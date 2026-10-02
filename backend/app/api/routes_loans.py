"""FastAPI routes for loan account management endpoints.

Implements:
- GET /api/v1/loan-accounts — list with filters
- GET /api/v1/loan-accounts/{id} — detail with rate history
- GET /api/v1/loan-accounts/sync — trigger CBS synchronization
"""

import logging
import uuid
from datetime import datetime
from decimal import Decimal
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
    CovenantMetricsResponse,
    LoanExposureSyncRequest,
    LoanExposureSyncResult,
    LoanExposureSyncScheduleRequest,
    LoanExposureSyncScheduleResponse,
    LoanExposureSyncHistoryItem,
)
from backend.app.services.cbs_sync_service import CBSSyncService
from backend.app.services.loan_exposure_service import LoanExposureService
from backend.app.services.loan_exposure_ingest import ingest_loan_exposures
from backend.app.services.loan_sync_scheduler_service import LoanSyncSchedulerService
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


@router.get("/{loan_id}/covenant-metrics", response_model=ApiResponse[CovenantMetricsResponse])
async def get_covenant_metrics(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[CovenantMetricsResponse]:
    """Get covenant metrics for a loan account.

    Returns DSCR, LTV, ICR with pass/fail indicators.
    RLS: user must have access to the linked project.
    """

    # Parse UUID
    try:
        lid = uuid.UUID(loan_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Loan {loan_id} not found")

    # Load loan
    result = await db.execute(select(LoanAccount).where(LoanAccount.id == lid))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail=f"Loan {loan_id} not found")

    # Check RLS via project access
    if not await RLSService.can_view_project(db, current_user, loan.project_id):
        raise HTTPException(status_code=404, detail=f"Loan {loan_id} not found")

    # Calculate if missing
    if not loan.dscr or not loan.metric_as_of_date:
        from backend.app.services.covenant_service import CovenantService
        await CovenantService.calculate_metrics(db, loan)
        await db.flush()

    # Prepare response with pass/fail flags
    metrics = CovenantMetricsResponse(
        loan_account_id=str(loan.id),
        dscr=loan.dscr,
        ltv=loan.ltv,
        icr=loan.icr,
        metric_as_of_date=loan.metric_as_of_date,
        dscr_pass=(loan.dscr or 0) >= 1.25,
        ltv_pass=(loan.ltv or 0) <= 70,
        icr_pass=(loan.icr or 0) >= 2.0,
    )

    return ApiResponse(
        data=metrics,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="read_covenant_metrics"),
    )


