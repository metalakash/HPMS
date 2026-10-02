"""Phase 11.3: regulatory filing calendar, reminders, stakeholder routing (no database required)."""

import uuid
from datetime import date
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database import get_db
from backend.app.main import app
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.services import regulatory_service as reg
from backend.app.services.email_service import EmailService, MockEmailProvider
from backend.app.services.filing_calendar import fiscal_year_of, period_ends


# ------------------------------------------------------------------ BS fiscal periods

def test_quarter_ends_follow_nepali_fiscal_year():
    ps = period_ends("quarterly", date(2025, 7, 1), date(2026, 7, 31))
    assert [p.label for p in ps] == [
        "FY 2081/82 Q4", "FY 2082/83 Q1", "FY 2082/83 Q2", "FY 2082/83 Q3", "FY 2082/83 Q4"]
    # Ashwin end 2082 is 31 days -> 2082-06-31 = 17 Oct 2025; FY ends on the last day of Ashadh (mid-July)
    assert ps[1].end_ad == date(2025, 10, 17) and ps[1].end_bs == "2082-06-31"
    assert ps[-1].end_ad == date(2026, 7, 16) and ps[-1].end_bs.startswith("2083-03-")


def test_other_frequencies():
    assert [p.label for p in period_ends("annual", date(2025, 7, 1), date(2026, 7, 31))] == [
        "FY 2081/82", "FY 2082/83"]
    assert [p.label for p in period_ends("semi_annual", date(2025, 7, 1), date(2026, 7, 31))] == [
        "FY 2081/82 H2", "FY 2082/83 H1", "FY 2082/83 H2"]
    assert len(period_ends("monthly", date(2025, 7, 17), date(2026, 7, 16))) == 12


def test_range_is_inclusive_and_empty_when_no_period_ends_inside():
    assert period_ends("annual", date(2025, 7, 16), date(2025, 7, 16))[0].end_ad == date(2025, 7, 16)
    assert period_ends("annual", date(2025, 8, 1), date(2026, 6, 30)) == []


def test_bad_inputs_rejected():
    with pytest.raises(ValueError, match="frequency"):
        period_ends("weekly", date(2025, 1, 1), date(2026, 1, 1))
    with pytest.raises(ValueError, match="before"):
        period_ends("annual", date(2026, 1, 1), date(2025, 1, 1))


def test_fiscal_year_boundaries():
    assert fiscal_year_of(2083, 3) == 2082 and fiscal_year_of(2083, 4) == 2083 and fiscal_year_of(2082, 12) == 2082


# ------------------------------------------------------------------ pure service logic

@pytest.mark.parametrize("days,urgency", [(-1, "expired"), (0, "critical"), (7, "critical"), (8, "warning"),
                                          (30, "warning"), (31, "ok")])
def test_filing_urgency_bands(days, urgency):
    assert reg.filing_urgency(days) == urgency


def _contact(**over):
    base = dict(is_active=True, project_id=None, alert_types=None, min_urgency="critical", email="a@x.com")
    base.update(over)
    return SimpleNamespace(**base)


def _alert(entity_type="PERMIT", urgency="critical", days=5):
    return {"entity_type": entity_type, "urgency": urgency, "days_remaining": days, "description": "d"}


def test_contact_wants_respects_urgency_type_project_and_active():
    pid = uuid.uuid4()
    assert reg.contact_wants(_contact(), pid, _alert())
    assert reg.contact_wants(_contact(), pid, _alert(urgency="expired"))
    assert not reg.contact_wants(_contact(), pid, _alert(urgency="warning"))
    assert reg.contact_wants(_contact(min_urgency="warning"), pid, _alert(urgency="warning"))
    assert not reg.contact_wants(_contact(alert_types=["FILING"]), pid, _alert("PERMIT"))
    assert reg.contact_wants(_contact(alert_types=["FILING"]), pid, _alert("FILING"))
    assert not reg.contact_wants(_contact(is_active=False), pid, _alert())
    assert reg.contact_wants(_contact(project_id=pid), pid, _alert())
    assert not reg.contact_wants(_contact(project_id=uuid.uuid4()), pid, _alert())


def test_pinned_contact_does_not_get_portfolio_alerts():
    pinned, everyone = _contact(project_id=uuid.uuid4(), email="p@x.com"), _contact(email="e@x.com")
    rows = [(None, "PORTFOLIO", "Regulatory filings", [_alert("FILING", "expired", -3)])]
    assert reg.route_alerts([pinned, everyone], rows) == {
        "e@x.com": ["[PORTFOLIO] Regulatory filings: d (expired, -3 days)"]}


