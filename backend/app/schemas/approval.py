"""Approval workflow related schemas.

Schemas for managing approval requests and workflow state transitions.
"""

from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field


class ApprovalStepResponse(BaseModel):
    """Single step in approval workflow."""

    step_no: int = Field(description="Step sequence (1, 2, 3...)")
    actor_id: str = Field(description="User who acted")
    actor_role: str = Field(description="Role (maker, recommender, approver)")
    from_state: str = Field(description="State before this step")
    to_state: str = Field(description="State after this step")
    acted_at: Optional[str] = Field(None, description="ISO timestamp when acted")
    remarks: Optional[str] = Field(None, description="Why (mandatory for reject/send_back)")

    class Config:
        strict = True


class ApprovalRequestDetailResponse(BaseModel):
    """Detailed approval request with full workflow history."""

    id: str = Field(description="ApprovalRequest UUID")
    entity_type: str = Field(description="Entity being approved (projects, loan_accounts)")
    entity_id: str = Field(description="ID of entity (project_id, loan_account_id)")

    current_state: str = Field(description="draft, submitted, under_recommendation, recommended, approved, disbursed, rejected, sent_back")

    # Workflow actors
    maker_id: Optional[str] = Field(None, description="Who created/submitted")
    recommender_id: Optional[str] = Field(None, description="Who recommended")
    approver_id: Optional[str] = Field(None, description="Who approved")

    # Timestamps
    submitted_at: Optional[str] = Field(None, description="When submitted for approval")
    completed_at: Optional[str] = Field(None, description="When workflow ended (approved/rejected/disbanded)")

    # Workflow history
    steps: List[ApprovalStepResponse] = Field(description="All workflow steps in order")

    created_at: str
    created_by: str

    class Config:
        strict = True


class ApprovalRequestListResponse(BaseModel):
    """Approval request summary for queue views."""

    id: str
    entity_type: str
    entity_id: str
    entity_code: Optional[str] = Field(None, description="Human-readable entity code (project_code, etc.)")

    current_state: str
    submitted_at: Optional[str]

    approver_id: Optional[str] = Field(None, description="Next approver")
    approver_role: str = Field(description="Role awaiting action")

    class Config:
        strict = True


class ApprovalSubmitRequest(BaseModel):
    """Submit entity for approval."""

    entity_type: str = Field(description="projects, loan_accounts, documents")
    entity_id: str = Field(description="UUID of entity to approve")
    reason: str = Field(min_length=1, description="Reason for submission (mandatory)")

    class Config:
        strict = True


class ApprovalActionRequest(BaseModel):
    """Approve, recommend, reject, or send back."""

    action: str = Field(description="approve, recommend, reject, send_back")
    remarks: str = Field(description="Mandatory for approve/recommend/reject/send_back")

    class Config:
        strict = True


class ApprovalQueueResponse(BaseModel):
    """Queue of approvals awaiting action by role."""

    role: str = Field(description="Current user's role")
    pending_count: int = Field(description="Number awaiting this role's action")
    items: List[ApprovalRequestListResponse] = Field(description="Approval requests awaiting this role")

    class Config:
        strict = True
