"""Immutable audit trail and compliance models."""
from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, BIGINT, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum
import uuid
from .base import Base

class AuditAction(str, enum.Enum):
    """Actions that can be audited."""
    CREATE = "create"
    UPDATE = "update"
    SUBMIT = "submit"
    RECOMMEND = "recommend"
    APPROVE = "approve"
    REJECT = "reject"
    SEND_BACK = "send_back"
    DISBURSE = "disburse"
    SYNC = "sync"
    EXPORT = "export"
    LOGIN = "login"
    LOGOUT = "logout"
    VIEW = "view"
    DELETE = "delete"

class AuditLog(Base):
    """Append-only, immutable audit log with cryptographic chaining."""
    
    id = Column(BIGINT, primary_key=True, autoincrement=True)  # Monotonic
    
    # Actor information
    user_id = Column(String(255), nullable=False, index=True)  # SBL employee ID from AD
    user_role = Column(String(100))
    source_ip = Column(String(50))
    session_id = Column(String(255))
    
    # Timestamp - server-side, non-negotiable
    timestamp = Column(String(100), nullable=False, index=True, server_default='now()')
    
    # Entity reference
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(255), nullable=False, index=True)
    
    # Action
    action_performed = Column(String(50), nullable=False, index=True)
    reason_for_action = Column(Text, nullable=False)  # MANDATORY
    
    # State tracking
    pre_state = Column(String(10000))  # JSONB as string, can be encrypted
    post_state = Column(String(10000))  # JSONB as string
    
    # Cryptographic chain
    state_hash = Column(String(64), nullable=False, unique=True)  # SHA-256
    prev_hash = Column(String(64))  # Chain link; genesis=64 zeros
    
    __table_args__ = (
        Index('ix_user_action_timestamp', 'user_id', 'action_performed', 'timestamp'),
        Index('ix_entity_action', 'entity_type', 'entity_id', 'action_performed'),
        CheckConstraint("LENGTH(state_hash) = 64", name='ck_state_hash_length'),
        CheckConstraint("LENGTH(prev_hash) = 64 OR prev_hash IS NULL", name='ck_prev_hash_length'),
    )

class AuditLogRead(Base):
    """Track read access to sensitive data."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False, index=True)
    timestamp = Column(String(100), nullable=False, index=True, server_default='now()')
    
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(255), nullable=False)
    export_format = Column(String(50))  # e.g., PDF, EXCEL, JSON
    record_count = Column(Integer)  # Number of rows accessed
    
    __table_args__ = (
        Index('ix_read_user_timestamp', 'user_id', 'timestamp'),
    )
