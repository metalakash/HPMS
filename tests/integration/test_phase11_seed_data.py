"""Phase 11: the synthetic dataset, the integrity validator, and the API serving that data.

The generator and validator checks are pure; everything from ``seeded`` down needs the migrated
test database from conftest (skipped without one).
"""

import random
import uuid
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.audit import AuditLog
from backend.app.models.financial import DisbursementTranche, LoanAccount, Repayment
from backend.app.models.governance import ApprovalRequest, ApprovalStep, WorkflowDefinition
from backend.app.models.project import PipelineStatus, Project
from backend.app.services.audit_chain import verify_stored_chain
from backend.scripts import seed_realistic_data as realistic
from backend.scripts import seed_test_workflows as workflows
from backend.scripts import validate_data_integrity as integrity

TODAY = date(2026, 10, 5)
ZERO = Decimal("0")


# ------------------------------------------------------------------ generators (no database)

def test_projects_are_deterministic_unique_and_use_the_applications_vocabulary():
    projects = realistic.build_projects(random.Random(realistic.SEED))
    assert projects == realistic.build_projects(random.Random(realistic.SEED))

    assert len(projects) == realistic.PROJECT_COUNT == 50
    assert len({p["code"] for p in projects}) == 50
    assert {p["province"] for p in projects} == set(realistic.PROVINCES)  # every UI filter option has data
    assert {p["stage"] for p in projects} == {"feasibility", "construction", "operation"}
    valid_statuses = {s.value for s in PipelineStatus}
    for p in projects:
        assert p["status"] in valid_statuses
        assert p["status"] in integrity.STATUSES_BY_STAGE[p["stage"]], p
        assert p["code"].split("-")[1] == realistic.PROVINCES[p["province"]]


@pytest.mark.parametrize("seed", range(20))
def test_tranches_add_up_to_the_disbursed_amount_exactly(seed):
    disbursed = Decimal("1000000000.01")
    tranches = realistic.build_tranches(random.Random(seed), disbursed, date(2022, 1, 15))

    assert 3 <= len(tranches) <= 5
    assert [t["tranche_no"] for t in tranches] == list(range(1, len(tranches) + 1))
    assert sum(t["actual_amount"] for t in tranches) == disbursed
    assert all(t["actual_date_ad"] >= t["planned_date_ad"] for t in tranches)


def _schedule(delinquent=False, principal=Decimal("1200000000.00"), tenor=10, grace=2, today=TODAY):
    return realistic.build_repayments(random.Random(1), principal, Decimal("10.00"), tenor, grace,
                                      date(2024, 6, 1), today, delinquent)


def test_schedule_is_interest_only_in_grace_then_amortises_to_zero():
    principal = Decimal("1200000000.00")
    rows = _schedule(principal=principal)

    assert len(rows) == 20
    assert all(r["principal_due"] == 0 for r in rows[:4])
    assert all(r["principal_due"] > 0 for r in rows[4:])
    assert sum(r["principal_due"] for r in rows) == principal

    # Interest is charged on the balance outstanding at the start of each half-year
    balance = principal
    for r in rows:
        assert r["interest_due"] == (balance * Decimal("10") / Decimal("200")).quantize(Decimal("0.01"))
        balance -= r["principal_due"]
    assert balance == 0
    assert rows[0]["interest_due"] == Decimal("60000000.00")
    assert rows[-1]["interest_due"] < rows[4]["interest_due"]


def test_schedule_absorbs_rounding_in_the_final_instalment():
    principal = Decimal("1000000000.00")  # not divisible by 14 amortising periods
    rows = _schedule(principal=principal, tenor=10, grace=3)
    assert sum(r["principal_due"] for r in rows) == principal


def test_only_instalments_already_due_are_paid():
    rows = _schedule()
    past = [r for r in rows if r["due_date_ad"] <= TODAY]
    future = [r for r in rows if r["due_date_ad"] > TODAY]

    assert len(past) == 5  # Jun 2024 .. Jun 2026
    for r in past:
        assert r["principal_paid"] == r["principal_due"] and r["interest_paid"] == r["interest_due"]
        assert r["due_date_ad"] <= r["paid_date_ad"] <= TODAY
        assert r["days_past_due"] == 0
    for r in future:
        assert r["principal_paid"] == r["interest_paid"] == 0
        assert r["paid_date_ad"] is None and r["days_past_due"] == 0


