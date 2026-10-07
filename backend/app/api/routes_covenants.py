"""Covenant testing endpoints: the borrower figures that go in, the thresholds, and the results.

- GET  /api/v1/compliance/covenants                               latest result per visible project
- GET  /api/v1/compliance/covenants/{project_id}/financials        reported quarters and thresholds
- PUT  /api/v1/compliance/covenants/{project_id}/financials/{q}    record or correct a quarter
- PUT  /api/v1/compliance/covenants/{project_id}/terms             thresholds from the sanction letter
- GET  /api/v1/compliance/covenants/{project_id}/calculation       the working behind a result
- POST /api/v1/compliance/covenants/{project_id}/recalculate       re-run the tests

Every write is audited and re-runs the project's tests in the same transaction.
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes_projects import _get_visible_project
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.middleware.security import client_ip
from backend.app.schemas.common import ApiResponse, AuditMetadata, ResponseMeta
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.ldap_provider import UserRole
from backend.app.security.rls_service import RLSService
from backend.app.services.audit_chain import append_audit_log
from backend.app.services.covenant_service import (
    PERIOD_AMOUNTS, TERM_FIELDS, CovenantService, calculation_to_dict, period_to_dict,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/compliance/covenants", tags=["covenants"])

Amount = Optional[Decimal]


class FinancialPeriodRequest(BaseModel):
    """One quarter of the borrower's figures in NPR. Leave income fields out before commercial operation."""

    revenue_npr: Amount = None
    operating_expenses_npr: Amount = None
    royalty_npr: Amount = None
    tax_paid_npr: Amount = None
    depreciation_npr: Amount = None
    security_value_npr: Amount = Field(None, description="Value of the security at the period end")
    is_audited: bool = False
    source_reference: str = Field(min_length=3, max_length=255,
                                  description="Where the figures come from, e.g. the accounts or valuation report")


class CovenantTermsRequest(BaseModel):
    dscr_min: Decimal
    ltv_max: Decimal
    icr_min: Decimal
    warning_margin_pct: Decimal = Decimal("8")
    source_reference: str = Field(min_length=3, max_length=255, description="Sanction letter or agreement reference")


def _respond(data: Any, user: CurrentUser, action: str) -> ApiResponse[Any]:
    now = datetime.utcnow().isoformat()
    return ApiResponse(
        data=data,
        meta=ResponseMeta(timestamp=now, version="0.1.0", page=None, page_size=None, total_count=None),
        audit=AuditMetadata(user_id=user.username, action=action, timestamp=now),
    )


def _plain(values: Dict[str, Any]) -> Dict[str, Any]:
    return {k: (str(v) if isinstance(v, Decimal) else v) for k, v in values.items()}


async def _audit(db: AsyncSession, request: Request, user: CurrentUser, entity_type: str, entity_id: Any,
                 action: str, reason: str, pre_state: Dict[str, Any], post_state: Dict[str, Any]) -> None:
    await append_audit_log(
        db, user_id=user.id or user.username, user_role=user.roles[0].value if user.roles else None,
        entity_type=entity_type, entity_id=entity_id, action=action, reason=reason, pre_state=_plain(pre_state),
        post_state=_plain(post_state), source_ip=client_ip(request.scope, settings.TRUSTED_PROXY_HOPS))


async def _editable_project(db: AsyncSession, user: CurrentUser, project_id: str):
    project = await _get_visible_project(db, user, project_id)
    if not await RLSService.can_update_project(db, user, project.id):
        raise HTTPException(status_code=403, detail="Not allowed to record figures for this project")
    return project


@router.get("", response_model=ApiResponse[list])
async def list_covenant_results(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[list]:
    """The latest covenant result of every project the caller may see, breaches first."""
    visible = await RLSService.get_authorized_project_ids(db, current_user)
    rows = await CovenantService.portfolio(db, visible) if visible else []
    return _respond(rows, current_user, "list_covenant_results")


@router.get("/{project_id}/financials", response_model=ApiResponse[dict])
async def get_financials(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """The quarters reported for a project (newest first) and the thresholds its covenants are tested against."""
    project = await _get_visible_project(db, current_user, project_id)
    return _respond(await CovenantService.get_financials(db, project.id), current_user, "view_covenant_inputs")


@router.put("/{project_id}/financials/{quarter}", response_model=ApiResponse[dict])
async def put_financial_period(
    project_id: str,
    quarter: str,
    body: FinancialPeriodRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Record or correct the figures for a completed quarter (e.g. 2026-Q2), then re-run the project's tests.

    Admins, and makers on projects they own. Fields left out of a correction keep their value.
    """
    project = await _editable_project(db, current_user, project_id)
    values = body.model_dump(exclude_unset=True)
    try:
        row, before = await CovenantService.save_period(db, project.id, quarter, values, current_user.username)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None

    after = {name: getattr(row, name) for name in (*PERIOD_AMOUNTS, "is_audited", "source_reference")}
    await _audit(db, request, current_user, "FINANCIAL_PERIOD", row.id, "update" if before else "create",
                 f"Financials for {row.quarter_ad}: {body.source_reference}", before, after)
    calculations = await CovenantService.recalculate_project(db, project.id)
    await db.commit()

    result = next((c for c in calculations if c.quarter.label == row.quarter_ad), None)
    return _respond({"period": period_to_dict(row), "calculation": calculation_to_dict(result) if result else None},
                    current_user, "record_financial_period")


@router.put("/{project_id}/terms", response_model=ApiResponse[dict])
async def put_terms(
    project_id: str,
    body: CovenantTermsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Set a project's covenant thresholds and re-test its history against them. Admin only."""
    project = await _get_visible_project(db, current_user, project_id)
    if not current_user.has_role(UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin role required to set covenant terms")
    try:
        row, before = await CovenantService.save_terms(db, project.id, body.model_dump(), current_user.username)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None

    await _audit(db, request, current_user, "COVENANT_TERMS", row.id, "update",
                 f"Covenant terms: {body.source_reference}", before, {name: getattr(row, name) for name in TERM_FIELDS})
    await CovenantService.recalculate_project(db, project.id)
    await db.commit()
    return _respond(await CovenantService.get_financials(db, project.id), current_user, "set_covenant_terms")


@router.get("/{project_id}/calculation", response_model=ApiResponse[dict])
async def get_calculation(
    project_id: str,
    quarter: Optional[str] = Query(None, description="Quarter like 2026-Q2; the latest tested quarter if omitted"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """How a quarter's DSCR, ICR and LTV were arrived at: the window, every input and each ratio."""
    project = await _get_visible_project(db, current_user, project_id)
    try:
        data = await CovenantService.explain(db, project.id, quarter)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    if data is None:
        raise HTTPException(status_code=404, detail="No figures are on file for that quarter")
    return _respond(data, current_user, "view_covenant_calculation")


@router.post("/{project_id}/recalculate", response_model=ApiResponse[dict])
async def recalculate(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Re-run the project's covenant tests, e.g. after its loan schedule changed."""
    project = await _editable_project(db, current_user, project_id)
    calculations = await CovenantService.recalculate_project(db, project.id)
    await db.commit()
    latest = calculations[-1] if calculations else None
    return _respond({"quarters_tested": len(calculations),
                     "latest": calculation_to_dict(latest) if latest else None}, current_user, "recalculate_covenants")
