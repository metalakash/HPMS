"""Covenant testing: the arithmetic on a hand-worked example, then the same example through the API.

The worked example (NPR millions), tested at 2082-83-Q4 (FY 2082/83) over 2025-07-17 .. 2026-07-16:

    four quarters, each: revenue 100, operating expenses 15, royalty 2.5, tax 2, depreciation 12.5
    EBITDA = 400 - 60 - 10 = 330      CFADS = 330 - 8 = 322      EBIT = 330 - 50 = 280
    scheduled in the window: principal 50 + 50, interest 50 + 47.5 -> debt service 197.5
    DSCR = 322 / 197.5 = 1.6304       ICR = 280 / 97.5 = 2.8718
    drawn 1,000, first instalment's 50 repaid, second missed -> owed 950; security 1,450 -> LTV 65.5172

The database tests need the migrated test database from conftest (skipped without one).
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
from backend.app.models.governance import ApprovalRequest
from backend.app.models.auth import ProjectOwner, User
from backend.app.models.financial import DisbursementTranche, LoanAccount, Repayment
from backend.app.models.operations import CovenantHistory
from backend.app.models.project import Project
from backend.app.security import field_policy
from backend.app.security.auth_middleware import TokenManager
from backend.app.security.ldap_provider import ADUser, UserRole
from backend.app.services import covenant_change
from backend.app.services import covenant_engine as engine
from backend.app.services.audit_chain import verify_stored_chain
from backend.app.services.covenant_engine import PeriodFinancials, Quarter, Terms
from backend.app.services.covenant_service import CovenantService

M = Decimal("1000000")
Q2 = Quarter(2082, 4)  # the test date: the last quarter of FY 2082/83
WINDOW = [Quarter(2082, 1), Quarter(2082, 2), Quarter(2082, 3), Q2]


def period(quarter: Quarter, **overrides) -> PeriodFinancials:
    figures = dict(revenue=100 * M, operating_expenses=15 * M, royalty=Decimal("2.5") * M, tax_paid=2 * M,
                   depreciation=Decimal("12.5") * M)
    return PeriodFinancials(quarter=quarter, **{**figures, **overrides})


def worked_example(**kwargs):
    periods = [period(q) for q in WINDOW[:-1]] + [period(Q2, security_value=1450 * M)]
    args = dict(principal_due=100 * M, interest_due=Decimal("97.5") * M, outstanding_principal=950 * M)
    return engine.calculate(Q2, periods, **{**args, **kwargs})


# ------------------------------------------------------------------ arithmetic (no database)

def test_quarters_know_their_bounds_and_neighbours():
    # Baisakh to Ashad 2083, the last quarter of FY 2082/83
    assert (Q2.start, Q2.end, Q2.label) == (date(2026, 4, 14), date(2026, 7, 16), "2082-83-Q4")
    assert Quarter(2082, 2).end == date(2026, 1, 14)  # the last day of Poush
    assert Quarter(2083, 1).shift(-1) == Q2 and Q2.shift(1) == Quarter(2083, 1)
    assert Quarter.of(date(2026, 10, 6)) == Quarter(2083, 1)
    assert Quarter.of(date(2026, 7, 16)) == Q2 and Quarter.of(date(2026, 7, 17)) == Quarter(2083, 1)
    assert Quarter.parse("2082-83-Q4") == Q2
    assert engine.window_of(Q2) == (date(2025, 7, 17), date(2026, 7, 16))


@pytest.mark.parametrize("label", ["2082-83Q4", "2082-83-Q5", "2082-83-Q0", "Q4-2082-83", "", "2082-83-Q", "x-Q1", "2026-Q2", "2082-84-Q1", "2082/83-Q4"])
def test_malformed_quarters_are_rejected(label):
    with pytest.raises(ValueError, match="not a quarter"):
        Quarter.parse(label)


def test_the_worked_example():
    calc = worked_example()

    assert (calc.revenue, calc.ebitda, calc.cfads, calc.ebit) == (400 * M, 330 * M, 322 * M, 280 * M)
    assert calc.quarters_used == ["2082-83-Q1", "2082-83-Q2", "2082-83-Q3", "2082-83-Q4"]
    assert (calc.dscr.value, calc.dscr.status) == (Decimal("1.6304"), "compliant")
    assert (calc.icr.value, calc.icr.status) == (Decimal("2.8718"), "compliant")
    assert (calc.ltv.value, calc.ltv.status) == (Decimal("65.5172"), "warning")  # within 8% of the 70 ceiling
    assert calc.overall_status == "warning"


def test_a_missing_quarter_leaves_the_income_ratios_untested_and_says_which():
    periods = [period(q) for q in WINDOW if q != Quarter(2082, 2)] + [
        PeriodFinancials(Quarter(2082, 2), security_value=1450 * M)]  # a valuation, but no income reported
    calc = engine.calculate(Q2, periods, 100 * M, 97 * M, 900 * M)

    assert calc.dscr.value is None and calc.dscr.status == "not_tested"
    assert calc.icr.status == "not_tested"
    assert "2082-83-Q2" in calc.dscr.note and "2082-83-Q3" not in calc.dscr.note
    assert calc.ltv.value == Decimal("62.0690") and calc.overall_status == "compliant"


def test_no_debt_service_means_no_coverage_ratio_rather_than_a_division_error():
    calc = worked_example(principal_due=Decimal("0"), interest_due=Decimal("0"))
    assert calc.dscr.status == calc.icr.status == "not_tested"
    assert "No debt service" in calc.dscr.note and "No interest" in calc.icr.note


def test_interest_only_period_still_tests_both_ratios():
    calc = worked_example(principal_due=Decimal("0"))
    assert calc.dscr.value == Decimal("3.3026")  # 322 / 97.5
    assert calc.icr.value == Decimal("2.8718")


def test_icr_needs_depreciation_for_every_quarter():
    periods = [period(q) for q in WINDOW[:-1]] + [period(Q2, depreciation=None)]
    calc = engine.calculate(Q2, periods, 100 * M, 97 * M, None)
    assert calc.dscr.status == "compliant" and calc.icr.status == "not_tested"
    assert calc.ltv.status == "not_tested" and "valuation" in calc.ltv.note


def test_ltv_uses_the_latest_valuation_on_or_before_the_test_date():
    periods = [period(Quarter(2082, 1), security_value=2000 * M), period(Quarter(2082, 2)),
               period(Quarter(2082, 3), security_value=1800 * M), period(Q2),
               period(Quarter(2083, 1), security_value=1 * M)]  # later than the test date: ignored
    calc = engine.calculate(Q2, periods, 100 * M, 97 * M, 900 * M)
    assert calc.security_value == 1800 * M and calc.ltv.value == Decimal("50.0000")


@pytest.mark.parametrize("value,higher_is_better,expected", [
    ("1.36", True, "compliant"), ("1.35", True, "compliant"), ("1.3499", True, "warning"),
    ("1.25", True, "warning"), ("1.2499", True, "breached"),
    ("64.4", False, "compliant"), ("64.5", False, "warning"), ("70", False, "warning"), ("70.01", False, "breached"),
])
def test_status_boundaries(value, higher_is_better, expected):
    threshold = Decimal("1.25") if higher_is_better else Decimal("70")
    assert engine.assess(Decimal(value), threshold, higher_is_better, Decimal("8")) == expected


def test_project_terms_replace_the_defaults():
    strict = Terms(dscr_min=Decimal("1.70"), ltv_max=Decimal("60"), icr_min=Decimal("3"))
    calc = worked_example(terms=strict)
    assert {calc.dscr.status, calc.icr.status, calc.ltv.status} == {"breached"}
    assert calc.dscr.threshold == Decimal("1.70")


def test_overall_status_is_the_worst_tested_ratio():
    assert engine.overall_status(["compliant", "not_tested", "warning"]) == "warning"
    assert engine.overall_status(["breached", "warning", "compliant"]) == "breached"
    assert engine.overall_status(["not_tested", "not_tested", None]) == "not_tested"


# ------------------------------------------------------------------ through the database and API

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
async def facility(db_session):
    """The worked example's project and loan: one drawdown, two instalments, the second missed."""
    project = Project(project_code="COV-001", name_en="Covenant Khola", name_np="Covenant Khola", province="Gandaki",
                      installed_capacity_mw=10, project_stage="operation", pipeline_status="under_operation")
    db_session.add(project)
    await db_session.flush()
    loan = LoanAccount(project_id=project.id, finacle_account_id="FIN-COV-1", facility_type="term_loan",
                       sanctioned_amount=1000 * M, disbursed_amount=1000 * M, outstanding_principal=950 * M,
                       interest_rate_pct=Decimal("10"))
    db_session.add(loan)
    await db_session.flush()
    db_session.add_all([
        DisbursementTranche(loan_account_id=loan.id, tranche_no=1, planned_amount=1000 * M, actual_amount=1000 * M,
                            planned_date_ad=date(2024, 1, 15), actual_date_ad=date(2024, 1, 15)),
        Repayment(loan_account_id=loan.id, due_date_ad=date(2025, 12, 1), principal_due=50 * M, interest_due=50 * M,
                  principal_paid=50 * M, interest_paid=50 * M, paid_date_ad=date(2025, 12, 3)),
        Repayment(loan_account_id=loan.id, due_date_ad=date(2026, 6, 1), principal_due=50 * M,
                  interest_due=Decimal("47.5") * M, days_past_due=30),
        # Outside the window on both sides: must not count
        Repayment(loan_account_id=loan.id, due_date_ad=date(2025, 6, 1), principal_due=0, interest_due=50 * M,
                  principal_paid=0, interest_paid=50 * M, paid_date_ad=date(2025, 6, 1)),
        Repayment(loan_account_id=loan.id, due_date_ad=date(2026, 12, 1), principal_due=50 * M, interest_due=45 * M),
    ])
    await db_session.flush()
    return project, loan


