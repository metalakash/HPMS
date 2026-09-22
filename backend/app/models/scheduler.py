"""Scheduler models for automated exports and jobs."""

from sqlalchemy import Column, String, Boolean, Date, DateTime, Text, Index, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum
import uuid
from .base import Base, TimestampedMixin


class JobStatus(str, enum.Enum):
    """Job execution status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class ExportJob(Base, TimestampedMixin):
    """Scheduled export job configuration.

    Defines when and how to export reports (daily, weekly, monthly).
    """

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Job configuration
    report_id = Column(String(100), nullable=False, index=True)  # portfolio, covenant, capex
    export_format = Column(String(50), nullable=False)  # csv, excel, json
    schedule = Column(String(100), nullable=False)  # Cron expression (0 6 * * * = daily 6am)
    name = Column(String(255), nullable=False)  # Human-readable name

    # Recipients
    recipients = Column(JSONB, nullable=False)  # ["email1@sbl.local", "email2@sbl.local"]
    subject_template = Column(String(255))  # Email subject template
    body_template = Column(Text)  # Email body template

    # Filters (optional)
    filters = Column(JSONB)  # {"province": "Gandaki", "status": "under_operation"}

    # Status
    is_enabled = Column(Boolean, default=True, index=True)
    last_run_at = Column(DateTime(timezone=True))
    next_run_at = Column(DateTime(timezone=True))

    # Retry configuration
    max_retries = Column(String(5), default="3")
    retry_backoff_seconds = Column(String(10), default="300")  # 5 minutes

    # Relationships
    job_runs = relationship("ExportJobRun", back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_job_report_schedule", "report_id", "is_enabled"),
        Index("ix_job_next_run", "next_run_at"),
    )


class ExportJobRun(Base, TimestampedMixin):
    """Historical record of export job execution.

    One record per run (successful, failed, or skipped).
    """

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("export_job.id"), nullable=False, index=True)

    # Execution details
    status = Column(String(50), nullable=False, index=True)  # pending, running, success, failed
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    duration_seconds = Column(String(10))

    # Output
    record_count = Column(String(10))  # Number of rows exported
    file_url = Column(String(1000))  # S3 presigned URL
    file_size_bytes = Column(String(20))

    # Error tracking
    error_message = Column(Text)  # Error details if failed
    retry_count = Column(String(5), default="0")
    next_retry_at = Column(DateTime(timezone=True))

    # Delivery
    emails_sent = Column(String(5), default="N")  # Y/N
    email_send_time = Column(DateTime(timezone=True))
    email_error = Column(Text)  # Error if email failed

    # Relationships
    job = relationship("ExportJob", back_populates="job_runs")

    __table_args__ = (
        Index("ix_run_status_date", "status", "created_at"),
        Index("ix_run_next_retry", "job_id", "next_retry_at"),
    )
