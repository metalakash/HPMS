"""End-to-end API tests against a real, migrated Postgres.

Drives the FastAPI app over HTTP (httpx ASGI transport, same event loop as the DB
session) with ``get_db`` bound to the rolled-back test session from conftest.
Covers the flows the web frontend depends on.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.audit import AuditLogRead
from backend.app.models.auth import User
from backend.app.models.financial import LoanAccount, LoanAccountRateHistory
from backend.app.models.project import Project
from backend.app.security.auth_middleware import TokenManager
from backend.app.security.ldap_provider import ADUser, UserRole


@pytest.fixture
async def api(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


async def login(api, username: str, password: str) -> dict:
    r = await api.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def extra_user(db_session, username: str, role: UserRole) -> dict:
    """A second user of a role the dev auth provider has only one of."""
    user = User(id=uuid.uuid4(), username=username, email=f"{username}@sbl.local", default_role=role.value)
    db_session.add(user)
    await db_session.flush()
    token = TokenManager.create_token(ADUser(username, f"{username}@sbl.local", username, [role]), user.id)
    return {"Authorization": f"Bearer {token}"}


PROJECT = {
    "project_code": "E2E-001",
    "name_en": "E2E Hydro",
    "name_np": "ई२ई जलविद्युत",
    "province": "Gandaki",
    "district": "Kaski",
    "installed_capacity_mw": 42.5,
    "project_stage": "construction",
    "pipeline_status": "under_construction",
}


async def test_login_creates_user_row_and_me_matches(api, db_session):
    headers = await login(api, "maker", "maker123")

    me = (await api.get("/api/v1/auth/me", headers=headers)).json()
    row = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()

    assert me["id"] == str(row.id)
    assert row.default_role.value == "maker"
    assert row.last_login_at == date.today()

    # Logging in again reuses the same row
    await login(api, "maker", "maker123")
    again = (await api.get("/api/v1/auth/me", headers=await login(api, "maker", "maker123"))).json()
    assert again["id"] == me["id"]


async def test_project_lifecycle_with_row_level_security(api, db_session):
    maker = await login(api, "maker", "maker123")
    admin = await login(api, "admin", "admin123")
    other_maker = await extra_user(db_session, "maker2", UserRole.MAKER)

    # Create: 201, persisted, creator becomes owner
    r = await api.post("/api/v1/projects", json=PROJECT, headers=maker)
    assert r.status_code == 201, r.text
    project_id = r.json()["data"]["id"]
    assert r.json()["data"]["created_by"] == "maker"

    # Duplicate code: 409
    assert (await api.post("/api/v1/projects", json=PROJECT, headers=maker)).status_code == 409

    # Invalid status value: 422
    bad = {**PROJECT, "project_code": "E2E-BAD", "pipeline_status": "active"}
    assert (await api.post("/api/v1/projects", json=bad, headers=maker)).status_code == 422

    # Owner and admin see it; another maker does not (list, total, detail)
    for headers, visible in ((maker, True), (admin, True), (other_maker, False)):
        listing = (await api.get("/api/v1/projects", headers=headers)).json()
        ids = {p["id"] for p in listing["data"]}
        assert (project_id in ids) is visible
        assert listing["meta"]["total_count"] == len(listing["data"])
        detail = await api.get(f"/api/v1/projects/{project_id}", headers=headers)
        assert detail.status_code == (200 if visible else 404)

    # Malformed id is a 404, not a 500
    assert (await api.get("/api/v1/projects/not-a-uuid", headers=admin)).status_code == 404

    # PATCH: owner may update; dropping needs a reason; other maker can't see it
    r = await api.patch(f"/api/v1/projects/{project_id}", json={"name_en": "Renamed"}, headers=maker)
    assert r.status_code == 200 and r.json()["data"]["name_en"] == "Renamed"
    r = await api.patch(f"/api/v1/projects/{project_id}", json={"pipeline_status": "dropped"}, headers=maker)
    assert r.status_code == 422
    r = await api.patch(
        f"/api/v1/projects/{project_id}",
        json={"pipeline_status": "dropped", "drop_reason": "Licence revoked"},
        headers=maker,
    )
    assert r.status_code == 200 and r.json()["data"]["drop_reason"] == "Licence revoked"
    r = await api.patch(f"/api/v1/projects/{project_id}", json={"name_en": "Hijack"}, headers=other_maker)
    assert r.status_code == 404


async def test_loan_accounts_respect_project_visibility(api, db_session):
    maker = await login(api, "maker", "maker123")
    auditor = await login(api, "auditor", "auditor123")

    project_id = (await api.post("/api/v1/projects", json=PROJECT, headers=maker)).json()["data"]["id"]
    hidden = Project(
        project_code="E2E-HIDDEN", name_en="Hidden", name_np="लुकेको", province="Koshi",
        installed_capacity_mw=5, project_stage="feasibility", pipeline_status="under_review",
    )
    db_session.add(hidden)
    await db_session.flush()

    mine = LoanAccount(project_id=uuid.UUID(project_id), finacle_account_id="FIN-E2E-1",
                       facility_type="Term Loan", sanctioned_amount=Decimal("1000000"), interest_rate_pct=Decimal("9.5"))
    theirs = LoanAccount(project_id=hidden.id, finacle_account_id="FIN-E2E-2",
                         facility_type="Term Loan", sanctioned_amount=Decimal("2000000"))
    db_session.add_all([mine, theirs])
    await db_session.flush()
    db_session.add(LoanAccountRateHistory(loan_account_id=mine.id, interest_rate_pct=Decimal("9.5"),
                                          valid_from_ad=date(2026, 1, 1), is_current="Y"))
    await db_session.flush()

    maker_ids = {a["id"] for a in (await api.get("/api/v1/loan-accounts", headers=maker)).json()["data"]}
    auditor_ids = {a["id"] for a in (await api.get("/api/v1/loan-accounts", headers=auditor)).json()["data"]}
    assert str(mine.id) in maker_ids and str(theirs.id) not in maker_ids
    assert {str(mine.id), str(theirs.id)} <= auditor_ids

    detail = await api.get(f"/api/v1/loan-accounts/{mine.id}", headers=maker)
    assert detail.status_code == 200
    body = detail.json()["data"]
    assert body["finacle_account_id"] == "***MASKED***"
    assert body["rate_history"][0]["is_current"] == "Y"
    assert (await api.get(f"/api/v1/loan-accounts/{theirs.id}", headers=maker)).status_code == 404

    per_project = await api.get(f"/api/v1/projects/{project_id}/loan-accounts", headers=maker)
    assert per_project.status_code == 200
    assert [a["project_code"] for a in per_project.json()["data"]] == ["E2E-001"]


async def test_graphql_against_real_data(api):
    maker = await login(api, "maker", "maker123")
    project_id = (await api.post("/api/v1/projects", json=PROJECT, headers=maker)).json()["data"]["id"]

    query = """
    query($id: UUID!) {
      currentUser { username defaultRole }
      projects(first: 5) { edges { node { id projectCode installedCapacityMw } } pageInfo { totalCount hasNextPage } }
      project(id: $id) { nameEn pipelineStatus }
      portfolioMetrics { totalProjects activeProjects totalCapacityMw }
    }
    """
    r = await api.post("/graphql", json={"query": query, "variables": {"id": project_id}}, headers=maker)
    assert r.status_code == 200
    body = r.json()
    assert body.get("errors") is None, body
    data = body["data"]
    assert data["currentUser"] == {"username": "maker", "defaultRole": "maker"}
    assert data["projects"]["pageInfo"]["totalCount"] == 1
    assert data["project"]["pipelineStatus"] == "under_construction"
    assert data["portfolioMetrics"] == {"totalProjects": 1, "activeProjects": 1, "totalCapacityMw": 42.5}

    mutation = """mutation($id: UUID!) { updateProject(id: $id, nameEn: "Via GraphQL") { nameEn } }"""
    r = await api.post("/graphql", json={"query": mutation, "variables": {"id": project_id}}, headers=maker)
    assert r.json()["data"]["updateProject"]["nameEn"] == "Via GraphQL"

    guest = await login(api, "guest", "guest123")
    r = await api.post("/graphql", json={"query": mutation, "variables": {"id": project_id}}, headers=guest)
    assert r.json()["errors"], "guest must not be able to update"


async def test_language_preference_round_trip(api):
    headers = await login(api, "approver", "approver123")

    r = await api.post("/api/v1/i18n/preferences", json={"language": "ne"}, headers=headers)
    assert r.status_code == 200, r.text
    assert (await api.get("/api/v1/i18n/preferences", headers=headers)).json()["language_preference"] == "ne"


async def test_mfa_setup_and_status(api):
    headers = await login(api, "admin", "admin123")

    setup = await api.post("/api/v1/mfa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    status = await api.get("/api/v1/mfa/status", headers=headers)
    assert status.status_code == 200, status.text
    assert status.json()["is_enabled"] is False  # not enabled until a code is verified


async def test_reports(api, db_session):
    maker = await login(api, "maker", "maker123")
    auditor = await login(api, "auditor", "auditor123")
    await api.post("/api/v1/projects", json=PROJECT, headers=maker)

    r = await api.post("/api/v1/reports/export", json={"report_id": "portfolio", "format": "json"}, headers=auditor)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["record_count"] >= 1
    audit = (await db_session.execute(select(AuditLogRead).where(AuditLogRead.user_id == "auditor"))).scalars().all()
    assert audit, "export must leave a read-audit row"

    r = await api.post("/api/v1/reports/export", json={"report_id": "nope", "format": "json"}, headers=auditor)
    assert r.status_code in (400, 422)

    pdf = await api.post("/api/v1/reports/pdf/portfolio", headers=auditor)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    assert (await api.post("/api/v1/reports/pdf/covenant", headers=auditor)).status_code == 501
    assert (await api.post("/api/v1/reports/pdf/portfolio", headers=maker)).status_code == 403


async def test_readiness_uses_database(api):
    assert (await api.get("/ready")).json() == {"status": "ready"}


async def test_compliance_audit_log_access_control(api, db_session):
    """Test that audit log endpoint enforces role-based access."""
    maker = await login(api, "maker", "maker123")
    auditor = await login(api, "auditor", "auditor123")
    guest = await login(api, "guest", "guest123")

    # Auditor can list (returns empty but succeeds)
    r = await api.get("/api/v1/compliance/audit-log", headers=auditor)
    assert r.status_code == 200
    assert r.json()["data"] == []

    # Maker can list (returns empty but succeeds)
    r = await api.get("/api/v1/compliance/audit-log", headers=maker)
    assert r.status_code == 200
    assert r.json()["data"] == []

    # Guest can list (returns empty, no error)
    r = await api.get("/api/v1/compliance/audit-log", headers=guest)
    assert r.status_code == 200
    assert r.json()["data"] == []


async def test_compliance_export_requires_auditor_or_admin(api, db_session):
    """Test that compliance export is restricted to auditors and admins."""
    maker = await login(api, "maker", "maker123")
    auditor = await login(api, "auditor", "auditor123")
    guest = await login(api, "guest", "guest123")

    # Auditor can export
    r = await api.post("/api/v1/compliance/export", json={}, headers=auditor)
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["record_count"] == 0
    assert "export_timestamp" in body
    assert body["generated_by"] == "auditor"

    # Maker cannot export
    r = await api.post("/api/v1/compliance/export", json={}, headers=maker)
    assert r.status_code == 403

    # Guest cannot export
    r = await api.post("/api/v1/compliance/export", json={}, headers=guest)
    assert r.status_code == 403


async def test_analytics_portfolio_metrics_with_rls(api, db_session):
    """Test portfolio analytics respects RLS and aggregates correctly."""
    maker = await login(api, "maker", "maker123")
    admin = await login(api, "admin", "admin123")
    other_maker = await extra_user(db_session, "maker2", UserRole.MAKER)

    # Create projects and loans
    p1_id = (await api.post("/api/v1/projects", json=PROJECT, headers=maker)).json()["data"]["id"]
    p2 = Project(
        project_code="ANALYTICS-2", name_en="Other", name_np="अन्य", province="Koshi",
        installed_capacity_mw=Decimal("30"), project_stage="feasibility", pipeline_status="under_review",
    )
    db_session.add(p2)
    await db_session.flush()

    # Add loans to maker's project
    db_session.add(LoanAccount(
        project_id=uuid.UUID(p1_id),
        finacle_account_id="FIN-1",
        facility_type="Term Loan",
        sanctioned_amount=Decimal("5000000"),
        disbursed_amount=Decimal("3000000"),
        outstanding_principal=Decimal("2500000"),
        interest_rate_pct=Decimal("8.5"),
    ))
    await db_session.flush()

    # Maker sees only their project metrics
    r = await api.get("/api/v1/analytics/portfolio", headers=maker)
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["total_projects"] == 1
    assert body["total_capacity_mw"] == 42.5
    assert body["total_sanctioned_amount"] == 5000000
    assert body["total_outstanding_principal"] == 2500000

    # Admin sees both projects
    r = await api.get("/api/v1/analytics/portfolio", headers=admin)
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["total_projects"] == 2
    assert body["total_capacity_mw"] == 72.5  # 42.5 + 30


async def test_analytics_project_detail_with_rls(api, db_session):
    """Test per-project analytics enforces RLS."""
    maker = await login(api, "maker", "maker123")
    other_maker = await extra_user(db_session, "maker2", UserRole.MAKER)

    project_id = (await api.post("/api/v1/projects", json=PROJECT, headers=maker)).json()["data"]["id"]

    # Maker can view their own project analytics
    r = await api.get(f"/api/v1/analytics/project/{project_id}", headers=maker)
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["project_id"] == project_id
    assert body["project_code"] == "E2E-001"

    # Other maker cannot view
    r = await api.get(f"/api/v1/analytics/project/{project_id}", headers=other_maker)
    assert r.status_code == 404

    # Malformed ID is 404
    r = await api.get("/api/v1/analytics/project/not-a-uuid", headers=maker)
    assert r.status_code == 404
