"""Document management models with versioning and audit trail.

Supports secure document storage with encryption, classification,
approval workflows, and full version history for compliance.
"""

from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, Enum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum
import uuid
from .base import Base, TimestampedMixin


class DocumentClassification(str, enum.Enum):
    """Document type classifications."""
    PROJECT_CHARTER = "project_charter"
    PPA = "ppa"  # Power Purchase Agreement
    ENVIRONMENTAL_CLEARANCE = "environmental_clearance"
    LAND_DEED = "land_deed"
    WATER_LICENSE = "water_license"
    BOARD_APPROVAL = "board_approval"
    TECHNICAL_REPORT = "technical_report"
    FINANCIAL_ANALYSIS = "financial_analysis"
    CONTRACT = "contract"
    INSURANCE = "insurance"
    OTHER = "other"


class DocumentStatus(str, enum.Enum):
    """Document lifecycle status."""
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"
    EXPIRED = "expired"


class Document(Base, TimestampedMixin):
    """Master document record with classification and lifecycle tracking."""
    
    __tablename__ = 'documents'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    # Document identity
    document_code = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Classification and lifecycle
    classification = Column(String(50), nullable=False, index=True)
    status = Column(String(50), nullable=False, default='draft', index=True)

    # Dates
    document_date = Column(Date)  # Date the document was created/issued
    expiry_date = Column(Date)  # Optional expiration (e.g., licenses)

    # Approval workflow
    requires_approval = Column(String(5), default='N')  # Y/N flag
    approved_by = Column(String(255))  # User who approved
    approval_date = Column(Date)
    approval_remarks = Column(Text)

    # Physical/storage metadata
    file_count = Column(Integer, default=0)  # Number of versions
    total_size_bytes = Column(Integer, default=0)  # Sum of all versions

    # Data provenance
    source_reference = Column(String(255))  # e.g., "Board Meeting 2026-09-15"

    # Relationships
    project = relationship("Project", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_project_classification', 'project_id', 'classification'),
        Index('ix_status_date', 'status', 'document_date'),
        CheckConstraint("expiry_date IS NULL OR expiry_date > document_date", name='ck_expiry_after_date'),
    )


class DocumentVersion(Base, TimestampedMixin):
    """Immutable version history of document files.

    Each upload creates a new version record. Previous versions are never deleted
    for compliance (7-year retention per AUDIT_RETENTION_YEARS).
    """

    __tablename__ = 'document_versions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id'), nullable=False, index=True)

    # Version tracking
    version_number = Column(Integer, nullable=False)  # 1, 2, 3, ...
    is_current = Column(String(5), default='Y', index=True)  # Y/N flag

    # File metadata
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=False, unique=True)  # SHA-256
    mime_type = Column(String(100))  # e.g., "application/pdf"

    # Storage reference (abstraction allows local/S3 swap in Phase 3)
    storage_path = Column(String(500), nullable=False)  # Path in storage backend
    storage_backend = Column(String(50), default='local')  # 'local', 's3', etc.

    # Content (encrypted if sensitive)
    # For small files (<1MB), content can be stored inline
    content_encrypted = Column(String(5), default='N')  # Y/N flag
    content_checksum = Column(String(64))  # SHA-256 of decrypted content for integrity

    # Versioning context
    upload_comment = Column(Text)  # Why this version was uploaded
    change_summary = Column(Text)  # What changed from previous version

    # Data provenance
    source_reference = Column(String(255))  # e.g., "Email from legal, 2026-09-20"

    # Relationships
    document = relationship("Document", back_populates="versions")

    __table_args__ = (
        Index('ix_document_current', 'document_id', 'is_current'),
        Index('ix_version_date', 'document_id', 'created_at'),
        CheckConstraint("version_number > 0", name='ck_version_positive'),
    )


class DocumentApprovalRequest(Base, TimestampedMixin):
    """Optional approval workflow for documents.

    Some documents require review/approval before entering system.
    This tracks the approval state independent of the document status.
    """

    __tablename__ = 'document_approval_requests'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey('documents.id'), nullable=False, index=True)
    document_version_id = Column(UUID(as_uuid=True), ForeignKey('document_versions.id'), nullable=False)

    # Approval chain
    requested_by = Column(String(255), nullable=False)
    request_date = Column(Date, nullable=False)

    approver_id = Column(String(255))  # Who will approve
    approver_role = Column(String(100))  # e.g., "legal", "compliance", "finance"
    approval_status = Column(String(50), default='pending')  # pending, approved, rejected

    approval_date = Column(Date)
    approval_remarks = Column(Text)

    # Retry tracking
    reminder_count = Column(Integer, default=0)
    last_reminder_date = Column(Date)

    __table_args__ = (
        Index('ix_approval_status', 'approval_status', 'approver_role'),
        Index('ix_approval_date', 'approval_date'),
    )
