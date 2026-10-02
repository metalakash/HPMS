"""
Mutation Service: Orchestrates maker-checker mutations with cryptographic audit trail.

Handles:
- Mutation submission with justification
- Cryptographic state hashing
- AuditLog chaining
- ApprovalRequest workflow creation
- State transitions (submit → recommend → approve → disburse)
"""

import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import false, select

from backend.app.models.governance import ApprovalRequest, ApprovalState, ApprovalStep
from backend.app.models.audit import AuditAction
from backend.app.security.auth_middleware import CurrentUser
from backend.app.security import field_policy
from backend.app.security.ldap_provider import UserRole
from backend.app.services.audit_chain import append_audit_log
from backend.app.schemas.common import AuditMetadata


def _has_any_role(user: CurrentUser, roles) -> bool:
    return any(r in user.roles for r in roles)


async def _authorize_target(db: AsyncSession, user: CurrentUser, entity_type: str, entity_id: str) -> None:
    """Row-level security for the entity a change request targets (PROJECT and LOAN; other types pass).

    Raises LookupError when the caller cannot see it (reported as not found) and PermissionError when
    they can see it but may not modify it.
    """
    from uuid import UUID
    from backend.app.models.financial import LoanAccount
    from backend.app.security.rls_service import RLSService

    kind = entity_type.upper()
    if kind not in ("PROJECT", "LOAN"):
        return
    try:
        target = UUID(str(entity_id))
    except ValueError:
        raise LookupError(f"{entity_type} {entity_id} not found")

    project_id = target
    if kind == "LOAN":
        project_id = (await db.execute(
            select(LoanAccount.project_id).where(LoanAccount.id == target))).scalar()
        if project_id is None:
            raise LookupError(f"{entity_type} {entity_id} not found")
    if not await RLSService.can_view_project(db, user, project_id):
        raise LookupError(f"{entity_type} {entity_id} not found")
    if not await RLSService.can_update_project(db, user, project_id):
        raise PermissionError("Not permitted to change this project")


