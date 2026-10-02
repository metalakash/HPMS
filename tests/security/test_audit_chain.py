"""Phase 11.4: hash-chained audit log, verification, retention (no database required)."""

import uuid
from datetime import date
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database import get_db
from backend.app.main import app
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.services import audit_chain as ac


def _row(i, prev, **over):
    h = ac.compute_hash(prev, user_id="u", entity_type="E", entity_id=str(i), action="update", reason="r",
                        pre_state=None, post_state=None, timestamp=f"2026-01-0{i}")
    return SimpleNamespace(id=i, prev_hash=prev, state_hash=over.pop("state_hash", h), **over)


def _chain(n=4, start=ac.GENESIS):
    rows, prev = [], start
    for i in range(1, n + 1):
        rows.append(_row(i, prev))
        prev = rows[-1].state_hash
    return rows


# ------------------------------------------------------------------ hashing

def test_hash_covers_content_and_predecessor():
    base = dict(user_id="u", entity_type="E", entity_id="1", action="a", reason="r", pre_state="{}",
                post_state="{}", timestamp="t")
    h = ac.compute_hash("p" * 64, **base)
    assert len(h) == 64 and h == ac.compute_hash("p" * 64, **base)
    assert h != ac.compute_hash("q" * 64, **base)  # predecessor
    for field, value in (("reason", "other"), ("post_state", '{"x":1}'), ("user_id", "v"), ("timestamp", "t2")):
        assert h != ac.compute_hash("p" * 64, **{**base, field: value}), field


# ------------------------------------------------------------------ verification

def test_intact_chain_verifies():
    r = ac.verify_chain(_chain(), ac.GENESIS)
    assert r.ok and r.checked == 4


def test_deleted_row_breaks_the_chain():
    rows = _chain()
    del rows[1]
    r = ac.verify_chain(rows, ac.GENESIS)
    assert not r.ok and r.first_bad_id == 3


def test_reordered_or_inserted_rows_are_detected():
    rows = _chain()
    rows[1], rows[2] = rows[2], rows[1]
    assert ac.verify_chain(rows, ac.GENESIS).first_bad_id == 3
    forged = _chain()
    forged.insert(2, _row(99, "f" * 64))
    assert not ac.verify_chain(forged, ac.GENESIS).ok


def test_blank_hashes_from_legacy_rows_are_reported():
    rows = _chain(2)
    rows.append(SimpleNamespace(id=3, prev_hash=rows[-1].state_hash, state_hash=""))
    r = ac.verify_chain(rows, ac.GENESIS)
    assert not r.ok and r.first_bad_id == 3 and "state_hash" in r.problem


def test_first_row_anchor_is_checked_only_when_given():
    purged_tail = _chain()[2:]  # oldest two rows purged
    assert ac.verify_chain(purged_tail).ok  # trusted anchor
    assert not ac.verify_chain(purged_tail, ac.GENESIS).ok  # would be wrong after a purge
    assert ac.verify_chain(purged_tail, _chain()[1].state_hash).ok  # the retention checkpoint hash


# ------------------------------------------------------------------ retention cutoff

@pytest.mark.parametrize("today,years,cutoff", [
    (date(2026, 10, 2), 7, date(2019, 10, 2)),
    (date(2028, 2, 29), 1, date(2027, 2, 28)),  # leap day
    (date(2026, 1, 1), 10, date(2016, 1, 1)),
])
def test_retention_cutoff(today, years, cutoff):
    assert ac.retention_cutoff(today, years) == cutoff


@pytest.mark.parametrize("years", [0, -3])
def test_retention_must_be_at_least_one_year(years):
    with pytest.raises(ValueError):
        ac.retention_cutoff(date(2026, 1, 1), years)


# ------------------------------------------------------------------ append / retention with a scripted session

class Result:
    def __init__(self, scalar=None, one=None, rowcount=0, all_=()):
        self._scalar, self._one, self.rowcount, self._all = scalar, one, rowcount, list(all_)

    def scalar(self):
        return self._scalar

    def one(self):
        return self._one

    def all(self):
        return self._all


