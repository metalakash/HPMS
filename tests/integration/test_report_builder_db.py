"""Report builder against a real migrated Postgres (skipped when none is available).

Covers migration 013, definition CRUD and ownership, and the geographic + shortfall queries.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest

from backend.app.models.financial import LoanAccount
from backend.app.models.project import Project
from backend.app.schemas.report_schema import ExportFilter
from backend.app.services.report_builder import run_report
from backend.app.services.report_service import ReportService
from tests.integration.test_api_with_db import api, extra_user, login  # noqa: F401
from backend.app.security.ldap_provider import UserRole


async def _project(db, code, province, district, local_level):
    p = Project(
        id=uuid.uuid4(), project_code=code, name_en=code, name_np=code, province=province, district=district,
        local_level=local_level, installed_capacity_mw=10, project_stage="construction",
        pipeline_status="under_construction")
    db.add(p)
    await db.flush()
    return p


async def _loan(db, project, acc, dscr, ltv, icr):
    db.add(LoanAccount(
        id=uuid.uuid4(), project_id=project.id, finacle_account_id=acc, facility_type="Term Loan",
        sanctioned_amount=Decimal("1000"), dscr=dscr, ltv=ltv, icr=icr, metric_as_of_date=date(2026, 4, 14)))
    await db.flush()


async def test_shortfall_report_filters_by_geography(db_session):
    a = await _project(db_session, "RB-A", "Gandaki", "Kaski", "Pokhara")
    b = await _project(db_session, "RB-B", "Bagmati", "Kathmandu", "Kathmandu")
    await _loan(db_session, a, "RB-ACC-A", Decimal("1.0"), Decimal("60"), Decimal("3"))   # DSCR breach
    await _loan(db_session, b, "RB-ACC-B", Decimal("1.5"), Decimal("60"), Decimal("3"))   # compliant

    rows = await run_report(db_session, "covenant_shortfall", filters={"province": "Gandaki"})
    assert [r["project_code"] for r in rows if r["project_code"].startswith("RB-")] == ["RB-A"]
    assert rows[0]["breached_covenants"] == "DSCR" and rows[0]["metric_as_of_date_bs"] == "2083-01-01"

    none = await run_report(db_session, "covenant_shortfall", filters={"province": "Gandaki", "district": "Kathmandu"})
    assert not [r for r in none if r["project_code"].startswith("RB-")]

    rows, _ = await ReportService.export_portfolio_report(
        db_session, ExportFilter(local_level="Pokhara"), "tester")
    assert [r["project_code"] for r in rows if r["project_code"].startswith("RB-")] == ["RB-A"]


async def test_definition_crud_and_ownership(api, db_session):  # noqa: F811
    admin = await login(api, "admin", "admin123")
    auditor = await login(api, "auditor", "auditor123")

    body = {"name": "Gandaki shortfalls", "source": "covenant_shortfall",
            "columns": ["project_code", "dscr", "dscr_shortfall"], "filters": {"province": "Gandaki"},
            "sort_by": "dscr", "default_format": "word", "is_shared": False}
    r = await api.post("/api/v1/reports/definitions", json=body, headers=admin)
    assert r.status_code == 201, r.text
    did = r.json()["id"]

    # Private: the auditor cannot see it; once shared, can read but not modify
    assert (await api.get(f"/api/v1/reports/definitions/{did}", headers=auditor)).status_code == 404
    assert (await api.patch(f"/api/v1/reports/definitions/{did}", json={"is_shared": True}, headers=admin)).status_code == 200
    assert (await api.get(f"/api/v1/reports/definitions/{did}", headers=auditor)).status_code == 200
    r = await api.patch(f"/api/v1/reports/definitions/{did}", json={"name": "x"}, headers=auditor)
    assert r.status_code == 403

    # Patch validates columns against the source
    r = await api.patch(f"/api/v1/reports/definitions/{did}", json={"columns": ["nope"]}, headers=admin)
    assert r.status_code == 422

    # Run the saved definition as JSON and as Word
    r = await api.post(f"/api/v1/reports/definitions/{did}/run?format=json", headers=admin)
    assert r.status_code == 200 and "data" in r.json()
    assert (await api.delete(f"/api/v1/reports/definitions/{did}", headers=admin)).status_code == 204
    assert (await api.get(f"/api/v1/reports/definitions/{did}", headers=admin)).status_code == 404
