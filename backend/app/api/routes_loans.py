"""FastAPI routes for loan account management endpoints.

Implements:
- GET /api/v1/loan-accounts — list with filters
- GET /api/v1/loan-accounts/{id} — detail with rate history
- GET /api/v1/loan-accounts/sync — trigger CBS synchronization
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.app.database import get_db
from backend.app.models.financial import LoanAccount, LoanAccountRateHistory
from backend.app.models.project import Project
from backend.app.schemas.common import ApiResponse, ResponseMeta, AuditMetadata
from backend.app.schemas.loan import (
    LoanAccountListRequest,
    LoanAccountListResponse,
    LoanAccountDetailResponse,
    RateHistoryEntry,
    RateSyncResponse,
)
from backend.app.services.cbs_sync_service import CBSSyncService
from backend.app.integration.finacle_adapter import get_adapter
from backend.app.integration.finacle_schema import FinacleSyncType
from backend.app.security.auth_middleware import CurrentUser, get_current_user, require_admin
from backend.app.security.rls_service import RLSService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/loan-accounts", tags=["loan-accounts"])


def _get_audit_metadata(user_id: str = "anonymous", action: str = "read") -> AuditMetadata:
    """Create audit metadata for response."""
    return AuditMetadata(
        user_id=user_id,
        action=action,
        timestamp=datetime.utcnow().isoformat(),
    )


def _parse_uuid(value: str, label: str) -> uuid.UUID:
    """Parse a UUID filter/path value; malformed ids are reported as not found."""
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"{label} {value} not found")


def _get_response_meta(page: Optional[int] = None, page_size: Optional[int] = None, total_count: Optional[int] = None) -> ResponseMeta:
    """Create response metadata."""
    return ResponseMeta(
        timestamp=datetime.utcnow().isoformat(),
        version="0.1.0",
        page=page,
        page_size=page_size,
        total_count=total_count,
    )


@router.get("", response_model=ApiResponse[list[LoanAccountListResponse]])
async def list_loan_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by sync_status"),
    facility_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ApiResponse[list[LoanAccountListResponse]]:
    """List loan accounts with filtering and pagination.

    Query parameters:
    - project_id: filter by project UUID
    - status: filter by sync_status (pending, success, failed)
    - facility_type: filter by facility type
    """

    if project_id:
        project_id = _parse_uuid(project_id, "Project")

    # Build query (joined to Project so each row carries its project code)
    query = select(LoanAccount, Project.project_code).join(Project, Project.id == LoanAccount.project_id)

    if project_id:
        query = query.where(LoanAccount.project_id == project_id)
    if status:
        query = query.where(LoanAccount.sync_status == status)
    if facility_type:
        query = query.where(LoanAccount.facility_type == facility_type)

    # Get total count
    count_query = select(func.count()).select_from(LoanAccount)
    if project_id:
        count_query = count_query.where(LoanAccount.project_id == project_id)
    if status:
        count_query = count_query.where(LoanAccount.sync_status == status)
    if facility_type:
        count_query = count_query.where(LoanAccount.facility_type == facility_type)

    # Row-level security: only accounts on projects the user may see
    query = await RLSService.scope_query(db, current_user, query, LoanAccount.project_id)
    count_query = await RLSService.scope_query(db, current_user, count_query, LoanAccount.project_id)

    total_count = await db.execute(count_query)
    total_count = total_count.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(LoanAccount.created_at.desc())

    # Execute
    result = await db.execute(query)
    rows = result.all()

    # Convert
    items = []
    for a, project_code in rows:
        items.append(
            LoanAccountListResponse(
                id=str(a.id),
                project_code=project_code,
                finacle_account_id="***MASKED***",
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
        )

    return ApiResponse(
        data=items,
        meta=_get_response_meta(page=page, page_size=page_size, total_count=total_count),
        audit=_get_audit_metadata(user_id=current_user.username, action="list_loan_accounts"),
    )


@router.get("/{account_id}", response_model=ApiResponse[LoanAccountDetailResponse])
async def get_loan_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[LoanAccountDetailResponse]:
    """Get detailed loan account view with rate history.

    Path parameters:
    - account_id: LoanAccount UUID
    """

    # Get account
    account_id = _parse_uuid(account_id, "Loan account")
    query = select(LoanAccount).where(LoanAccount.id == account_id)
    result = await db.execute(query)
    account = result.scalar_one_or_none()

    # Accounts on projects the user can't see are reported as missing
    if not account or not await RLSService.can_view_project(db, current_user, account.project_id):
        raise HTTPException(status_code=404, detail=f"Loan account {account_id} not found")

    # Get project code
    proj_query = select(Project).where(Project.id == account.project_id)
    proj_result = await db.execute(proj_query)
    project = proj_result.scalar()

    # Get rate history
    rate_query = (
        select(LoanAccountRateHistory)
        .where(LoanAccountRateHistory.loan_account_id == account_id)
        .order_by(LoanAccountRateHistory.valid_from_ad.desc())  # newest first
    )
    rate_result = await db.execute(rate_query)
    rates = rate_result.scalars().all()

    rate_history = [
        RateHistoryEntry(
            interest_rate_pct=r.interest_rate_pct,
            valid_from_ad=r.valid_from_ad,
            valid_from_bs=r.valid_from_bs,
            valid_to_ad=r.valid_to_ad,
            valid_to_bs=r.valid_to_bs,
            is_current=r.is_current,
            reason_for_change=r.reason_for_change,
            source=r.data_provenance,
        )
        for r in rates
    ]

    response = LoanAccountDetailResponse(
        id=str(account.id),
        project_id=str(account.project_id),
        project_code=project.project_code if project else "UNKNOWN",
        finacle_account_id="***MASKED***",
        facility_type=account.facility_type,
        sanctioned_amount=account.sanctioned_amount,
        currency_code=account.currency_code,
        disbursed_amount=account.disbursed_amount,
        outstanding_principal=account.outstanding_principal,
        outstanding_interest=account.outstanding_interest,
        overdue_principal=account.overdue_principal,
        overdue_interest=account.overdue_interest,
        interest_rate_pct=account.interest_rate_pct,
        rate_as_of_date=rates[0].valid_from_ad if rates else None,
        moratorium_end_ad=account.moratorium_end_ad,
        moratorium_end_bs=account.moratorium_end_bs,
        maturity_ad=account.maturity_ad,
        maturity_bs=account.maturity_bs,
        last_synced_at=account.last_synced_at,
        sync_status=account.sync_status,
        data_provenance=account.data_provenance,
        rate_history=rate_history,
        created_at=account.created_at.isoformat() if account.created_at else None,
        updated_at=account.updated_at.isoformat() if account.updated_at else None,
    )

    return ApiResponse(
        data=response,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="get_loan_account"),
    )


@router.post("/sync", response_model=ApiResponse[RateSyncResponse], status_code=status.HTTP_202_ACCEPTED)
async def trigger_rate_sync(
    db: AsyncSession = Depends(get_db),
    sync_type: str = Query("eod_batch", description="realtime_inquiry, eod_batch, bod_batch"),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[RateSyncResponse]:
    """Trigger CBS loan account synchronization (admin only).

    Query parameters:
    - sync_type: realtime_inquiry (single), eod_batch (all), bod_batch (all)

    Response: 202 Accepted (async job started)
    """

    user_id = current_user.username

    # Map sync type
    sync_type_map = {
        "realtime_inquiry": FinacleSyncType.REALTIME_INQUIRY,
        "eod_batch": FinacleSyncType.EOD_BATCH,
        "bod_batch": FinacleSyncType.BOD_BATCH,
    }

    if sync_type not in sync_type_map:
        raise HTTPException(status_code=400, detail=f"Unknown sync_type: {sync_type}")

    # Get adapter and sync service
    adapter = get_adapter("mock")  # Use mock for Phase 2; real adapter in Phase 2.5
    service = CBSSyncService(adapter=adapter)

    # Trigger sync
    try:
        sync_result = await service.sync_loan_accounts(
            db,
            sync_type=sync_type_map[sync_type],
            user_id=user_id,
        )
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

    # Commit any DB changes
    await db.commit()

    response = RateSyncResponse(
        sync_log_id=sync_result['sync_log_id'],
        accounts_synced=sync_result['accounts_synced'],
        rate_changes=sync_result['rate_changes'],
        errors=sync_result['errors'],
        status=sync_result['status'],
        message=sync_result['message'],
    )

    logger.info(f"Triggered {sync_type} sync: {sync_result['message']}")

    return ApiResponse(
        data=response,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=user_id, action="trigger_sync"),
    )