def test_a_delinquent_loan_has_missed_only_its_latest_due_instalment():
    rows = _schedule(delinquent=True)
    overdue = [r for r in rows if r["days_past_due"] > 0]

    assert len(overdue) == 1
    assert overdue[0]["due_date_ad"] == date(2026, 6, 1)
    assert overdue[0]["days_past_due"] == (TODAY - date(2026, 6, 1)).days == 126
    assert overdue[0]["paid_date_ad"] is None and overdue[0]["interest_paid"] == 0


def test_a_loan_with_nothing_due_yet_cannot_be_delinquent():
    rows = _schedule(delinquent=True, today=date(2024, 1, 1))
    assert all(r["days_past_due"] == 0 and r["paid_date_ad"] is None for r in rows)


# ------------------------------------------------------------------ validator checks (no database)

def _loan_fixture(**loan_overrides):
    """A consistent loan in the shape the validator reads."""
    disbursed = Decimal("900000000.00")
    repayments = [SimpleNamespace(**r) for r in _schedule(principal=disbursed)]
    repaid = sum(r.principal_paid for r in repayments)
    loan = SimpleNamespace(sanctioned_amount=Decimal("1000000000.00"), disbursed_amount=disbursed,
                           outstanding_principal=disbursed - repaid, interest_rate_pct=Decimal("10.00"))
    for key, value in loan_overrides.items():
        setattr(loan, key, value)
    tranches = [SimpleNamespace(actual_amount=disbursed / 3) for _ in range(3)]
    return loan, tranches, repayments


def _check(loan, tranches, repayments):
    return integrity.check_loan("L", loan, tranches, repayments, TODAY)


def test_validator_accepts_a_consistent_loan():
    assert _check(*_loan_fixture()) == []


def test_validator_accepts_a_delinquent_loan_with_correct_days_past_due():
    disbursed = Decimal("900000000.00")
    repayments = [SimpleNamespace(**r) for r in _schedule(delinquent=True, principal=disbursed)]
    loan, tranches, _ = _loan_fixture(
        outstanding_principal=disbursed - sum(r.principal_paid for r in repayments))
    assert _check(loan, tranches, repayments) == []


def test_validator_flags_disbursement_beyond_the_sanction():
    errors = _check(*_loan_fixture(sanctioned_amount=Decimal("800000000.00")))
    assert len(errors) == 1 and "exceeds sanctioned" in errors[0]


def test_validator_flags_tranches_that_do_not_add_up():
    loan, tranches, repayments = _loan_fixture()
    errors = _check(loan, tranches[:2], repayments)
    assert len(errors) == 1 and "tranches total" in errors[0]


def test_validator_flags_an_outstanding_balance_that_ignores_repayments():
    loan, tranches, repayments = _loan_fixture()
    loan.outstanding_principal = loan.disbursed_amount
    errors = _check(loan, tranches, repayments)
    assert len(errors) == 1 and "outstanding" in errors[0]


def test_validator_flags_flat_interest_on_a_reducing_balance():
    loan, tranches, repayments = _loan_fixture()
    for r in repayments:
        r.interest_due = repayments[0].interest_due  # as if the balance never fell
    errors = _check(loan, tranches, repayments)
    assert errors and all("interest" in e for e in errors)
    assert len(errors) == 15  # every period after the balance first reduces


def test_validator_flags_payment_dated_in_the_future_and_wrong_days_past_due():
    loan, tranches, repayments = _loan_fixture()
    repayments[0].paid_date_ad = TODAY + timedelta(days=1)
    repayments[1].days_past_due = 30  # paid in full, so cannot be past due
    errors = _check(loan, tranches, repayments)
    assert len(errors) == 2
    assert "future date" in errors[0] and "days past due is 30, expected 0" in errors[1]


def test_validator_flags_an_unpaid_past_instalment_not_marked_overdue():
    loan, tranches, repayments = _loan_fixture()
    missed = repayments[4]  # due 2026-06-01, paid in the fixture
    loan.outstanding_principal += missed.principal_paid
    missed.principal_paid = missed.interest_paid = ZERO
    missed.paid_date_ad = None
    errors = _check(loan, tranches, repayments)
    assert errors == [f"L instalment 2026-06-01: days past due is 0, expected 126"]


