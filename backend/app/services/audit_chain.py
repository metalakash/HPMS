"""Hash-chained audit log: the single writer, verification, and retention (RFP E.1, E.3, E.4).

Every ``audit_logs`` row stores ``prev_hash`` (the previous row's ``state_hash``) and a
``state_hash`` covering its own content *and* ``prev_hash``. Deleting, inserting or
reordering rows breaks the links; editing a row is additionally blocked by a database
trigger (migration 015). Retention may remove only a contiguous oldest prefix, and records a
checkpoint so the remaining chain still verifies.
"""

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Iterable, Optional

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.audit import AuditLog

logger = logging.getLogger(__name__)

GENESIS = "0" * 64
_CHAIN_LOCK_KEY = 7_340_223  # pg_advisory_xact_lock key serialising chain appends


def compute_hash(prev_hash: str, *, user_id: str, entity_type: str, entity_id: str, action: str,
                 reason: str, pre_state: Optional[str], post_state: Optional[str], timestamp: str) -> str:
    """SHA-256 over the row's content and its predecessor's hash."""
    payload = json.dumps({
        "prev": prev_hash, "user": str(user_id), "entity_type": entity_type, "entity_id": str(entity_id),
        "action": action, "reason": reason, "pre": pre_state, "post": post_state, "ts": timestamp,
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _dump(state: Any) -> Optional[str]:
    if state is None or isinstance(state, str):
        return state
    return json.dumps(state, sort_keys=True, default=str)


async def append_audit_log(
    db: AsyncSession, *, user_id: Any, user_role: Optional[str], entity_type: str, entity_id: Any, action: str,
    reason: str, pre_state: Any = None, post_state: Any = None, source_ip: Optional[str] = None,
    session_id: Optional[str] = None, timestamp: Optional[str] = None,
) -> AuditLog:
    """Append one row to the chain. Serialised with an advisory lock so concurrent writers cannot fork it."""
    if not reason or not str(reason).strip():
        raise ValueError("reason_for_action is mandatory")
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _CHAIN_LOCK_KEY})
    last = (await db.execute(select(AuditLog.state_hash).order_by(AuditLog.id.desc()).limit(1))).scalar()
    prev_hash = last or await _checkpoint_hash(db) or GENESIS

    timestamp = timestamp or datetime.now(timezone.utc).isoformat()
    pre, post = _dump(pre_state), _dump(post_state)
    entry = AuditLog(
        user_id=str(user_id), user_role=user_role, source_ip=source_ip or "0.0.0.0", session_id=session_id or "unknown",
        timestamp=timestamp, entity_type=entity_type, entity_id=str(entity_id), action_performed=action,
        reason_for_action=reason, pre_state=pre, post_state=post, prev_hash=prev_hash,
        state_hash=compute_hash(prev_hash, user_id=user_id, entity_type=entity_type, entity_id=entity_id,
                                action=action, reason=reason, pre_state=pre, post_state=post, timestamp=timestamp),
    )
    db.add(entry)
    await db.flush()
    return entry


# ---------------------------------------------------------------- verification

@dataclass
class ChainReport:
    ok: bool
    checked: int
    first_bad_id: Optional[int] = None
    problem: Optional[str] = None


def verify_chain(entries: Iterable[Any], start_prev_hash: Optional[str] = None) -> ChainReport:
    """Check that each row's prev_hash is its predecessor's state_hash, oldest first.

    ``start_prev_hash`` is what the first row must point at: GENESIS for a never-purged log, or the
    retention checkpoint's hash after a purge. When omitted the first row is trusted as the anchor.
    """
    expected = start_prev_hash
    checked = 0
    for e in entries:
        if expected is not None and e.prev_hash != expected:
            return ChainReport(False, checked, e.id, f"row {e.id} does not follow the previous row")
        if not e.state_hash or len(e.state_hash) != 64:
            return ChainReport(False, checked, e.id, f"row {e.id} has no valid state_hash")
        expected = e.state_hash
        checked += 1
    return ChainReport(True, checked)