FIGURES = {"revenue_npr": "100000000", "operating_expenses_npr": "15000000", "royalty_npr": "2500000",
           "tax_paid_npr": "2000000", "depreciation_npr": "12500000", "source_reference": "Management accounts"}
TERMS = {"dscr_min": "1.70", "ltv_max": "75", "icr_min": "2.0", "source_reference": "SL/2024/118"}
JUSTIFICATION = "Figures per the borrower's submission, checked against the audited accounts"
SUBMIT = "/api/v1/mutations/submit-with-justification"
MUTATIONS = "/api/v1/mutations"


@pytest.fixture
async def owned_facility(api, db_session, facility):
    """The worked example, owned by the demo maker so the maker can propose its figures."""
    project, loan = facility
    await login(api, "maker")  # the maker's user row is created on first sign-in
    owner = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    db_session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
    await db_session.flush()
    return project, loan


def second_admin() -> dict:
    """A second admin: the final check on sanction terms cannot come from the admin who submitted them."""
    token = TokenManager.create_token(
        ADUser(username="admin2", email="admin2@sbl.local", full_name="Second Admin", roles=[UserRole.ADMIN]),
        uuid.uuid4())
    return {"Authorization": f"Bearer {token}"}


async def propose(api, headers, project_id, entity: str, changes: dict):
    """Submit a change request as ``headers``. Returns the response, not yet approved."""
    return await api.post(SUBMIT, headers=headers, json={
        "entity_type": entity, "entity_id": str(project_id), "action": "UPDATE", "changes": changes,
        "justification": JUSTIFICATION})