def test_route_alerts_groups_lines_per_email():
    p1, p2 = uuid.uuid4(), uuid.uuid4()
    rows = [(p1, "P1", "Alpha", [_alert()]), (p2, "P2", "Beta", [_alert(), _alert(urgency="warning")])]
    out = reg.route_alerts([_contact()], rows)
    assert len(out["a@x.com"]) == 2  # warning filtered out for a critical-only contact


def test_filing_alert_wording():
    entry = SimpleNamespace(id=uuid.uuid4(), due_date_ad=date(2026, 10, 1), period_label="FY 2082/83 Q1")
    req = SimpleNamespace(authority="NRB", title="Quarterly return")
    late = reg.filing_alert(entry, req, date(2026, 10, 4))
    assert late["urgency"] == "expired" and late["days_remaining"] == -3 and "overdue" in late["description"]
    assert reg.filing_alert(entry, req, date(2026, 9, 25))["description"].endswith("due")


# ------------------------------------------------------------------ DB-less service tests

class Result:
    def __init__(self, items=(), rowcount=0):
        self.items, self.rowcount = list(items), rowcount

    def all(self):
        return self.items

    def first(self):
        return self.items[0] if self.items else None

    def scalars(self):
        return SimpleNamespace(all=lambda: self.items)

    def scalar_one_or_none(self):
        return self.items[0] if self.items else None


class ScriptedDB:
    """Returns queued results in order; records adds."""

    def __init__(self, *results):
        self.results, self.added = list(results), []

    async def execute(self, stmt):
        return self.results.pop(0) if self.results else Result()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def delete(self, obj):
        self.deleted = obj


def _requirement(**over):
    base = dict(id=uuid.uuid4(), frequency="quarterly", lag_days=15, applies_to="portfolio",
                code="X", title="Return", authority="NRB", is_active=True)
    base.update(over)
    return SimpleNamespace(**base)


async def test_generate_filings_creates_rows_with_due_dates_and_bs():
    db = ScriptedDB(Result())  # nothing exists yet
    n = await reg.generate_filings(db, _requirement(), date(2025, 7, 1), date(2026, 7, 31), created_by="admin")
    assert n == 5 and len(db.added) == 5
    q1 = next(e for e in db.added if e.period_label == "FY 2082/83 Q1")
    assert q1.project_id is None and q1.due_date_ad == date(2025, 11, 1)  # period end + 15 days
    assert q1.due_date_bs == "2082-07-15" and q1.period_end_bs == "2082-06-31"


async def test_generate_filings_is_idempotent():
    existing = [SimpleNamespace(project_id=None, period_end_ad=date(2025, 10, 17))]
    db = ScriptedDB(Result(existing))
    assert await reg.generate_filings(db, _requirement(), date(2025, 7, 1), date(2026, 7, 31)) == 4


async def test_generate_filings_one_row_per_project_for_project_requirements():
    p1, p2 = uuid.uuid4(), uuid.uuid4()
    db = ScriptedDB(Result())
    n = await reg.generate_filings(db, _requirement(applies_to="project", frequency="annual"),
                                   date(2025, 7, 1), date(2025, 7, 31), project_ids=[p1, p2])
    assert n == 2 and {e.project_id for e in db.added} == {p1, p2}


async def test_generate_filings_no_period_in_range_creates_nothing():
    db = ScriptedDB()
    assert await reg.generate_filings(db, _requirement(frequency="annual"), date(2025, 8, 1), date(2026, 6, 1)) == 0


class Capturing(MockEmailProvider):
    def __init__(self):
        self.sent = []

    async def send(self, message):
        self.sent.append(message)
        return True


async def test_send_due_reminders_emails_owner_and_marks_sent():
    due = SimpleNamespace(id=uuid.uuid4(), owner_username="maker", title="Chase NEA", note="PPA draft",
                          remind_on_ad=date(2026, 10, 1), remind_on_bs="2083-06-14", status="active", sent_at=None)
    ghost = SimpleNamespace(id=uuid.uuid4(), owner_username="nobody", title="x", note=None,
                            remind_on_ad=date(2026, 10, 1), remind_on_bs=None, status="active", sent_at=None)
    user = SimpleNamespace(email="maker@sbl.local")
    # due_reminders query, then user lookup for each reminder
    db = ScriptedDB(Result([due, ghost]), Result([user]), Result([]))
    provider = Capturing()
    sent = await reg.send_due_reminders(db, EmailService(provider), date(2026, 10, 2))
    assert sent == 1 and due.status == "sent" and due.sent_at == date(2026, 10, 2)
    assert ghost.status == "active"  # no address: stays active, retried next scan
    msg = provider.sent[0]
    assert msg.to == ["maker@sbl.local"] and "Chase NEA" in msg.subject and "2083-06-14 BS" in msg.body_text


