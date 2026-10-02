"""End-to-end MFA login against a real migrated Postgres (skipped when none is available)."""

from urllib.parse import parse_qs, urlparse

import pyotp
from sqlalchemy import select

from backend.app.models.audit import AuditLog
from backend.app.models.auth import User
from backend.app.models.mfa import UserMFA
from tests.integration.test_api_with_db import api, login  # noqa: F401


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


async def enrol(api, headers):
    """Set up and verify TOTP for the caller; returns (secret, backup_codes). The enrolment code uses the
    current time step, so later logins use the next step (the replay guard refuses reuse)."""
    r = await api.post("/api/v1/mfa/setup", headers=headers)
    assert r.status_code == 200, r.text
    secret = parse_qs(urlparse(r.json()["totp_uri"]).query)["secret"][0]
    totp = pyotp.TOTP(secret)
    assert (await api.post("/api/v1/mfa/verify", json={"code": totp.now()}, headers=headers)).json()["mfa_verified"]
    codes = (await api.post("/api/v1/mfa/backup-codes", headers=headers)).json()["codes"]
    return secret, codes


def next_code(secret, steps=1):
    totp = pyotp.TOTP(secret)
    from datetime import datetime, timezone
    return totp.generate_otp(totp.timecode(datetime.now(timezone.utc)) + steps)


async def password_login(api, username="maker", password="maker123"):
    return await api.post("/api/v1/auth/login", json={"username": username, "password": password})


async def test_login_without_mfa_is_unchanged(api):
    r = await password_login(api)
    assert r.status_code == 200 and "access_token" in r.json() and r.json()["mfa_enrollment_required"] is False


async def test_enabled_mfa_turns_password_login_into_a_challenge(api, db_session):
    headers = await login(api, "maker", "maker123")
    secret, codes = await enrol(api, headers)

    # the seed is encrypted in the table
    assert (await db_session.execute(select(UserMFA.totp_secret))).scalar() == secret  # decrypted on read
    raw = (await db_session.execute(__import__("sqlalchemy").text("SELECT totp_secret FROM user_mfa"))).scalar()
    assert raw.startswith("enc1:") and secret not in raw

    r = await password_login(api)
    body = r.json()
    assert r.status_code == 200 and body["mfa_required"] is True and "access_token" not in body

    # the challenge token is not a session
    assert (await api.get("/api/v1/auth/me", headers=bearer(body["mfa_token"]))).status_code == 401

    # wrong code, then the right (next-step) code
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": body["mfa_token"], "code": "000000"})
            ).status_code == 401
    ok = await api.post("/api/v1/auth/login/mfa", json={"mfa_token": body["mfa_token"], "code": next_code(secret)})
    assert ok.status_code == 200, ok.text
    token = ok.json()["access_token"]
    me = await api.get("/api/v1/auth/me", headers=bearer(token))
    assert me.status_code == 200 and me.json()["username"] == "maker"

    # the same code cannot be used again (new challenge, same code)
    again = (await password_login(api)).json()["mfa_token"]
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": again, "code": next_code(secret)})
            ).status_code == 401

    # a backup code works once
    code = codes[0]
    first = await api.post("/api/v1/auth/login/mfa", json={"mfa_token": again, "code": code})
    assert first.status_code == 200
    third = (await password_login(api)).json()["mfa_token"]
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": third, "code": code})).status_code == 401
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": third, "code": codes[1].lower().replace("-", "")})
            ).status_code == 200


async def test_five_wrong_codes_lock_the_account(api):
    headers = await login(api, "maker", "maker123")
    secret, _ = await enrol(api, headers)
    challenge = (await password_login(api)).json()["mfa_token"]
    statuses = [(await api.post("/api/v1/auth/login/mfa", json={"mfa_token": challenge, "code": "000000"})).status_code
                for _ in range(5)]
    assert statuses == [401, 401, 401, 401, 429]
    # locked: even the correct code and a fresh password login are refused
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": challenge, "code": next_code(secret)})
            ).status_code == 429
    assert (await password_login(api)).status_code == 429


async def test_expired_or_forged_challenge_is_refused(api):
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": "forged", "code": "123456"})).status_code == 401
    access = (await login(api, "maker", "maker123"))["Authorization"].split()[1]
    assert (await api.post("/api/v1/auth/login/mfa", json={"mfa_token": access, "code": "123456"})).status_code == 401


async def test_disabling_mfa_needs_a_valid_code(api):
    headers = await login(api, "maker", "maker123")
    secret, _ = await enrol(api, headers)
    token = (await api.post("/api/v1/auth/login/mfa", json={
        "mfa_token": (await password_login(api)).json()["mfa_token"], "code": next_code(secret)})).json()["access_token"]
    h = bearer(token)

    assert (await api.request("DELETE", "/api/v1/mfa/disable", json={"code": "000000"}, headers=h)).status_code == 403
    # login consumed step +1, so the current step is older than the last accepted one: refused as a replay
    assert (await api.request("DELETE", "/api/v1/mfa/disable", json={"code": next_code(secret, 0)}, headers=h)
            ).status_code == 403
    codes = (await api.post("/api/v1/mfa/backup-codes", headers=h)).json()["codes"]
    assert (await api.request("DELETE", "/api/v1/mfa/disable", json={"code": codes[0]}, headers=h)).status_code == 200
    assert (await password_login(api)).json().get("access_token")  # plain password login works again


async def test_admin_can_reset_a_locked_out_users_mfa(api, db_session):
    maker = await login(api, "maker", "maker123")
    await enrol(api, maker)
    admin = await login(api, "admin", "admin123")

    assert (await api.delete("/api/v1/mfa/admin/maker", headers=maker)).status_code == 403
    assert (await api.delete("/api/v1/mfa/admin/nobody", headers=admin)).status_code == 404
    assert (await api.delete("/api/v1/mfa/admin/maker", headers=admin)).status_code == 200

    assert (await password_login(api)).json().get("access_token")
    audit = (await db_session.execute(select(AuditLog).where(AuditLog.entity_type == "USER_MFA"))).scalars().all()
    assert audit and "reset by administrator" in audit[-1].reason_for_action
    maker_row = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    assert str(maker_row.id) == audit[-1].entity_id


async def test_backup_codes_need_mfa_enabled(api):
    headers = await login(api, "maker", "maker123")
    assert (await api.post("/api/v1/mfa/backup-codes", headers=headers)).status_code == 400