@pytest.mark.parametrize("stage,status,problem", [
    ("operation", "under_review", "does not fit stage"),
    ("feasibility", "under_operation", "does not fit stage"),
    ("construction", "under_feasibility", "unknown pipeline status"),
    ("planning", "approved", "unknown stage"),
])
def test_validator_flags_incoherent_project_status(stage, status, problem):
    project = SimpleNamespace(project_code="P", project_stage=stage, pipeline_status=status,
                              installed_capacity_mw=Decimal("10"))
    errors = integrity.check_project(project)
    assert len(errors) == 1 and problem in errors[0]


def test_validator_flags_non_positive_capacity():
    project = SimpleNamespace(project_code="P", project_stage="operation", pipeline_status="under_operation",
                              installed_capacity_mw=Decimal("0"))
    assert integrity.check_project(project) == ["P: installed capacity must be positive"]


# ------------------------------------------------------------------ seeded database

@pytest.fixture
async def seeded(db_session):
    await realistic.seed(db_session, today=TODAY)
    return db_session


async def _count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar()


async def test_seed_creates_financed_projects_that_pass_validation(seeded):
    assert await _count(seeded, Project) == 50
    loans = (await seeded.execute(select(LoanAccount))).scalars().all()
    stages = dict((await seeded.execute(select(Project.id, Project.project_stage))).all())

    # One loan for every project past feasibility, none before
    assert sorted(stages[l.project_id] for l in loans) == ["construction"] * 17 + ["operation"] * 17
    assert len({l.project_id for l in loans}) == len(loans) == 34
    assert len({l.finacle_account_id for l in loans}) == 34
    for loan in loans:
        assert 0 < loan.disbursed_amount <= loan.sanctioned_amount
        assert 0 < loan.outstanding_principal <= loan.disbursed_amount

    delinquent = [l for l in loans if l.overdue_principal or l.overdue_interest]
    assert 1 <= len(delinquent) <= 6

    report = await integrity.validate(seeded, today=TODAY)
    assert report.errors == []
    assert (report.projects, report.loans) == (50, 34)


async def test_reseeding_replaces_the_data_with_an_identical_set(seeded):
    before = (await seeded.execute(select(Project.id, Project.project_code).order_by(Project.project_code))).all()
    counts = [await _count(seeded, m) for m in (LoanAccount, DisbursementTranche, Repayment)]

    await realistic.seed(seeded, today=TODAY)

    after = (await seeded.execute(select(Project.id, Project.project_code).order_by(Project.project_code))).all()
    assert after == before  # same ids, so links to projects stay valid across reseeds
    assert [await _count(seeded, m) for m in (LoanAccount, DisbursementTranche, Repayment)] == counts


async def test_validator_reports_corruption_in_stored_data(seeded):
    loan = (await seeded.execute(select(LoanAccount).order_by(LoanAccount.finacle_account_id))).scalars().first()
    code = (await seeded.execute(select(Project.project_code).where(Project.id == loan.project_id))).scalar()
    loan.outstanding_principal = loan.disbursed_amount + 5
    await seeded.flush()

    report = await integrity.validate(seeded, today=TODAY)
    assert not report.ok
    assert len(report.errors) == 1 and report.errors[0].startswith(f"{code} loan: outstanding")


async def test_validator_reports_a_broken_audit_chain(seeded):
    seeded.add(AuditLog(user_id="x", timestamp="2026-10-05T00:00:00", entity_type="PROJECT", entity_id="p",
                        action_performed="submit", reason_for_action="hand-written row", state_hash="a" * 64,
                        prev_hash=None))
    await seeded.flush()

    report = await integrity.validate(seeded, today=TODAY)
    assert [e for e in report.errors if e.startswith("audit chain:")]


# ------------------------------------------------------------------ seeded maker-checker workflows

JUSTIFICATION = "Monsoon delay per NEA correspondence dated 2083/06/15 BS"