async def approve(api, headers, request_id: str, verb: str = "approve"):
    return await api.post(f"{MUTATIONS}/{verb}", headers=headers,
                          json={"approval_request_id": request_id, "remarks": "Checked against the file"})


async def record_period(api, project_id, quarter: str, body: dict, maker=None) -> None:
    """Propose a quarter's figures as the maker; the approver recommends, the admin gives the final approval."""
    maker = maker or await login(api, "maker")
    r = await propose(api, maker, project_id, "FINANCIAL_PERIOD", {"quarter_ad": quarter, **body})
    assert r.status_code == 200, r.text
    request_id = r.json()["data"]["approval_request_id"]
    assert (await approve(api, await login(api, "approver"), request_id)).status_code == 200
    final = await approve(api, await login(api, "admin"), request_id)
    assert final.status_code == 200 and final.json()["data"]["changes_applied"] is True, final.text


async def report_year(api, project_id) -> dict:
    """Report the four quarters of the worked example; returns the latest quarter's calculation."""
    for quarter in WINDOW:
        body = {**FIGURES, "security_value_npr": "1450000000"} if quarter == Q2 else FIGURES
        await record_period(api, project_id, quarter.label, body)
    return (await api.get(f"/api/v1/compliance/covenants/{project_id}/calculation",
                          headers=await login(api, "admin"))).json()["data"]


