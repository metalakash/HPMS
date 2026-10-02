"""Scheduled loan exposure sync: due-time logic, executor, async service, in-process ingestion (no database)."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

from backend.app.models.financial import LoanAccount, LoanAccountRateHistory, LoanExposureSyncSchedule
from backend.app.services import background_sync_executor as bse
from backend.app.services.background_sync_executor import (
    BackgroundSyncExecutor, SourceError, is_due, latest_occurrence,
)
from backend.app.services.loan_exposure_ingest import coerce_items, ingest_loan_exposures
from backend.app.services.loan_sync_scheduler_service import LoanSyncSchedulerService

NOW = datetime(2026, 10, 2, 14, 30)  # a Friday (weekday 4)


# ------------------------------------------------------------------ latest occurrence

@pytest.mark.parametrize("freq,at,dow,expected", [
    ("hourly", None, None, datetime(2026, 10, 2, 14, 0)),
    ("daily", "02:00", None, datetime(2026, 10, 2, 2, 0)),
    ("daily", "18:00", None, datetime(2026, 10, 1, 18, 0)),        # today's slot has not happened yet
    ("weekly", "06:00", 4, datetime(2026, 10, 2, 6, 0)),           # Friday 06:00 already passed today
    ("weekly", "18:00", 4, datetime(2026, 9, 25, 18, 0)),          # Friday 18:00 not yet: last week's
    ("weekly", "06:00", 0, datetime(2026, 9, 28, 6, 0)),           # Monday
    ("weekly", "06:00", 6, datetime(2026, 9, 27, 6, 0)),           # Sunday
])
def test_latest_occurrence(freq, at, dow, expected):
    assert latest_occurrence(freq, at, dow, NOW) == expected


@pytest.mark.parametrize("freq,at,dow", [
    ("manual", "02:00", None), ("daily", None, None), ("daily", "25:00", None), ("daily", "2am", None),
    ("weekly", "06:00", None), ("weekly", "06:00", 9), ("fortnightly", "06:00", 1),
])
def test_unusable_schedules_never_fire(freq, at, dow):
    assert latest_occurrence(freq, at, dow, NOW) is None


def schedule(**over):
    base = dict(id=uuid.uuid4(), name="Nightly", frequency="daily", scheduled_time_utc="02:00", day_of_week=None,
                sync_source="BANK_API", source_config={"webhook_url": "https://bank.example/loans"}, is_active="Y",
                last_sync_at=None, last_sync_status=None, created_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
                alert_email_addresses=None, alert_on_dscr_below=None, alert_on_ltv_above=None,
                alert_on_concentration_above=None)
    base.update(over)
    return SimpleNamespace(**base)


def test_due_after_a_missed_occurrence_and_only_once():
    s = schedule(last_sync_at=datetime(2026, 10, 1, 2, 0).isoformat())
    assert is_due(s, NOW)                                   # 02:00 today has passed since yesterday's run
    s.last_sync_at = datetime(2026, 10, 2, 14, 29).isoformat()
    assert not is_due(s, NOW)                               # claimed a minute ago: not due again


def test_new_schedule_waits_for_its_next_occurrence():
    s = schedule(created_at=datetime(2026, 10, 2, 9, 0, tzinfo=timezone.utc))   # created after today's 02:00 slot
    assert not is_due(s, NOW)
    assert is_due(s, datetime(2026, 10, 3, 2, 1))


def test_inactive_and_manual_schedules_are_not_due():
    assert not is_due(schedule(is_active="N"), NOW)
    assert not is_due(schedule(frequency="manual"), NOW)


def test_aware_and_naive_timestamps_compare():
    s = schedule(created_at=datetime(2026, 10, 2, 1, 0, tzinfo=timezone.utc), last_sync_at="2026-10-01T02:00:00")
    assert is_due(s, NOW)


# ------------------------------------------------------------------ scripted session + stubs

class Rows:
    def __init__(self, items=(), one=None):
        self.items, self.one = list(items), one

    def scalars(self):
        return SimpleNamespace(all=lambda: self.items)

    def scalar_one_or_none(self):
        return self.one if self.one is not None else (self.items[0] if self.items else None)

    def scalar(self):
        return self.one

    def all(self):
        return self.items


class DB:
    def __init__(self, *results):
        self.results, self.added, self.commits, self.rollbacks = list(results), [], 0, 0

    async def execute(self, stmt, params=None):
        return self.results.pop(0) if self.results else Rows()

    def add(self, o):
        self.added.append(o)

    async def flush(self):
        pass

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def refresh(self, o):
        pass


class Factory:
    """session_factory(): an async context manager yielding the next scripted DB."""

    def __init__(self, *dbs):
        self.dbs = list(dbs)

    def __call__(self):
        db = self.dbs.pop(0)

        class Ctx:
            async def __aenter__(self_inner):
                return db

            async def __aexit__(self_inner, *a):
                return False
        return Ctx()


PID = str(uuid.uuid4())
RECORD = {"project_id": PID, "facility_type": "Construction Term Loan", "sanctioned_amount": 1000,
          "outstanding_principal": 500, "interest_rate_pct": 11.5, "tenor_years": 15, "grace_years": 3,
          "sanction_date": "2023-01-15", "disbursement_date": "2023-02-01", "maturity_date": "2038-02-01"}


@pytest.fixture
def recorded(monkeypatch):
    """Capture log_sync_result calls and stub policy checks."""
    calls = []

    async def log(db, sid, status, total, created, updated, skipped, **kw):
        calls.append(SimpleNamespace(status=status, total=total, created=created, updated=updated, skipped=skipped,
                                     **kw))
        return "hist"

    async def no_alerts(db, sid):
        return []

    monkeypatch.setattr(LoanSyncSchedulerService, "log_sync_result", staticmethod(log))
    monkeypatch.setattr(LoanSyncSchedulerService, "check_policy_violations", staticmethod(no_alerts))
    return calls


# ------------------------------------------------------------------ run_due

async def test_run_due_claims_then_runs_only_due_schedules(monkeypatch, recorded):
    due, not_due = schedule(), schedule(is_active="Y", last_sync_at="2026-10-02T14:29:00")
    ran = []

    async def fake_run(self, db, sched, started=None):
        ran.append(sched)
        return "success"

    monkeypatch.setattr(BackgroundSyncExecutor, "run_schedule", fake_run)
    claim_db = DB(Rows(one=due))
    ex = BackgroundSyncExecutor(Factory(DB(Rows([due, not_due])), claim_db))
    assert await ex.run_due(NOW) == 1
    assert ran == [due]
    assert due.last_sync_status == "running" and due.last_sync_at == NOW.isoformat()
    assert claim_db.commits == 1   # the claim is committed before the run starts


async def test_run_due_skips_a_schedule_another_worker_holds(monkeypatch):
    async def never(self, *a, **k):
        raise AssertionError("must not run")

    monkeypatch.setattr(BackgroundSyncExecutor, "run_schedule", never)
    # SKIP LOCKED returns no row when someone else has it
    ex = BackgroundSyncExecutor(Factory(DB(Rows([schedule()])), DB(Rows())))
    assert await ex.run_due(NOW) == 0


async def test_one_crashing_schedule_does_not_stop_the_others(monkeypatch):
    a, b = schedule(name="A"), schedule(name="B")
    ran = []

    async def fake_run(self, db, sched, started=None):
        ran.append(sched.name)
        if sched.name == "A":
            raise RuntimeError("boom")
        return "success"

    monkeypatch.setattr(BackgroundSyncExecutor, "run_schedule", fake_run)
    ex = BackgroundSyncExecutor(Factory(DB(Rows([a, b])), DB(Rows(one=a)), DB(Rows(one=b))))
    assert await ex.run_due(NOW) == 2 and ran == ["A", "B"]


# ------------------------------------------------------------------ run_schedule

def executor_with(monkeypatch, fetch):
    async def f(self, sched):
        if isinstance(fetch, Exception):
            raise fetch
        return fetch

    monkeypatch.setattr(BackgroundSyncExecutor, "fetch", f)
    return BackgroundSyncExecutor(Factory())


async def test_source_error_is_recorded_as_failed_with_its_message(monkeypatch, recorded):
    ex = executor_with(monkeypatch, SourceError("Bank API call failed: ConnectError"))
    assert await ex.run_schedule(DB(), schedule()) == "failed"
    assert recorded[0].status == "failed" and "ConnectError" in recorded[0].error_message


async def test_empty_response_is_a_failure_not_a_silent_success(monkeypatch, recorded):
    assert await executor_with(monkeypatch, []).run_schedule(DB(), schedule()) == "failed"
    assert "no loan accounts" in recorded[0].error_message


async def test_successful_run_ingests_in_process_and_logs_counts(monkeypatch, recorded):
    ex = executor_with(monkeypatch, [RECORD])
    project = SimpleNamespace(id=uuid.UUID(PID))
    # project lookup, existing-loan lookup, advisory lock, last hash, checkpoint
    db = DB(Rows(one=project), Rows(), Rows(), Rows(one="a" * 64), Rows())
    assert await ex.run_schedule(db, schedule()) == "success"
    created = [o for o in db.added if isinstance(o, LoanAccount)]
    assert len(created) == 1 and created[0].data_provenance == "BANK_API"
    assert any(isinstance(o, LoanAccountRateHistory) for o in db.added)
    assert (recorded[0].created, recorded[0].updated, recorded[0].skipped) == (1, 0, 0)
    audit = next(o for o in db.added if hasattr(o, "state_hash"))
    assert audit.entity_type == "LOAN_EXPOSURE_SYNC" and audit.user_id == "scheduler" and db.commits == 1


async def test_partial_and_total_failure_statuses(monkeypatch, recorded):
    bad = {"project_id": PID}  # missing required fields
    ex = executor_with(monkeypatch, [RECORD, bad])
    db = DB(Rows(one=SimpleNamespace(id=uuid.UUID(PID))), Rows(), Rows(), Rows(one="a" * 64), Rows())
    assert await ex.run_schedule(db, schedule()) == "partial_success"
    assert recorded[0].total == 2 and recorded[0].skipped == 1 and "Record 2" in recorded[0].error_message

    recorded.clear()
    ex = executor_with(monkeypatch, [bad])
    assert await ex.run_schedule(DB(Rows(), Rows(one="a" * 64), Rows()), schedule()) == "failed"


async def test_alerts_are_emailed_when_addresses_are_configured(monkeypatch, recorded):
    sent = []

    async def with_alerts(db, sid):
        return ["alert"]

    monkeypatch.setattr(LoanSyncSchedulerService, "check_policy_violations", staticmethod(with_alerts))

    class Mail:
        async def send_loan_sync_alerts(self, schedule_name, alerts, recipients):
            sent.append((schedule_name, alerts, recipients))

    ex = executor_with(monkeypatch, [RECORD])
    ex.email_service = Mail()
    db = DB(Rows(one=SimpleNamespace(id=uuid.UUID(PID))), Rows(), Rows(), Rows(one="a" * 64), Rows())
    await ex.run_schedule(db, schedule(alert_email_addresses="risk@sbl.example, cfo@sbl.example"))
    assert sent == [("Nightly", ["alert"], ["risk@sbl.example", "cfo@sbl.example"])]


# ------------------------------------------------------------------ sources

async def test_unusable_sources_raise_clear_errors():
    ex = BackgroundSyncExecutor(Factory())
    for src, text in (("FINACLE_CBS", "not implemented"), ("CSV_UPLOAD", "nothing to fetch"), ("ODBC", "Unknown")):
        with pytest.raises(SourceError, match=text):
            await ex.fetch(schedule(sync_source=src))
    with pytest.raises(SourceError, match="webhook_url is not set"):
        await ex.fetch(schedule(source_config={}))
    with pytest.raises(SourceError, match="http"):
        await ex.fetch(schedule(source_config={"webhook_url": "file:///etc/passwd"}))


async def test_bank_api_response_shapes(monkeypatch):
    import httpx

    real = httpx.AsyncClient

    def client_for(payload, status=200):
        transport = httpx.MockTransport(lambda req: httpx.Response(status, json=payload))
        monkeypatch.setattr(bse.httpx, "AsyncClient", lambda **kw: real(transport=transport))

    ex = BackgroundSyncExecutor(Factory())
    client_for({"loan_accounts": [RECORD]})
    assert await ex.fetch(schedule()) == [RECORD]
    client_for([RECORD])
    assert await ex.fetch(schedule()) == [RECORD]
    client_for({"unexpected": 1})
    with pytest.raises(SourceError, match="Unexpected"):
        await ex.fetch(schedule())
    client_for({}, status=500)
    with pytest.raises(SourceError, match="Bank API call failed"):
        await ex.fetch(schedule())


# ------------------------------------------------------------------ ingestion

def test_coerce_items_reports_bad_records_by_position():
    items, errors = coerce_items([RECORD, {"project_id": PID}, "not a dict"])
    assert len(items) == 1 and len(errors) == 2 and errors[0].startswith("Record 2")


async def test_ingest_updates_an_existing_loan():
    items, _ = coerce_items([{**RECORD, "outstanding_principal": 400}])
    loan = SimpleNamespace(sanctioned_amount=0, disbursed_amount=0, outstanding_principal=999)
    db = DB(Rows(one=SimpleNamespace(id=uuid.UUID(PID))), Rows(one=loan), Rows(), Rows(one="a" * 64), Rows())
    out = await ingest_loan_exposures(db, items, "BANK_API", "ref", actor="admin")
    assert (out["created_count"], out["updated_count"], out["skipped_count"]) == (0, 1, 0)
    assert loan.outstanding_principal == 400 and loan.sync_status == "success" and db.commits == 1


async def test_ingest_skips_unknown_projects_and_commit_failure_rolls_back():
    items, _ = coerce_items([RECORD])
    out = await ingest_loan_exposures(DB(Rows()), items, "BANK_API", "ref", actor="admin")  # project not found
    assert out["skipped_count"] == 1 and any("not found" in e for e in out["errors"])

    class Failing(DB):
        async def commit(self):
            raise RuntimeError("disk full")

    db = Failing(Rows(one=SimpleNamespace(id=uuid.UUID(PID))), Rows(), Rows(), Rows(one="a" * 64), Rows())
    out = await ingest_loan_exposures(db, items, "BANK_API", "ref", actor="admin")
    assert out["created_count"] == 0 and out["skipped_count"] == 1 and db.rollbacks == 1
    assert any("commit failed" in e for e in out["errors"])


# ------------------------------------------------------------------ async schedule service

async def test_service_methods_are_coroutines_and_create_returns_server_values():
    import inspect
    for name in ("create_schedule", "list_schedules", "get_schedule", "update_schedule", "toggle_schedule",
                 "log_sync_result", "check_policy_violations"):
        assert inspect.iscoroutinefunction(getattr(LoanSyncSchedulerService, name)), name

    from backend.app.schemas.loan import LoanExposureSyncScheduleRequest
    req = LoanExposureSyncScheduleRequest(name="Nightly", frequency="daily", scheduled_time_utc="02:00",
                                          sync_source="BANK_API", source_config={"webhook_url": "https://b/x"})

    class RefreshingDB(DB):
        async def refresh(self, o):
            o.created_at = o.updated_at = datetime(2026, 10, 2, tzinfo=timezone.utc)

    resp = await LoanSyncSchedulerService.create_schedule(RefreshingDB(), req, "admin")
    assert resp.name == "Nightly" and resp.created_at.startswith("2026-10-02")


async def test_log_sync_result_stores_json_serialisable_alerts():
    import json
    from backend.app.schemas.loan import LoanExposureSyncAlertResponse
    sched = schedule(id=uuid.uuid4())
    sched.last_sync_record_count = 0
    sched.last_sync_error = None
    alert = LoanExposureSyncAlertResponse(
        alert_type="dscr_violation", severity="high", project_id=PID, project_code="P1",
        current_value=Decimal("0.9"), threshold_value=Decimal("1.2"), message="m", timestamp="t")
    db = DB(Rows(one=sched))
    await LoanSyncSchedulerService.log_sync_result(db, str(sched.id), "success", 1, 1, 0, 0, alerts=[alert],
                                                   started_at="2026-10-02T02:00:00")
    history = next(o for o in db.added if hasattr(o, "alerts_triggered"))
    json.dumps(history.alerts_triggered)   # a Decimal would make the JSONB insert fail
    assert history.started_at == "2026-10-02T02:00:00" and sched.last_sync_status == "success"


# ------------------------------------------------------------------ wiring

def test_app_starts_the_asyncio_loop_not_apscheduler():
    import inspect
    from backend.app import main
    src = inspect.getsource(main.startup_event)
    assert "sync_loop" in src and "apscheduler" not in src.lower()
    assert not hasattr(main, "SessionLocal")
    from backend.app import database
    assert not hasattr(database, "SessionLocal")  # the import the old executor depended on never existed


# ------------------------------------------------------------------ routes

async def test_schedule_and_exposure_routes_await_the_async_service(monkeypatch):
    from httpx import ASGITransport, AsyncClient
    from backend.app.database import get_db
    from backend.app.main import app
    from backend.app.security.auth_middleware import CurrentUser, get_current_user
    from backend.app.api import routes_loans

    seen = {}

    async def fake_list(db, is_active=None, sync_source=None):
        seen["list"] = (is_active, sync_source)
        return []

    async def fake_ingest(db, items, source, ref, actor, actor_role=None, **kw):
        seen["ingest"] = (len(items), source, actor)
        return {"sync_id": "s1", "total_records": len(items), "created_count": len(items), "updated_count": 0,
                "skipped_count": 0, "errors": [], "warnings": [], "audit_log_id": "7",
                "timestamp": "2026-10-02T00:00:00"}

    async def fake_db():
        yield SimpleNamespace()

    monkeypatch.setattr(routes_loans.LoanSyncSchedulerService, "list_schedules", staticmethod(fake_list))
    monkeypatch.setattr(routes_loans, "ingest_loan_exposures", fake_ingest)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        {"sub": str(uuid.uuid4()), "username": "root", "roles": ["admin"], "is_authenticated": True})
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as c:
            r = await c.get("/api/v1/loan-accounts/sync-schedule?is_active=Y")
            assert r.status_code == 200, r.text
            assert seen["list"] == ("Y", None)
            body = {"sync_source": "CSV", "source_reference": "f.csv", "loan_accounts": [{
                **RECORD, "sanction_date": "2023-01-15", "disbursement_date": "2023-02-01",
                "maturity_date": "2038-02-01"}]}
            r = await c.post("/api/v1/loan-accounts/exposure-sync", json=body)
            assert r.status_code == 202, r.text
            assert r.json()["data"]["created_count"] == 1 and seen["ingest"] == (1, "CSV", "root")
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("patch,problem", [
    ({"frequency": "yearly"}, "frequency"),
    ({"sync_source": "FAX"}, "sync_source"),
    ({"scheduled_time_utc": None}, "HH:MM"),
    ({"scheduled_time_utc": "2am"}, "HH:MM"),
    ({"scheduled_time_utc": "25:00"}, "HH:MM"),
    ({"frequency": "weekly"}, "day_of_week"),
    ({"frequency": "weekly", "day_of_week": 7}, "day_of_week"),
])
def test_unrunnable_schedules_are_rejected_at_creation(patch, problem):
    from pydantic import ValidationError
    from backend.app.schemas.loan import LoanExposureSyncScheduleRequest
    base = dict(name="N", frequency="daily", scheduled_time_utc="02:00", sync_source="BANK_API")
    with pytest.raises(ValidationError, match=problem):
        LoanExposureSyncScheduleRequest(**{**base, **patch})


def test_valid_schedules_are_accepted_including_json_style_numbers():
    from backend.app.schemas.loan import LoanExposureSyncScheduleRequest as R
    assert R(name="N", frequency="manual", sync_source="CSV_UPLOAD").frequency == "manual"
    assert R(name="N", frequency="hourly", sync_source="BANK_API").scheduled_time_utc is None
    r = R(name="N", frequency="weekly", scheduled_time_utc="06:30", day_of_week=0, sync_source="BANK_API",
          alert_on_dscr_below=1.2, alert_on_ltv_above="75")
    assert r.alert_on_dscr_below == Decimal("1.2") and r.alert_on_ltv_above == Decimal("75")
