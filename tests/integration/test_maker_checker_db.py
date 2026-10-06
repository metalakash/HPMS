"""Maker-checker end to end over HTTP against a real, migrated Postgres (skipped without one).

tests/security/test_maker_checker_controls.py covers the permission rules with a scripted session;
these tests cover what only the real schema shows: foreign keys, loading, and the change being applied.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.audit import AuditLog
from backend.app.models.auth import ProjectOwner, User
from backend.app.models.financial import LoanAccount
from backend.app.models.governance import ApprovalRequest, ApprovalStep, WorkflowDefinition
from backend.app.models.project import Project
from backend.app.services import change_applier
from backend.app.services.audit_chain import verify_stored_chain

JUSTIFICATION = "Monsoon delay per NEA correspondence dated 2083/06/15 BS"
SUBMIT = "/api/v1/mutations/submit-with-justification"
QUEUE = "/api/v1/mutations/approval-queue"


# ------------------------------------------------------------------ change validation (no database)

def test_changes_are_typed_from_their_columns():
    typed = change_applier.normalise("project", "update", {
        "forecast_cod_ad": "2027-03-31", "installed_capacity_mw": "42.5", "district": "Kaski", "drop_reason": None})
    assert typed == {"forecast_cod_ad": date(2027, 3, 31), "installed_capacity_mw": Decimal("42.5"),
                     "district": "Kaski", "drop_reason": None}
    assert change_applier.normalise("LOAN", "UPDATE", {"interest_rate_pct": 9.75}) == {
        "interest_rate_pct": Decimal("9.75")}


@pytest.mark.parametrize("entity,action,changes,problem", [
    ("PROJECT", "UPDATE", {}, "No changes"),
    ("PROJECT", "DELETE", {"district": "Kaski"}, "Only UPDATE"),
    ("PROJECT", "UPDATE", {"nonexistent": 1}, "not a field"),
    ("PROJECT", "UPDATE", {"id": str(uuid.uuid4())}, "not a field"),
    ("LOAN", "UPDATE", {"project_id": str(uuid.uuid4())}, "not a field"),
    ("PROJECT", "UPDATE", {"updated_by": "someone"}, "not a field"),
    ("PROJECT", "UPDATE", {"forecast_cod_ad": "31/03/2027"}, "not a valid value"),
    ("LOAN", "UPDATE", {"sanctioned_amount": "a lot"}, "not a valid value"),
    ("LOAN", "UPDATE", {"sanctioned_amount": "NaN"}, "not a valid value"),
    ("PROJECT", "UPDATE", {"pipeline_status": "under_feasibility"}, "is not one of"),
    ("PROJECT", "UPDATE", {"project_stage": "planning"}, "is not one of"),
    ("PROJECT", "UPDATE", {"name_en": None}, "cannot be empty"),
    ("PROJECT", "UPDATE", {"district": 7}, "must be text"),
    ("PROJECT", "UPDATE", {"province": "x" * 101}, "longer than 100"),
])
def test_unapplicable_changes_are_refused(entity, action, changes, problem):
    with pytest.raises(ValueError, match=problem):
        change_applier.normalise(entity, action, changes)


def test_only_projects_and_loans_are_applied():
    assert change_applier.is_applicable("project") and change_applier.is_applicable("LOAN")
    assert not change_applier.is_applicable("RCOD_UPDATE")


# ------------------------------------------------------------------ fixtures

@pytest.fixture
async def api(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


async def login(api, username: str) -> dict:
    r = await api.post("/api/v1/auth/login", json={"username": username, "password": f"{username}123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
async def world(api, db_session):
    """A project with a loan, owned by the demo maker; and signed-in maker, approver and admin."""
    project = Project(id=uuid.uuid4(), project_code="MC-001", name_en="Maker Checker Hydro", name_np="x",
                      province="Gandaki", installed_capacity_mw=Decimal("42.5"), project_stage="construction",
                      pipeline_status="under_construction")
    loan = LoanAccount(id=uuid.uuid4(), project_id=project.id, finacle_account_id="FIN-MC-001",
                       facility_type="term_loan", sanctioned_amount=Decimal("1000"), disbursed_amount=Decimal("500"),
                       outstanding_principal=Decimal("500"), interest_rate_pct=Decimal("9.50"))
    db_session.add_all([project, loan])
    await db_session.flush()

    headers = {name: await login(api, name) for name in ("maker", "approver", "admin")}
    maker_id = (await db_session.execute(select(User.id).where(User.username == "maker"))).scalar()
    db_session.add(ProjectOwner(user_id=maker_id, project_id=project.id, ownership_type="direct"))
    await db_session.flush()
    return {"project": project, "loan": loan, "db": db_session, **headers}


async def submit(api, world, changes, entity="PROJECT", who="maker", action="UPDATE", justification=JUSTIFICATION):
    entity_id = {"PROJECT": world["project"].id, "LOAN": world["loan"].id}.get(entity, "free-form")
    return await api.post(SUBMIT, headers=world[who], json={
        "entity_type": entity, "entity_id": str(entity_id), "action": action, "changes": changes,
        "justification": justification})


async def submitted(api, world, changes, **kwargs) -> str:
    r = await submit(api, world, changes, **kwargs)
    assert r.status_code == 200, r.text
    return r.json()["data"]["approval_request_id"]


async def decide(api, world, who, request_id, verb="approve", remarks="Checked against the file"):
    return await api.post(f"/api/v1/mutations/{verb}", headers=world[who],
                          json={"approval_request_id": request_id, "remarks": remarks})


async def count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar()


# ------------------------------------------------------------------ the whole workflow

async def test_a_change_is_applied_only_after_two_different_checkers_approve(api, world):
    db, project = world["db"], world["project"]

    r = await submit(api, world, {"pipeline_status": "under_operation", "project_stage": "operation"})
    assert r.status_code == 200, r.text
    request_id = r.json()["data"]["approval_request_id"]
    assert r.json()["data"]["current_state"] == "submitted"

    # Submitting changes nothing yet
    await db.refresh(project)
    assert project.pipeline_status == "under_construction"

    first = await decide(api, world, "approver", request_id)
    assert first.status_code == 200, first.text
    assert first.json()["data"]["new_state"] == "recommended"
    assert first.json()["data"]["changes_applied"] is False
    await db.refresh(project)
    assert project.pipeline_status == "under_construction"

    # The recommender cannot also give the final approval
    again = await decide(api, world, "approver", request_id)
    assert again.status_code == 403 and "different person" in again.json()["detail"]

    final = await decide(api, world, "admin", request_id)
    assert final.status_code == 200, final.text
    assert final.json()["data"]["new_state"] == "approved"
    assert final.json()["data"]["changes_applied"] is True

    await db.refresh(project)
    assert (project.pipeline_status, project.project_stage) == ("under_operation", "operation")
    assert project.updated_by == "admin"

    request = (await db.execute(select(ApprovalRequest))).scalar_one()
    assert request.current_state == "approved" and request.completed_at
    steps = (await db.execute(select(ApprovalStep.step_no, ApprovalStep.to_state, ApprovalStep.actor_role)
                              .order_by(ApprovalStep.step_no))).all()
    assert [tuple(s) for s in steps] == [(1, "submitted", "maker"), (2, "recommended", "approver"),
                                         (3, "approved", "admin")]

    audit = (await db.execute(select(AuditLog).order_by(AuditLog.id))).scalars().all()
    assert [(a.entity_type, a.action_performed) for a in audit] == [
        ("PROJECT", "UPDATE"), ("APPROVAL_REQUEST", "approve"), ("APPROVAL_REQUEST", "approve"), ("PROJECT", "update")]
    assert '"pipeline_status": "under_construction"' in audit[0].pre_state  # the values being replaced
    assert '"pipeline_status": "under_construction"' in audit[-1].pre_state
    assert '"pipeline_status": "under_operation"' in audit[-1].post_state
    assert (await verify_stored_chain(db)).ok

    # A closed request cannot be decided again
    assert (await decide(api, world, "admin", request_id)).status_code == 400
    assert (await decide(api, world, "admin", request_id, "reject", "Changed my mind later")).status_code == 400


async def test_a_rejected_change_is_never_applied(api, world):
    db, project = world["db"], world["project"]
    request_id = await submitted(api, world, {"forecast_cod_ad": "2027-03-31"})

    r = await decide(api, world, "approver", request_id, "reject", "Supporting letter is missing")
    assert r.status_code == 200, r.text
    assert r.json()["data"]["state"] == "rejected"

    await db.refresh(project)
    assert project.forecast_cod_ad is None
    assert (await decide(api, world, "admin", request_id)).status_code == 400
    assert (await verify_stored_chain(db)).ok


async def test_rejection_needs_a_reason(api, world):
    request_id = await submitted(api, world, {"district": "Kaski"})
    assert (await decide(api, world, "approver", request_id, "reject", "no")).status_code == 422


async def test_loan_terms_are_applied_with_their_types(api, world):
    db, loan = world["db"], world["loan"]
    request_id = await submitted(api, world, {"interest_rate_pct": "9.75", "maturity_ad": "2041-06-01"}, entity="LOAN")
    assert (await decide(api, world, "approver", request_id)).status_code == 200
    assert (await decide(api, world, "admin", request_id)).json()["data"]["changes_applied"] is True

    await db.refresh(loan)
    assert loan.interest_rate_pct == Decimal("9.75") and loan.maturity_ad == date(2041, 6, 1)
    assert loan.sanctioned_amount == Decimal("1000")  # untouched


async def test_free_form_requests_are_decided_but_change_no_record(api, world):
    request_id = await submitted(api, world, {"note": "Revise the RCOD schedule"}, entity="RCOD_UPDATE")
    assert (await decide(api, world, "approver", request_id)).status_code == 200
    final = await decide(api, world, "admin", request_id)
    assert final.status_code == 200 and final.json()["data"]["changes_applied"] is False


async def test_nobody_approves_their_own_submission(api, world):
    request_id = await submitted(api, world, {"district": "Kaski"}, who="admin")
    r = await decide(api, world, "admin", request_id)
    assert r.status_code == 403 and "submitted it" in r.json()["detail"]


async def test_one_default_workflow_per_entity_type_is_created_and_reused(api, world):
    await submitted(api, world, {"district": "Kaski"})
    await submitted(api, world, {"district": "Lamjung"})
    await submitted(api, world, {"interest_rate_pct": "9.75"}, entity="LOAN")

    definitions = (await world["db"].execute(
        select(WorkflowDefinition.entity_type, WorkflowDefinition.name).order_by(WorkflowDefinition.name))).all()
    assert [tuple(d) for d in definitions] == [("LOAN", "default-loan"), ("PROJECT", "default-project")]
    assert await count(world["db"], ApprovalRequest) == 3


async def test_an_existing_workflow_definition_is_used(api, world):
    custom = WorkflowDefinition(name="project-changes-v2", entity_type="PROJECT", is_active=True, version=2)
    world["db"].add(custom)
    await world["db"].flush()

    await submitted(api, world, {"district": "Kaski"})
    request = (await world["db"].execute(select(ApprovalRequest))).scalar_one()
    assert request.workflow_definition_id == custom.id
    assert await count(world["db"], WorkflowDefinition) == 1


# ------------------------------------------------------------------ refusals leave no trace

@pytest.mark.parametrize("changes,kwargs,status,detail", [
    ({"nonexistent": 1}, {}, 400, "not a field"),
    ({"forecast_cod_ad": "next spring"}, {}, 400, "not a valid value"),
    ({"pipeline_status": "under_feasibility"}, {}, 400, "is not one of"),
    ({"pipeline_status": "dropped"}, {}, 400, "drop_reason is required"),
    ({"district": "Kaski"}, {"action": "DELETE"}, 400, "Only UPDATE"),
    ({"project_id": str(uuid.uuid4())}, {"entity": "LOAN"}, 400, "not a field"),
    ({"outstanding_principal": "1"}, {"entity": "LOAN"}, 403, "core banking"),
    ({"district": "Kaski"}, {"who": "approver"}, 403, "Only makers and admins"),
])
async def test_unacceptable_submissions_are_refused_and_record_nothing(api, world, changes, kwargs, status, detail):
    r = await submit(api, world, changes, **kwargs)
    assert r.status_code == status, r.text
    assert detail in r.json()["detail"]
    assert await count(world["db"], ApprovalRequest) == 0
    assert await count(world["db"], AuditLog) == 0


async def test_dropping_a_project_with_a_reason_is_accepted(api, world):
    request_id = await submitted(api, world, {"pipeline_status": "dropped", "drop_reason": "Developer withdrew"})
    await decide(api, world, "approver", request_id)
    assert (await decide(api, world, "admin", request_id)).status_code == 200
    await world["db"].refresh(world["project"])
    assert (world["project"].pipeline_status, world["project"].drop_reason) == ("dropped", "Developer withdrew")


async def test_a_maker_cannot_propose_changes_to_a_project_they_do_not_own(api, world):
    other = Project(id=uuid.uuid4(), project_code="MC-002", name_en="Someone Else's", name_np="x",
                    installed_capacity_mw=Decimal("10"), project_stage="construction",
                    pipeline_status="under_construction")
    world["db"].add(other)
    await world["db"].flush()

    r = await api.post(SUBMIT, headers=world["maker"], json={
        "entity_type": "PROJECT", "entity_id": str(other.id), "action": "UPDATE",
        "changes": {"district": "Kaski"}, "justification": JUSTIFICATION})
    assert r.status_code == 404


@pytest.mark.parametrize("request_id", ["not-a-uuid", "00000000-0000-4000-8000-000000000000"])
async def test_deciding_an_unknown_request_is_not_found(api, world, request_id):
    assert (await decide(api, world, "approver", request_id)).status_code == 404
    assert (await decide(api, world, "approver", request_id, "reject", "No such request exists")).status_code == 404


# ------------------------------------------------------------------ the queue

async def test_queue_shows_what_is_proposed_and_who_may_decide(api, world):
    request_id = await submitted(api, world, {"pipeline_status": "under_operation", "project_stage": "operation"})

    def only(response):
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["total"] == 1
        return data["approvals"][0]

    item = only(await api.get(QUEUE, headers=world["approver"]))
    assert item["id"] == request_id
    assert item["entity_label"] == "Maker Checker Hydro (MC-001)"
    assert item["maker_name"] == "Maker User" or item["maker_name"] == "maker"
    assert item["action"] == "UPDATE" and item["justification"] == JUSTIFICATION
    assert item["changes"] == {"pipeline_status": "under_operation", "project_stage": "operation"}
    assert item["previous_values"] == {"pipeline_status": "under_construction", "project_stage": "construction"}
    assert item["current_state"] == "submitted" and item["can_decide"] is True

    assert only(await api.get(QUEUE, headers=world["maker"]))["can_decide"] is False  # sees it, cannot decide it

    await decide(api, world, "approver", request_id)
    assert only(await api.get(QUEUE, headers=world["approver"]))["can_decide"] is False  # already recommended it
    assert only(await api.get(QUEUE, headers=world["admin"]))["can_decide"] is True

    await decide(api, world, "admin", request_id)
    closed = only(await api.get(QUEUE, headers=world["admin"]))
    assert closed["current_state"] == "approved" and closed["can_decide"] is False and closed["completed_at"]


async def test_queue_labels_loans_and_filters_and_pages(api, world):
    await submitted(api, world, {"district": "Kaski"})
    loan_request = await submitted(api, world, {"interest_rate_pct": "9.75"}, entity="LOAN")
    await decide(api, world, "approver", loan_request)

    everything = (await api.get(QUEUE, headers=world["admin"])).json()["data"]
    assert everything["total"] == 2
    labels = {a["entity_type"]: a["entity_label"] for a in everything["approvals"]}
    assert labels["LOAN"] == "Term loan for Maker Checker Hydro (MC-001)"

    page = (await api.get(QUEUE, headers=world["admin"], params={"limit": 1})).json()["data"]
    assert page["total"] == 2 and len(page["approvals"]) == 1

    recommended = (await api.get(QUEUE, headers=world["admin"], params={"status": "recommended"})).json()["data"]
    assert recommended["total"] == 1 and recommended["approvals"][0]["id"] == loan_request

    loans = (await api.get(QUEUE, headers=world["admin"], params={"entity_type": "LOAN"})).json()["data"]
    assert [a["id"] for a in loans["approvals"]] == [loan_request]


async def test_queue_is_empty_for_a_maker_with_no_requests_of_their_own(api, world):
    await submitted(api, world, {"district": "Kaski"}, who="admin")
    data = (await api.get(QUEUE, headers=world["maker"])).json()["data"]
    assert data == {"total": 0, "approvals": []}
