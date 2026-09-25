"""FastAPI routes for project management endpoints.

Implements:
- GET /api/v1/projects — list with filters
- GET /api/v1/projects/{id} — detail with COD history
- POST /api/v1/projects — create new
- PATCH /api/v1/projects/{id} — update
- GET /api/v1/projects/{id}/loan-accounts — linked accounts
"""

import logging
from datetime import datetime
from typing import Optional
from decimal import Decimal
import uuid

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.app.database import get_db
from backend.app.models.project import Project, RCODEvent, PipelineStatus, ProjectStage
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.rls_service import RLSService
from backend.app.models.financial import LoanAccount, LoanAccountRateHistory
from backend.app.schemas.common import ApiResponse, ResponseMeta, AuditMetadata
from backend.app.schemas.project import (
    ProjectCreateRequest,
    ProjectListRequest,
    ProjectListResponse,
    ProjectDetailResponse,
    ProjectUpdateRequest,
    CODHistoryEntry,
)
from backend.app.schemas.loan import LoanAccountDetailResponse, LoanAccountListResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _get_audit_metadata(user_id: str = "anonymous", action: str = "read") -> AuditMetadata:
    """Create audit metadata for response."""
    return AuditMetadata(
        user_id=user_id,
        action=action,
        timestamp=datetime.utcnow().isoformat(),
    )


def _parse_project_id(project_id: str) -> uuid.UUID:
    """Parse a path UUID; malformed ids are reported as not found."""
    try:
        return uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


async def _get_visible_project(db: AsyncSession, user: CurrentUser, project_id: str) -> Project:
    """Load a project the user may see. Invisible projects are 404, not 403, so ids don't leak."""
    pid = _parse_project_id(project_id)
    result = await db.execute(select(Project).where(Project.id == pid))
    project = result.scalar_one_or_none()
    if not project or not await RLSService.can_view_project(db, user, pid):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


def _validate_status_fields(project_stage: Optional[str], pipeline_status: Optional[str]) -> None:
    valid_stages = {s.value for s in ProjectStage}
    valid_statuses = {s.value for s in PipelineStatus}
    if project_stage is not None and project_stage not in valid_stages:
        raise HTTPException(status_code=422, detail=f"Invalid project_stage. Allowed: {sorted(valid_stages)}")
    if pipeline_status is not None and pipeline_status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid pipeline_status. Allowed: {sorted(valid_statuses)}")


def _get_response_meta(page: Optional[int] = None, page_size: Optional[int] = None, total_count: Optional[int] = None) -> ResponseMeta:
    """Create response metadata."""
    return ResponseMeta(
        timestamp=datetime.utcnow().isoformat(),
        version="0.1.0",
        page=page,
        page_size=page_size,
        total_count=total_count,
    )


@router.get("", response_model=ApiResponse[list[ProjectListResponse]])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    status: Optional[str] = Query(None, description="Filter by pipeline_status"),
    stage: Optional[str] = Query(None, description="Filter by project_stage"),
    province: Optional[str] = Query(None, description="Filter by province"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ApiResponse[list[ProjectListResponse]]:
    """List projects with filtering and pagination.

    Query parameters:
    - status: proposal_under_pipeline, under_review, approved, dropped, etc.
    - stage: feasibility, construction, operation
    - province: province name
    """

    # Build query
    query = select(Project)

    if status:
        query = query.where(Project.pipeline_status == status)
    if stage:
        query = query.where(Project.project_stage == stage)
    if province:
        query = query.where(Project.province == province)

    # Get total count
    count_query = select(func.count()).select_from(Project)
    if status:
        count_query = count_query.where(Project.pipeline_status == status)
    if stage:
        count_query = count_query.where(Project.project_stage == stage)
    if province:
        count_query = count_query.where(Project.province == province)

    # Row-level security: the page and the total see the same rows
    query = await RLSService.scope_query(db, current_user, query)
    count_query = await RLSService.scope_query(db, current_user, count_query)

    total_count = await db.execute(count_query)
    total_count = total_count.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Project.created_at.desc())

    # Execute
    result = await db.execute(query)
    projects = result.scalars().all()

    # Convert to response
    items = [
        ProjectListResponse(
            id=str(p.id),
            project_code=p.project_code,
            name_en=p.name_en,
            name_np=p.name_np,
            province=p.province,
            installed_capacity_mw=p.installed_capacity_mw,
            project_stage=p.project_stage,
            pipeline_status=p.pipeline_status,
            latest_cod_ad=p.actual_cod_ad or p.forecast_cod_ad or p.current_approved_cod_ad,
            latest_cod_bs=p.actual_cod_bs or p.forecast_cod_bs or p.current_approved_cod_bs,
            created_at=p.created_at.isoformat() if p.created_at else None,
            created_by=p.created_by or "SYSTEM",
        )
        for p in projects
    ]

    return ApiResponse(
        data=items,
        meta=_get_response_meta(page=page, page_size=page_size, total_count=total_count),
        audit=_get_audit_metadata(user_id=current_user.username, action="list_projects"),
    )


