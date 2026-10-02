"""Audit immutability trigger, chain and retention against a real migrated Postgres (skipped without one)."""

from datetime import date

import pytest
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import DBAPIError

from backend.app.models.audit import AuditLog, AuditRetentionCheckpoint
from backend.app.services import audit_chain as ac


async def _append(db, n, ts="2010-01-01T00:00:00+00:00"):
    return [await ac.append_audit_log(db, user_id="u", user_role="admin", entity_type="T", entity_id=str(i),
                                      action="update", reason="test", timestamp=ts) for i in range(n)]


async def test_chain_links_and_verifies(db_session):
    rows = await _append(db_session, 3)
    assert rows[0].prev_hash == ac.GENESIS and rows[1].prev_hash == rows[0].state_hash
    assert (await ac.verify_stored_chain(db_session)).ok


async def test_rows_cannot_be_updated_deleted_or_truncated(db_session):
    rows = await _append(db_session, 1)
    for stmt in (update(AuditLog).where(AuditLog.id == rows[0].id).values(reason_for_action="edited"),
                 delete(AuditLog).where(AuditLog.id == rows[0].id), text("TRUNCATE audit_logs")):
        async with db_session.begin_nested():
            with pytest.raises(DBAPIError, match="append-only"):
                await db_session.execute(stmt)


async def test_purge_removes_only_the_old_prefix_and_chain_still_verifies(db_session):
    await _append(db_session, 3, ts="2010-01-01T00:00:00+00:00")   # expired
    recent = await _append(db_session, 2, ts="2026-09-01T00:00:00+00:00")
    today = date(2026, 10, 2)

    preview = await ac.preview_retention(db_session, today, 7)
    assert preview.eligible_rows == 3
    assert await ac.purge_expired(db_session, today, 7, "admin") == 3

    remaining = (await db_session.execute(select(AuditLog.id).order_by(AuditLog.id))).scalars().all()
    assert remaining == [r.id for r in recent]
    cp = (await db_session.execute(select(AuditRetentionCheckpoint))).scalar_one()
    assert cp.purged_count == 3 and recent[0].prev_hash == cp.last_purged_hash
    assert (await ac.verify_stored_chain(db_session)).ok  # anchored on the checkpoint

    # the purge bypass was transaction-local: direct deletes are blocked again
    async with db_session.begin_nested():
        with pytest.raises(DBAPIError, match="append-only"):
            await db_session.execute(delete(AuditLog).where(AuditLog.id == recent[0].id))


async def test_purge_never_punches_holes(db_session):
    """An old-timestamped row after a newer one is not purged: only a contiguous oldest prefix may go."""
    await _append(db_session, 1, ts="2010-01-01T00:00:00+00:00")
    await _append(db_session, 1, ts="2026-09-01T00:00:00+00:00")
    await _append(db_session, 1, ts="2010-06-01T00:00:00+00:00")
    assert await ac.purge_expired(db_session, date(2026, 10, 2), 7, "admin") == 1
    assert (await ac.verify_stored_chain(db_session)).ok