class ScriptedDB:
    def __init__(self, *results):
        self.results, self.added, self.statements = list(results), [], []

    async def execute(self, stmt, params=None):
        self.statements.append(str(stmt))
        return self.results.pop(0) if self.results else Result()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass


async def test_append_chains_onto_last_hash_and_serialises_writers():
    last = "a" * 64
    db = ScriptedDB(Result(), Result(scalar=last))  # advisory lock, last state_hash
    e = await ac.append_audit_log(db, user_id=uuid.uuid4(), user_role="maker", entity_type="PROJECT", entity_id=7,
                                  action="update", reason="fix typo in name", pre_state={"a": 1}, post_state={"a": 2})
    assert "pg_advisory_xact_lock" in db.statements[0]
    assert e.prev_hash == last and len(e.state_hash) == 64 and e.state_hash != last
    assert db.added == [e] and e.pre_state == '{"a": 1}'


async def test_append_starts_from_genesis_when_log_is_empty():
    db = ScriptedDB(Result(), Result(scalar=None), Result(scalar=None))  # lock, last row, checkpoint
    e = await ac.append_audit_log(db, user_id="u", user_role=None, entity_type="X", entity_id="1", action="create",
                                  reason="because")
    assert e.prev_hash == ac.GENESIS


async def test_append_after_a_full_purge_continues_from_the_checkpoint():
    db = ScriptedDB(Result(), Result(scalar=None), Result(scalar="c" * 64))
    e = await ac.append_audit_log(db, user_id="u", user_role=None, entity_type="X", entity_id="1", action="create",
                                  reason="because")
    assert e.prev_hash == "c" * 64


@pytest.mark.parametrize("reason", ["", "   ", None])
async def test_append_requires_a_reason(reason):
    with pytest.raises(ValueError, match="mandatory"):
        await ac.append_audit_log(ScriptedDB(), user_id="u", user_role=None, entity_type="X", entity_id="1",
                                  action="a", reason=reason)


async def test_preview_counts_only_the_oldest_prefix():
    db = ScriptedDB(Result(scalar=51), Result(one=(50, 1, 50)))  # first kept id, then count/min/max
    p = await ac.preview_retention(db, date(2026, 10, 2), 7)
    assert (p.eligible_rows, p.oldest_id, p.newest_eligible_id) == (50, 1, 50)
    assert p.cutoff == date(2019, 10, 2)


async def test_purge_deletes_prefix_and_records_checkpoint():
    from backend.app.models.audit import AuditRetentionCheckpoint
    db = ScriptedDB(Result(), Result(scalar=51), Result(one=(50, 1, 50)), Result(scalar="d" * 64),
                    Result(), Result(rowcount=50))
    n = await ac.purge_expired(db, date(2026, 10, 2), 7, "admin")
    assert n == 50
    assert any("hpms.audit_purge" in s for s in db.statements)  # trigger bypass is transaction-local
    cp = db.added[0]
    assert isinstance(cp, AuditRetentionCheckpoint)
    assert (cp.purged_through_id, cp.last_purged_hash, cp.purged_count, cp.purged_by) == (50, "d" * 64, 50, "admin")


async def test_purge_with_nothing_eligible_changes_nothing():
    db = ScriptedDB(Result(), Result(scalar=1), Result(one=(0, None, None)))
    assert await ac.purge_expired(db, date(2026, 10, 2), 7, "admin") == 0
    assert db.added == [] and not any("hpms.audit_purge" in s for s in db.statements)


# ------------------------------------------------------------------ admin routes

def _user(role):
    return CurrentUser({"sub": str(uuid.uuid4()), "username": "root", "roles": [role], "is_authenticated": True})


@pytest.fixture
async def api(monkeypatch):
    async def fake_db():
        yield SimpleNamespace()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: _user("admin")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as c:
        yield c
    app.dependency_overrides.clear()


async def test_audit_admin_routes_are_admin_only(api):
    app.dependency_overrides[get_current_user] = lambda: _user("auditor")
    for method, path in (("get", "/api/v1/admin/audit/verify"), ("get", "/api/v1/admin/audit/retention")):
        assert (await getattr(api, method)(path)).status_code == 403
    assert (await api.post("/api/v1/admin/audit/retention/purge", json={"confirm_cutoff_date": "2019-10-02"})
            ).status_code == 403