@router.post(
    "/exposure-sync",
    response_model=ApiResponse[LoanExposureSyncResult],
    status_code=status.HTTP_202_ACCEPTED,
)
async def sync_loan_exposure(
    request: LoanExposureSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[LoanExposureSyncResult]:
    """
    Ingest loan exposure data from CSV/JSON (Phase 8.2 - Option A).

    Accepts a JSON payload with loan accounts to create or update:
    - Validates referential integrity (project_id must exist)
    - Upserts loan_accounts records
    - Creates/updates rate history
    - Logs to compliance audit trail

    Request body:
    ```json
    {
      "sync_source": "CSV",
      "source_reference": "bank_exposure_2026-09-30.csv",
      "loan_accounts": [
        {
          "project_id": "uuid",
          "facility_type": "Construction Term Loan",
          "sanctioned_amount": 50000000,
          "outstanding_principal": 25000000,
          "interest_rate_pct": 11.5,
          "tenor_years": 15,
          "grace_years": 3,
          "sanction_date": "2023-01-15",
          "disbursement_date": "2023-02-01",
          "maturity_date": "2038-02-01"
        }
      ]
    }
    ```

    Response: 202 Accepted (async job started)
    Returns sync result with created/updated/skipped counts
    """

    user_id = current_user.username

    try:
        logger.info(f"📥 Loan exposure sync initiated by {user_id}: {request.sync_source} "
                    f"({request.source_reference}), {len(request.loan_accounts)} records")
        outcome = await ingest_loan_exposures(
            db, request.loan_accounts, request.sync_source, request.source_reference,
            actor=user_id, actor_role=current_user.roles[0].value if current_user.roles else None,
        )
        return ApiResponse(
            data=LoanExposureSyncResult(**outcome),
            meta=_get_response_meta(),
            audit=_get_audit_metadata(user_id=user_id, action="loan_exposure_sync"),
        )

    except Exception as e:
        logger.error(f"❌ Loan exposure sync failed: {e}")
        raise HTTPException(status_code=500, detail="Sync failed")


# ============================================================================
# SYNC SCHEDULE ENDPOINTS (Phase 8.3 Option B)
# ============================================================================


@router.post(
    "/sync-schedule",
    response_model=ApiResponse[LoanExposureSyncScheduleResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_sync_schedule(
    request: LoanExposureSyncScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[LoanExposureSyncScheduleResponse]:
    """
    Create a new automatic loan exposure sync schedule (Phase 8.3 Option B).

    Supports frequencies: daily, weekly, hourly, manual
    Sources: BANK_API, FINACLE_CBS, CSV_UPLOAD

    Example:
    ```json
    {
      "name": "Daily Bank Loan Export",
      "frequency": "daily",
      "scheduled_time_utc": "02:00",
      "sync_source": "BANK_API",
      "source_config": {
        "webhook_url": "https://bank.com/export/loans",
        "auth_method": "api_key"
      },
      "alert_on_dscr_below": 1.2,
      "alert_on_ltv_above": 75,
      "alert_email_addresses": "risk@bank.com,admin@bank.com"
    }
    ```
    """

    try:
        schedule = await LoanSyncSchedulerService.create_schedule(
            db, request, current_user.username
        )

        logger.info(f"✅ Created sync schedule: {schedule.id} ({schedule.name})")

        return ApiResponse(
            data=schedule,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(user_id=current_user.username, action="create_sync_schedule"),
        )

    except Exception as e:
        logger.error(f"❌ Failed to create schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create schedule: {str(e)}")


@router.get(
    "/sync-schedule",
    response_model=ApiResponse[list[LoanExposureSyncScheduleResponse]],
)
async def list_sync_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
    is_active: Optional[str] = Query(None, description="'Y' or 'N'"),
    sync_source: Optional[str] = Query(None),
) -> ApiResponse[list[LoanExposureSyncScheduleResponse]]:
    """List all sync schedules with optional filters."""

    try:
        schedules = await LoanSyncSchedulerService.list_schedules(
            db, is_active=is_active, sync_source=sync_source
        )

        return ApiResponse(
            data=schedules,
            meta=_get_response_meta(total_count=len(schedules)),
            audit=_get_audit_metadata(user_id=current_user.username, action="list_sync_schedules"),
        )

    except Exception as e:
        logger.error(f"❌ Failed to list schedules: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list schedules: {str(e)}")


@router.get(
    "/sync-schedule/{schedule_id}",
    response_model=ApiResponse[LoanExposureSyncScheduleResponse],
)
async def get_sync_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[LoanExposureSyncScheduleResponse]:
    """Get a specific sync schedule by ID."""

    try:
        schedule = await LoanSyncSchedulerService.get_schedule(db, schedule_id)

        if not schedule:
            raise HTTPException(status_code=404, detail=f"Schedule {schedule_id} not found")

        return ApiResponse(
            data=schedule,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(user_id=current_user.username, action="get_sync_schedule"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get schedule: {str(e)}")


@router.put(
    "/sync-schedule/{schedule_id}",
    response_model=ApiResponse[LoanExposureSyncScheduleResponse],
)
async def update_sync_schedule(
    schedule_id: str,
    request: LoanExposureSyncScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[LoanExposureSyncScheduleResponse]:
    """Update an existing sync schedule."""

    try:
        schedule = await LoanSyncSchedulerService.update_schedule(
            db, schedule_id, request, current_user.username
        )

        if not schedule:
            raise HTTPException(status_code=404, detail=f"Schedule {schedule_id} not found")

        return ApiResponse(
            data=schedule,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(user_id=current_user.username, action="update_sync_schedule"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to update schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {str(e)}")


@router.patch(
    "/sync-schedule/{schedule_id}/toggle",
    response_model=ApiResponse[LoanExposureSyncScheduleResponse],
)
async def toggle_sync_schedule(
    schedule_id: str,
    is_active: str = Query(..., description="'Y' to enable, 'N' to disable"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[LoanExposureSyncScheduleResponse]:
    """Enable or disable a sync schedule."""

    if is_active not in ("Y", "N"):
        raise HTTPException(status_code=400, detail="is_active must be 'Y' or 'N'")

    try:
        schedule = await LoanSyncSchedulerService.toggle_schedule(
            db, schedule_id, is_active, current_user.username
        )

        if not schedule:
            raise HTTPException(status_code=404, detail=f"Schedule {schedule_id} not found")

        return ApiResponse(
            data=schedule,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(user_id=current_user.username, action="toggle_sync_schedule"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to toggle schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle schedule: {str(e)}")


# Declared last on purpose: "/{account_id}" would otherwise swallow GET /sync-schedule (list), which
# has the same single-segment shape.

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
