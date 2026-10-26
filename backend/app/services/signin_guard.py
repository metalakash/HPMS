"""Sign-in throttling, account lockout and the record of every attempt (OWASP ASVS V2.2).

Before a password is checked: if a username has had ``LOGIN_MAX_FAILURES`` failed attempts since its last
success within the last ``LOGIN_LOCKOUT_MINUTES``, or a source address ``LOGIN_IP_MAX_FAILURES``, sign-in is
refused until the window passes, whatever the password. The refusal names the wait but never says whether the
username exists. Every attempt, allowed or not, is recorded.

If the record cannot be read or written (a database not yet migrated), the problem is logged and sign-in
continues on the password check alone: the bookkeeping must never be what locks every user out.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.models.auth import LoginAttempt

logger = logging.getLogger(__name__)


class SignInRefused(Exception):
    def __init__(self, minutes: int):
        super().__init__(f"Too many failed sign-in attempts. Try again in {minutes} minutes.")
        self.minutes = minutes


def _key(username: str) -> str:
    return (username or "").strip().lower()[:255]


async def _failures(db: AsyncSession, username: str, source_ip: Optional[str]):
    since = datetime.now(timezone.utc) - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
    key = _key(username)
    last_success = (await db.execute(select(func.max(LoginAttempt.attempted_at)).where(
        LoginAttempt.username == key, LoginAttempt.succeeded.is_(True)))).scalar()
    user_from = max(since, last_success) if last_success else since
    user_query = select(func.count()).select_from(LoginAttempt).where(
        LoginAttempt.username == key, LoginAttempt.outcome == "bad_credentials", LoginAttempt.attempted_at > user_from)
    if settings.LOGIN_LOCKOUT_SCOPE == "user_ip":
        user_query = user_query.where(LoginAttempt.source_ip == source_ip)
    by_user = (await db.execute(user_query)).scalar()
    by_ip = 0
    if source_ip:
        by_ip = (await db.execute(select(func.count()).select_from(LoginAttempt).where(
            LoginAttempt.source_ip == source_ip, LoginAttempt.outcome == "bad_credentials",
            LoginAttempt.attempted_at > since))).scalar()
    return by_user, by_ip


async def check(db: AsyncSession, username: str, source_ip: Optional[str]) -> None:
    """Raise SignInRefused when the username or the address is over its limit in the current window."""
    try:
        by_user, by_ip = await _failures(db, username, source_ip)
    except SQLAlchemyError as error:
        await db.rollback()
        logger.error("Sign-in record unavailable, throttling skipped: %s", error)
        return
    if by_user >= settings.LOGIN_MAX_FAILURES or by_ip >= settings.LOGIN_IP_MAX_FAILURES:
        await record(db, username, source_ip, "locked" if by_user >= settings.LOGIN_MAX_FAILURES else "throttled")
        raise SignInRefused(settings.LOGIN_LOCKOUT_MINUTES)


async def record(db: AsyncSession, username: str, source_ip: Optional[str], outcome: str) -> None:
    """Record an attempt and commit it: a refused attempt is answered with an error, which must not undo it."""
    try:
        db.add(LoginAttempt(username=_key(username), source_ip=(source_ip or "")[:64] or None,
                            succeeded=outcome == "success", outcome=outcome))
        await db.commit()
    except SQLAlchemyError as error:
        await db.rollback()
        logger.error("Could not record a sign-in attempt (%s): %s", outcome, error)