async def test_purge_is_disabled_by_default(api):
    from backend.app.config import settings
    assert settings.AUDIT_PURGE_ENABLED is False
    r = await api.post("/api/v1/admin/audit/retention/purge", json={"confirm_cutoff_date": "2019-10-02"})
    assert r.status_code == 403 and "disabled" in r.json()["detail"]


async def test_purge_requires_the_current_cutoff(api, monkeypatch):
    from backend.app.api import routes_audit_admin as r
    monkeypatch.setattr(r.settings, "AUDIT_PURGE_ENABLED", True)
    monkeypatch.setattr(r, "_today", lambda: date(2026, 10, 2))

    async def fake_preview(db, today, years):
        return ac.RetentionPreview(ac.retention_cutoff(today, years), years, 5, 1, 5)

    purged = []

    async def fake_purge(db, today, years, by):
        purged.append(by)
        return 5

    monkeypatch.setattr(r, "preview_retention", fake_preview)
    monkeypatch.setattr(r, "purge_expired", fake_purge)

    stale = await api.post("/api/v1/admin/audit/retention/purge", json={"confirm_cutoff_date": "2019-01-01"})
    assert stale.status_code == 409 and purged == []
    ok = await api.post("/api/v1/admin/audit/retention/purge", json={"confirm_cutoff_date": "2019-10-02"})
    assert ok.status_code == 200 and ok.json()["deleted"] == 5 and purged == ["root"]


async def test_retention_status_reports_the_unconfirmed_policy(api, monkeypatch):
    from backend.app.api import routes_audit_admin as r

    async def fake_preview(db, today, years):
        return ac.RetentionPreview(date(2019, 10, 2), years, 3, 1, 3)

    monkeypatch.setattr(r, "preview_retention", fake_preview)
    body = (await api.get("/api/v1/admin/audit/retention")).json()
    assert body["eligible_rows"] == 3 and body["purge_enabled"] is False and "not a confirmed NRB" in body["note"]


# ------------------------------------------------------------------ the maker-checker writers use the chain

def test_mutation_service_no_longer_writes_blank_hashes():
    import inspect
    from backend.app.services import mutation_service
    src = inspect.getsource(mutation_service)
    assert 'state_hash=""' not in src and 'prev_hash=""' not in src
    assert src.count("append_audit_log(") >= 3


# ------------------------------------------------------------------ direct project edits are audited too

async def test_project_update_writes_a_chained_audit_row_with_before_and_after(monkeypatch):
    from backend.app.api import routes_projects as rp
    from backend.app.schemas.project import ProjectUpdateRequest

    project = SimpleNamespace(id=uuid.uuid4(), name_en="Old", project_stage="feasibility", drop_reason=None,
                              updated_by=None, project_code="P1")

    async def visible(db, user, pid):
        return project

    async def can(db, user, pid):
        return True

    async def detail(pid, db, current_user):
        return "detail"

    class Db(ScriptedDB):
        async def commit(self):
            self.committed = True

    monkeypatch.setattr(rp, "_get_visible_project", visible)
    monkeypatch.setattr(rp.RLSService, "can_update_project", can)
    monkeypatch.setattr(rp, "get_project", detail)
    db = Db(Result(), Result(scalar="e" * 64), Result())  # advisory lock, last hash, checkpoint
    user = CurrentUser({"sub": str(uuid.uuid4()), "username": "maker1", "roles": ["maker"], "is_authenticated": True})
    request = SimpleNamespace(scope={"client": ("198.51.100.9", 1), "headers": []})

    await rp.update_project(str(project.id), ProjectUpdateRequest(name_en="New"), request, db=db, current_user=user)

    audit = next(o for o in db.added if hasattr(o, "state_hash"))
    assert audit.entity_type == "PROJECT" and audit.action_performed == "update"
    assert audit.pre_state == '{"name_en": "Old"}' and audit.post_state == '{"name_en": "New"}'
    assert audit.prev_hash == "e" * 64 and audit.source_ip == "198.51.100.9" and db.committed
    assert project.name_en == "New"
