"""The Admin screen's demo data reset: off unless switched on, never over bank data, and complete.

Database tests need the migrated test database from conftest (skipped without one).
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.audit import AuditLog
from backend.app.models.financial import EnergyBond, LoanAccount
from backend.app.models.governance import ApprovalRequest
from backend.app.models.project import Project
from backend.app.models.risk import InsurancePolicy
from backend.app.services import demo_reset

TODAY = date(2026, 10, 5)


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_RESET_ENABLED", True)
    monkeypatch.setattr(settings, "ALLOW_DEV_AUTH", True)


def test_off_by_default_and_needs_the_demo_accounts(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_RESET_ENABLED", False)
    monkeypatch.setattr(settings, "ALLOW_DEV_AUTH", True)
    assert not demo_reset.reset_enabled()
    # Switched on, but where the published demo passwords are refused it stays off
    monkeypatch.setattr(settings, "DEMO_RESET_ENABLED", True)
    monkeypatch.setattr(settings, "ALLOW_DEV_AUTH", False)
    assert not demo_reset.reset_enabled()
    monkeypatch.setattr(settings, "ALLOW_DEV_AUTH", True)
    assert demo_reset.reset_enabled()


def test_every_table_that_points_at_a_project_is_cleared_children_first():
    names = [table.name for table in demo_reset.project_dependent_tables()]
    # Records a demo audience can add, which the seed scripts do not delete themselves
    assert {"insurance_policies", "stakeholder_contacts", "documents", "document_versions",
            "community_engagements", "esia_monitoring_records", "loan_accounts", "repayments"} <= set(names)
    assert names.index("document_versions") < names.index("documents")
    assert names.index("repayments") < names.index("loan_accounts")
    assert "projects" not in names and "user" not in names and "audit_logs" not in names


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


async def _count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar()


async def test_refused_when_not_switched_on(api, db_session, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_RESET_ENABLED", False)
    admin = await login(api, "admin")
    assert (await api.get("/api/v1/admin/demo-reset", headers=admin)).json() == {"enabled": False}
    r = await api.post("/api/v1/admin/demo-reset", headers=admin)
    assert r.status_code == 403 and "not enabled" in r.json()["detail"]


async def test_only_an_admin_may_reset(api, enabled):
    r = await api.post("/api/v1/admin/demo-reset", headers=await login(api, "maker"))
    assert r.status_code == 403


async def test_refused_on_a_database_holding_bank_data(api, db_session, enabled):
    db_session.add(EnergyBond(
        id=uuid.uuid4(), name="Bank-held bond", amount=Decimal("1"), data_provenance=demo_reset.BANK_PROVENANCE))
    project = Project(project_code="BANK-1", name_en="Bank Khola", name_np="Bank Khola", province="Gandaki",
                      installed_capacity_mw=1, project_stage="operation", pipeline_status="under_operation")
    db_session.add(project)
    await db_session.flush()

    r = await api.post("/api/v1/admin/demo-reset", headers=await login(api, "admin"))
    assert r.status_code == 403 and "loaded from the bank" in r.json()["detail"]
    assert await db_session.get(Project, project.id) is not None


async def test_reset_replaces_everything_with_the_demo_portfolio(api, db_session, enabled):
    # Something a demo audience added, hanging off a project the seed knows nothing about
    stray = Project(project_code="STRAY-1", name_en="Stray Khola", name_np="Stray Khola", province="Koshi",
                    installed_capacity_mw=1, project_stage="operation", pipeline_status="under_operation")
    db_session.add(stray)
    await db_session.flush()
    db_session.add(InsurancePolicy(project_id=stray.id, policy_number=f"POL-{uuid.uuid4()}", insurer="Demo Insurance",
                                   policy_type="operational_all_risk", valid_from_ad=TODAY, valid_to_ad=TODAY))
    await db_session.flush()
    audit_before = await _count(db_session, AuditLog)

    admin = await login(api, "admin")
    assert (await api.get("/api/v1/admin/demo-reset", headers=admin)).json() == {"enabled": True}
    r = await api.post("/api/v1/admin/demo-reset", headers=admin)
    assert r.status_code == 200, r.text
    result = r.json()["data"]
    assert result["projects"] == 50 and result["change_requests"] == 4 and result["documents"] > 0

    assert await _count(db_session, Project) == 50
    assert await db_session.get(Project, stray.id) is None
    assert not (await db_session.execute(select(InsurancePolicy).where(InsurancePolicy.project_id == stray.id))).first()
    assert await _count(db_session, LoanAccount) > 0
    assert await _count(db_session, ApprovalRequest) == 4
    reset_entry = (await db_session.execute(
        select(AuditLog).where(AuditLog.entity_type == "DEMO_DATA").order_by(AuditLog.id.desc()).limit(1))).scalar()
    assert reset_entry.action_performed == "RESET"
    assert await _count(db_session, AuditLog) > audit_before  # kept, and added to

    # Running it again gives the same portfolio, change requests included
    again = await api.post("/api/v1/admin/demo-reset", headers=admin)
    assert again.status_code == 200 and again.json()["data"]["change_requests"] == 4
    assert again.json()["data"]["documents"] == result["documents"]
    assert await _count(db_session, Project) == 50

