"""Change request types beyond project, loan and covenant edits, behind one interface.

Each kind checks a proposed change when it is submitted (and records the values it would replace),
then applies it on final approval. The mutation service calls ``get(entity_type)`` at those two points;
the maker-checker rules (two different checkers, nobody checks their own work) stay in the service.

A kind is either *project-scoped* (``entity_id`` is a project id: row-level security applies, so a
maker may only propose for projects they own) or *bank-wide* (settings and rules; ``entity_id`` names
the setting).
"""

import json
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Awaitable, Callable, Dict, FrozenSet, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.audit import AuditLog
from backend.app.models.governance import ApprovalRequest

Prepare = Callable[[AsyncSession, Any, Dict[str, Any]], Awaitable[Dict[str, Any]]]
Apply = Callable[[AsyncSession, Any, Dict[str, Any], str], Awaitable[Tuple[Dict[str, Any], Dict[str, Any]]]]


@dataclass(frozen=True)
class ChangeKind:
    name: str
    project_scoped: bool
    prepare: Prepare  # (db, entity_id, changes) -> values being replaced; raises ValueError / LookupError
    apply: Apply  # (db, entity_id, changes, approver username) -> (before, after)
    label: str  # how the approvals queue names it, e.g. "Budget for"
    author_roles: FrozenSet[str] = field(default_factory=lambda: frozenset({"maker", "admin"}))


_KINDS: Dict[str, ChangeKind] = {}


def register(kind: ChangeKind) -> ChangeKind:
    _KINDS[kind.name] = kind
    return kind


def get(entity_type: str) -> Optional[ChangeKind]:
    _load()
    return _KINDS.get(entity_type.upper())


def _load() -> None:
    # Kinds register themselves on import; imported here so the mutation service needs no list of them
    from backend.app.services import budget_changes, fx_changes, projection_changes, settings_changes  # noqa: F401


async def submitted_changes(db: AsyncSession, approval: ApprovalRequest) -> Dict[str, Any]:
    """What the request proposed, from its submission entry in the audit log."""
    submission = None
    if approval.submit_audit_log_id is not None:
        submission = (await db.execute(
            select(AuditLog).where(AuditLog.id == approval.submit_audit_log_id))).scalar_one_or_none()
    if submission is None:
        raise ValueError("The submission record for this request is no longer available; it cannot be applied")
    return json.loads(submission.post_state or "{}")


# ---------------------------------------------------------------- shared checks

def project_uuid(entity_id: Any) -> UUID:
    try:
        return UUID(str(entity_id))
    except ValueError:
        raise LookupError(f"Project {entity_id} not found") from None


def amount(value: Any, name: str, allow_negative: bool = False) -> Decimal:
    """A money amount in NPR with at most two decimals."""
    try:
        number = Decimal(str(value).strip().replace(",", ""))
    except (InvalidOperation, AttributeError):
        raise ValueError(f"{name}: {value!r} is not an amount") from None
    if not number.is_finite() or number.as_tuple().exponent < -2:
        raise ValueError(f"{name}: use at most two decimals")
    if number < 0 and not allow_negative:
        raise ValueError(f"{name} cannot be negative")
    return number


def plain(values: Dict[str, Any]) -> Dict[str, Any]:
    """JSON-friendly copy for the audit log (decimals as strings)."""
    return {k: (str(v) if isinstance(v, Decimal) else v) for k, v in values.items()}


def require_source(changes: Dict[str, Any]) -> str:
    source = str(changes.get("source_reference") or "").strip()
    if len(source) < 3:
        raise ValueError("source_reference is required: where these figures come from")
    return source[:255]


def only_fields(changes: Dict[str, Any], allowed: List[str], kind: str) -> None:
    unknown = set(changes) - set(allowed)
    if unknown:
        raise ValueError(f"{', '.join(sorted(unknown))} is not a field of {kind}")
