"""Sprint D2 through the API: budget lines, projection figures, settings and approval rules, all by change request.

Needs the migrated test database from conftest (skipped without one).
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.auth import ProjectOwner, User
from backend.app.models.financial import BudgetLine, LoanProjectionQuarter
from backend.app.models.project import Project
from backend.app.services import app_settings
from backend.app.services.alert_service import AlertService
from backend.app.services.covenant_service import CovenantService

REASON = "Board-approved revision of the project budget (test)"


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
async def people(api):
    return {name: await login(api, name) for name in ("maker", "approver", "admin", "admin2")}


@pytest.fixture
async def project(db_session, people):
    project = Project(project_code="D2-001", name_en="Budget Khola", name_np="Budget Khola", province="Gandaki",
                      installed_capacity_mw=10, project_stage="construction", pipeline_status="under_construction")
    db_session.add(project)
    await db_session.flush()
    maker = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    db_session.add(ProjectOwner(user_id=maker.id, project_id=project.id, ownership_type="direct"))
    await db_session.flush()
    return project


async def propose(api, headers, entity_type, entity_id, changes, justification=REASON):
    return await api.post("/api/v1/mutations/submit-with-justification", headers=headers, json={
        "entity_type": entity_type, "entity_id": str(entity_id), "action": "UPDATE", "changes": changes,
        "justification": justification})


async def decide(api, headers, request_id):
    return await api.post("/api/v1/mutations/approve", headers=headers, json={"approval_request_id": request_id})


def request_id(response) -> str:
    assert response.status_code in (200, 201), response.text
    body = response.json()
    return body.get("approval_request_id") or body["data"]["approval_request_id"]


# ---------------------------------------------------------------- budget (B.2, C.4, F.9, G.3)

async def test_budget_lines_change_only_after_two_checks_and_variance_is_calculated(api, db_session, people, project):
    r = await propose(api, people["maker"], "BUDGET_LINE", project.id, {
        "source_reference": "Budget FY 2082/83",
        "lines": [{"category": "Civil works", "budgeted_amount": "1000000", "actual_amount": "1150000"},
                  {"category": "Transmission line", "budgeted_amount": "500000", "actual_amount": "200000"}]})
    rid = request_id(r)
    budget = (await api.get(f"/api/v1/projects/{project.id}/budget", headers=people["maker"])).json()["data"]
    assert budget["lines"] == []

    assert (await decide(api, people["approver"], rid)).status_code == 200
    assert (await decide(api, people["admin"], rid)).status_code == 200
    budget = (await api.get(f"/api/v1/projects/{project.id}/budget", headers=people["maker"])).json()["data"]
    civil = next(line for line in budget["lines"] if line["category"] == "Civil works")
    assert Decimal(civil["variance_amount"]) == Decimal("150000") and Decimal(civil["variance_pct"]) == Decimal("15")
    assert budget["totals"]["overspent_lines"] == 1
    assert Decimal(budget["totals"]["budgeted_amount"]) == Decimal("1500000")

    # A second request updates one line and removes the other
    transmission = next(line for line in budget["lines"] if line["category"] == "Transmission line")
    rid = request_id(await propose(api, people["maker"], "BUDGET_LINE", project.id, {
        "source_reference": "Mid-year review",
        "lines": [{"id": civil["id"], "category": "Civil works", "budgeted_amount": "1200000", "actual_amount": "1150000"}],
        "remove": [transmission["id"]]}))
    await decide(api, people["approver"], rid)
    await decide(api, people["admin"], rid)
    lines = (await db_session.execute(select(BudgetLine).where(BudgetLine.project_id == project.id))).scalars().all()
    assert [(line.category, line.variance_amount) for line in lines] == [("Civil works", Decimal("-50000"))]


@pytest.mark.parametrize("changes,problem", [
    ({"lines": [{"category": "Civil", "budgeted_amount": "-1"}], "source_reference": "x" * 5}, "cannot be negative"),
    ({"lines": [{"category": "Civil", "budgeted_amount": "1"}, {"category": "civil ", "budgeted_amount": "2"}],
      "source_reference": "x" * 5}, "appear twice"),
    ({"lines": [{"category": "Civil", "budgeted_amount": "1"}]}, "source_reference is required"),
    ({"lines": [], "source_reference": "x" * 5}, "Nothing to change"),
])
async def test_bad_budget_changes_are_refused_when_proposed(api, people, project, changes, problem):
    r = await propose(api, people["maker"], "BUDGET_LINE", project.id, changes)
    assert r.status_code in (400, 422) and problem in r.text


async def test_a_maker_cannot_propose_a_budget_for_a_project_they_do_not_own(api, db_session, people):
    other = Project(project_code="D2-002", name_en="Other Khola", name_np="Other Khola", province="Koshi",
                    installed_capacity_mw=1, project_stage="construction", pipeline_status="under_construction")
    db_session.add(other)
    await db_session.flush()
    r = await propose(api, people["maker"], "BUDGET_LINE", other.id,
                      {"lines": [{"category": "Civil", "budgeted_amount": "1"}], "source_reference": "Budget"})
    assert r.status_code in (403, 404)


async def test_the_upload_preview_reports_row_errors_and_matches_existing_categories(api, db_session, people, project):
    db_session.add(BudgetLine(project_id=project.id, category="Civil works", budgeted_amount=Decimal("10"),
                              actual_amount=Decimal("0")))
    await db_session.flush()
    sheet = ("Category,Budgeted amount,Actual amount\n"
             "civil works,1000,900\nTransmission line,500,\n,10,1\nLand,abc,1\nTransmission line,1,1\n")
    r = await api.post(f"/api/v1/projects/{project.id}/budget/preview", headers=people["maker"],
                       files={"file": ("budget.csv", sheet.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert [(line["category"], line["change"]) for line in data["lines"]] == [("civil works", "update"),
                                                                             ("Transmission line", "add")]
    assert [e["row"] for e in data["errors"]] == [4, 5, 6]
    assert "listed twice" in data["errors"][2]["message"]
    assert data["upload_batch_id"].startswith("UPLOAD-")

    missing = await api.post(f"/api/v1/projects/{project.id}/budget/preview", headers=people["maker"],
                             files={"file": ("budget.csv", b"Head,Amount\nCivil,1\n", "text/csv")})
    assert missing.status_code == 422 and "first row must name the columns" in missing.json()["detail"]


# ---------------------------------------------------------------- projection (B.6)

async def test_a_projection_change_carries_the_balance_down_after_approval(api, db_session, people, project):
    quarters = [("2083/84", 1, True, "0", "0", "1000"), ("2083/84", 2, False, "100", "50", "1050"),
                ("2083/84", 3, False, "0", "50", "1000")]
    for number, (fy, q, opening, disb, repay, out) in enumerate(quarters):
        db_session.add(LoanProjectionQuarter(
            project_id=project.id, fiscal_year=fy, quarter=q, period_end_ad=date(2026, 10 + number, 15),
            is_opening=opening, projected_disbursement=Decimal(disb), projected_repayment=Decimal(repay),
            projected_outstanding=Decimal(out)))
    await db_session.flush()

    refused = await propose(api, people["maker"], "LOAN_PROJECTION", project.id, {
        "source_reference": "Plan", "quarters": [{"fiscal_year": "2083/84", "quarter": 1, "projected_disbursement": "5"}]})
    assert refused.status_code in (400, 422) and "opening quarter" in refused.text
    too_much = await propose(api, people["maker"], "LOAN_PROJECTION", project.id, {
        "source_reference": "Plan", "quarters": [{"fiscal_year": "2083/84", "quarter": 3, "projected_repayment": "5000"}]})
    assert too_much.status_code in (400, 422) and "exceed the balance" in too_much.text

    rid = request_id(await propose(api, people["maker"], "LOAN_PROJECTION", project.id, {
        "source_reference": "Revised drawdown plan",
        "quarters": [{"fiscal_year": "2083/84", "quarter": 2, "projected_disbursement": "300", "projected_repayment": "50"}]}))
    await decide(api, people["approver"], rid)
    await decide(api, people["admin"], rid)
    rows = (await db_session.execute(select(LoanProjectionQuarter).where(LoanProjectionQuarter.project_id == project.id)
                                     .order_by(LoanProjectionQuarter.period_end_ad))).scalars().all()
    assert [row.projected_outstanding for row in rows] == [Decimal("1000"), Decimal("1250"), Decimal("1200")]


# ---------------------------------------------------------------- settings (A.5)

async def test_a_setting_needs_an_admin_to_propose_and_another_admin_to_approve(api, db_session, people):
    maker = await propose(api, people["maker"], "SETTING", "alert_warning_days", {"value": "60"})
    assert maker.status_code == 403

    rid = request_id(await propose(api, people["admin"], "SETTING", "alert_warning_days", {"value": "60"},
                                   justification="Insurers ask for sixty days of notice now (test)"))
    assert (await decide(api, people["approver"], rid)).status_code == 200  # recommendation
    final = await decide(api, people["approver"], rid)
    assert final.status_code == 403  # final approval is an administrator's, and not the one who proposed it
    assert (await decide(api, people["admin"], rid)).status_code == 403
    assert (await decide(api, people["admin2"], rid)).status_code == 200
    assert await app_settings.value(db_session, "alert_warning_days") == Decimal("60")

    listed = {s["name"]: s for s in (await api.get("/api/v1/admin/settings", headers=people["admin"])).json()["data"]}
    assert listed["alert_warning_days"]["value"] == "60" and listed["alert_warning_days"]["is_default"] is False


async def test_settings_are_checked_against_their_limits_and_each_other(api, people):
    over = await propose(api, people["admin"], "SETTING", "alert_warning_days", {"value": "400"},
                         justification="Testing the upper limit of the setting")
    assert over.status_code in (400, 422) and "between 7 and 365" in over.text
    crossed = await propose(api, people["admin"], "SETTING", "alert_critical_days", {"value": "120"},
                            justification="Testing the rule across the two settings")
    assert crossed.status_code in (400, 422) and "shorter than the warning lead time" in crossed.text


async def test_the_alert_run_uses_the_warning_lead_time_setting(db_session, project):
    from backend.app.models.risk import InsurancePolicy

    expiring = date.today().toordinal() + 75
    db_session.add(InsurancePolicy(project_id=project.id, policy_number=f"P-{uuid.uuid4()}", insurer="Insurer",
                                   policy_type="car", valid_from_ad=date.today(), valid_to_ad=date.fromordinal(expiring)))
    await db_session.flush()
    alerts = await AlertService.get_expiry_alerts(db_session, str(project.id))
    assert alerts["warning_count"] == 1  # 75 days is inside the default 90
    await app_settings.save(db_session, "alert_warning_days", Decimal("60"), "test")
    alerts = await AlertService.get_expiry_alerts(db_session, str(project.id))
    assert alerts["total_alerts"] == 0


async def test_default_covenant_thresholds_come_from_the_settings(db_session, project):
    assert (await CovenantService.default_terms(db_session)).dscr_min == Decimal("1.25")
    await app_settings.save(db_session, "default_dscr_min", Decimal("1.4"), "test")
    terms, row = await CovenantService.terms_for(db_session, project.id)
    assert row is None and terms.dscr_min == Decimal("1.4")


# ---------------------------------------------------------------- approval rules (A.3, D.9)

async def test_an_approval_rule_change_applies_to_new_requests_only(api, people, project):
    budget = {"lines": [{"category": "Civil", "budgeted_amount": "1"}], "source_reference": "Budget FY 2083/84"}
    before_rule = request_id(await propose(api, people["maker"], "BUDGET_LINE", project.id, budget))

    rule = {"steps": ["submitted", "approved"], "approve_roles": ["approver"]}
    rid = request_id(await propose(api, people["admin"], "APPROVAL_RULE", "BUDGET_LINE", rule,
                                   justification="Budget lines need one check only (test)"))
    await decide(api, people["approver"], rid)
    assert (await decide(api, people["admin2"], rid)).status_code == 200

    rules = {r["entity_type"]: r for r in (await api.get("/api/v1/admin/approval-rules", headers=people["admin"])).json()["data"]}
    assert rules["BUDGET_LINE"]["steps"] == ["submitted", "approved"] and rules["BUDGET_LINE"]["version"] == 2

    after_rule = request_id(await propose(api, people["maker"], "BUDGET_LINE", project.id,
                                          {**budget, "lines": [{"category": "Land", "budgeted_amount": "2"}]}))
    assert (await decide(api, people["admin"], after_rule)).status_code == 403  # the rule names approvers only
    approved = await decide(api, people["approver"], after_rule)
    assert approved.status_code == 200 and approved.json()["data"]["new_state"] == "approved"

    # The request raised before the change still needs two checks
    first = await decide(api, people["approver"], before_rule)
    assert first.json()["data"]["new_state"] == "recommended"


async def test_nonsense_rules_are_refused(api, people):
    r = await propose(api, people["admin"], "APPROVAL_RULE", "BUDGET_LINE",
                      {"steps": ["submitted", "approved"], "approve_roles": ["maker"]},
                      justification="A maker may not be a checker (test)")
    assert r.status_code in (400, 422) and "choose from approver, admin" in r.text


async def test_the_capex_report_flags_heads_over_budget(api, db_session, people, project):
    rid = request_id(await propose(api, people["maker"], "BUDGET_LINE", project.id, {
        "source_reference": "Budget FY 2082/83",
        "lines": [{"category": "Civil works", "budgeted_amount": "100", "actual_amount": "130"},
                  {"category": "Land", "budgeted_amount": "100", "actual_amount": "40"}]}))
    await decide(api, people["approver"], rid)
    await decide(api, people["admin"], rid)
    r = await api.post("/api/v1/reports/builder/run", headers=people["admin"], json={
        "source": "capex_progress", "columns": ["project_code", "budget_category", "variance_amount", "overspent"],
        "format": "json"})
    assert r.status_code == 200, r.text
    rows = [row for row in r.json()["data"] if row["project_code"] == "D2-001"]
    assert sorted((row["budget_category"], row["overspent"], row["variance_amount"]) for row in rows) == [
        ("Civil works", "Yes", 30.0), ("Land", "No", -60.0)]
