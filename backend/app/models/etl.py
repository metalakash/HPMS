"""Phase 8.4 Enterprise ETL models."""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from .base import Base


class AirflowLoanDAGRun(Base):
    """Track Airflow DAG executions for loan sync."""
    __tablename__ = 'airflow_loan_dag_runs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dag_id = Column(String(255), nullable=False, index=True)
    run_id = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, index=True)  # running, success, failed, partial_success
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    total_extracted = Column(Integer, default=0)
    total_reconciled = Column(Integer, default=0)
    total_loaded = Column(Integer, default=0)
    reconciliation_conflicts = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    reconciliation_logs = relationship('LoanReconciliationLog', back_populates='dag_run')
    provenance_records = relationship('LoanDataProvenance', back_populates='dag_run')
    
    def __repr__(self):
        return f"<AirflowLoanDAGRun {self.dag_id}:{self.run_id} status={self.status}>"


class LoanReconciliationLog(Base):
    """Track reconciliation decisions when merging multi-source loan data."""
    __tablename__ = 'loan_reconciliation_log'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_account_id = Column(UUID(as_uuid=True), ForeignKey('loan_accounts.id'), nullable=False, index=True)
    dag_run_id = Column(UUID(as_uuid=True), ForeignKey('airflow_loan_dag_runs.id'), nullable=True, index=True)
    source_a = Column(String(50), nullable=False)  # BANK_A, BANK_B, FINACLE_CBS, CSV_UPLOAD
    source_b = Column(String(50), nullable=True)
    conflict_type = Column(String(100), nullable=True)  # DSCR_MISMATCH, LTV_MISMATCH, AMOUNT_MISMATCH, etc.
    resolution = Column(String(50), nullable=True)  # keep_source_a, keep_source_b, average, manual_review
    resolved_by = Column(String(100), nullable=True)  # SYSTEM_RULE, MANUAL_REVIEW, USER_NAME
    conflict_details = Column(JSONB, nullable=True)  # {source_a: {...}, source_b: {...}, difference: {...}}
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    loan = relationship('LoanAccount')
    dag_run = relationship('AirflowLoanDAGRun', back_populates='reconciliation_logs')
    
    __table_args__ = (
        Index('idx_reconciliation_log_loan_dag', 'loan_account_id', 'dag_run_id'),
    )
    
    def __repr__(self):
        return f"<LoanReconciliationLog {self.loan_account_id} {self.conflict_type}>"


class LoanDataProvenance(Base):
    """Track the source of each field in a loan account."""
    __tablename__ = 'loan_data_provenance'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_account_id = Column(UUID(as_uuid=True), ForeignKey('loan_accounts.id'), nullable=False, index=True)
    field_name = Column(String(100), nullable=False)  # principal_amount, interest_rate, dscr, etc.
    source = Column(String(50), nullable=False)  # BANK_A, BANK_B, FINACLE_CBS, CSV_UPLOAD
    last_updated_at = Column(DateTime, nullable=True)
    last_updated_by_dag_run_id = Column(UUID(as_uuid=True), ForeignKey('airflow_loan_dag_runs.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    loan = relationship('LoanAccount')
    dag_run = relationship('AirflowLoanDAGRun', back_populates='provenance_records')
    
    __table_args__ = (
        Index('idx_data_provenance_loan_field', 'loan_account_id', 'field_name'),
    )
    
    def __repr__(self):
        return f"<LoanDataProvenance {self.loan_account_id} {self.field_name}={self.source}>"