# ------------------------------------------------------------------ routes

def _user(role="admin", name="tester"):
    return CurrentUser({"sub": str(uuid.uuid4()), "username": name, "roles": [role], "is_authenticated": True})


@pytest.fixture
async def api():
    holder = SimpleNamespace(db=ScriptedDB())

    async def fake_db():
        yield holder.db

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: _user()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        client.holder = holder
        yield client
    app.dependency_overrides.clear()


REQ = {"code": "NRB-Q", "title": "Quarterly return", "authority": "NRB", "frequency": "quarterly", "lag_days": 15}


@pytest.mark.parametrize("patch", [
    {"authority": "WHO"}, {"frequency": "weekly"}, {"lag_days": -1}, {"lag_days": 400}, {"code": ""},
    {"applies_to": "everything"},
])
async def test_requirement_validation(api, patch):
    assert (await api.post("/api/v1/regulatory/requirements", json={**REQ, **patch})).status_code == 422


async def test_requirement_create_ok_and_admin_only(api):
    r = await api.post("/api/v1/regulatory/requirements", json=REQ)
    assert r.status_code == 201 and r.json()["code"] == "NRB-Q"
    app.dependency_overrides[get_current_user] = lambda: _user("auditor")
    assert (await api.post("/api/v1/regulatory/requirements", json=REQ)).status_code == 403
    assert (await api.get("/api/v1/regulatory/requirements")).status_code == 200  # auditors may read


async def test_generate_rejects_reversed_range_and_unknown_requirement(api):
    rid = uuid.uuid4()
    api.holder.db = ScriptedDB(Result([_requirement(id=rid)]))
    r = await api.post(f"/api/v1/regulatory/requirements/{rid}/generate",
                       json={"from_date": "2026-01-01", "to_date": "2025-01-01"})
    assert r.status_code == 422
    api.holder.db = ScriptedDB(Result([]))
    assert (await api.post(f"/api/v1/regulatory/requirements/{rid}/generate",
                           json={"from_date": "2025-01-01", "to_date": "2026-01-01"})).status_code == 404
    assert (await api.patch("/api/v1/regulatory/requirements/nope", json={})).status_code == 404


def _entry(**over):
    base = dict(id=uuid.uuid4(), requirement_id=uuid.uuid4(), project_id=None, period_label="FY 2082/83 Q1",
                period_end_ad=date(2025, 10, 17), period_end_bs="2082-06-31", due_date_ad=date(2025, 11, 1),
                due_date_bs="2082-07-15", status="pending", filed_date_ad=None, filed_date_bs=None,
                reference_no=None, assigned_to=None, remarks=None, updated_by=None)
    base.update(over)
    return SimpleNamespace(**base)


async def test_mark_filed_needs_reference_and_sets_dual_dates(api):
    entry, req = _entry(), _requirement()
    api.holder.db = ScriptedDB(Result([(entry, req)]))
    r = await api.patch(f"/api/v1/regulatory/calendar/{entry.id}", json={"status": "filed"})
    assert r.status_code == 422 and "reference_no" in r.json()["detail"]

    api.holder.db = ScriptedDB(Result([(entry, req)]))
    r = await api.patch(f"/api/v1/regulatory/calendar/{entry.id}",
                        json={"status": "filed", "reference_no": "NRB/2082/001", "filed_date_ad": "2025-10-30"})
    body = r.json()
    assert r.status_code == 200 and body["status"] == "filed"
    assert body["filed_date_ad"] == "2025-10-30" and body["filed_date_bs"] == "2082-07-13"
    assert entry.updated_by == "tester"


async def test_filed_date_cannot_be_in_the_future(api):
    entry, req = _entry(), _requirement()
    api.holder.db = ScriptedDB(Result([(entry, req)]))
    r = await api.patch(f"/api/v1/regulatory/calendar/{entry.id}",
                        json={"status": "filed", "reference_no": "R", "filed_date_ad": "2999-01-01"})
    assert r.status_code == 422


async def test_reopening_clears_filing_record(api):
    entry = _entry(status="filed", reference_no="R1", filed_date_ad=date(2025, 10, 30), filed_date_bs="x")
    api.holder.db = ScriptedDB(Result([(entry, _requirement())]))
    r = await api.patch(f"/api/v1/regulatory/calendar/{entry.id}", json={"status": "pending"})
    assert r.status_code == 200 and entry.filed_date_ad is None and entry.filed_date_bs is None


