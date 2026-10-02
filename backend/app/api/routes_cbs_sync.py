"""FastAPI routes for CBS Finacle sync operations.

Implements:
- POST /api/v1/cbs/sync/:project_id — On-demand Finacle sync with diff log
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.schemas.common import ApiResponse, ResponseMeta, AuditMetadata

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/cbs", tags=["cbs"])


class CBSSyncRequest(BaseModel):
    """CBS sync request."""
    loan_id: str


class CBSDiffLog(BaseModel):
    """Field-level diff from CBS sync."""
    field: str
    previous_value: Any
    new_value: Any
    status: str  # 'changed' or 'same'


@router.get("/status", response_model=ApiResponse[Dict[str, Any]])
async def get_cbs_status(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[Dict[str, Any]]:
    """Get Finacle CBS adapter health status.

    Returns:
    - circuit_breaker: State (CLOSED/OPEN/HALF_OPEN), failure count
    - rate_limiter: Calls used, remaining, limit

    Requires admin or auditor role.
    """
    from backend.app.integration.finacle_adapter import get_adapter
    from backend.app.services.cbs_sync_real_service import CBSSyncService

    if not current_user.roles or current_user.roles[0].value not in ("admin", "auditor"):
        raise HTTPException(status_code=403, detail="Admin or auditor role required")

    try:
        adapter = get_adapter("mock")
        sync_service = CBSSyncService(adapter)
        status = sync_service.get_adapter_status()

        return ApiResponse(
            data=status,
            meta=ResponseMeta(
                timestamp=datetime.utcnow().isoformat(),
                version="0.1.0",
                page=None,
                page_size=None,
                total_count=None,
            ),
            audit=AuditMetadata(
                user_id=current_user.username,
                action="check_cbs_status",
                timestamp=datetime.utcnow().isoformat(),
            ),
        )
    except Exception as e:
        logger.error(f"Error checking CBS status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check CBS status")


@router.post("/sync/{project_id}", response_model=ApiResponse[Dict[str, Any]])
async def sync_cbs_account(
    project_id: str,
    request: CBSSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[Dict[str, Any]]:
    """Sync CBS Finacle account for a project/loan.

    Performs on-demand sync with Finacle API:
    1. Queries Finacle for current account status
    2. Compares with local cached values
    3. Returns diff log (before/after)
    4. Updates local database if changes detected
    5. Logs audit trail

    Args:
    - project_id: Project ID
    - loan_id: Finacle loan account ID

    Returns:
    - diff_log: List of field changes
    - sync_timestamp: When sync completed
    - status: 'success' or 'error'
    - changes_count: Number of fields that changed
    """
    if not any(r.value in ("admin", "maker", "approver") for r in current_user.roles):
        raise HTTPException(status_code=403, detail="Admin, maker or approver role required")

    from backend.app.api import routes_projects
    from backend.app.security.rls_service import RLSService

    # RLS: the caller must be able to see the project, and non-admins must be allowed to update it.
    project = await routes_projects._get_visible_project(db, current_user, project_id)
    if not await RLSService.can_update_project(db, current_user, project.id):
        raise HTTPException(status_code=403, detail="Not permitted to sync loans of this project")

    try:
        from backend.app.integration.finacle_adapter import get_adapter
        from backend.app.services.cbs_sync_real_service import CBSSyncService

        # Get adapter and service
        adapter = get_adapter("mock")  # Use mock by default; set via env for production
        sync_service = CBSSyncService(adapter)

        # Perform sync
        sync_result = await sync_service.sync_loan_account(
            db, project_id, request.loan_id, user_id=current_user.username
        )

        return ApiResponse(
            data=sync_result,
            meta=ResponseMeta(
                timestamp=datetime.utcnow().isoformat(),
                version="0.1.0",
                page=None,
                page_size=None,
                total_count=None,
            ),
            audit=AuditMetadata(
                user_id=current_user.username,
                action="cbs_sync",
                timestamp=datetime.utcnow().isoformat(),
            ),
        )
    except Exception as e:
        logger.error(f"CBS sync failed: {e}")
        raise HTTPException(status_code=500, detail="CBS sync failed")
