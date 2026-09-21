"""Financial Data Integration models."""
from sqlalchemy import Column, String, Numeric, Integer, Date, Text, ForeignKey, Enum, Index, UniqueConstraint, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import enum
import uuid
from .base import Base, TimestampedMixin

class SyncType(str, enum.Enum):
    """CBS synchronisation type."""
    REALTIME_INQUIRY = "realtime_inquiry"
    EOD_BATCH = "eod_batch"
    BOD_BATCH = "bod_batch"

class LoanAccount(Base, TimestampedMixin):
    """Finacle loan account linked to a project."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    # Encrypted field for sensitive data
    finacle_account_id = Column(String(500), unique=True, nullable=False)  # pgcrypto encrypted
    
    facility_type = Column(String(100))
    sanctioned_amount = Column(Numeric(20, 4), nullable=False)
    disbursed_amount = Column(Numeric(20, 4), default=0)
    outstanding_principal = Column(Numeric(20, 4), default=0)
    outstanding_interest = Column(Numeric(20, 4), default=0)
    overdue_principal = Column(Numeric(20, 4), default=0)
    overdue_interest = Column(Numeric(20, 4), default=0)
    
    currency_code = Column(String(3), default='NPR')
    fx_rate_to_npr = Column(Numeric(18, 8), default=1)
    fx_rate_asof_ad = Column(Date)
    
    interest_rate_pct = Column(Numeric(7, 4))
    moratorium_end_ad = Column(Date)
    moratorium_end_bs = Column(String(10))
    maturity_ad = Column(Date)
    maturity_bs = Column(String(10))
    
    last_synced_at = Column(String(100))
    sync_status = Column(String(50), default='pending', index=True)
    
    # Data provenance
    data_provenance = Column(String(50), default='MANUAL_ENTRY')
    source_reference = Column(String(255))
    
    project = relationship("Project", back_populates="loan_accounts")
    disbursement_tranches = relationship("DisbursementTranche", back_populates="loan_account")
    repayments = relationship("Repayment", back_populates="loan_account")
    
    __table_args__ = (
        Index('ix_sync_status_synced', 'sync_status', 'last_synced_at'),
    )

class DisbursementTranche(Base, TimestampedMixin):
    """Disbursement tranche schedule and tracking."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_account_id = Column(UUID(as_uuid=True), ForeignKey('loan_accounts.id'), nullable=False, index=True)
    
    tranche_no = Column(Integer)
    planned_amount = Column(Numeric(20, 4))
    actual_amount = Column(Numeric(20, 4))
    
    planned_date_ad = Column(Date)
    planned_date_bs = Column(String(10))
    actual_date_ad = Column(Date)
    actual_date_bs = Column(String(10))
    
    pro_rata_share_pct = Column(Numeric(9, 6))
    
    loan_account = relationship("LoanAccount", back_populates="disbursement_tranches")

class Repayment(Base, TimestampedMixin):
    """Repayment schedule and tracking."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_account_id = Column(UUID(as_uuid=True), ForeignKey('loan_accounts.id'), nullable=False, index=True)
    
    due_date_ad = Column(Date, index=True)
    due_date_bs = Column(String(10))
    principal_due = Column(Numeric(20, 4))
    interest_due = Column(Numeric(20, 4))
    
    principal_paid = Column(Numeric(20, 4), default=0)
    interest_paid = Column(Numeric(20, 4), default=0)
    paid_date_ad = Column(Date)
    paid_date_bs = Column(String(10))
    
    days_past_due = Column(Integer, default=0)
    
    loan_account = relationship("LoanAccount", back_populates="repayments")

class CBSSyncLog(Base, TimestampedMixin):
    """Finacle CBS synchronisation audit log."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_account_id = Column(UUID(as_uuid=True), ForeignKey('loan_accounts.id'), nullable=True, index=True)
    
    sync_type = Column(String(50), nullable=False)
    request_ref = Column(String(255))
    response_code = Column(String(50))
    
    started_at = Column(String(100))
    completed_at = Column(String(100))
    record_count = Column(Integer, default=0)
    
    # Encrypted raw payload (pgcrypto)
    raw_payload = Column(String(10000))  # pgcrypto encrypted JSONB
    
    error_detail = Column(Text)
    retry_count = Column(Integer, default=0)
    dlq_flag = Column(String(50), default='ok', index=True)

class BudgetLine(Base, TimestampedMixin):
    """Project budget and actual expense tracking."""
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    category = Column(String(100))
    budgeted_amount = Column(Numeric(20, 4))
    actual_amount = Column(Numeric(20, 4), default=0)
    
    # Derived columns
    variance_amount = Column(Numeric(20, 4))
    variance_pct = Column(Numeric(7, 4))
    
    upload_batch_id = Column(String(255))  # For bulk imports
    
    data_provenance = Column(String(50), default='MANUAL_ENTRY')
