"""Admin user management (FUNC A.2): block, unblock, role override, and the guards around them.

Needs the migrated test database from conftest (skipped without one).
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.audit import AuditLog
from backend.app.models.auth import User


@pytest.fixture
async def api(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


async def login(api, username: str):
    return await api.post("/api/v1/auth/login", json={"username": username, "password": f"{username}123"})


async def headers(api, username: str) -> dict:
    r = await login(api, username)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def user_id(db, username: str) -> str:
    return str((await db.execute(select(User.id).where(User.username == username))).scalar_one())


async def test_a_blocked_user_cannot_sign_in_and_loses_open_sessions(api, db_session):
    guest = await headers(api, "guest")
    assert (await api.get("/api/v1/auth/me", headers=guest)).status_code == 200
    admin = await headers(api, "admin")
    gid = await user_id(db_session, "guest")

    r = await api.post(f"/api/v1/admin/users/{gid}/block", headers=admin, json={"reason": "Left the bank"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["is_active"] is False

    assert (await api.get("/api/v1/auth/me", headers=guest)).status_code == 401  # the open session ends now
    refused = await login(api, "guest")
    assert refused.status_code == 403 and "disabled" in refused.json()["detail"]

    r = await api.post(f"/api/v1/admin/users/{gid}/unblock", headers=admin, json={"reason": "Rejoined"})
    assert r.status_code == 200
    assert (await login(api, "guest")).status_code == 200

    actions = (await db_session.execute(select(AuditLog.action_performed).where(
        AuditLog.entity_type == "USER", AuditLog.entity_id == gid).order_by(AuditLog.id))).scalars().all()
    assert actions == ["USER_BLOCKED", "USER_UNBLOCKED"]


async def test_a_role_set_in_hpms_applies_at_the_next_sign_in_until_cleared(api, db_session):
    await headers(api, "guest")  # creates the row
    admin = await headers(api, "admin")
    gid = await user_id(db_session, "guest")

    r = await api.post(f"/api/v1/admin/users/{gid}/role", headers=admin, json={"role": "auditor", "reason": "Internal audit cover"})
    assert r.status_code == 200 and r.json()["data"]["role"] == "auditor"
    assert (await login(api, "guest")).json()["user"]["roles"] == ["auditor"]

    listed = {u["username"]: u for u in (await api.get("/api/v1/admin/users", headers=admin)).json()["data"]}
    assert (listed["guest"]["role"], listed["guest"]["directory_role"], listed["guest"]["role_override"]) == (
        "auditor", "guest", "auditor")

    r = await api.post(f"/api/v1/admin/users/{gid}/role", headers=admin, json={"role": None, "reason": "Cover ended"})
    assert r.status_code == 200 and r.json()["data"]["role"] == "guest"
    assert (await login(api, "guest")).json()["user"]["roles"] == ["guest"]


async def test_an_admin_cannot_change_their_own_account(api, db_session):
    admin = await headers(api, "admin")
    aid = await user_id(db_session, "admin")
    r = await api.post(f"/api/v1/admin/users/{aid}/block", headers=admin, json={"reason": "Testing"})
    assert r.status_code == 409 and "your own account" in r.json()["detail"]


async def test_the_last_active_administrator_cannot_be_blocked_or_demoted(api, db_session):
    await headers(api, "admin2")
    admin = await headers(api, "admin")
    second = await user_id(db_session, "admin2")
    # The caller was demoted by another admin earlier; it still holds an admin session until it signs in again.
    # So admin2 is the only active administrator, and must stay one.
    caller = (await db_session.execute(select(User).where(User.username == "admin"))).scalar_one()
    caller.role_override = "maker"
    await db_session.flush()

    r = await api.post(f"/api/v1/admin/users/{second}/block", headers=admin, json={"reason": "Leave"})
    assert r.status_code == 409 and "last active administrator" in r.json()["detail"]
    r = await api.post(f"/api/v1/admin/users/{second}/role", headers=admin, json={"role": "maker", "reason": "Rotate"})
    assert r.status_code == 409 and "last active administrator" in r.json()["detail"]

    # With a second active administrator, the same changes are allowed
    caller.role_override = None
    await db_session.flush()
    r = await api.post(f"/api/v1/admin/users/{second}/block", headers=admin, json={"reason": "Leave"})
    assert r.status_code == 200, r.text


async def test_only_admins_manage_users_and_unknown_roles_are_refused(api, db_session):
    await headers(api, "guest")
    gid = await user_id(db_session, "guest")
    maker = await headers(api, "maker")
    assert (await api.post(f"/api/v1/admin/users/{gid}/block", headers=maker, json={"reason": "No"})).status_code == 403
    admin = await headers(api, "admin")
    r = await api.post(f"/api/v1/admin/users/{gid}/role", headers=admin, json={"role": "superuser", "reason": "Try"})
    assert r.status_code == 422
