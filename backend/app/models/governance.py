"""Governance, RBAC and workflow models."""
from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, Boolean, UniqueConstraint, Index, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime, date
import enum
import uuid
from .base import Base, TimestampedMixin

class ApprovalState(str, enum.Enum):
    """Workflow approval state machine."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_RECOMMENDATION = "under_recommendation"
    RECOMMENDED = "recommended"
    APPROVED = "approved"
    DISBURSED = "disbursed"
    REJECTED = "rejected"
    SENT_BACK = "sent_back"

class Role(Base, TimestampedMixin):
    """User roles in the system."""
    
    __tablename__ = 'roles'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    
    permissions = relationship(
        "Permission",
        secondary="role_permissions",
        back_populates="roles"
    )

class Permission(Base, TimestampedMixin):
    """Granular permissions (field-level, entity-level)."""
    
    __tablename__ = 'permissions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    entity_type = Column(String(100), nullable=False)
    field_name = Column(String(255))  # Nullable for entity-level
    access_level = Column(String(50), nullable=False)  # NONE, READ, WRITE
    
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    
    roles = relationship(
        "Role",
        secondary="role_permissions",
        back_populates="permissions"
    )
    
    __table_args__ = (
        UniqueConstraint('entity_type', 'field_name', 'access_level', name='uq_permission'),
    )

# Association table for Role-Permission many-to-many
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id'), primary_key=True),
    Column('permission_id', UUID(as_uuid=True), ForeignKey('permissions.id'), primary_key=True),
)

class WorkflowDefinition(Base, TimestampedMixin):
    """Configurable workflow definition per use case."""
    
    __tablename__ = 'workflow_definitions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    name = Column(String(255), unique=True, nullable=False)
    entity_type = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    
    # Workflow graph as JSONB
    workflow_steps = Column(String(10000))  # JSONB: step definitions and routing
    
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)

class ApprovalRequest(Base, TimestampedMixin):
    """Approval workflow instance."""
    
    __tablename__ = 'approval_requests'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_definition_id = Column(UUID(as_uuid=True), ForeignKey('workflow_definitions.id'), nullable=False)
    
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(255), nullable=False)
    
    current_state = Column(String(50), nullable=False, default='draft', index=True)
    
    maker_id = Column(String(255), nullable=False)  # SBL employee ID
    recommender_id = Column(String(255))
    approver_id = Column(String(255))
    
    submitted_at = Column(String(100))
    completed_at = Column(String(100))
    
    approval_steps = relationship("ApprovalStep", back_populates="approval_request")
    
    __table_args__ = (
        Index('ix_entity_state', 'entity_type', 'entity_id', 'current_state'),
    )

class ApprovalStep(Base, TimestampedMixin):
    """Individual approval step in a workflow."""
    
    __tablename__ = 'approval_steps'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    approval_request_id = Column(UUID(as_uuid=True), ForeignKey('approval_requests.id'), nullable=False, index=True)
    
    step_no = Column(Integer)
    actor_id = Column(String(255), nullable=False)
    actor_role = Column(String(100))
    
    from_state = Column(String(50))
    to_state = Column(String(50), nullable=False)
    acted_at = Column(String(100))
    
    remarks = Column(Text)  # MANDATORY for REJECTED, SENT_BACK
    
    approval_request = relationship("ApprovalRequest", back_populates="approval_steps")
