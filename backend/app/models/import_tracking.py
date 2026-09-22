"""Import batch tracking models for audit trail and error reporting.

Tracks all bulk imports with line-by-line error logs for compliance.
"""

from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum
import uuid
from .base import Base, TimestampedMixin


class ImportStatus(str, enum.Enum):
    """Import batch lifecycle status."""
    PENDING = "pending"  # Uploaded, validation running
    VALIDATED = "validated"  # Passed validation, ready to import
    IN_PROGRESS = "in_progress"  # Importing data
    COMPLETED = "completed"  # All rows processed
    FAILED = "failed"  # Batch-level failure (transaction rolled back)
    PARTIAL = "partial"  # Some rows succeeded, some failed


class ImportBatch(Base, TimestampedMixin):
    """Master record for bulk import operation.

    Tracks a single CSV/Excel upload with all its rows and errors.
    """

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Upload metadata
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer)
    mime_type = Column(String(100))

    # Import configuration
    import_type = Column(String(50), nullable=False, index=True)  # projects, loans, budget, consortium
    status = Column(String(50), nullable=False, default='pending', index=True)

    # Statistics
    total_rows = Column(Integer, default=0)
    successful_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)

    # Error summary (first 1000 chars)
    error_summary = Column(Text)

    # User audit
    uploaded_by = Column(String(255), nullable=False)
    upload_timestamp = Column(Date, nullable=False)

    # Processing
    started_at = Column(Date)
    completed_at = Column(Date)
    processing_duration_seconds = Column(Integer)  # How long import took

    # Relationships
    row_errors = relationship("ImportRowError", back_populates="batch", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_import_type_status', 'import_type', 'status'),
        Index('ix_import_date', 'upload_timestamp'),
    )


class ImportRowError(Base, TimestampedMixin):
    """Line-by-line error log for import batch.

    One record per validation error or processing failure.
    Enables detailed error reporting and retry logic.
    """

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey('import_batches.id'), nullable=False, index=True)

    # Row identification
    row_number = Column(Integer, nullable=False)  # 1-indexed

    # Error details
    error_type = Column(String(50))  # validation, constraint, duplicate, not_found, etc.
    column_name = Column(String(255))  # Which column (if applicable)
    error_message = Column(String(500), nullable=False)

    # Row data (for debugging and retry)
    row_data_json = Column(String(5000))  # JSONB snapshot of row

    # Recovery (Phase 3+)
    is_retryable = Column(String(5), default='Y')  # Y/N flag for retry logic
    retry_count = Column(Integer, default=0)

    # Relationships
    batch = relationship("ImportBatch", back_populates="row_errors")

    __table_args__ = (
        Index('ix_error_row', 'batch_id', 'row_number'),
    )