@router.get("/{project_id}", response_model=ApiResponse[ProjectDetailResponse])
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ProjectDetailResponse]:
    """Get detailed project view with COD history and linked entities.

    Path parameters:
    - project_id: Project UUID
    """

    project = await _get_visible_project(db, current_user, project_id)
    project_id = project.id

    # Build COD history
    cod_history = [
        CODHistoryEntry(
            cod_type="original_cod",
            date_ad=project.original_cod_ad,
            date_bs=project.original_cod_bs,
            version=1,
            source="MANUAL_ENTRY",
        ),
        CODHistoryEntry(
            cod_type="current_approved_cod",
            date_ad=project.current_approved_cod_ad,
            date_bs=project.current_approved_cod_bs,
            version=1,
            source="MANUAL_ENTRY",
        ),
        CODHistoryEntry(
            cod_type="forecast_cod",
            date_ad=project.forecast_cod_ad,
            date_bs=project.forecast_cod_bs,
            version=1,
            source="CALCULATED",
        ),
        CODHistoryEntry(
            cod_type="actual_cod",
            date_ad=project.actual_cod_ad,
            date_bs=project.actual_cod_bs,
            version=1,
            source="DOCUMENT_VERIFIED",
        ),
    ]

    # Count related entities
    loan_count_query = select(func.count()).select_from(LoanAccount).where(LoanAccount.project_id == project_id)
    loan_count = await db.execute(loan_count_query)
    loan_count = loan_count.scalar() or 0

    doc_count_query = select(func.count()).select_from(Document).where(Document.project_id == project_id)
    doc_count = await db.execute(doc_count_query)
    doc_count = doc_count.scalar() or 0

    response = ProjectDetailResponse(
        id=str(project.id),
        project_code=project.project_code,
        name_en=project.name_en,
        name_np=project.name_np,
        location={
            "province": project.province,
            "district": project.district,
            "local_level": project.local_level,
        },
        installed_capacity_mw=project.installed_capacity_mw,
        project_stage=project.project_stage,
        pipeline_status=project.pipeline_status,
        drop_reason=project.drop_reason,
        cod_history=[h for h in cod_history if h.date_ad],  # Filter out nulls
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
        created_by=project.created_by or "SYSTEM",
        updated_by=project.updated_by or "SYSTEM",
        loan_accounts_count=loan_count,
        documents_count=doc_count,
    )

    return ApiResponse(
        data=response,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="get_project"),
    )


