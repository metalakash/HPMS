"""Phase 11.4: field-level write rights and maker-checker dual control (no database required)."""

import uuid
from types import SimpleNamespace

import pytest

from backend.app.security import field_policy
from backend.app.security.auth_middleware import CurrentUser
from backend.app.security.ldap_provider import UserRole
from backend.app.services.mutation_service import MutationService


def user(role, uid=None):
    return CurrentUser({"sub": uid or str(uuid.uuid4()), "username": role, "roles": [role], "is_authenticated": True})


# ------------------------------------------------------------------ field policy

@pytest.mark.parametrize("entity,field", [
    ("LOAN", "finacle_account_id"), ("LOAN", "outstanding_principal"), ("LOAN", "overdue_interest"),
    ("LOAN", "dscr"), ("PROJECT", "id"), ("PROJECT", "created_by"), ("LOAN", "state_hash"),
])
def test_system_owned_fields_cannot_be_proposed_by_anyone(entity, field):
    for role in UserRole:
        assert field_policy.violations(entity, {field: 1}, [role]), (role, field)


@pytest.mark.parametrize("field", ["sanctioned_amount", "disbursed_amount", "interest_rate_pct"])
def test_money_terms_only_for_makers_and_admins(field):
    assert not field_policy.violations("LOAN", {field: 1}, [UserRole.MAKER])
    assert not field_policy.violations("loan", {field: 1}, [UserRole.ADMIN])  # entity type is case-insensitive
    for role in (UserRole.APPROVER, UserRole.AUDITOR, UserRole.GUEST):
        assert field_policy.violations("LOAN", {field: 1}, [role]), role


def test_unknown_fields_and_entity_types_stay_unrestricted():
    assert not field_policy.violations("LOAN", {"remarks": "x", "updated_at": "now"}, [UserRole.MAKER])
    assert not field_policy.violations("RCOD_UPDATE", {"new_cod": "2027-01-01"}, [UserRole.MAKER])


def test_check_write_lists_every_offending_field():
    with pytest.raises(PermissionError) as e:
        field_policy.check_write("LOAN", {"dscr": 2, "finacle_account_id": "x", "remarks": "ok"}, [UserRole.MAKER])
    assert "dscr" in str(e.value) and "finacle_account_id" in str(e.value) and "remarks" not in str(e.value)


# ------------------------------------------------------------------ scripted session

class Result:
    def __init__(self, scalar=None):
        self._scalar = scalar

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar


class ScriptedDB:
    def __init__(self, *results):
        self.results, self.added, self.commits = list(results), [], 0

    async def execute(self, stmt, params=None):
        return self.results.pop(0) if self.results else Result()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.commits += 1


JUSTIFICATION = "Correcting the sanctioned amount after the revised facility letter"


async def submit(db, who, **over):
    args = dict(entity_type="RCOD_UPDATE", entity_id="abc", action="UPDATE", changes={"note": "x"},
                justification=JUSTIFICATION)
    args.update(over)
    return await MutationService.submit_mutation(db=db, current_user=who, **args)


# ------------------------------------------------------------------ submit

@pytest.mark.parametrize("role", ["guest", "auditor", "approver"])
async def test_only_makers_and_admins_can_submit(role):
    db = ScriptedDB()
    with pytest.raises(PermissionError, match="Only makers and admins"):
        await submit(db, user(role))
    assert db.added == [] and db.commits == 0


async def test_submit_enforces_field_policy_before_writing_anything():
    db = ScriptedDB()
    with pytest.raises(PermissionError, match="finacle_account_id"):
        await submit(db, user("maker"), entity_type="LOAN", entity_id=str(uuid.uuid4()),
                     changes={"finacle_account_id": "hacked"})
    assert db.added == [] and db.commits == 0


async def test_submit_for_unseen_project_is_not_found(monkeypatch):
    async def cannot_view(db, u, pid):
        return False

    monkeypatch.setattr("backend.app.security.rls_service.RLSService.can_view_project", cannot_view)
    with pytest.raises(LookupError):
        await submit(ScriptedDB(), user("maker"), entity_type="PROJECT", entity_id=str(uuid.uuid4()),
                     changes={"project_stage": "construction"})


async def test_submit_for_visible_but_not_updatable_project_is_forbidden(monkeypatch):
    async def yes(db, u, pid):
        return True

    async def no(db, u, pid):
        return False

    monkeypatch.setattr("backend.app.security.rls_service.RLSService.can_view_project", yes)
    monkeypatch.setattr("backend.app.security.rls_service.RLSService.can_update_project", no)
    with pytest.raises(PermissionError, match="Not permitted"):
        await submit(ScriptedDB(), user("maker"), entity_type="PROJECT", entity_id=str(uuid.uuid4()),
                     changes={"project_stage": "construction"})


async def test_submit_with_malformed_target_id_is_not_found():
    with pytest.raises(LookupError):
        await submit(ScriptedDB(), user("maker"), entity_type="PROJECT", entity_id="not-a-uuid")


async def test_submit_writes_chained_audit_row_and_workflow():
    # advisory lock, last hash, checkpoint
    db = ScriptedDB(Result(), Result("a" * 64), Result())
    out = await submit(db, user("maker"))
    audit = next(o for o in db.added if hasattr(o, "state_hash"))
    assert audit.prev_hash == "a" * 64 and out["justification_hash"] == audit.state_hash
    assert db.commits == 1


# ------------------------------------------------------------------ approve / reject dual control

