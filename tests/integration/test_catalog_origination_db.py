"""The bank's portfolio is separate from the national hydro catalog, and a catalog project enters the
portfolio only through an approved proposal. Runs over HTTP against a real, migrated Postgres.
"""

import uuid
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.auth import ProjectOwner, User
from backend.app.models.financial import LoanAccount
from backend.app.models.project import HydrologyRecord, Project, WaterLicense

JUSTIFICATION = "Sponsor approached the bank for a 70% term loan; licence and PPA are in order"
SUBMIT = "/api/v1/mutations/submit-with-justification"


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


def project(code, name, financed, status="proposal_under_pipeline", **extra):
    return Project(id=uuid.uuid4(), project_code=code, name_en=name, name_np=name, province="Gandaki",
                   district="Kaski", installed_capacity_mw=Decimal("30"), project_stage="feasibility",
                   pipeline_status=status, is_bank_financed=financed, **extra)


@pytest.fixture
async def world(api, db_session):
    book = project("BK-001", "Bank Financed Hydro", True, status="under_construction")
    catalog = project("CT-001", "Seti Catalog Hydro", False)
    other = project("CT-002", "Marsyangdi Reference Hydro", False)
    db_session.add_all([book, catalog, other])
    await db_session.flush()
    db_session.add_all([
        LoanAccount(id=uuid.uuid4(), project_id=book.id, finacle_account_id="FIN-BK-001", facility_type="term_loan",
                    sanctioned_amount=Decimal("1000"), disbursed_amount=Decimal("500"),
                    outstanding_principal=Decimal("500"), interest_rate_pct=Decimal("9.50")),
        HydrologyRecord(id=uuid.uuid4(), project_id=catalog.id, river_basin="Gandaki"),
        WaterLicense(id=uuid.uuid4(), project_id=catalog.id, license_number="DoED-GEN-2075-014", status="active"),
    ])
    await db_session.flush()
    headers = {name: await login(api, name) for name in ("maker", "approver", "admin", "auditor", "guest")}
    return {"book": book, "catalog": catalog, "other": other, "db": db_session, **headers}


# ------------------------------------------------------------------ the portfolio view

async def test_the_project_list_holds_only_the_banks_projects_by_default(api, world):
    r = await api.get("/api/v1/projects", headers=world["admin"])
    assert r.status_code == 200, r.text
    assert [p["project_code"] for p in r.json()["data"]] == ["BK-001"]
    assert r.json()["meta"]["total_count"] == 1
    assert r.json()["data"][0]["is_bank_financed"] is True


async def test_scope_all_includes_the_catalog(api, world):
    r = await api.get("/api/v1/projects", headers=world["admin"], params={"scope": "all"})
    assert r.json()["meta"]["total_count"] == 3
    assert (await api.get("/api/v1/projects", headers=world["admin"], params={"scope": "everything"})).status_code == 422


