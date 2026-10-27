"""Importing the bank's portfolio workbooks through the application: preview, change request, second admin's approval.

The workbooks are small invented ones in the bank's layout (tests/bank_workbooks.py). Needs the migrated
test database from conftest (skipped without one).
"""

from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.bank_import import BankImport
from backend.app.models.financial import LoanAccount, LoanProjectionQuarter
from backend.app.models.governance import ApprovalRequest
from backend.app.models.operations import EnergyGenerationData
from backend.app.models.project import Project
from backend.app.services.audit_chain import verify_stored_chain
from backend.app.services.demo_reset import holds_bank_data
from backend.scripts import seed_realistic_data, seed_test_workflows
from tests.bank_workbooks import as_bytes, generation_book, projection_book

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
REASON = "Quarterly portfolio position from the credit department's workbooks (test)"


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
def enabled(monkeypatch):
    monkeypatch.setattr(settings, "BANK_IMPORT_ENABLED", True)
    monkeypatch.setattr(settings, "DEMO_RESET_ENABLED", False)


def files(projection=None, generation=None, projection_name="Projection.xlsx"):
    return {"projection": (projection_name, projection or as_bytes(projection_book()), XLSX),
            "generation": ("Generation.xlsx", generation or as_bytes(generation_book()), XLSX)}


async def count(db, model, *where) -> int:
    return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar()


async def propose(api, headers, upload, changes=None):
    return await api.post("/api/v1/mutations/submit-with-justification", headers=headers, json={
        "entity_type": "BANK_IMPORT", "entity_id": upload["id"], "action": "UPDATE",
        "changes": changes if changes is not None else {"files": upload["files"]}, "justification": REASON})


async def decide(api, headers, request_id):
    return await api.post("/api/v1/mutations/approve", headers=headers, json={"approval_request_id": request_id})


async def test_import_is_off_unless_enabled_and_never_on_a_demo(api, monkeypatch):
    admin = await login(api, "admin")
    assert (await api.get("/api/v1/admin/bank-import", headers=admin)).json()["data"] == {"enabled": False, "imports": []}
    refused = await api.post("/api/v1/admin/bank-import/preview", headers=admin, files=files())
    assert refused.status_code == 422 and "not enabled" in refused.json()["detail"]

    monkeypatch.setattr(settings, "BANK_IMPORT_ENABLED", True)
    monkeypatch.setattr(settings, "DEMO_RESET_ENABLED", True)  # a public demo
    assert (await api.post("/api/v1/admin/bank-import/preview", headers=admin, files=files())).status_code == 422


async def test_only_admins_can_upload(api, enabled):
    for user in ("maker", "approver"):
        r = await api.post("/api/v1/admin/bank-import/preview", headers=await login(api, user), files=files())
        assert r.status_code == 403, user


async def test_a_file_that_is_not_a_workbook_is_refused(api, enabled):
    admin = await login(api, "admin")
    r = await api.post("/api/v1/admin/bank-import/preview", headers=admin,
                       files=files(projection=b"MZ\x90\x00 not a workbook", projection_name="Projection.xlsx"))
    assert r.status_code == 422 and "not an Excel workbook" in r.json()["detail"]
    r = await api.post("/api/v1/admin/bank-import/preview", headers=admin, files=files(projection_name="Projection.csv"))
    assert r.status_code == 422 and ".xlsx" in r.json()["detail"]


