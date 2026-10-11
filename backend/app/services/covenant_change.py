"""Covenant inputs as maker-checker change requests.

A project's reported financials (FINANCIAL_PERIOD, one per fiscal quarter) and its sanction terms
(COVENANT_TERMS, one per project) change only through a change request. Submission checks the
change and records the values it would replace; final approval applies it through CovenantService,
which re-tests the project. The direct PUT endpoints are closed (routes_covenants).

Requests are keyed by project: ``entity_id`` is the project's id. A FINANCIAL_PERIOD request also
names its quarter in ``quarter_ad``.
"""

import json
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.audit import AuditAction, AuditLog
from backend.app.models.governance import ApprovalRequest
from backend.app.models.operations import FinancialPeriod
from backend.app.models.project import Project
from backend.app.schemas.covenant import CovenantTermsRequest, FinancialPeriodRequest
from backend.app.security.auth_middleware import CurrentUser
from backend.app.services import covenant_service as cs
from backend.app.services.audit_chain import append_audit_log
from backend.app.services.covenant_engine import Quarter

KINDS = frozenset({"FINANCIAL_PERIOD", "COVENANT_TERMS"})
PERIOD_FIELDS = (*cs.PERIOD_AMOUNTS, "is_audited", "source_reference")
TERM_FIELDS_WITH_SOURCE = (*cs.TERM_FIELDS, "source_reference")


def is_covenant_kind(entity_type: str) -> bool:
    return entity_type.upper() in KINDS


def _project_id(entity_id: Any) -> UUID:
    try:
        return UUID(str(entity_id))
    except ValueError:
        raise LookupError(f"Project {entity_id} not found") from None


def _typed(kind: str, changes: Dict[str, Any]) -> Tuple[Optional[str], Dict[str, Any]]:
    """Check a request body the way the direct endpoints did. Returns (quarter label, values)."""
    values = dict(changes)
    quarter = None
    if kind == "FINANCIAL_PERIOD":
        quarter = values.pop("quarter_ad", None)
        if not quarter:
            raise ValueError("quarter_ad is required: the fiscal quarter, e.g. 2082-83-Q4")
        model = FinancialPeriodRequest
    else:
        model = CovenantTermsRequest

    unknown = set(values) - set(model.model_fields)
    if unknown:
        raise ValueError(f"{', '.join(sorted(unknown))} is not a field of {kind}")
    try:
        body = model(**values)
    except ValidationError as exc:
        first = exc.errors()[0]
        raise ValueError(f"{first['loc'][0]}: {first['msg']}") from None
    # A period records only the fields sent (a correction keeps the rest); terms always replace all four
    typed = body.model_dump(exclude_unset=True) if kind == "FINANCIAL_PERIOD" else body.model_dump()
    return quarter, typed


def _plain(values: Dict[str, Any]) -> Dict[str, Any]:
    return {k: (str(v) if hasattr(v, "as_tuple") else v) for k, v in values.items()}


async def prepare(db: AsyncSession, entity_type: str, entity_id: Any, changes: Dict[str, Any],
                  today=None) -> Dict[str, Any]:
    """Check a proposed change now and return the values it would replace (the request's pre-state)."""
    kind = entity_type.upper()
    project_id = _project_id(entity_id)
    if await db.get(Project, project_id) is None:
        raise LookupError(f"Project {entity_id} not found")
    quarter, values = _typed(kind, changes)

    if kind == "FINANCIAL_PERIOD":
        label = cs.check_period(quarter, values, today).label
        row = (await db.execute(select(FinancialPeriod).where(
            FinancialPeriod.project_id == project_id, FinancialPeriod.quarter_ad == label))).scalar_one_or_none()
        return {name: getattr(row, name) for name in PERIOD_FIELDS} if row else {}

    cs.check_terms(values)
    previous, row = await cs.CovenantService.terms_for(db, project_id)
    return {name: getattr(previous, name) for name in cs.TERM_FIELDS} if row else {}


async def _submitted_changes(db: AsyncSession, approval: ApprovalRequest) -> Dict[str, Any]:
    submission = None
    if approval.submit_audit_log_id is not None:
        submission = (await db.execute(
            select(AuditLog).where(AuditLog.id == approval.submit_audit_log_id))).scalar_one_or_none()
    if submission is None:
        raise ValueError("The submission record for this request is no longer available; it cannot be applied")
    return json.loads(submission.post_state or "{}")


async def apply(db: AsyncSession, approval: ApprovalRequest, approver: CurrentUser,
                source_ip: Optional[str], timestamp: str) -> bool:
    """Apply an approved covenant change and re-test the project. Always True: the change is applied or it raises."""
    kind = approval.entity_type.upper()
    project_id = _project_id(approval.entity_id)
    quarter, values = _typed(kind, await _submitted_changes(db, approval))
    if kind == "FINANCIAL_PERIOD":
        row, before = await cs.CovenantService.save_period(db, project_id, quarter, values, approver.username)
        after = {name: getattr(row, name) for name in PERIOD_FIELDS}
        action = AuditAction.UPDATE.value if before else AuditAction.CREATE.value
        recorded = Quarter.parse(quarter).label
    else:
        row, before = await cs.CovenantService.save_terms(db, project_id, values, approver.username)
        after = {name: getattr(row, name) for name in TERM_FIELDS_WITH_SOURCE}
        action = AuditAction.UPDATE.value if before else AuditAction.CREATE.value
        recorded = str(project_id)

    await append_audit_log(
        db, user_id=approver.id, user_role=approver.roles[0].value if approver.roles else "guest",
        source_ip=source_ip, timestamp=timestamp, entity_type=kind, entity_id=row.id, action=action,
        reason=f"Applied approved change request {approval.id} ({recorded})",
        pre_state=_plain(before), post_state=_plain(after))
    await cs.CovenantService.recalculate_project(db, project_id)
    return True