async def test_portfolio_metrics_ignore_catalog_records(api, world):
    r = await api.get("/api/v1/analytics/portfolio", headers=world["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["data"]["total_projects"] == 1


# ------------------------------------------------------------------ the catalog

async def test_catalog_lists_only_projects_the_bank_does_not_finance(api, world):
    r = await api.get("/api/v1/projects/catalog", headers=world["maker"])
    assert r.status_code == 200, r.text
    # Makers own none of these, yet can search them: the catalog is reference data
    assert {p["project_code"] for p in r.json()["data"]} == {"CT-001", "CT-002"}
    assert r.json()["meta"]["total_count"] == 2


async def test_catalog_search_matches_name_code_district_and_licence(api, world):
    async def codes(q):
        r = await api.get("/api/v1/projects/catalog", headers=world["maker"], params={"q": q})
        assert r.status_code == 200, r.text
        return [p["project_code"] for p in r.json()["data"]]

    assert await codes("seti") == ["CT-001"]
    assert await codes("CT-002") == ["CT-002"]
    assert await codes("kaski") == ["CT-001", "CT-002"] or set(await codes("kaski")) == {"CT-001", "CT-002"}
    assert await codes("GEN-2075") == ["CT-001"]
    assert await codes("100%") == []  # wildcard characters are literal


async def test_catalog_rows_carry_the_baseline_parameters_a_proposal_is_filled_from(api, world):
    r = await api.get("/api/v1/projects/catalog", headers=world["maker"], params={"q": "seti"})
    row = r.json()["data"][0]
    assert row["river_basin"] == "Gandaki"
    assert row["license_number"] == "DoED-GEN-2075-014" and row["license_status"] == "active"
    assert Decimal(row["installed_capacity_mw"]) == Decimal("30")
    assert row["district"] == "Kaski"


async def test_guests_cannot_search_the_catalog(api, world):
    assert (await api.get("/api/v1/projects/catalog", headers=world["guest"])).status_code == 403


# ------------------------------------------------------------------ origination

async def originate(api, world, who="maker", project_key="catalog", justification=JUSTIFICATION):
    return await api.post(f"/api/v1/projects/{world[project_key].id}/originate", headers=world[who],
                          json={"justification": justification})


async def test_origination_changes_nothing_until_approved(api, world):
    db, catalog = world["db"], world["catalog"]

    r = await originate(api, world)
    assert r.status_code == 202, r.text
    request_id = r.json()["data"]["approval_request_id"]

    await db.refresh(catalog)
    assert catalog.is_bank_financed is False
    still = await api.get("/api/v1/projects", headers=world["admin"])
    assert "CT-001" not in {p["project_code"] for p in still.json()["data"]}

    # The maker now owns the record, so they can follow it
    maker_id = (await db.execute(select(User.id).where(User.username == "maker"))).scalar()
    owner = (await db.execute(select(ProjectOwner).where(
        ProjectOwner.project_id == catalog.id, ProjectOwner.user_id == maker_id))).scalar_one_or_none()
    assert owner is not None

    for who in ("approver", "admin"):
        decided = await api.post("/api/v1/mutations/approve", headers=world[who],
                                 json={"approval_request_id": request_id, "remarks": "Checked against the file"})
        assert decided.status_code == 200, decided.text
    assert decided.json()["data"]["changes_applied"] is True

    await db.refresh(catalog)
    assert catalog.is_bank_financed is True and catalog.pipeline_status == "proposal_under_pipeline"

    listed = await api.get("/api/v1/projects", headers=world["admin"])
    assert "CT-001" in {p["project_code"] for p in listed.json()["data"]}
    in_catalog = await api.get("/api/v1/projects/catalog", headers=world["maker"])
    assert "CT-001" not in {p["project_code"] for p in in_catalog.json()["data"]}


async def test_a_rejected_proposal_stays_in_the_catalog(api, world):
    db, catalog = world["db"], world["catalog"]
    request_id = (await originate(api, world)).json()["data"]["approval_request_id"]
    r = await api.post("/api/v1/mutations/reject", headers=world["approver"],
                       json={"approval_request_id": request_id, "remarks": "Sponsor equity is not in place"})
    assert r.status_code == 200, r.text
    await db.refresh(catalog)
    assert catalog.is_bank_financed is False
    # It can be proposed again once the request is closed
    assert (await originate(api, world)).status_code == 202


async def test_origination_rules(api, world):
    # Only makers and admins author proposals
    assert (await originate(api, world, "approver")).status_code == 403
    assert (await originate(api, world, "auditor")).status_code == 403
    # Already the bank's
    assert (await originate(api, world, project_key="book")).status_code == 409
    # Justification is mandatory
    assert (await originate(api, world, justification="too short")).status_code == 422
    # Unknown project
    r = await api.post(f"/api/v1/projects/{uuid.uuid4()}/originate", headers=world["maker"],
                       json={"justification": JUSTIFICATION})
    assert r.status_code == 404
    # One open request at a time
    assert (await originate(api, world)).status_code == 202
    assert (await originate(api, world, "admin")).status_code == 409


async def test_the_flag_cannot_be_set_by_editing_the_project(api, world):
    db, catalog = world["db"], world["catalog"]
    db.add(ProjectOwner(user_id=(await db.execute(select(User.id).where(User.username == "maker"))).scalar(),
                        project_id=catalog.id, ownership_type="direct"))
    await db.flush()
    r = await api.patch(f"/api/v1/projects/{catalog.id}", headers=world["maker"], json={"name_en": "Renamed"})
    assert r.status_code == 200, r.text
    # An approver cannot propose the flag directly either: it is not theirs to author
    r = await api.post(SUBMIT, headers=world["approver"], json={
        "entity_type": "PROJECT", "entity_id": str(catalog.id), "action": "UPDATE",
        "changes": {"is_bank_financed": True}, "justification": JUSTIFICATION})
    assert r.status_code == 403
    await db.refresh(catalog)
    assert catalog.is_bank_financed is False


async def test_a_project_created_by_the_bank_is_the_banks(api, world):
    r = await api.post("/api/v1/projects", headers=world["maker"], json={
        "project_code": "NEW-001", "name_en": "New Proposal", "name_np": "New Proposal", "province": "Koshi",
        "district": "Taplejung", "installed_capacity_mw": "12.5", "project_stage": "feasibility",
        "pipeline_status": "proposal_under_pipeline"})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["is_bank_financed"] is True
    listed = await api.get("/api/v1/projects", headers=world["admin"])
    assert "NEW-001" in {p["project_code"] for p in listed.json()["data"]}
