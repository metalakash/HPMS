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
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import false, func, select
from sqlalchemy.orm import selectinload

from backend.app.models.auth import User
from backend.app.models.governance import ApprovalRequest, ApprovalState, ApprovalStep, WorkflowDefinition
from backend.app.models.audit import AuditAction, AuditLog
from backend.app.security.auth_middleware import CurrentUser
from backend.app.security import field_policy
from backend.app.security.ldap_provider import UserRole
from backend.app.services import change_applier
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


DEFAULT_WORKFLOW_STEPS = json.dumps({"steps": ["submitted", "recommended", "approved"]})


async def _workflow_definition_id(db: AsyncSession, entity_type: str) -> UUID:
    """The active workflow for an entity type, created on first use as the standard two-check flow.

    Call it after append_audit_log, whose advisory lock keeps two first submissions from racing.
    """
    kind = entity_type.upper()
    found = (await db.execute(
        select(WorkflowDefinition.id)
        .where(WorkflowDefinition.entity_type == kind, WorkflowDefinition.is_active.is_(True))
        .order_by(WorkflowDefinition.version.desc()).limit(1))).scalar()
    if found:
        return found
    definition = WorkflowDefinition(
        id=uuid4(), name=f"default-{kind.lower()}", entity_type=kind, is_active=True, version=1,
        description="Maker submits, one checker recommends, a second checker approves",
        workflow_steps=DEFAULT_WORKFLOW_STEPS, created_by="system")
    db.add(definition)
    await db.flush()
    return definition.id


async def _open_request(db: AsyncSession, approval_request_id: str) -> ApprovalRequest:
    """Load a request with its steps (an async session cannot lazy-load them later)."""
    try:
        key = UUID(str(approval_request_id))
    except ValueError:
        raise LookupError(f"Approval request {approval_request_id} not found")
    approval = (await db.execute(
        select(ApprovalRequest).options(selectinload(ApprovalRequest.approval_steps))
        .where(ApprovalRequest.id == key))).scalar()
    if not approval:
        raise LookupError(f"Approval request {approval_request_id} not found")
    return approval


async def _apply_approved_changes(db: AsyncSession, approval: ApprovalRequest, approver: CurrentUser,
                                  source_ip: Optional[str], timestamp: str) -> bool:
    """On final approval, make the recorded change to the project or loan. False if nothing applies."""
    if not change_applier.is_applicable(approval.entity_type):
        return False
    submission = None
    if approval.submit_audit_log_id is not None:
        submission = (await db.execute(
            select(AuditLog).where(AuditLog.id == approval.submit_audit_log_id))).scalar_one_or_none()
    if submission is None:
        raise ValueError("The submission record for this request is no longer available; it cannot be applied")
    record = await change_applier.load(db, approval.entity_type, approval.entity_id)
    if record is None:
        raise LookupError(f"{approval.entity_type} {approval.entity_id} no longer exists")

    typed = change_applier.normalise(approval.entity_type, "UPDATE", json.loads(submission.post_state or "{}"))
    before, after = change_applier.apply(approval.entity_type, record, typed, updated_by=approver.username)
    await append_audit_log(
        db, user_id=approver.id, user_role=approver.roles[0].value if approver.roles else "guest",
        source_ip=source_ip, timestamp=timestamp, entity_type=approval.entity_type, entity_id=approval.entity_id,
        action=AuditAction.UPDATE.value, reason=f"Applied approved change request {approval.id}",
        pre_state=before, post_state=after)
    return True


def _can_decide(user: CurrentUser, approval: ApprovalRequest) -> bool:
    """Whether this user may approve or reject the request now (the same rules the actions enforce)."""
    if not _has_any_role(user, (UserRole.APPROVER, UserRole.ADMIN)):
        return False
    if approval.current_state not in (ApprovalState.SUBMITTED.value, ApprovalState.RECOMMENDED.value):
        return False
    actor = str(user.id)
    if actor == str(approval.maker_id):
        return False
    return not (approval.current_state == ApprovalState.RECOMMENDED.value and actor == str(approval.recommender_id))


async def _submissions(db: AsyncSession, approvals) -> Dict[int, AuditLog]:
    ids = [a.submit_audit_log_id for a in approvals if a.submit_audit_log_id is not None]
    if not ids:
        return {}
    rows = (await db.execute(select(AuditLog).where(AuditLog.id.in_(ids)))).scalars().all()
    return {row.id: row for row in rows}


async def _usernames(db: AsyncSession, user_ids) -> Dict[str, str]:
    keys = []
    for value in user_ids:
        try:
            keys.append(UUID(str(value)))
        except ValueError:
            continue
    if not keys:
        return {}
    rows = (await db.execute(select(User.id, User.username, User.full_name).where(User.id.in_(keys)))).all()
    return {str(uid): full_name or username for uid, username, full_name in rows}