class MutationService:
    """Service for handling mutations with maker-checker dual control."""

    @staticmethod
    def _compute_state_hash(entity_type: str, entity_id: str, state_diff: Dict, timestamp: str) -> str:
        """
        Compute SHA-256 hash for state transition.

        Args:
            entity_type: Type of entity being mutated (PROJECT, LOAN, etc.)
            entity_id: ID of the entity
            state_diff: Dictionary of changes being made
            timestamp: ISO timestamp of the action

        Returns:
            SHA-256 hash of the state transition
        """
        combined = json.dumps({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "state_diff": state_diff,
            "timestamp": timestamp,
        }, sort_keys=True)

        return hashlib.sha256(combined.encode()).hexdigest()

    @staticmethod
    async def submit_mutation(
        db: AsyncSession,
        current_user: CurrentUser,
        entity_type: str,
        entity_id: str,
        action: str,
        changes: Dict[str, Any],
        justification: str,
        document_url: Optional[str] = None,
        source_ip: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submit a mutation for approval.

        Creates:
        1. AuditLog entry (immutable, cryptographically chained)
        2. ApprovalRequest (workflow instance)
        3. ApprovalStep (initial submit step)

        Args:
            db: Database session
            current_user: Current authenticated user
            entity_type: Type of entity (PROJECT, LOAN, RCOD_UPDATE, etc.)
            entity_id: ID of the entity being mutated
            action: Type of action (CREATE, UPDATE, DELETE, etc.)
            changes: Dictionary of changes being made
            justification: Mandatory reason for the change
            document_url: Optional supporting document URL
            source_ip: IP address of request origin
            session_id: Session ID for audit tracking

        Returns:
            Dictionary with approval_request_id, current_state, and audit info

        Raises:
            ValueError: If justification is too short or required fields missing
            HTTPException: Database errors
        """

        # Validate justification
        if not justification or len(justification.strip()) < 20:
            raise ValueError("Justification must be at least 20 characters")

        if not entity_type or not entity_id:
            raise ValueError("entity_type and entity_id are required")

        if not _has_any_role(current_user, (UserRole.MAKER, UserRole.ADMIN)):
            raise PermissionError("Only makers and admins can submit changes")
        field_policy.check_write(entity_type, changes, current_user.roles)
        await _authorize_target(db, current_user, entity_type, entity_id)

        timestamp = datetime.utcnow().isoformat()

        # Steps 1-3: append to the hash-chained, append-only audit log
        audit_log = await append_audit_log(
            db,
            user_id=current_user.id,
            user_role=current_user.roles[0].value if current_user.roles else "guest",
            source_ip=source_ip,
            session_id=session_id,
            timestamp=timestamp,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            reason=justification,
            pre_state={},  # TODO: Fetch actual pre_state from entity
            post_state=changes,
        )

        # Step 4: Create ApprovalRequest workflow
        approval_request = ApprovalRequest(
            id=str(uuid4()),
            workflow_definition_id=str(uuid4()),  # TODO: Get from workflow config
            entity_type=entity_type,
            entity_id=entity_id,
            current_state=ApprovalState.SUBMITTED.value,
            maker_id=current_user.id,
            recommender_id=None,
            approver_id=None,
            submitted_at=timestamp,
            completed_at=None,
        )
        db.add(approval_request)
        await db.flush()

        # Step 5: Create initial ApprovalStep
        approval_step = ApprovalStep(
            id=str(uuid4()),
            approval_request_id=approval_request.id,
            step_no=1,
            actor_id=current_user.id,
            actor_role=current_user.roles[0].value if current_user.roles else "guest",
            from_state="draft",
            to_state=ApprovalState.SUBMITTED.value,
            acted_at=timestamp,
            remarks=None,
        )
        db.add(approval_step)

        # Commit all changes
        await db.commit()

        return {
            "approval_request_id": str(approval_request.id),
            "audit_log_id": audit_log.id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "current_state": ApprovalState.SUBMITTED.value,
            "created_at": timestamp,
            "justification_hash": audit_log.state_hash,
            "document_url": document_url,
        }

    @staticmethod
    async def get_approval_queue(
        db: AsyncSession,
        current_user: CurrentUser,
        entity_type: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Get list of pending approvals for current user.

        Returns ApprovalRequests where:
        - recommender_id = current_user (for UNDER_RECOMMENDATION state)
        - approver_id = current_user (for APPROVED state)

        Args:
            db: Database session
            current_user: Current user
            entity_type: Filter by entity type
            status: Filter by approval state
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            List of pending approvals with context
        """

        # Build query
        query = select(ApprovalRequest)

        # Visibility by role: checkers and auditors see every request, makers only their own, others none
        roles = set(current_user.roles)
        if roles & {UserRole.ADMIN, UserRole.APPROVER, UserRole.AUDITOR}:
            pass
        elif UserRole.MAKER in roles:
            query = query.where(ApprovalRequest.maker_id == str(current_user.id))
        else:
            query = query.where(false())

        # Apply filters
        if entity_type:
            query = query.where(ApprovalRequest.entity_type == entity_type)
        if status:
            query = query.where(ApprovalRequest.current_state == status)

        # Pagination
        query = query.offset(skip).limit(limit).order_by(ApprovalRequest.submitted_at.desc())

        # Execute
        result = await db.execute(query)
        approvals = result.scalars().all()

        return {
            "total": len(approvals),
            "approvals": [
                {
                    "id": str(a.id),
                    "entity_type": a.entity_type,
                    "entity_id": a.entity_id,
                    "current_state": a.current_state,
                    "maker_id": a.maker_id,
                    "submitted_at": a.submitted_at,
                }
                for a in approvals
            ],
        }

    @staticmethod
    async def approve_mutation(
        db: AsyncSession,
        current_user: CurrentUser,
        approval_request_id: str,
        remarks: Optional[str] = None,
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Approve a pending mutation.

        Transitions ApprovalRequest state and creates audit log entry.

        Args:
            db: Database session
            current_user: Current user (must have approver role)
            approval_request_id: ID of the approval request to approve
            remarks: Optional remarks on approval
            source_ip: IP address of request origin

        Returns:
            Updated approval request info
        """

        if not _has_any_role(current_user, (UserRole.APPROVER, UserRole.ADMIN)):
            raise PermissionError("Only approvers and admins can approve changes")

        # Fetch approval request
        query = select(ApprovalRequest).where(ApprovalRequest.id == approval_request_id)
        result = await db.execute(query)
        approval = result.scalar()

        if not approval:
            raise ValueError(f"Approval request {approval_request_id} not found")

        # Validate state transitions
        current_state = ApprovalState(approval.current_state)

        if current_state == ApprovalState.SUBMITTED:
            new_state = ApprovalState.RECOMMENDED
        elif current_state == ApprovalState.RECOMMENDED:
            new_state = ApprovalState.APPROVED
        else:
            raise ValueError(f"Cannot approve from state: {current_state}")

        # Dual control: nobody checks their own work, and the two checks come from different people
        actor = str(current_user.id)
        if actor == str(approval.maker_id):
            raise PermissionError("A change cannot be approved by the person who submitted it")
        if new_state == ApprovalState.APPROVED and actor == str(approval.recommender_id):
            raise PermissionError("The final approval must come from a different person than the recommender")

        # Update approval request
        timestamp = datetime.utcnow().isoformat()
        approval.current_state = new_state.value
        if new_state == ApprovalState.RECOMMENDED:
            approval.recommender_id = actor
        else:
            approval.approver_id = actor
            approval.completed_at = timestamp

        # Create approval step
        approval_step = ApprovalStep(
            id=str(uuid4()),
            approval_request_id=approval.id,
            step_no=len(approval.approval_steps) + 1,
            actor_id=current_user.id,
            actor_role=current_user.roles[0].value if current_user.roles else "guest",
            from_state=current_state.value,
            to_state=new_state.value,
            acted_at=timestamp,
            remarks=remarks,
        )
        db.add(approval_step)

        await append_audit_log(
            db,
            user_id=current_user.id,
            user_role=current_user.roles[0].value if current_user.roles else "guest",
            source_ip=source_ip,
            timestamp=timestamp,
            entity_type="APPROVAL_REQUEST",
            entity_id=approval.id,
            action=AuditAction.APPROVE.value,
            reason=remarks or f"Approved transition from {current_state} to {new_state}",
            pre_state={"state": current_state.value},
            post_state={"state": new_state.value},
        )

        await db.commit()

        return {
            "approval_request_id": str(approval.id),
            "previous_state": current_state.value,
            "new_state": new_state.value,
            "approved_by": current_user.id,
            "approved_at": timestamp,
        }

    @staticmethod
    async def reject_mutation(
        db: AsyncSession,
        current_user: CurrentUser,
        approval_request_id: str,
        remarks: str,  # MANDATORY for rejection
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Reject a pending mutation.

        Transitions ApprovalRequest to REJECTED state.

        Args:
            db: Database session
            current_user: Current user
            approval_request_id: ID of approval to reject
            remarks: MANDATORY remarks explaining rejection reason
            source_ip: IP address of request origin

        Returns:
            Updated approval request info
        """

        if not _has_any_role(current_user, (UserRole.APPROVER, UserRole.ADMIN)):
            raise PermissionError("Only approvers and admins can reject changes")
        if not remarks or len(remarks.strip()) < 10:
            raise ValueError("Rejection remarks are mandatory (min 10 characters)")

        # Fetch approval request
        query = select(ApprovalRequest).where(ApprovalRequest.id == approval_request_id)
        result = await db.execute(query)
        approval = result.scalar()

        if not approval:
            raise ValueError(f"Approval request {approval_request_id} not found")
        if approval.current_state not in (ApprovalState.SUBMITTED.value, ApprovalState.RECOMMENDED.value):
            raise ValueError(f"Cannot reject from state: {approval.current_state}")

        # Update state
        timestamp = datetime.utcnow().isoformat()
        previous_state = approval.current_state
        approval.current_state = ApprovalState.REJECTED.value
        approval.completed_at = timestamp

        # Create rejection step
        approval_step = ApprovalStep(
            id=str(uuid4()),
            approval_request_id=approval.id,
            step_no=len(approval.approval_steps) + 1,
            actor_id=current_user.id,
            actor_role=current_user.roles[0].value if current_user.roles else "guest",
            from_state=previous_state,
            to_state=ApprovalState.REJECTED.value,
            acted_at=timestamp,
            remarks=remarks,
        )
        db.add(approval_step)

        await append_audit_log(
            db,
            user_id=current_user.id,
            user_role=current_user.roles[0].value if current_user.roles else "guest",
            source_ip=source_ip,
            timestamp=timestamp,
            entity_type="APPROVAL_REQUEST",
            entity_id=approval.id,
            action=AuditAction.REJECT.value,
            reason=remarks,
            pre_state={"state": previous_state},
            post_state={"state": ApprovalState.REJECTED.value},
        )

        await db.commit()

        return {
            "approval_request_id": str(approval.id),
            "state": ApprovalState.REJECTED.value,
            "rejected_by": current_user.id,
            "rejected_at": timestamp,
            "remarks": remarks,
        }