async def test_reporting_a_year_of_figures_tests_the_covenants_and_updates_the_loan(api, db_session, owned_facility):
    project, loan = owned_facility
    admin = await login(api, "admin")
    audit_before = (await db_session.execute(select(func.count()).select_from(AuditLog))).scalar()

    await record_period(api, project.id, "2082-83-Q1", FIGURES)
    first = (await api.get(f"/api/v1/compliance/covenants/{project.id}/calculation", headers=admin)).json()["data"]
    assert first["dscr"]["status"] == "not_tested"  # one quarter is not a year

    calc = await report_year(api, project.id)
    assert (calc["dscr"]["value"], calc["icr"]["value"], calc["ltv"]["value"]) == ("1.6304", "2.8718", "65.5172")
    assert calc["overall_status"] == "warning"
    assert calc["inputs"]["debt_service"] == "197500000.0000" and calc["inputs"]["cfads"] == "322000000.00"
    assert calc["window"] == {"from": "2025-07-17", "to": "2026-07-16",
                              "quarters_used": ["2082-83-Q1", "2082-83-Q2", "2082-83-Q3", "2082-83-Q4"]}

    history = (await db_session.execute(
        select(CovenantHistory).where(CovenantHistory.project_id == project.id)
        .order_by(CovenantHistory.quarter_ad))).scalars().all()
    assert [h.quarter_ad for h in history] == [q.label for q in WINDOW]
    assert [h.dscr_status for h in history] == ["not_tested"] * 3 + ["compliant"]
    assert history[-1].data_provenance == "CALCULATED" and history[-1].quarter_bs == "2082-83-Q4"

    metrics = (await api.get(f"/api/v1/loan-accounts/{loan.id}/covenant-metrics", headers=admin)).json()["data"]
    assert (metrics["dscr"], metrics["ltv"], metrics["metric_as_of_date"]) == ("1.6304", "65.5172", "2026-07-16")
    assert metrics["dscr_pass"] and metrics["ltv_pass"] and metrics["icr_pass"]
    assert metrics["dscr_threshold"] == "1.25"

    # Five applied writes (the first quarter twice), each audited, and the chain still verifies
    applied = [a for a in (await db_session.execute(
        select(AuditLog).where(AuditLog.entity_type == "FINANCIAL_PERIOD").order_by(AuditLog.id))).scalars().all()
        if a.reason_for_action.startswith("Applied approved change request")]
    assert [a.action_performed for a in applied] == ["create", "update", "create", "create", "create"]
    assert "100000000.00" in str(applied[1].pre_state)
    if audit_before == 0:  # a reused test database may hold a chain this test cannot vouch for
        assert (await verify_stored_chain(db_session)).ok

    explained = await api.get(f"/api/v1/compliance/covenants/{project.id}/calculation", headers=admin)
    assert explained.json()["data"]["dscr"]["value"] == "1.6304"
    assert explained.json()["data"]["terms_source"] == "bank defaults"
    older = await api.get(f"/api/v1/compliance/covenants/{project.id}/calculation",
                          params={"quarter": "2082-83-Q3"}, headers=admin)
    assert older.json()["data"]["dscr"]["note"] == "No income figures for 2081-82-Q4"
    for quarter, code in (("2080-81-Q3", 404), ("nonsense", 422)):
        r = await api.get(f"/api/v1/compliance/covenants/{project.id}/calculation",
                          params={"quarter": quarter}, headers=admin)
        assert r.status_code == code