async def test_preview_reconciles_and_changes_nothing_until_a_second_admin_approves(api, db_session, enabled):
    await seed_realistic_data.seed(db_session, today=date(2026, 10, 5))
    await seed_test_workflows.seed(db_session)  # project change requests waiting in the queue
    admin, admin2, approver = await login(api, "admin"), await login(api, "admin2"), await login(api, "approver")
    setting = await api.post("/api/v1/mutations/submit-with-justification", headers=admin, json={
        "entity_type": "SETTING", "entity_id": "alert_warning_days", "action": "UPDATE", "changes": {"value": "75"},
        "justification": "Insurers ask for more notice now (bank-wide, test)"})
    assert setting.status_code == 200, setting.text

    r = await api.post("/api/v1/admin/bank-import/preview", headers=admin, files=files())
    assert r.status_code == 200, r.text
    upload = r.json()["data"]
    summary = upload["summary"]
    assert upload["status"] == "previewed" and upload["agrees"] is True and upload["request"] is None
    assert summary["borrowers"] == 2 and all(t["matches"] for t in summary["totals"])
    assert {s["status"]: s["count"] for s in summary["statuses"]} == {"under_operation": 1, "yet_to_start_drawdown": 1}
    assert summary["projection"]["quarters"] == 4 and summary["generation"]["months"] == 3
    assert upload["replaces"]["projects"] == 50 and upload["replaces"]["change_requests"] == 4
    assert await count(db_session, Project) == 50  # nothing replaced yet
    stored = await db_session.get(BankImport, __import__("uuid").UUID(upload["id"]))
    assert b"ALPHA" not in stored.projection_content  # kept encrypted

    # The request must name exactly the previewed files
    wrong = await propose(api, admin, upload, {"files": "0" * 64})
    assert wrong.status_code in (400, 422) and "previewed" in wrong.text
    submitted = await propose(api, admin, upload)
    assert submitted.status_code == 200, submitted.text
    rid = submitted.json()["data"]["approval_request_id"]
    again = await propose(api, admin, upload)
    assert again.status_code in (400, 422) and "already waiting" in again.text

    listed = (await api.get("/api/v1/admin/bank-import", headers=admin)).json()["data"]
    assert listed["enabled"] and listed["imports"][0]["request"] == {"id": rid, "state": "submitted"}

    assert (await decide(api, approver, rid)).status_code == 200  # recommended
    assert (await decide(api, approver, rid)).status_code == 403  # the final approval is an administrator's
    assert (await decide(api, admin, rid)).status_code == 403  # and not the one who proposed it
    assert await count(db_session, Project) == 50
    final = await decide(api, admin2, rid)
    assert final.status_code == 200, final.text

    # The portfolio is now the workbooks'
    projects = (await db_session.execute(select(Project).order_by(Project.project_code))).scalars().all()
    assert [p.name_en for p in projects] == ["ALPHA HYDRO PVT LTD", "BETA POWER LTD"]
    assert [p.pipeline_status for p in projects] == ["under_operation", "yet_to_start_drawdown"]
    assert await count(db_session, LoanAccount) == 2
    assert await count(db_session, LoanProjectionQuarter) == 8
    assert await count(db_session, EnergyGenerationData) == 3
    assert await holds_bank_data(db_session)  # demo reset will now refuse this database

    applied = await db_session.get(BankImport, stored.id)
    await db_session.refresh(applied)
    assert applied.status == "applied" and applied.applied_by == "admin2" and applied.result["projects"] == 2
    # Project change requests went with the projects; the bank-wide setting and the import itself stayed
    kinds = sorted((await db_session.execute(select(ApprovalRequest.entity_type))).scalars())
    assert kinds == ["BANK_IMPORT", "SETTING"]
    assert (await verify_stored_chain(db_session)).ok

    # An applied import cannot be loaded twice
    assert (await propose(api, admin, upload)).status_code in (400, 422)


async def test_workbooks_that_do_not_add_up_cannot_be_submitted(api, db_session, enabled):
    admin = await login(api, "admin")
    r = await api.post("/api/v1/admin/bank-import/preview", headers=admin,
                       files=files(projection=as_bytes(projection_book(total_limit=1500))))
    assert r.status_code == 200, r.text
    upload = r.json()["data"]
    limit = next(t for t in upload["summary"]["totals"] if t["field"] == "limit")
    assert upload["agrees"] is False and limit["matches"] is False and limit["workbook"] == "1500"
    refused = await propose(api, admin, upload)
    assert refused.status_code in (400, 422) and "do not add up" in refused.text