async def _entity_labels(db: AsyncSession, approvals) -> Dict[tuple, str]:
    """Human-readable names for the projects and loans the requests point at."""
    from backend.app.models.financial import LoanAccount
    from backend.app.models.project import Project

    wanted: Dict[str, list] = {"PROJECT": [], "LOAN": []}
    for a in approvals:
        kind = a.entity_type.upper()
        if kind in wanted:
            try:
                wanted[kind].append(UUID(str(a.entity_id)))
            except ValueError:
                continue
    labels: Dict[tuple, str] = {}
    if wanted["PROJECT"]:
        rows = (await db.execute(
            select(Project.id, Project.project_code, Project.name_en).where(Project.id.in_(wanted["PROJECT"])))).all()
        labels.update({("PROJECT", str(pid)): f"{name} ({code})" for pid, code, name in rows})
    if wanted["LOAN"]:
        rows = (await db.execute(
            select(LoanAccount.id, LoanAccount.facility_type, Project.project_code, Project.name_en)
            .join(Project, Project.id == LoanAccount.project_id).where(LoanAccount.id.in_(wanted["LOAN"])))).all()
        labels.update({("LOAN", str(lid)): f"{(facility or 'loan').replace('_', ' ').capitalize()} for {name} ({code})"
                       for lid, facility, code, name in rows})
    return labels


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

        pre_state: Dict[str, Any] = {}
        if change_applier.is_applicable(entity_type):
            # Refuse now what could not be applied later, and record the values being replaced
            typed = change_applier.normalise(entity_type, action, changes)
            record = await change_applier.load(db, entity_type, entity_id)
            if record is None:
                raise LookupError(f"{entity_type} {entity_id} not found")
            change_applier.check_against(entity_type, record, typed)
            pre_state = {field: getattr(record, field) for field in typed}

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
            pre_state=pre_state,
            post_state=changes,
        )

        # Step 4: Create ApprovalRequest workflow
        approval_request = ApprovalRequest(
            id=uuid4(),
            workflow_definition_id=await _workflow_definition_id(db, entity_type),
            entity_type=entity_type,
            entity_id=entity_id,
            current_state=ApprovalState.SUBMITTED.value,
            maker_id=current_user.id,
            recommender_id=None,
            approver_id=None,
            submitted_at=timestamp,
            completed_at=None,
            submit_audit_log_id=audit_log.id,
        )
        db.add(approval_request)
        await db.flush()

        # Step 5: Create initial ApprovalStep
        approval_step = ApprovalStep(
            id=uuid4(),
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
        Change requests the current user may see, newest first, with what each one proposes.

        Checkers (approver, admin) and auditors see every request; makers see their own; others none.
        ``total`` counts every visible request matching the filters, not just this page.
        """

        query = select(ApprovalRequest)

        # Visibility by role: checkers and auditors see every request, makers only their own, others none
        roles = set(current_user.roles)
        if roles & {UserRole.ADMIN, UserRole.APPROVER, UserRole.AUDITOR}:
            pass
        elif UserRole.MAKER in roles:
            query = query.where(ApprovalRequest.maker_id == str(current_user.id))
        else:
            query = query.where(false())

        if entity_type:
            query = query.where(ApprovalRequest.entity_type == entity_type)
        if status:
            query = query.where(ApprovalRequest.current_state == status)

        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
        approvals = (await db.execute(
            query.order_by(ApprovalRequest.submitted_at.desc()).offset(skip).limit(limit))).scalars().all()

        submissions = await _submissions(db, approvals)
        makers = await _usernames(db, {a.maker_id for a in approvals})
        labels = await _entity_labels(db, approvals)

        items = []
        for a in approvals:
            submission = submissions.get(a.submit_audit_log_id)
            items.append({
                "id": str(a.id),
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "entity_label": labels.get((a.entity_type.upper(), a.entity_id)),
                "current_state": a.current_state,
                "maker_id": a.maker_id,
                "maker_name": makers.get(a.maker_id),
                "submitted_at": a.submitted_at,
                "completed_at": a.completed_at,
                "action": submission.action_performed if submission else None,
                "justification": submission.reason_for_action if submission else None,
                "changes": json.loads(submission.post_state or "{}") if submission else None,
                "previous_values": json.loads(submission.pre_state or "{}") if submission else None,
                "can_decide": _can_decide(current_user, a),
            })
        return {"total": total, "approvals": items}

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

        approval = await _open_request(db, approval_request_id)

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
            id=uuid4(),
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

        applied = False
        if new_state == ApprovalState.APPROVED:
            applied = await _apply_approved_changes(db, approval, current_user, source_ip, timestamp)

        await db.commit()

        return {
            "approval_request_id": str(approval.id),
            "previous_state": current_state.value,
            "new_state": new_state.value,
            "changes_applied": applied,
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

        approval = await _open_request(db, approval_request_id)
        if approval.current_state not in (ApprovalState.SUBMITTED.value, ApprovalState.RECOMMENDED.value):
            raise ValueError(f"Cannot reject from state: {approval.current_state}")

        # Update state
        timestamp = datetime.utcnow().isoformat()
        previous_state = approval.current_state
        approval.current_state = ApprovalState.REJECTED.value
        approval.completed_at = timestamp

        # Create rejection step
        approval_step = ApprovalStep(
            id=uuid4(),
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
