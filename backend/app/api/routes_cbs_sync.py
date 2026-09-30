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

    try:
        # TODO: Implement actual Finacle API call
        # For now, return mock diff log

        mock_response = {
            "sync_timestamp": datetime.utcnow().isoformat(),
            "status": "success",
            "changes_count": 1,
            "diff_log": [
                {
                    "field": "outstanding_principal",
                    "previous_value": 850000000,
                    "new_value": 842000000,
                    "status": "changed",
                },
                {
                    "field": "overdue_amount",
                    "previous_value": 0,
                    "new_value": 0,
                    "status": "same",
                },
            ],
        }

        return ApiResponse(
            data=mock_response,
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
