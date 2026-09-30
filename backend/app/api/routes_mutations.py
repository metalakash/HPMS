"""FastAPI routes for maker-checker mutations with dual control.

Implements:
- POST /api/v1/mutations/submit-with-justification — Submit mutation for approval
- GET /api/v1/mutations/approval-queue — Get pending approvals for current user
- POST /api/v1/mutations/approve — Approve pending mutation
- POST /api/v1/mutations/reject — Reject pending mutation
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.schemas.common import ApiResponse, ResponseMeta, AuditMetadata
from backend.app.services.mutation_service import MutationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/mutations", tags=["mutations"])


# ========== Request/Response Models ==========

class SubmitMutationRequest(BaseModel):
    """Submit a mutation for approval."""
    entity_type: str = Field(..., description="Type of entity (PROJECT, LOAN, etc.)")
    entity_id: str = Field(..., description="ID of the entity being mutated")
    action: str = Field(..., description="Type of action (CREATE, UPDATE, DELETE, etc.)")
    changes: Dict[str, Any] = Field(..., description="Dictionary of changes being made")
    justification: str = Field(..., min_length=20, description="Mandatory justification (min 20 chars)")
    document_url: Optional[str] = None


class ApprovalActionRequest(BaseModel):
    """Approve or reject a pending mutation."""
    approval_request_id: str
    remarks: Optional[str] = None


class RejectionRequest(BaseModel):
    """Reject a mutation (mandatory remarks)."""
    approval_request_id: str
    remarks: str = Field(..., min_length=10, description="Mandatory rejection reason (min 10 chars)")


# ========== Helpers ==========

def _get_audit_metadata(user_id: str, action: str) -> AuditMetadata:
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
        page=None,
        page_size=None,
        total_count=None,
    )


# ========== Endpoints ==========

@router.post("/submit-with-justification", response_model=ApiResponse[Dict[str, Any]])
async def submit_mutation_with_justification(
    request: SubmitMutationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[Dict[str, Any]]:
    """Submit a mutation (state change) for approval.

    Creates:
    1. AuditLog entry with cryptographic chaining
    2. ApprovalRequest workflow instance
    3. ApprovalStep for tracking

    Requires:
    - justification: Mandatory reason for change (min 20 chars)
    - entity_type, entity_id: Identify what's being changed
    - action: Type of mutation (CREATE, UPDATE, DELETE)
    - changes: Dictionary of changes

    Returns:
    - approval_request_id: Track this in UI for polling approval status
    - current_state: Should be "submitted"
    - justification_hash: SHA-256 of the justification for audit
    """

    try:
        result = await MutationService.submit_mutation(
            db=db,
            current_user=current_user,
            entity_type=request.entity_type,
            entity_id=request.entity_id,
            action=request.action,
            changes=request.changes,
            justification=request.justification,
            document_url=request.document_url,
            source_ip="0.0.0.0",  # TODO: Extract from request.client
        )

        return ApiResponse(
            data=result,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(
                user_id=current_user.username,
                action="submit_mutation"
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to submit mutation: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit mutation")


@router.get("/approval-queue", response_model=ApiResponse[Dict[str, Any]])
async def get_approval_queue(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> ApiResponse[Dict[str, Any]]:
    """Get pending approvals for current user.

    Returns:
    - List of ApprovalRequests where current user is:
      - recommender: State is UNDER_RECOMMENDATION
      - approver: State is RECOMMENDED

    Used by:
    - Compliance officers to review pending license renewals
    - Finance team to review RCOD updates
    - Legal team to review contract amendments
    """

    try:
        result = await MutationService.get_approval_queue(
            db=db,
            current_user=current_user,
            entity_type=entity_type,
            status=status,
            skip=skip,
            limit=limit,
        )

        return ApiResponse(
            data=result,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(
                user_id=current_user.username,
                action="view_approval_queue"
            ),
        )
    except Exception as e:
        logger.error(f"Failed to get approval queue: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve approval queue")


@router.post("/approve", response_model=ApiResponse[Dict[str, Any]])
async def approve_mutation(
    request: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[Dict[str, Any]]:
    """Approve a pending mutation.

    Transitions ApprovalRequest state:
    - SUBMITTED → RECOMMENDED (if you're a recommender)
    - RECOMMENDED → APPROVED (if you're an approver)

    Args:
    - approval_request_id: ID of the approval to process
    - remarks: Optional remarks on approval

    Returns:
    - Updated approval state
    - Timestamp of approval
    - New state (RECOMMENDED or APPROVED)
    """

    try:
        result = await MutationService.approve_mutation(
            db=db,
            current_user=current_user,
            approval_request_id=request.approval_request_id,
            remarks=request.remarks,
            source_ip="0.0.0.0",
        )

        return ApiResponse(
            data=result,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(
                user_id=current_user.username,
                action="approve_mutation"
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to approve mutation: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve mutation")


@router.post("/reject", response_model=ApiResponse[Dict[str, Any]])
async def reject_mutation(
    request: RejectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[Dict[str, Any]]:
    """Reject a pending mutation.

    Transitions ApprovalRequest to REJECTED state.

    Requires:
    - approval_request_id: ID of approval to reject
    - remarks: MANDATORY reason for rejection (min 10 chars)

    Returns:
    - Rejected state
    - Timestamp of rejection
    - Rejection remarks (for audit)

    Notifications:
    - Sends email to original maker
    - Posts to approval notification feed
    """

    try:
        result = await MutationService.reject_mutation(
            db=db,
            current_user=current_user,
            approval_request_id=request.approval_request_id,
            remarks=request.remarks,
            source_ip="0.0.0.0",
        )

        # TODO: Send notification email to maker
        # TODO: Post to notification feed

        return ApiResponse(
            data=result,
            meta=_get_response_meta(),
            audit=_get_audit_metadata(
                user_id=current_user.username,
                action="reject_mutation"
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to reject mutation: {e}")
        raise HTTPException(status_code=500, detail="Failed to reject mutation")
