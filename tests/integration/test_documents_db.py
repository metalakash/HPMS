"""Project documents through the API: filing, versions, download, archive, permissions and audit.

Needs the migrated test database from conftest (skipped without one).
"""

import hashlib

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.audit import AuditLog
from backend.app.models.document import DocumentBlob, DocumentVersion
from backend.app.models.project import Project

PDF = b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"


@pytest.fixture
async def api(db_session, monkeypatch):
    monkeypatch.setattr(settings, "DOCUMENT_STORAGE", "database")
    monkeypatch.setattr(settings, "DOCUMENT_ENCRYPTION", True)

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
async def project(db_session):
    project = Project(project_code="DOC-001", name_en="Document Khola", name_np="Document Khola", province="Gandaki",
                      installed_capacity_mw=5, project_stage="operation", pipeline_status="under_operation")
    db_session.add(project)
    await db_session.flush()
    return project


async def file_letter(api, project, headers, content=PDF, name="sanction letter.pdf", **fields):
    data = {"title": "Sanction letter", "classification": "sanction_letter", "document_date": "2026-07-16",
            "upload_comment": "Signed copy from the credit department", **fields}
    return await api.post(f"/api/v1/projects/{project.id}/documents", headers=headers, data=data,
                          files={"file": (name, content, "application/pdf")})


async def test_an_admin_files_a_document_and_gets_the_same_bytes_back(api, db_session, project):
    admin = await login(api, "admin")
    r = await file_letter(api, project, admin)
    assert r.status_code == 201, r.text
    doc = r.json()["data"]
    current = doc["current_version"]
    assert (doc["classification"], doc["version_count"], current["version_number"]) == ("sanction_letter", 1, 1)
    assert current["sha256"] == hashlib.sha256(PDF).hexdigest() and current["encrypted"] is True

    listed = (await api.get(f"/api/v1/projects/{project.id}/documents", headers=admin)).json()["data"]
    assert [d["title"] for d in listed] == ["Sanction letter"]

    download = await api.get(
        f"/api/v1/projects/{project.id}/documents/{doc['id']}/versions/{current['id']}/download", headers=admin)
    assert download.status_code == 200 and download.content == PDF
    assert "sanction%20letter.pdf" in download.headers["content-disposition"]

    # Stored encrypted: the bytes at rest are not the file
    version = (await db_session.execute(select(DocumentVersion))).scalar_one()
    blob = await db_session.get(DocumentBlob, version.storage_path)
    assert blob.content != PDF and PDF not in blob.content

    actions = (await db_session.execute(
        select(AuditLog.action_performed).where(AuditLog.entity_type == "DOCUMENT").order_by(AuditLog.id))).scalars().all()
    assert actions == ["DOCUMENT_FILED", "DOCUMENT_DOWNLOADED"]


async def test_a_new_version_keeps_the_old_one(api, project):
    admin = await login(api, "admin")
    doc = (await file_letter(api, project, admin)).json()["data"]
    revised = PDF + b"% revised\n"
    r = await api.post(f"/api/v1/projects/{project.id}/documents/{doc['id']}/versions", headers=admin,
                       data={"upload_comment": "Revised limit per board decision"},
                       files={"file": ("sanction letter v2.pdf", revised, "application/pdf")})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["version_count"] == 2

    versions = (await api.get(f"/api/v1/projects/{project.id}/documents/{doc['id']}/versions", headers=admin)).json()["data"]
    assert [(v["version_number"], v["is_current"]) for v in versions] == [(2, True), (1, False)]
    for v, expected in zip(versions, (revised, PDF)):
        got = await api.get(f"/api/v1/projects/{project.id}/documents/{doc['id']}/versions/{v['id']}/download",
                            headers=admin)
        assert got.content == expected


@pytest.mark.parametrize("name,content,problem", [
    ("payload.exe", b"MZ", "not accepted"),
    ("empty.pdf", b"", "is empty"),
])
async def test_unsupported_and_empty_files_are_refused_with_the_reason(api, project, name, content, problem):
    r = await file_letter(api, project, await login(api, "admin"), content=content, name=name)
    assert r.status_code == 422 and problem in r.json()["detail"]


async def test_files_over_the_limit_are_refused(api, project, monkeypatch):
    monkeypatch.setattr(settings, "DOCUMENT_MAX_MB", 1)
    r = await file_letter(api, project, await login(api, "admin"), content=b"%PDF" + b"0" * (1024 * 1024 + 10))
    assert r.status_code == 422 and "the limit is 1 MB" in r.json()["detail"]


async def test_an_auditor_reads_but_cannot_file_and_a_maker_only_files_on_owned_projects(api, project):
    admin = await login(api, "admin")
    doc = (await file_letter(api, project, admin)).json()["data"]

    auditor = await login(api, "auditor")
    assert (await file_letter(api, project, auditor)).status_code == 403
    listed = await api.get(f"/api/v1/projects/{project.id}/documents", headers=auditor)
    assert listed.status_code == 200 and len(listed.json()["data"]) == 1
    got = await api.get(f"/api/v1/projects/{project.id}/documents/{doc['id']}/versions/"
                        f"{doc['current_version']['id']}/download", headers=auditor)
    assert got.status_code == 200

    # The maker owns no project here
    assert (await file_letter(api, project, await login(api, "maker"))).status_code in (403, 404)


async def test_archiving_hides_a_document_without_deleting_it(api, project):
    admin = await login(api, "admin")
    doc = (await file_letter(api, project, admin)).json()["data"]
    base = f"/api/v1/projects/{project.id}/documents"
    assert (await api.post(f"{base}/{doc['id']}/archive", headers=admin, data={"reason": " "})).status_code == 422
    r = await api.post(f"{base}/{doc['id']}/archive", headers=admin, data={"reason": "Superseded by the new PPA"})
    assert r.status_code == 200 and r.json()["data"]["status"] == "archived"

    assert (await api.get(base, headers=admin)).json()["data"] == []
    archived = (await api.get(base, headers=admin, params={"include_archived": "true"})).json()["data"]
    assert [d["status"] for d in archived] == ["archived"]
    # An archived document takes no new versions
    r = await api.post(f"{base}/{doc['id']}/versions", headers=admin, data={"upload_comment": "late"},
                       files={"file": ("x.pdf", PDF, "application/pdf")})
    assert r.status_code == 422


async def test_a_file_altered_in_storage_is_refused(api, db_session, project, monkeypatch):
    monkeypatch.setattr(settings, "DOCUMENT_ENCRYPTION", False)
    admin = await login(api, "admin")
    doc = (await file_letter(api, project, admin)).json()["data"]
    version = (await db_session.execute(select(DocumentVersion))).scalar_one()
    blob = await db_session.get(DocumentBlob, version.storage_path)
    blob.content = PDF + b"tampered"
    await db_session.flush()

    r = await api.get(f"/api/v1/projects/{project.id}/documents/{doc['id']}/versions/"
                      f"{doc['current_version']['id']}/download", headers=admin)
    assert r.status_code == 409 and "changed since it was filed" in r.json()["detail"]


async def test_the_same_file_can_be_filed_twice(api, project):
    admin = await login(api, "admin")
    assert (await file_letter(api, project, admin)).status_code == 201
    assert (await file_letter(api, project, admin, title="Copy for the consortium")).status_code == 201