async def test_a_correction_replaces_the_quarter_and_its_result(api, db_session, owned_facility):
    project, loan = owned_facility
    await report_year(api, project.id)

    # Only the corrected field is proposed; the rest of the quarter is kept
    correction = {"quarter_ad": "2082-83-Q4", "operating_expenses_npr": "150000000",
                  "source_reference": "Audited accounts", "is_audited": True}
    maker = await login(api, "maker")
    request_id = (await propose(api, maker, project.id, "FINANCIAL_PERIOD", correction)).json()["data"]["approval_request_id"]
    assert (await approve(api, await login(api, "approver"), request_id)).status_code == 200
    assert (await approve(api, await login(api, "admin"), request_id)).status_code == 200

    admin = await login(api, "admin")
    calc = (await api.get(f"/api/v1/compliance/covenants/{project.id}/calculation", headers=admin)).json()["data"]
    assert calc["dscr"] == {"value": "0.9468", "threshold": "1.25", "status": "breached", "note": None}
    periods = (await api.get(f"/api/v1/compliance/covenants/{project.id}/financials", headers=admin)).json()["data"]["periods"]
    latest = next(p for p in periods if p["quarter"] == "2082-83-Q4")
    assert latest["revenue_npr"] == "100000000.00" and latest["is_audited"] is True

    rows = (await db_session.execute(select(func.count()).select_from(CovenantHistory)
                                     .where(CovenantHistory.project_id == project.id))).scalar()
    assert rows == 4
    await db_session.refresh(loan)
    assert loan.dscr == Decimal("0.9468")

    history = (await api.get(f"/api/v1/compliance/covenants/{project.id}/history", headers=admin)).json()["data"]
    assert history["overall_status"] == "breached"
    assert [a["metric"] for a in history["breach_alerts"]] == ["DSCR", "ICR"]
    assert history["trends"][0]["dscr"] == {"value": None, "threshold": 1.25, "status": "not_tested", "variance_pct": None}
    assert await CovenantService.detect_covenant_breaches(db_session, str(project.id))


async def test_sanction_terms_are_admin_only_and_retest_the_history(api, owned_facility):
    project, _ = owned_facility
    await report_year(api, project.id)
    maker, approver, admin = [await login(api, n) for n in ("maker", "approver", "admin")]

    assert (await propose(api, maker, project.id, "COVENANT_TERMS", TERMS)).status_code == 403
    assert (await propose(api, approver, project.id, "COVENANT_TERMS", TERMS)).status_code == 403
    for bad in ({**TERMS, "ltv_max": "140"}, {**TERMS, "dscr_min": "0"}, {**TERMS, "warning_margin_pct": "100"}):
        r = await propose(api, admin, project.id, "COVENANT_TERMS", bad)
        assert r.status_code == 400, r.text

    r = await propose(api, admin, project.id, "COVENANT_TERMS", TERMS)
    assert r.status_code == 200, r.text
    request_id = r.json()["data"]["approval_request_id"]
    assert (await approve(api, approver, request_id)).status_code == 200
    # The admin who submitted cannot give the final approval; a second admin does
    assert (await approve(api, admin, request_id)).status_code == 403
    assert (await approve(api, second_admin(), request_id)).status_code == 200

    financials = (await api.get(f"/api/v1/compliance/covenants/{project.id}/financials", headers=admin)).json()["data"]
    assert financials["terms"]["source"] == "sanction terms"
    assert len(financials["periods"]) == 4 and financials["periods"][0]["quarter"] == "2082-83-Q4"

    calc = (await api.get(f"/api/v1/compliance/covenants/{project.id}/calculation", headers=admin)).json()["data"]
    assert calc["dscr"]["status"] == "breached" and calc["dscr"]["threshold"] == "1.7000"
    assert calc["ltv"]["status"] == "compliant"  # 65.52 against 75


async def test_figures_are_validated_when_proposed(api, db_session, facility):
    project, _ = facility
    admin = await login(api, "admin")
    future = Quarter.of(date.today())
    for quarter, body, problem in (
        (future.label, FIGURES, "has not ended"),
        (future.shift(4).label, FIGURES, "has not ended"),
        ("2082-83-Q7", FIGURES, "not a quarter"),
        ("2082-83-Q4", {**FIGURES, "revenue_npr": "-1"}, "cannot be negative"),
        ("2082-83-Q4", {**FIGURES, "security_value_npr": "0"}, "greater than zero"),
        ("2082-83-Q4", {"revenue_npr": "1"}, "source_reference"),  # no source given
        ("2082-83-Q4", {**FIGURES, "data_provenance": "CBS"}, "not a field"),
    ):
        r = await propose(api, admin, project.id, "FINANCIAL_PERIOD", {"quarter_ad": quarter, **body})
        assert r.status_code == 400 and problem in r.json()["detail"], r.text
    assert (await propose(api, admin, project.id, "FINANCIAL_PERIOD", FIGURES)).status_code == 400  # no quarter named

    # Nothing was proposed, so nothing is pending or recorded
    assert (await db_session.execute(select(func.count()).select_from(ApprovalRequest))).scalar() == 0
    url = f"/api/v1/compliance/covenants/{project.id}/financials"
    assert (await api.get(url, headers=admin)).json()["data"]["periods"] == []


