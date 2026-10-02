"""MFA at login: second-factor verification, challenge tokens, lockout, replay (no database required)."""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pyotp
import pytest

from backend.app.security.auth_middleware import TokenManager
from backend.app.security.ldap_provider import ADUser, UserRole
from backend.app.services.mfa_service import MFAService

SECRET = pyotp.random_base32()
NOW = datetime(2026, 10, 2, 12, 0, 5, tzinfo=timezone.utc)


def totp_code(offset_steps=0, now=NOW):
    t = pyotp.TOTP(SECRET)
    return t.generate_otp(t.timecode(now) + offset_steps)


def counter_of(now=NOW):
    return pyotp.TOTP(SECRET).timecode(now)


def mfa(**over):
    base = dict(id=uuid.uuid4(), totp_secret=SECRET, failed_attempts="0", locked_until=None, last_totp_counter=None,
                last_mfa_used_at=None, is_mfa_enabled=True)
    base.update(over)
    return SimpleNamespace(**base)


class Rows:
    def __init__(self, items):
        self.items = items

    def scalars(self):
        return SimpleNamespace(all=lambda: self.items)


class DB:
    def __init__(self, backup_rows=()):
        self.backup_rows = list(backup_rows)

    async def execute(self, stmt):
        return Rows([r for r in self.backup_rows if not r.is_used])


def backup_row(code):
    return SimpleNamespace(code=MFAService.hash_backup_code(code), is_used=False, used_at=None, used_ip=None)


# ------------------------------------------------------------------ TOTP step

def test_totp_step_accepts_current_and_adjacent_steps_only():
    now = NOW
    current = counter_of()
    assert MFAService.verify_totp_step(SECRET, totp_code(0), now) == current
    assert MFAService.verify_totp_step(SECRET, totp_code(-1), now) == current - 1
    assert MFAService.verify_totp_step(SECRET, totp_code(1), now) == current + 1
    assert MFAService.verify_totp_step(SECRET, totp_code(2), now) is None
    assert MFAService.verify_totp_step(SECRET, totp_code(-2), now) is None


@pytest.mark.parametrize("bad", ["", "abc123", "12345", "1234567", None])
def test_totp_step_rejects_malformed_codes(bad):
    assert MFAService.verify_totp_step(SECRET, bad, NOW) is None


# ------------------------------------------------------------------ verify_second_factor

async def test_valid_totp_is_accepted_and_resets_failures():
    m = mfa(failed_attempts="3")
    assert await MFAService.verify_second_factor(DB(), m, totp_code(), now=NOW) == "ok"
    assert m.failed_attempts == "0" and m.last_totp_counter == counter_of() and m.last_mfa_used_at == NOW


async def test_a_totp_code_cannot_be_replayed_nor_an_older_one_used():
    m = mfa()
    assert await MFAService.verify_second_factor(DB(), m, totp_code(), now=NOW) == "ok"
    assert await MFAService.verify_second_factor(DB(), m, totp_code(), now=NOW) == "invalid"      # same code again
    assert await MFAService.verify_second_factor(DB(), m, totp_code(-1), now=NOW) == "invalid"    # an earlier step
    assert await MFAService.verify_second_factor(DB(), m, totp_code(1), now=NOW) == "ok"          # a later one is fine


async def test_wrong_codes_count_and_five_in_a_row_lock_for_fifteen_minutes():
    m = mfa()
    for expected in ("invalid", "invalid", "invalid", "invalid", "locked"):
        assert await MFAService.verify_second_factor(DB(), m, "000000", now=NOW) == expected
    assert m.locked_until == NOW + timedelta(minutes=15)
    # even the right code is refused while locked
    assert await MFAService.verify_second_factor(DB(), m, totp_code(), now=NOW + timedelta(minutes=14)) == "locked"
    # and works again afterwards
    later = NOW + timedelta(minutes=16)
    assert await MFAService.verify_second_factor(DB(), m, totp_code(now=later), now=later) == "ok"
    assert m.locked_until is None


async def test_backup_code_works_once_in_either_notation_and_records_use():
    row = backup_row("AB12-CD34")
    m = mfa()
    assert await MFAService.verify_second_factor(DB([row]), m, "ab12cd34", ip="10.1.1.1", now=NOW) == "ok"
    assert row.is_used and row.used_at == NOW and row.used_ip == "10.1.1.1"
    assert await MFAService.verify_second_factor(DB([row]), m, "AB12-CD34", now=NOW) == "invalid"  # spent


async def test_wrong_backup_code_and_junk_are_invalid_and_counted():
    m = mfa()
    row = backup_row("AB12-CD34")
    for code in ("AB12-CD35", "not a code", "", "12-34"):
        assert await MFAService.verify_second_factor(DB([row]), m, code, now=NOW) in ("invalid", "locked")
    assert not row.is_used and int(m.failed_attempts) == 4


async def test_no_seed_means_totp_cannot_succeed():
    m = mfa(totp_secret=None)
    assert await MFAService.verify_second_factor(DB(), m, totp_code(), now=NOW) == "invalid"


# ------------------------------------------------------------------ challenge tokens

def ad_user():
    return ADUser("maker", "m@sbl.local", "Maker", [UserRole.MAKER])


def test_challenge_token_is_not_an_access_token():
    challenge = TokenManager.create_challenge_token(ad_user(), uuid.uuid4())
    assert TokenManager.verify_token(challenge) is None            # cannot call the API
    payload = TokenManager.verify_challenge_token(challenge)
    assert payload["typ"] == "mfa_challenge" and payload["is_authenticated"] is False


def test_access_token_is_not_a_challenge_token():
    access = TokenManager.create_token(ad_user(), uuid.uuid4())
    assert TokenManager.verify_challenge_token(access) is None
    assert TokenManager.verify_token(access)["username"] == "maker"


def test_challenge_token_expires_in_minutes(monkeypatch):
    from jose import jwt
    from backend.app.config import settings
    token = TokenManager.create_challenge_token(ad_user(), uuid.uuid4())
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    assert 0 < payload["exp"] - payload["iat"] <= TokenManager.CHALLENGE_EXPIRY_MINUTES * 60
    assert TokenManager.verify_challenge_token("garbage") is None


def test_challenge_token_does_not_pass_get_current_user():
    import asyncio
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from backend.app.security.auth_middleware import get_current_user
    token = TokenManager.create_challenge_token(ad_user(), uuid.uuid4())
    with pytest.raises(HTTPException) as e:
        asyncio.run(get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)))
    assert e.value.status_code == 401


# ------------------------------------------------------------------ settings

def test_mfa_required_roles_flag():
    from backend.app.api import routes_auth
    from backend.app.config import settings
    settings.MFA_REQUIRED_ROLES, original = "admin, approver", settings.MFA_REQUIRED_ROLES
    try:
        assert routes_auth._needs_enrollment(ADUser("a", None, None, [UserRole.ADMIN]))
        assert not routes_auth._needs_enrollment(ad_user())
    finally:
        settings.MFA_REQUIRED_ROLES = original


def test_naive_datetimes_are_read_as_utc_not_local_time():
    """pyotp treats a naive datetime as local time; a server in UTC+5:45 would otherwise reject every valid code."""
    naive = NOW.replace(tzinfo=None)
    assert MFAService.verify_totp_step(SECRET, totp_code(0), naive) == counter_of()


def test_codes_from_a_real_authenticator_clock_are_accepted():
    """Cross-check against pyotp's own notion of 'now' (what an authenticator app produces)."""
    code = pyotp.TOTP(SECRET).now()
    assert MFAService.verify_totp_step(SECRET, code) is not None
