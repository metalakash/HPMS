"""Tell PostgreSQL who the request's user is, so its row policies apply (RFP TECH A.6; migration 033).

With ``DB_ROW_SECURITY`` on, ``get_current_user`` calls ``describe_user``; from then on every transaction the
request's session begins starts by setting ``hpms.rls``, ``hpms.user_id`` and ``hpms.roles`` for that
transaction only (``set_config(..., true)``), so nothing leaks to the next request that reuses the pooled
connection. Sessions that never call it (scheduled jobs, migrations, seeds) are not restricted.

``bank_wide`` is the one deliberate exemption: a figure that is by definition the whole bank's (the energy
financing share) is computed over every project whoever asks, as the application already intends.
"""

from contextlib import asynccontextmanager
from typing import Any, Iterable

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

INFO_KEY = "hpms_row_security"
_APPLY = text("SELECT set_config('hpms.rls', :rls, true), set_config('hpms.user_id', :user_id, true), "
              "set_config('hpms.roles', :roles, true)")


def describe_user(session: AsyncSession, user_id: Any, roles: Iterable[Any]) -> None:
    session.sync_session.info[INFO_KEY] = {
        "rls": "on", "user_id": str(user_id), "roles": ",".join(getattr(r, "value", r) for r in roles)}


@event.listens_for(Session, "after_begin")
def _apply_on_begin(session: Session, transaction, connection) -> None:
    context = session.info.get(INFO_KEY)
    if context:
        connection.execute(_APPLY, context)


async def _set_rls(session: AsyncSession, value: str) -> None:
    await session.execute(text("SELECT set_config('hpms.rls', :value, true)"), {"value": value})


@asynccontextmanager
async def bank_wide(session: AsyncSession):
    """Run the enclosed queries over every project: for bank-wide totals only."""
    context = session.sync_session.info.get(INFO_KEY)
    if not context:
        yield
        return
    await _set_rls(session, "off")
    try:
        yield
    finally:
        await _set_rls(session, "on")
