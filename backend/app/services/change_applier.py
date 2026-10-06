"""Validate and apply the field changes carried by a maker-checker change request.

Only PROJECT and LOAN updates are applied to a record. Other entity types are free-form
requests that are recorded and decided but change nothing by themselves.

Who may propose which field is decided by ``security.field_policy``; this module decides what
a change must look like to be applicable at all (a real column, of the right type).
"""

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import LoanAccount
from backend.app.models.project import PipelineStatus, Project, ProjectStage

APPLICABLE = {"PROJECT": Project, "LOAN": LoanAccount}

# Never set through a change request, whatever the field policy says
_BOOKKEEPING = {"created_at", "updated_at", "created_by", "updated_by"}

_ALLOWED_VALUES = {
    ("PROJECT", "pipeline_status"): {s.value for s in PipelineStatus},
    ("PROJECT", "project_stage"): {s.value for s in ProjectStage},
}


def is_applicable(entity_type: str) -> bool:
    return entity_type.upper() in APPLICABLE


def _coerce(column: sa.Column, value: Any) -> Any:
    name = column.name
    if value is None:
        if not column.nullable:
            raise ValueError(f"{name} cannot be empty")
        return None
    kind = column.type
    try:
        if isinstance(kind, sa.Date):
            return value if isinstance(value, date) else date.fromisoformat(str(value))
        if isinstance(kind, sa.Numeric):
            number = Decimal(str(value))
            if not number.is_finite():
                raise ValueError
            return number
        if isinstance(kind, sa.Integer):
            return int(value)
    except (ValueError, InvalidOperation):
        raise ValueError(f"{name}: {value!r} is not a valid value") from None
    if isinstance(kind, (sa.String, sa.Text)):
        if not isinstance(value, str):
            raise ValueError(f"{name} must be text")
        if getattr(kind, "length", None) and len(value) > kind.length:
            raise ValueError(f"{name} is longer than {kind.length} characters")
        return value
    raise ValueError(f"{name} cannot be changed through a change request")


def normalise(entity_type: str, action: str, changes: Dict[str, Any]) -> Dict[str, Any]:
    """Typed copy of ``changes`` for an applicable entity type; ValueError if it could not be applied."""
    kind = entity_type.upper()
    model = APPLICABLE[kind]
    if action.upper() != "UPDATE":
        raise ValueError(f"Only UPDATE requests are supported for {kind}")
    if not changes:
        raise ValueError("No changes were given")

    columns = model.__table__.columns
    typed = {}
    for field, value in changes.items():
        column = columns.get(field)
        if column is None or column.primary_key or column.foreign_keys or field in _BOOKKEEPING:
            raise ValueError(f"{field} is not a field of {kind} that can be changed")
        typed[field] = _coerce(column, value)
        allowed = _ALLOWED_VALUES.get((kind, field))
        if allowed and typed[field] not in allowed:
            raise ValueError(f"{field}: {value!r} is not one of {', '.join(sorted(allowed))}")
    return typed


async def load(db: AsyncSession, entity_type: str, entity_id: str) -> Optional[Any]:
    model = APPLICABLE[entity_type.upper()]
    try:
        key = UUID(str(entity_id))
    except ValueError:
        return None
    return (await db.execute(select(model).where(model.id == key))).scalar_one_or_none()


def check_against(entity_type: str, record: Any, typed: Dict[str, Any]) -> None:
    """Rules that depend on the record's other fields."""
    if entity_type.upper() == "PROJECT" and typed.get("pipeline_status") == PipelineStatus.DROPPED.value:
        if not (typed.get("drop_reason") or record.drop_reason):
            raise ValueError("drop_reason is required when dropping a project")


def apply(entity_type: str, record: Any, typed: Dict[str, Any], updated_by: str) -> Tuple[dict, dict]:
    """Set the fields on ``record``. Returns (previous values, new values) for the audit trail."""
    check_against(entity_type, record, typed)
    before = {field: getattr(record, field) for field in typed}
    for field, value in typed.items():
        setattr(record, field, value)
    record.updated_by = updated_by
    return before, dict(typed)
