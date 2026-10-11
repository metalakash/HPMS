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
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes_projects import _get_visible_project
from backend.app.database import get_db
from backend.app.schemas.common import ApiResponse, AuditMetadata, ResponseMeta
from backend.app.schemas.covenant import CovenantTermsRequest, FinancialPeriodRequest
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.rls_service import RLSService
from backend.app.services.covenant_service import CovenantService, calculation_to_dict

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/compliance/covenants", tags=["covenants"])

CHANGE_REQUEST_MESSAGE = ("Covenant inputs are changed through a change request: submit to "
                         "/api/v1/mutations/submit-with-justification with entity_type {entity}, "
                         "the project id as entity_id, and get it approved by a second checker")


def _respond(data: Any, user: CurrentUser, action: str) -> ApiResponse[Any]:
    now = datetime.utcnow().isoformat()
    return ApiResponse(
        data=data,
        meta=ResponseMeta(timestamp=now, version="0.1.0", page=None, page_size=None, total_count=None),
        audit=AuditMetadata(user_id=user.username, action=action, timestamp=now),
    )


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
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Closed: reported figures change only through a maker-checker change request."""
    raise HTTPException(status_code=409, detail=CHANGE_REQUEST_MESSAGE.format(entity="FINANCIAL_PERIOD"))


@router.put("/{project_id}/terms", response_model=ApiResponse[dict])
async def put_terms(
    project_id: str,
    body: CovenantTermsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Closed: sanction terms change only through a maker-checker change request (admin approves)."""
    raise HTTPException(status_code=409, detail=CHANGE_REQUEST_MESSAGE.format(entity="COVENANT_TERMS"))


@router.get("/{project_id}/calculation", response_model=ApiResponse[dict])
async def get_calculation(
    project_id: str,
    quarter: Optional[str] = Query(None, description="Fiscal quarter like 2082-83-Q4; the latest tested quarter if omitted"),
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