async def verify_stored_chain(db: AsyncSession, batch: int = 5000) -> ChainReport:
    """Verify the whole table in id order, in batches."""
    expected = await _checkpoint_hash(db) or GENESIS
    last_id, checked = 0, 0
    while True:
        rows = (await db.execute(
            select(AuditLog.id, AuditLog.prev_hash, AuditLog.state_hash)
            .where(AuditLog.id > last_id).order_by(AuditLog.id).limit(batch))).all()
        if not rows:
            return ChainReport(True, checked)
        report = verify_chain(rows, expected)
        if not report.ok:
            return ChainReport(False, checked + report.checked, report.first_bad_id, report.problem)
        checked += report.checked
        expected, last_id = rows[-1].state_hash, rows[-1].id


# ---------------------------------------------------------------- retention

async def _checkpoint_hash(db: AsyncSession) -> Optional[str]:
    from backend.app.models.audit import AuditRetentionCheckpoint
    return (await db.execute(
        select(AuditRetentionCheckpoint.last_purged_hash).order_by(AuditRetentionCheckpoint.id.desc()).limit(1)
    )).scalar()


def retention_cutoff(today: date, years: int) -> date:
    """Oldest date that must still be retained; rows strictly before it are eligible for purge."""
    if years < 1:
        raise ValueError("Retention must be at least 1 year")
    try:
        return today.replace(year=today.year - years)
    except ValueError:  # 29 Feb
        return today.replace(year=today.year - years, day=28)


@dataclass
class RetentionPreview:
    cutoff: date
    years: int
    eligible_rows: int
    oldest_id: Optional[int]
    newest_eligible_id: Optional[int]


async def preview_retention(db: AsyncSession, today: date, years: int) -> RetentionPreview:
    """Count rows older than the cutoff that form a purgeable oldest prefix. Never modifies data."""
    cutoff = retention_cutoff(today, years)
    # timestamp is an ISO-8601 string, so lexicographic comparison orders it correctly
    boundary = cutoff.isoformat()
    first_kept = (await db.execute(
        select(func.min(AuditLog.id)).where(AuditLog.timestamp >= boundary))).scalar()
    q = select(func.count(), func.min(AuditLog.id), func.max(AuditLog.id))
    if first_kept is not None:
        q = q.where(AuditLog.id < first_kept)  # only the oldest contiguous prefix: never punch holes in the chain
    count, oldest, newest = (await db.execute(q)).one()
    return RetentionPreview(cutoff, years, count or 0, oldest, newest)


async def purge_expired(db: AsyncSession, today: date, years: int, purged_by: str) -> int:
    """Delete the oldest prefix older than the retention cutoff and record a checkpoint. Returns rows deleted.

    The caller owns the transaction. The delete is allowed through the immutability trigger only by
    ``SET LOCAL hpms.audit_purge = 'on'`` for this transaction.
    """
    from backend.app.models.audit import AuditRetentionCheckpoint

    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _CHAIN_LOCK_KEY})
    preview = await preview_retention(db, today, years)
    if not preview.eligible_rows:
        return 0
    last_hash = (await db.execute(
        select(AuditLog.state_hash).where(AuditLog.id == preview.newest_eligible_id))).scalar()

    await db.execute(text("SET LOCAL hpms.audit_purge = 'on'"))
    result = await db.execute(delete(AuditLog).where(AuditLog.id <= preview.newest_eligible_id))
    deleted = result.rowcount or 0
    await db.execute(text("SET LOCAL hpms.audit_purge = 'off'"))  # close the window as soon as the delete is done
    db.add(AuditRetentionCheckpoint(
        purged_through_id=preview.newest_eligible_id, last_purged_hash=last_hash, purged_count=deleted,
        retention_years=years, cutoff_date=preview.cutoff, purged_by=purged_by))
    await db.flush()
    logger.warning("Audit retention: purged %d rows through id %s (cutoff %s) by %s",
                   deleted, preview.newest_eligible_id, preview.cutoff, purged_by)
    return deleted
