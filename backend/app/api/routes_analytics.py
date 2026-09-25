"""FastAPI routes for analytics and reporting endpoints.

Implements:
- GET /api/v1/analytics/portfolio — portfolio-level metrics
- GET /api/v1/analytics/project/{id} — per-project analytics
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models.project import Project
from backend.app.models.financial import LoanAccount
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.rls_service import RLSService
from backend.app.schemas.common import ApiResponse, ResponseMeta, AuditMetadata
from backend.app.schemas.analytics import PortfolioMetricsResponse, ProjectAnalyticsResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _get_audit_metadata(user_id: str = "anonymous", action: str = "read") -> AuditMetadata:
    """Create audit metadata for response."""
    return AuditMetadata(
        user_id=user_id,
        action=action,
        timestamp=datetime.utcnow().isoformat(),
    )


def _get_response_meta() -> ResponseMeta:
    """Create response metadata."""
    return ResponseMeta(
        timestamp=datetime.utcnow().isoformat(),
        version="0.1.0",
    )


@router.get("/portfolio", response_model=ApiResponse[PortfolioMetricsResponse])
async def get_portfolio_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[PortfolioMetricsResponse]:
    """Get portfolio-level analytics.

    Returns aggregated metrics across all projects the user can view.
    Admins/auditors see all; makers see only their owned projects; guests see empty.
    """

    # Get authorized project IDs
    authorized_ids = await RLSService.get_authorized_project_ids(db, current_user)

    if not authorized_ids:
        # No authorized projects - return zeros
        return ApiResponse(
            data=PortfolioMetricsResponse(
                total_projects=0,
                active_projects=0,
                total_capacity_mw=Decimal("0"),
                average_interest_rate=None,
                total_sanctioned_amount=Decimal("0"),
                total_disbursed_amount=Decimal("0"),
                total_outstanding_principal=Decimal("0"),
            ),
            meta=_get_response_meta(),
            audit=_get_audit_metadata(user_id=current_user.username, action="read_portfolio_metrics"),
        )

    # Query authorized projects
    project_query = select(Project).where(Project.id.in_(authorized_ids))
    result = await db.execute(project_query)
    projects = result.scalars().all()

    total_projects = len(projects)
    active_projects = sum(
        1 for p in projects
        if p.pipeline_status in ("under_construction", "under_operation")
    )
    total_capacity_mw = sum((p.installed_capacity_mw or Decimal("0")) for p in projects)

    # Query loan account metrics for authorized projects
    loan_query = select(
        func.count(LoanAccount.id).label("count"),
        func.sum(LoanAccount.interest_rate_pct).label("total_rate"),
        func.sum(LoanAccount.sanctioned_amount).label("total_sanctioned"),
        func.sum(LoanAccount.disbursed_amount).label("total_disbursed"),
        func.sum(LoanAccount.outstanding_principal).label("total_outstanding"),
    ).where(LoanAccount.project_id.in_(authorized_ids))

    result = await db.execute(loan_query)
    row = result.one()

    loan_count = row.count or 0
    total_rate = row.total_rate or Decimal("0")
    avg_rate = (total_rate / loan_count) if loan_count > 0 else None

    metrics = PortfolioMetricsResponse(
        total_projects=total_projects,
        active_projects=active_projects,
        total_capacity_mw=total_capacity_mw,
        average_interest_rate=avg_rate,
        total_sanctioned_amount=row.total_sanctioned or Decimal("0"),
        total_disbursed_amount=row.total_disbursed or Decimal("0"),
        total_outstanding_principal=row.total_outstanding or Decimal("0"),
    )

    return ApiResponse(
        data=metrics,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="read_portfolio_metrics"),
    )


@router.get("/project/{project_id}", response_model=ApiResponse[ProjectAnalyticsResponse])
async def get_project_analytics(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ProjectAnalyticsResponse]:
    """Get per-project analytics with financial metrics.

    Returns detailed metrics for a single project if the user has view access.
    404 if not found or not authorized (RLS).
    """

    # Parse UUID; malformed IDs are 404
    try:
        pid = UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Load project
    result = await db.execute(select(Project).where(Project.id == pid))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Check RLS
    if not await RLSService.can_view_project(db, current_user, pid):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    # Get loan account metrics for this project
    loan_query = select(
        func.count(LoanAccount.id).label("count"),
        func.sum(LoanAccount.sanctioned_amount).label("total_sanctioned"),
        func.sum(LoanAccount.disbursed_amount).label("total_disbursed"),
        func.sum(LoanAccount.outstanding_principal).label("total_outstanding"),
    ).where(LoanAccount.project_id == pid)

    result = await db.execute(loan_query)
    row = result.one()

    analytics = ProjectAnalyticsResponse(
        project_id=str(project.id),
        project_code=project.project_code,
        name_en=project.name_en,
        name_np=project.name_np,
        installed_capacity_mw=project.installed_capacity_mw or Decimal("0"),
        pipeline_status=project.pipeline_status,
        project_stage=project.project_stage,
        province=project.province,
        total_sanctioned_amount=row.total_sanctioned or Decimal("0"),
        total_disbursed_amount=row.total_disbursed or Decimal("0"),
        total_outstanding_principal=row.total_outstanding or Decimal("0"),
        loan_account_count=row.count or 0,
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
    )

    return ApiResponse(
        data=analytics,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="read_project_analytics"),
    )