@router.post("", response_model=ApiResponse[ProjectDetailResponse], status_code=status.HTTP_201_CREATED)
async def create_project(
    req: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ProjectDetailResponse]:
    """Create new project.

    Request body:
    - project_code: unique identifier
    - name_en: English name
    - name_np: Nepali name
    - installed_capacity_mw: MW capacity
    - project_stage: feasibility, construction, operation
    - pipeline_status: proposal_under_pipeline, under_review, approved, etc.

    Requires maker or admin. The creator becomes the project's direct owner.
    """

    if not await RLSService.can_create_project(current_user):
        raise HTTPException(status_code=403, detail="Maker or admin role required")
    _validate_status_fields(req.project_stage, req.pipeline_status)

    user_id = current_user.username
    project = Project(
        id=uuid.uuid4(),
        project_code=req.project_code,
        name_en=req.name_en,
        name_np=req.name_np,
        province=req.province,
        district=req.district,
        local_level=req.local_level,
        installed_capacity_mw=req.installed_capacity_mw,
        project_stage=req.project_stage,
        pipeline_status=req.pipeline_status,
        created_by=user_id,
        updated_by=user_id,
    )

    db.add(project)

    try:
        await db.flush()
        await RLSService.assign_project_ownership(db, current_user.uuid, project.id, "direct")
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Project code {req.project_code} already exists")
    await db.refresh(project)

    # Return created project
    response = ProjectDetailResponse(
        id=str(project.id),
        project_code=project.project_code,
        name_en=project.name_en,
        name_np=project.name_np,
        location={
            "province": project.province,
            "district": project.district,
            "local_level": project.local_level,
        },
        installed_capacity_mw=project.installed_capacity_mw,
        project_stage=project.project_stage,
        pipeline_status=project.pipeline_status,
        drop_reason=None,
        cod_history=[],
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
        created_by=project.created_by,
        updated_by=project.updated_by,
        loan_accounts_count=0,
        documents_count=0,
    )

    logger.info(f"Created project {project.project_code} by {user_id}")

    return ApiResponse(
        data=response,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=user_id, action="create_project"),
    )


@router.get("/{project_id}/loan-accounts", response_model=ApiResponse[list[LoanAccountListResponse]])
async def get_project_loan_accounts(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[list[LoanAccountListResponse]]:
    """Get all loan accounts linked to a project.

    Path parameters:
    - project_id: Project UUID
    """

    p = await _get_visible_project(db, current_user, project_id)

    # Get loan accounts
    query = (
        select(LoanAccount)
        .where(LoanAccount.project_id == p.id)
        .order_by(LoanAccount.created_at.desc())
    )
    result = await db.execute(query)
    accounts = result.scalars().all()

    # Convert
    items = [
        LoanAccountListResponse(
            id=str(a.id),
            project_code=p.project_code,  # From project relation
            finacle_account_id="***MASKED***",  # Never expose account ID
            facility_type=a.facility_type,
            sanctioned_amount=a.sanctioned_amount,
            disbursed_amount=a.disbursed_amount,
            outstanding_principal=a.outstanding_principal,
            current_rate_pct=a.interest_rate_pct,
            maturity_ad=a.maturity_ad,
            sync_status=a.sync_status,
            last_synced_at=a.last_synced_at,
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in accounts
    ]

    return ApiResponse(
        data=items,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="list_loan_accounts"),
    )


@router.patch("/{project_id}", response_model=ApiResponse[ProjectDetailResponse])
async def update_project(
    project_id: str,
    req: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ProjectDetailResponse]:
    """Update project fields.

    Admins may update any project; makers only projects they own.
    Moving to "dropped" requires a drop_reason.
    """

    project = await _get_visible_project(db, current_user, project_id)
    if not await RLSService.can_update_project(db, current_user, project.id):
        raise HTTPException(status_code=403, detail="Not allowed to update this project")

    _validate_status_fields(req.project_stage, req.pipeline_status)
    changes = req.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No fields to update")

    if changes.get("pipeline_status") == PipelineStatus.DROPPED.value:
        if not (changes.get("drop_reason") or project.drop_reason):
            raise HTTPException(status_code=422, detail="drop_reason is required when dropping a project")

    for field, value in changes.items():
        setattr(project, field, value)
    project.updated_by = current_user.username

    await db.commit()
    logger.info(f"Updated project {project.project_code} fields {sorted(changes)} by {current_user.username}")

    # Reuse the detail view for a consistent response shape
    return await get_project(str(project.id), db=db, current_user=current_user)


# Import Document model (deferred to avoid circular imports)
from backend.app.models.document import Document