def approval(state="submitted", maker=None, recommender=None):
    return SimpleNamespace(id="req1", current_state=state, maker_id=maker or str(uuid.uuid4()),
                           recommender_id=recommender, approver_id=None, completed_at=None, approval_steps=[])


async def approve(db, who):
    return await MutationService.approve_mutation(db=db, current_user=who, approval_request_id="req1", remarks="ok")


@pytest.mark.parametrize("role", ["guest", "auditor", "maker"])
async def test_only_approvers_and_admins_can_approve_or_reject(role):
    with pytest.raises(PermissionError):
        await approve(ScriptedDB(Result(approval())), user(role))
    with pytest.raises(PermissionError):
        await MutationService.reject_mutation(db=ScriptedDB(Result(approval())), current_user=user(role),
                                              approval_request_id="req1", remarks="not acceptable at all")


async def test_maker_cannot_approve_their_own_request_even_as_admin():
    uid = str(uuid.uuid4())
    db = ScriptedDB(Result(approval(maker=uid)))
    with pytest.raises(PermissionError, match="submitted it"):
        await approve(db, user("admin", uid))
    assert db.commits == 0


async def test_two_step_approval_needs_two_different_people():
    req = approval()
    first, second = user("approver"), user("approver")

    await approve(ScriptedDB(Result(req), Result(), Result("a" * 64), Result()), first)
    assert req.current_state == "recommended" and req.recommender_id == str(first.id) and req.completed_at is None

    with pytest.raises(PermissionError, match="different person"):
        await approve(ScriptedDB(Result(req)), first)

    await approve(ScriptedDB(Result(req), Result(), Result("b" * 64), Result()), second)
    assert req.current_state == "approved" and req.approver_id == str(second.id) and req.completed_at


async def test_approval_writes_a_real_chained_audit_row():
    db = ScriptedDB(Result(approval()), Result(), Result("c" * 64), Result())
    await approve(db, user("approver"))
    audit = next(o for o in db.added if hasattr(o, "state_hash"))
    assert len(audit.state_hash) == 64 and audit.prev_hash == "c" * 64 and audit.entity_type == "APPROVAL_REQUEST"


@pytest.mark.parametrize("state", ["approved", "rejected"])
async def test_closed_requests_cannot_be_rejected_or_approved(state):
    with pytest.raises(ValueError, match="Cannot reject"):
        await MutationService.reject_mutation(db=ScriptedDB(Result(approval(state))), current_user=user("approver"),
                                              approval_request_id="req1", remarks="changed my mind later")
    with pytest.raises(ValueError, match="Cannot approve"):
        await approve(ScriptedDB(Result(approval(state))), user("approver"))


async def test_reject_open_request_marks_it_rejected_and_audits():
    req = approval("recommended")
    db = ScriptedDB(Result(req), Result(), Result("d" * 64), Result())
    out = await MutationService.reject_mutation(db=db, current_user=user("approver"), approval_request_id="req1",
                                                remarks="supporting document is missing")
    assert req.current_state == "rejected" and out["state"] == "rejected"
    assert any(getattr(o, "action_performed", "") == "reject" for o in db.added)


# ------------------------------------------------------------------ route layer

async def test_routes_map_policy_errors_to_http_codes(monkeypatch):
    from httpx import ASGITransport, AsyncClient
    from backend.app.database import get_db
    from backend.app.main import app
    from backend.app.security.auth_middleware import get_current_user

    seen = {}

    async def deny(**kwargs):
        seen["ip"] = kwargs["source_ip"]
        raise PermissionError("nope")

    async def missing(**kwargs):
        raise LookupError("PROJECT x not found")

    async def fake_db():
        yield SimpleNamespace()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: user("maker")
    body = {"entity_type": "PROJECT", "entity_id": "x", "action": "UPDATE", "changes": {"a": 1},
            "justification": JUSTIFICATION}
    try:
        async with AsyncClient(transport=ASGITransport(app=app, client=("198.51.100.7", 1)),
                               base_url="http://localhost") as c:
            monkeypatch.setattr(MutationService, "submit_mutation", staticmethod(deny))
            assert (await c.post("/api/v1/mutations/submit-with-justification", json=body)).status_code == 403
            assert seen["ip"] == "198.51.100.7"  # the real caller address, not a hard-coded 0.0.0.0
            monkeypatch.setattr(MutationService, "submit_mutation", staticmethod(missing))
            assert (await c.post("/api/v1/mutations/submit-with-justification", json=body)).status_code == 404
    finally:
        app.dependency_overrides.clear()


# ------------------------------------------------------------------ approval queue visibility

class CapturingDB:
    def __init__(self):
        self.sql = None

    async def execute(self, stmt, params=None):
        self.sql = str(stmt.compile(compile_kwargs={"literal_binds": True}))
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))


async def queue_sql(who):
    db = CapturingDB()
    await MutationService.get_approval_queue(db, who)
    return db.sql


@pytest.mark.parametrize("role", ["admin", "approver", "auditor"])
async def test_checkers_and_auditors_see_every_request(role):
    sql = await queue_sql(user(role))
    assert "WHERE" not in sql


async def test_maker_sees_only_their_own_requests():
    uid = str(uuid.uuid4())
    sql = await queue_sql(user("maker", uid))
    assert "maker_id" in sql and uid in sql


async def test_guest_sees_nothing():
    sql = await queue_sql(user("guest"))
    assert "WHERE false" in sql or "WHERE 0 = 1" in sql