async def test_filing_update_needs_filer_role(api):
    app.dependency_overrides[get_current_user] = lambda: _user("auditor")
    assert (await api.patch(f"/api/v1/regulatory/calendar/{uuid.uuid4()}", json={"remarks": "x"})).status_code == 403
    assert (await api.get("/api/v1/regulatory/calendar")).status_code == 200


async def test_calendar_rejects_bad_filters(api):
    assert (await api.get("/api/v1/regulatory/calendar?status=lost")).status_code == 422
    assert (await api.get("/api/v1/regulatory/calendar?authority=WHO")).status_code == 422


async def test_reminder_create_fills_bs_and_validates(api):
    r = await api.post("/api/v1/reminders", json={"title": "Chase NEA", "remind_on_ad": "2026-04-14"})
    assert r.status_code == 201
    assert r.json()["remind_on_bs"] == "2083-01-01" and r.json()["status"] == "active"
    assert (await api.post("/api/v1/reminders", json={"title": "", "remind_on_ad": "2026-04-14"})).status_code == 422
    assert (await api.post("/api/v1/reminders", json={"title": "x"})).status_code == 422
    assert (await api.post("/api/v1/reminders", json={
        "title": "x", "remind_on_ad": "2026-04-14", "entity_type": "BANANA"})).status_code == 422


async def test_reminders_are_private_to_their_owner(api):
    api.holder.db = ScriptedDB(Result([]))  # ownership lookup finds nothing for this user
    assert (await api.patch(f"/api/v1/reminders/{uuid.uuid4()}", json={"title": "x"})).status_code == 404
    api.holder.db = ScriptedDB(Result([]))
    assert (await api.delete(f"/api/v1/reminders/{uuid.uuid4()}")).status_code == 404


async def test_rescheduling_a_sent_reminder_rearms_it(api):
    rem = SimpleNamespace(id=uuid.uuid4(), title="t", note=None, remind_on_ad=date(2026, 1, 1), remind_on_bs="x",
                          project_id=None, entity_type=None, entity_id=None, status="sent",
                          sent_at=date(2026, 1, 1), updated_by=None)
    api.holder.db = ScriptedDB(Result([rem]))
    r = await api.patch(f"/api/v1/reminders/{rem.id}", json={"remind_on_ad": "2026-04-14"})
    assert r.status_code == 200 and rem.status == "active" and rem.sent_at is None
    assert rem.remind_on_bs == "2083-01-01"


@pytest.mark.parametrize("patch", [
    {"email": "nope"}, {"alert_types": ["BANANA"]}, {"alert_types": []}, {"min_urgency": "low"}, {"name": ""},
])
async def test_stakeholder_validation(api, patch):
    body = {"name": "NEA Contact", "email": "a@nea.org.np", **patch}
    assert (await api.post("/api/v1/stakeholders", json=body)).status_code == 422


async def test_stakeholder_create_and_admin_only(api):
    ok = {"name": "NEA Contact", "email": "a@nea.org.np", "alert_types": ["PPA", "FILING"]}
    assert (await api.post("/api/v1/stakeholders", json=ok)).status_code == 201
    app.dependency_overrides[get_current_user] = lambda: _user("maker")
    assert (await api.post("/api/v1/stakeholders", json=ok)).status_code == 403
    assert (await api.get("/api/v1/stakeholders")).status_code == 403


def test_routes_registered():
    paths = app.openapi()["paths"]
    for p in ("/api/v1/regulatory/requirements", "/api/v1/regulatory/calendar", "/api/v1/reminders",
              "/api/v1/stakeholders", "/api/v1/projects/{project_id}/filings",
              "/api/v1/regulatory/requirements/{requirement_id}/generate"):
        assert p in paths, p


async def test_dispatch_stakeholder_alerts_sends_one_email_per_contact():
    from backend.app.services.alert_daemon import dispatch_stakeholder_alerts
    pid = uuid.uuid4()
    contacts = [_contact(email="nea@x.com"), _contact(email="quiet@x.com", min_urgency="critical",
                                                      alert_types=["FILING"])]
    rows = [(pid, "P1", "Alpha", [_alert("PPA", "critical", 5)])]
    provider = Capturing()
    sent = await dispatch_stakeholder_alerts(ScriptedDB(Result(contacts)), EmailService(provider), rows,
                                             date(2026, 10, 2))
    assert sent == 1 and provider.sent[0].to == ["nea@x.com"] and "[P1] Alpha" in provider.sent[0].body_text