async def test_only_the_owning_maker_or_an_admin_may_propose_figures(api, db_session, facility):
    project, _ = facility
    maker, auditor, guest = await login(api, "maker"), await login(api, "auditor"), await login(api, "guest")
    url = f"/api/v1/compliance/covenants/{project.id}"

    # A maker who does not own the project cannot even see it; a guest cannot propose anything
    assert (await propose(api, maker, project.id, "FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES})).status_code == 404
    assert (await propose(api, guest, project.id, "FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES})).status_code == 403
    assert (await api.get(f"{url}/financials", headers=guest)).status_code == 404
    # An auditor sees everything and proposes nothing
    assert (await api.get(f"{url}/financials", headers=auditor)).status_code == 200
    assert (await propose(api, auditor, project.id, "FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES})).status_code == 403
    assert (await api.post(f"{url}/recalculate", headers=auditor)).status_code == 403

    owner = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    db_session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
    await db_session.flush()
    await record_period(api, project.id, "2082-83-Q4", FIGURES, maker=maker)
    r = await api.post(f"{url}/recalculate", headers=maker)
    assert r.status_code == 200 and r.json()["data"]["quarters_tested"] == 1


async def test_direct_writes_to_covenant_inputs_are_closed(api, facility):
    project, _ = facility
    admin = await login(api, "admin")
    url = f"/api/v1/compliance/covenants/{project.id}"
    r = await api.put(f"{url}/financials/2082-83-Q4", json=FIGURES, headers=admin)
    assert r.status_code == 409 and "change request" in r.json()["detail"] and "FINANCIAL_PERIOD" in r.json()["detail"]
    r = await api.put(f"{url}/terms", json=TERMS, headers=admin)
    assert r.status_code == 409 and "COVENANT_TERMS" in r.json()["detail"]
    assert (await api.get(f"{url}/financials", headers=admin)).json()["data"]["periods"] == []


async def test_a_proposal_changes_nothing_until_two_checkers_approve(api, db_session, facility):
    project, _ = facility
    maker, approver, admin = [await login(api, n) for n in ("maker", "approver", "admin")]
    owner = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    db_session.add(ProjectOwner(project_id=project.id, user_id=owner.id))
    await db_session.flush()
    url = f"/api/v1/compliance/covenants/{project.id}/financials"

    r = await propose(api, maker, project.id, "FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES})
    assert r.status_code == 200, r.text
    request_id = r.json()["data"]["approval_request_id"]
    assert (await api.get(url, headers=admin)).json()["data"]["periods"] == []

    # The maker cannot check their own work; the approver's recommendation alone applies nothing
    assert (await approve(api, maker, request_id)).status_code == 403
    first = await approve(api, approver, request_id)
    assert first.status_code == 200 and first.json()["data"]["changes_applied"] is False
    assert (await api.get(url, headers=admin)).json()["data"]["periods"] == []
    assert (await approve(api, approver, request_id)).status_code == 403  # the recommender cannot also approve

    final = await approve(api, admin, request_id)
    assert final.status_code == 200 and final.json()["data"]["changes_applied"] is True
    assert [p["quarter"] for p in (await api.get(url, headers=admin)).json()["data"]["periods"]] == ["2082-83-Q4"]


async def test_a_rejected_proposal_leaves_no_trace(api, facility):
    project, _ = facility
    approver, admin = await login(api, "approver"), await login(api, "admin")
    r = await propose(api, admin, project.id, "FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES})
    request_id = r.json()["data"]["approval_request_id"]
    rejected = await api.post(f"{MUTATIONS}/reject", headers=approver,
                              json={"approval_request_id": request_id, "remarks": "Figures do not match the accounts"})
    assert rejected.status_code == 200, rejected.text
    assert (await approve(api, admin, request_id)).status_code == 400  # a rejected request cannot be approved
    assert (await api.get(f"/api/v1/compliance/covenants/{project.id}/financials", headers=admin)).json()["data"]["periods"] == []


async def test_portfolio_lists_the_latest_result_per_visible_project_worst_first(api, db_session, facility):
    project, _ = facility
    admin, guest = await login(api, "admin"), await login(api, "guest")
    maker = await login(api, "maker")
    healthy = Project(project_code="COV-002", name_en="Aaramdayak Khola", name_np="Aaramdayak Khola",
                      province="Koshi", installed_capacity_mw=5, project_stage="construction",
                      pipeline_status="under_construction")
    db_session.add(healthy)
    await db_session.flush()
    db_session.add(LoanAccount(project_id=healthy.id, finacle_account_id="FIN-COV-2", sanctioned_amount=500 * M,
                               outstanding_principal=300 * M))
    owner = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    db_session.add_all([ProjectOwner(project_id=healthy.id, user_id=owner.id),
                        ProjectOwner(project_id=project.id, user_id=owner.id)])
    await db_session.flush()

    await report_year(api, project.id)
    latest_done = Quarter.of(date.today()).shift(-1)
    await record_period(api, healthy.id, latest_done.label,
                        {"security_value_npr": "1000000000", "source_reference": "Valuation report"}, maker=maker)
    # No drawdown records: today's balance stands in for the latest quarter only
    healthy_calc = (await api.get(f"/api/v1/compliance/covenants/{healthy.id}/calculation",
                                  headers=admin)).json()["data"]
    assert healthy_calc["ltv"]["value"] == "30.0000", healthy_calc
    assert healthy_calc["dscr"]["status"] == "not_tested"

    rows = [x for x in (await api.get("/api/v1/compliance/covenants", headers=admin)).json()["data"]
            if x["project_code"].startswith("COV-")]
    assert [(x["project_code"], x["quarter"], x["overall_status"]) for x in rows] == [
        ("COV-001", "2082-83-Q4", "warning"), ("COV-002", latest_done.label, "compliant")]
    assert rows[0]["ltv"] == {"value": "65.5172", "threshold": "70.0000", "status": "warning"}
    assert (await api.get("/api/v1/compliance/covenants", headers=guest)).json()["data"] == []


# ------------------------------------------------------------------ change request rules (no database)

def test_a_covenant_proposal_names_its_quarter_and_no_unknown_fields():
    with pytest.raises(ValueError, match="quarter_ad is required"):
        covenant_change._typed("FINANCIAL_PERIOD", FIGURES)
    with pytest.raises(ValueError, match="data_provenance is not a field of FINANCIAL_PERIOD"):
        covenant_change._typed("FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES, "data_provenance": "CBS"})
    quarter, values = covenant_change._typed("FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", "revenue_npr": "1",
                                                                  "source_reference": "Accounts"})
    assert quarter == "2082-83-Q4" and values == {"revenue_npr": Decimal("1"), "source_reference": "Accounts"}


def test_terms_always_carry_all_four_thresholds_and_the_default_margin():
    _, values = covenant_change._typed("COVENANT_TERMS", TERMS)
    assert values == {"dscr_min": Decimal("1.70"), "ltv_max": Decimal("75"), "icr_min": Decimal("2.0"),
                      "warning_margin_pct": Decimal("8"), "source_reference": "SL/2024/118"}


def test_calculated_fields_are_never_proposable():
    with pytest.raises(ValueError, match="dscr is not a field of FINANCIAL_PERIOD"):
        covenant_change._typed("FINANCIAL_PERIOD", {"quarter_ad": "2082-83-Q4", **FIGURES, "dscr": "1"})


@pytest.mark.parametrize("entity,changes,role,allowed", [
    ("COVENANT_TERMS", {"dscr_min": "1.7"}, UserRole.MAKER, False),
    ("COVENANT_TERMS", {"dscr_min": "1.7"}, UserRole.ADMIN, True),
    ("FINANCIAL_PERIOD", {"revenue_npr": "1"}, UserRole.MAKER, True),
    ("FINANCIAL_PERIOD", {"revenue_npr": "1"}, UserRole.APPROVER, False),
])
def test_who_may_propose_covenant_inputs(entity, changes, role, allowed):
    assert (field_policy.violations(entity, changes, [role]) == []) is allowed