async def _stored_request(db, state="submitted") -> str:
    """A change request written straight to the tables, so these tests do not depend on submit working."""
    definition = WorkflowDefinition(name=f"test-{uuid.uuid4()}", entity_type="PROJECT")
    db.add(definition)
    await db.flush()
    request = ApprovalRequest(workflow_definition_id=definition.id, entity_type="PROJECT",
                              entity_id=str(uuid.uuid4()), current_state=state, maker_id=str(uuid.uuid4()),
                              submitted_at="2026-10-05T00:00:00")
    db.add(request)
    await db.flush()
    db.add(ApprovalStep(approval_request_id=request.id, step_no=1, actor_id=request.maker_id,
                        actor_role="maker", from_state="draft", to_state="submitted"))
    await db.flush()
    request_id = str(request.id)
    db.expunge_all()  # as in production, where the deciding request arrives in a fresh session
    return request_id


async def _as(api, username: str) -> dict:
    login = await api.post("/api/v1/auth/login", json={"username": username, "password": f"{username}123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_a_change_request_can_be_submitted_through_the_api(api, seeded):
    project_id = (await seeded.execute(select(Project.id).order_by(Project.project_code))).scalars().first()
    r = await api.post("/api/v1/mutations/submit-with-justification", json={
        "entity_type": "PROJECT", "entity_id": str(project_id), "action": "UPDATE",
        "changes": {"forecast_cod_ad": "2027-03-31"}, "justification": JUSTIFICATION,
    })
    assert r.status_code == 200, r.text
    assert r.json()["data"]["current_state"] == "submitted"


async def test_submission_is_refused_without_an_adequate_justification(api, seeded):
    project_id = (await seeded.execute(select(Project.id))).scalars().first()
    r = await api.post("/api/v1/mutations/submit-with-justification", json={
        "entity_type": "PROJECT", "entity_id": str(project_id), "action": "UPDATE",
        "changes": {"forecast_cod_ad": "2027-03-31"}, "justification": "too short",
    })
    assert r.status_code == 422
    assert await _count(seeded, ApprovalRequest) == 0 and await _count(seeded, AuditLog) == 0


async def test_an_approver_can_recommend_a_submitted_request(api, seeded):
    request_id = await _stored_request(seeded)
    r = await api.post("/api/v1/mutations/approve", json={"approval_request_id": request_id, "remarks": "ok"},
                       headers=await _as(api, "approver"))
    assert r.status_code == 200, r.text
    state = (await seeded.execute(
        select(ApprovalRequest.current_state).where(ApprovalRequest.id == uuid.UUID(request_id)))).scalar()
    assert state == "recommended"


async def test_an_approver_can_reject_a_submitted_request(api, seeded):
    request_id = await _stored_request(seeded)
    r = await api.post("/api/v1/mutations/reject",
                       json={"approval_request_id": request_id, "remarks": "Supporting letter is missing"},
                       headers=await _as(api, "approver"))
    assert r.status_code == 200, r.text
    state = (await seeded.execute(
        select(ApprovalRequest.current_state).where(ApprovalRequest.id == uuid.UUID(request_id)))).scalar()
    assert state == "rejected"


async def test_a_maker_cannot_approve_or_reject(api, seeded):
    request_id = await _stored_request(seeded)
    maker = await _as(api, "maker")
    approve = await api.post("/api/v1/mutations/approve", json={"approval_request_id": request_id}, headers=maker)
    reject = await api.post("/api/v1/mutations/reject",
                            json={"approval_request_id": request_id, "remarks": "I disagree with it"}, headers=maker)
    assert approve.status_code == reject.status_code == 403
    state = (await seeded.execute(
        select(ApprovalRequest.current_state).where(ApprovalRequest.id == uuid.UUID(request_id)))).scalar()
    assert state == "submitted"


async def test_approval_queue_shows_checkers_everything_and_makers_only_their_own(api, seeded):
    request_id = await _stored_request(seeded)

    for username in ("admin", "approver"):
        r = await api.get("/api/v1/mutations/approval-queue", headers=await _as(api, username))
        assert r.status_code == 200, r.text
        assert [a["id"] for a in r.json()["data"]["approvals"]] == [request_id], username

    r = await api.get("/api/v1/mutations/approval-queue", headers=await _as(api, "maker"))
    assert r.status_code == 200 and r.json()["data"]["approvals"] == []  # submitted by someone else


async def test_workflow_seed_creates_one_request_per_state_through_the_audit_chain(seeded):
    created = await workflows.seed(seeded)
    assert sorted(c["state"] for c in created) == ["approved", "recommended", "rejected", "submitted"]

    requests = {str(r.id): r for r in (await seeded.execute(select(ApprovalRequest))).scalars()}
    for c in created:
        assert requests[c["id"]].current_state == c["state"]

    approved = requests[next(c["id"] for c in created if c["state"] == "approved")]
    # Dual control: three different people
    assert len({str(approved.maker_id), str(approved.recommender_id), str(approved.approver_id)}) == 3
    assert approved.completed_at is not None

    steps = (await seeded.execute(
        select(ApprovalStep.to_state).where(ApprovalStep.approval_request_id == approved.id)
        .order_by(ApprovalStep.step_no))).scalars().all()
    assert steps == ["submitted", "recommended", "approved"]

    # The approved change was applied to its project; the pending and rejected ones were not
    forecast = (await seeded.execute(
        select(Project.forecast_cod_ad).where(Project.id == uuid.UUID(approved.entity_id)))).scalar()
    assert forecast == date(2027, 3, 31)
    assert await _count(seeded, Project) == 50
    dropped = (await seeded.execute(
        select(func.count()).select_from(Project).where(Project.pipeline_status == "dropped"))).scalar()
    assert dropped == 0

    # 4 submissions + 3 approval steps + 1 rejection + 1 applied update, all linked from genesis
    chain = await verify_stored_chain(seeded)
    assert chain.ok and chain.checked == 9
    assert (await integrity.validate(seeded, today=TODAY)).errors == []


async def test_workflow_seed_targets_real_projects_and_loans(seeded):
    await workflows.seed(seeded)
    project_ids = {str(i) for i in (await seeded.execute(select(Project.id))).scalars()}
    loan_ids = {str(i) for i in (await seeded.execute(select(LoanAccount.id))).scalars()}

    for request in (await seeded.execute(select(ApprovalRequest))).scalars():
        known = project_ids if request.entity_type == "PROJECT" else loan_ids
        assert request.entity_id in known, (request.entity_type, request.entity_id)


async def test_workflow_seed_is_idempotent(seeded):
    await workflows.seed(seeded)
    audit_rows = await _count(seeded, AuditLog)

    assert await workflows.seed(seeded) == []
    assert await _count(seeded, ApprovalRequest) == 4
    assert await _count(seeded, AuditLog) == audit_rows


async def test_workflow_seed_needs_financed_projects(db_session):
    with pytest.raises(RuntimeError, match="run seed_realistic_data first"):
        await workflows.seed(db_session)


# ------------------------------------------------------------------ API over the seeded data

@pytest.fixture
async def api(seeded):
    async def override_get_db():
        yield seeded

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        login = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
        assert login.status_code == 200, login.text
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        yield client
    app.dependency_overrides.pop(get_db, None)


async def _all_projects(api, **params):
    r = await api.get("/api/v1/projects", params={"page_size": 100, **params})
    assert r.status_code == 200, r.text
    body = r.json()
    return body["data"], body["meta"]["total_count"]


async def test_project_list_pages_through_every_project_exactly_once(api):
    seen = []
    for page in (1, 2, 3):
        r = await api.get("/api/v1/projects", params={"page": page, "page_size": 20})
        body = r.json()
        assert body["meta"]["total_count"] == 50
        seen += [p["project_code"] for p in body["data"]]
    assert len(seen) == 50 and len(set(seen)) == 50

    beyond = (await api.get("/api/v1/projects", params={"page": 4, "page_size": 20})).json()
    assert beyond["data"] == [] and beyond["meta"]["total_count"] == 50


@pytest.mark.parametrize("param,field,value", [
    ("stage", "project_stage", "construction"),
    ("stage", "project_stage", "operation"),
    ("province", "province", "Bagmati"),
    ("province", "province", "Sudurpashchim"),
    ("status", "pipeline_status", "approved"),
    ("status", "pipeline_status", "under_operation"),
])
async def test_project_filters_return_only_matching_rows_and_a_matching_total(api, param, field, value):
    everything, _ = await _all_projects(api)
    expected = [p["project_code"] for p in everything if p[field] == value]
    assert expected, "the seed should have data for every filter under test"

    rows, total = await _all_projects(api, **{param: value})
    assert sorted(p["project_code"] for p in rows) == sorted(expected)
    assert total == len(expected)


async def test_project_filters_combine(api):
    everything, _ = await _all_projects(api)
    expected = [p for p in everything if p["project_stage"] == "operation" and p["province"] == "Gandaki"]

    rows, total = await _all_projects(api, stage="operation", province="Gandaki")
    assert total == len(rows) == len(expected) > 0

    _, none = await _all_projects(api, stage="operation", status="under_review")
    assert none == 0


async def test_project_detail_endpoints_agree_with_each_other(api, seeded):
    rows, _ = await _all_projects(api, stage="operation")
    project = rows[0]
    base = f"/api/v1/projects/{project['id']}"

    detail = (await api.get(base)).json()["data"]
    loans = (await api.get(f"{base}/loan-accounts")).json()["data"]
    disbursements = (await api.get(f"{base}/disbursements")).json()["data"]

    assert detail["project_code"] == project["project_code"]
    assert detail["loan_accounts_count"] == len(loans) == 1
    assert detail["location"]["province"] == project["province"]
    assert [c["cod_type"] for c in detail["cod_history"]] == ["original_cod"]

    loan = loans[0]
    assert loan["finacle_account_id"] != f"FIN-{project['project_code']}"  # account number is masked
    drawn = sum(Decimal(t["actual_amount"]) for t in disbursements["tranches"])
    assert drawn == Decimal(loan["disbursed_amount"])
    assert {t["loan_account_id"] for t in disbursements["tranches"]} == {loan["id"]}

    repayments = disbursements["repayments"]
    assert [r["due_date_ad"] for r in repayments] == sorted(r["due_date_ad"] for r in repayments)
    repaid = sum(Decimal(r["principal_paid"]) for r in repayments)
    assert Decimal(loan["disbursed_amount"]) - repaid == Decimal(loan["outstanding_principal"])
    assert {r["status"] for r in repayments} <= {"paid", "upcoming", "overdue"}


async def test_repayment_status_follows_payment_and_due_date(api, seeded):
    """A delinquent loan shows exactly its missed instalment as overdue; future ones are upcoming."""
    overdue_loan = (await seeded.execute(
        select(LoanAccount).where(LoanAccount.overdue_interest > 0))).scalars().first()
    r = await api.get(f"/api/v1/projects/{overdue_loan.project_id}/disbursements")
    repayments = r.json()["data"]["repayments"]

    overdue = [x for x in repayments if x["status"] == "overdue"]
    assert len(overdue) == 1
    assert overdue[0]["days_past_due"] > 0 and overdue[0]["paid_date_ad"] is None
    # The API derives status from the real clock; the seed's "today" is in the past
    assert all(x["status"] == "paid" for x in repayments if x["due_date_ad"] < overdue[0]["due_date_ad"])


async def test_feasibility_projects_have_no_loan_data(api):
    rows, _ = await _all_projects(api, stage="feasibility")
    base = f"/api/v1/projects/{rows[0]['id']}"

    assert (await api.get(base)).json()["data"]["loan_accounts_count"] == 0
    assert (await api.get(f"{base}/loan-accounts")).json()["data"] == []
    assert (await api.get(f"{base}/disbursements")).json()["data"] == {"tranches": [], "repayments": []}


async def test_unknown_project_is_404_on_every_detail_endpoint(api):
    missing = "/api/v1/projects/00000000-0000-4000-8000-000000000000"
    for path in ("", "/loan-accounts", "/disbursements", "/milestones", "/risks"):
        assert (await api.get(missing + path)).status_code == 404, path


async def test_loan_list_is_paginated_and_matches_the_seed(api):
    r = await api.get("/api/v1/loan-accounts", params={"page_size": 100})
    body = r.json()
    assert r.status_code == 200 and body["meta"]["total_count"] == len(body["data"]) == 34
    assert all(l["sync_status"] == "success" for l in body["data"])

    failed = (await api.get("/api/v1/loan-accounts", params={"status": "failed"})).json()
    assert failed["data"] == [] and failed["meta"]["total_count"] == 0


async def test_project_tab_endpoints_serve_the_seeded_operations_data(api):
    rows, _ = await _all_projects(api, stage="operation")
    base = f"/api/v1/projects/{rows[0]['id']}"

    generation = (await api.get(f"{base}/generation-ppa")).json()["data"]
    assert generation["ppa"]["agreement_number"] == f"NEA-{rows[0]['project_code']}"
    assert generation["summary"]["months_available"] == len(generation["monthly_data"]) == 6
    months = [m["month"] for m in generation["monthly_data"]]
    assert months == sorted(months) and len(set(months)) == 6  # oldest first
    for month in generation["monthly_data"]:
        assert month["season"] in ("wet", "dry")
        expected = round((month["actual_mwh"] - month["contract_mwh"]) / month["contract_mwh"] * 100, 2)
        assert float(month["variance_pct"]) == pytest.approx(expected, abs=0.01)  # a Decimal, sent as a string
    assert generation["summary"]["total_generated_mwh"] == pytest.approx(
        sum(m["actual_mwh"] for m in generation["monthly_data"]))

    hydrology = (await api.get(f"{base}/hydrology")).json()["data"]
    assert hydrology["hydrology"]["river_basin"] and hydrology["hydrology"]["design_discharge_q90_m3s"] > 0

    land = (await api.get(f"{base}/land-governance")).json()["data"]
    acquisition = land["land_acquisition"]
    assert 0 < acquisition["total_area_acquired_ropani"] <= acquisition["total_area_required_ropani"]
    assert land["board_of_directors"]["total_members"] == 3
    assert land["shareholding"]["total_share_pct"] == 100

    esg = (await api.get(f"{base}/esg")).json()["data"]
    assert esg["metrics_as_of"] and esg["social"]["local_employment_count"] > 0
    assert (esg["eia_mitigation"]["total_measures"], esg["eia_mitigation"]["completed_measures"]) == (3, 1)


async def test_project_tab_endpoints_are_empty_but_healthy_for_a_project_without_operations_data(api):
    rows, _ = await _all_projects(api, stage="construction")
    base = f"/api/v1/projects/{rows[0]['id']}"

    generation = (await api.get(f"{base}/generation-ppa")).json()["data"]
    assert generation["ppa"] is None and generation["monthly_data"] == []
    assert (await api.get(f"{base}/hydrology")).json()["data"]["water_licenses"] == []
    assert (await api.get(f"{base}/land-governance")).json()["data"]["board_of_directors"]["members"] == []
    assert (await api.get(f"{base}/esg")).json()["data"]["metrics_as_of"] is None
    assert (await api.get(f"{base}/maintenance")).status_code == 200
    history = await api.get(f"/api/v1/compliance/covenants/{rows[0]['id']}/history")
    assert history.status_code == 200 and history.json()["data"]["status"] == "no_data"


async def test_the_demo_maker_owns_the_workflow_projects_after_seeding(api, seeded):
    await workflows.seed(seeded)
    maker = await _as(api, "maker")

    visible = (await api.get("/api/v1/projects", headers=maker, params={"page_size": 100})).json()
    assert visible["meta"]["total_count"] == 4  # makers see only projects they own

    r = await api.post("/api/v1/mutations/submit-with-justification", headers=maker, json={
        "entity_type": "PROJECT", "entity_id": visible["data"][0]["id"], "action": "UPDATE",
        "changes": {"forecast_cod_ad": "2028-01-01"}, "justification": JUSTIFICATION})
    assert r.status_code == 200, r.text


@pytest.mark.xfail(strict=True, reason=(
    "CovenantService.calculate_metrics is a placeholder: LTV divides the sanction by NPR 1 crore per MW "
    "and DSCR is derived from the disbursement ratio, so a loan at 60-75% of project cost reports an "
    "LTV in the thousands of percent"))
async def test_covenant_metrics_are_plausible_for_a_seeded_loan(api, seeded):
    loan = (await seeded.execute(select(LoanAccount))).scalars().first()
    r = await api.get(f"/api/v1/loan-accounts/{loan.id}/covenant-metrics")
    assert r.status_code == 200, r.text
    assert Decimal(str(r.json()["data"]["ltv"])) <= 100
