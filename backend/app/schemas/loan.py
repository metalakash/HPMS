"""Loan account related request/response schemas.

Schemas for loan account queries, rate history, and financial data.
"""

from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class RateHistoryEntry(BaseModel):
    """Interest rate history entry with effective dating."""

    interest_rate_pct: Decimal = Field(description="Interest rate percentage")
    valid_from_ad: date = Field(description="Effective date (AD)")
    valid_from_bs: Optional[str] = Field(None, description="Effective date (BS)")
    valid_to_ad: Optional[date] = Field(None, description="End date if superseded")
    valid_to_bs: Optional[str] = Field(None)
    is_current: str = Field(description="Y/N flag for current rate")
    reason_for_change: Optional[str] = Field(None, description="Why rate changed")
    source: str = Field(description="Data provenance (CBS_SYNCED, MANUAL_ENTRY)")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanAccountDetailResponse(BaseModel):
    """Detailed loan account with rate history and linked project."""

    id: str = Field(description="Account UUID")
    project_id: str = Field(description="Linked project UUID")
    project_code: str = Field(description="Linked project code (for context)")

    # Account identity (sensitive fields masked in logs)
    finacle_account_id: str = Field(description="CBS account ID (encrypted in DB)")
    facility_type: Optional[str]

    # Financial snapshot
    sanctioned_amount: Decimal = Field(description="Loan limit")
    currency_code: str = Field(default="NPR")

    disbursed_amount: Decimal = Field(description="Amount drawn")
    outstanding_principal: Decimal
    outstanding_interest: Decimal
    overdue_principal: Decimal = Field(default=0)
    overdue_interest: Decimal = Field(default=0)

    # Current rate
    interest_rate_pct: Optional[Decimal] = Field(description="Current rate; null if not yet known")
    rate_as_of_date: Optional[date] = Field(None, description="When rate last changed")

    # Dates
    moratorium_end_ad: Optional[date]
    moratorium_end_bs: Optional[str]
    maturity_ad: Optional[date]
    maturity_bs: Optional[str]

    # CBS sync status
    last_synced_at: Optional[str] = Field(None, description="ISO timestamp of last CBS sync")
    sync_status: str = Field(description="pending, success, failed")
    data_provenance: str = Field(description="CBS_SYNCED, MANUAL_ENTRY, CALCULATED")

    # Rate history (nested)
    rate_history: List[RateHistoryEntry] = Field(description="All rate versions (newest first)")

    created_at: str
    updated_at: str

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanAccountListResponse(BaseModel):
    """Loan account summary for list views."""

    id: str
    project_code: str
    finacle_account_id: str = Field(description="Masked in logs")

    facility_type: Optional[str]
    sanctioned_amount: Decimal
    disbursed_amount: Decimal
    outstanding_principal: Decimal

    current_rate_pct: Optional[Decimal]  # nullable in DB until CBS provides a rate
    maturity_ad: Optional[date]

    sync_status: str
    last_synced_at: Optional[str]

    created_at: str

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanAccountListRequest(BaseModel):
    """Query parameters for listing loan accounts."""

    project_id: Optional[str] = Field(None, description="Filter by project UUID")
    status: Optional[str] = Field(None, description="Filter by sync_status")
    facility_type: Optional[str] = Field(None)

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    class Config:
        strict = True


class RateSyncResponse(BaseModel):
    """Response from CBS rate synchronization."""

    sync_log_id: str = Field(description="CBSSyncLog UUID")
    accounts_synced: int
    rate_changes: int
    errors: List[str]
    status: str = Field(description="ok or dlq (dead-letter queue)")
    message: str

    class Config:
        strict = True


class DisbursementTrancheItem(BaseModel):
    """A single disbursement tranche, scoped to its loan account."""

    id: str
    loan_account_id: str
    facility_type: Optional[str]
    tranche_no: Optional[int]
    planned_amount: Optional[Decimal]
    actual_amount: Optional[Decimal]
    planned_date_ad: Optional[date]
    actual_date_ad: Optional[date]

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class RepaymentItem(BaseModel):
    """A single repayment installment, scoped to its loan account."""

    id: str
    loan_account_id: str
    facility_type: Optional[str]
    due_date_ad: Optional[date]
    principal_due: Decimal
    interest_due: Decimal
    principal_paid: Decimal
    interest_paid: Decimal
    paid_date_ad: Optional[date]
    days_past_due: int
    status: str = Field(description="paid, overdue, or upcoming")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class ProjectDisbursementsResponse(BaseModel):
    """Disbursement tranches and repayments across all of a project's loan accounts."""

    tranches: List[DisbursementTrancheItem]
    repayments: List[RepaymentItem]

    class Config:
        strict = True


class CovenantMetricsResponse(BaseModel):
    """Covenant metrics for a loan account."""

    loan_account_id: str = Field(description="Loan account UUID")
    dscr: Optional[Decimal] = Field(None, description="Debt Service Coverage Ratio")
    ltv: Optional[Decimal] = Field(None, description="Loan-to-Value ratio (%)")
    icr: Optional[Decimal] = Field(None, description="Interest Coverage Ratio")
    metric_as_of_date: Optional[date] = Field(None, description="Date metrics were calculated")

    # Status indicators
    dscr_pass: bool = Field(description="DSCR >= 1.25 threshold")
    ltv_pass: bool = Field(description="LTV <= 70% threshold")
    icr_pass: bool = Field(description="ICR >= 2.0 threshold")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanExposureImportItem(BaseModel):
    """Single loan exposure record for CSV/JSON import (Option A)."""

    project_id: str = Field(description="Project UUID (must exist in projects table)")
    facility_type: str = Field(description="e.g., 'Construction Term Loan', 'Working Capital'")
    sanctioned_amount: Decimal = Field(description="Total credit limit (NPR)")
    disbursed_amount: Optional[Decimal] = Field(None, description="Amount drawn")
    outstanding_principal: Decimal = Field(description="Current outstanding balance")
    outstanding_interest: Optional[Decimal] = Field(None, description="Accrued interest")
    interest_rate_pct: Decimal = Field(description="Annual interest rate (%)")
    tenor_years: int = Field(description="Total loan tenor (years)")
    grace_years: int = Field(description="Grace period (years, no principal repayment)")
    sanction_date: date = Field(description="Sanction date (YYYY-MM-DD)")
    disbursement_date: date = Field(description="First disbursement date")
    maturity_date: date = Field(description="Final maturity date")
    risk_rating: Optional[str] = Field(None, description="e.g., 'AAA', 'AA', 'A', 'BBB'")
    ifrs9_stage: Optional[str] = Field(None, description="'Stage 1' (performing), 'Stage 2' (watch), 'Stage 3' (NPL)")
    dscr: Optional[Decimal] = Field(None, description="Debt Service Coverage Ratio")
    ltv: Optional[Decimal] = Field(None, description="Loan-to-Value ratio (%)")
    icr: Optional[Decimal] = Field(None, description="Interest Coverage Ratio")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanExposureSyncRequest(BaseModel):
    """Request payload for loan exposure sync (CSV or JSON)."""

    loan_accounts: List[LoanExposureImportItem] = Field(description="Loan accounts to import")
    sync_source: str = Field(default="MANUAL_UPLOAD", description="Source: MANUAL_UPLOAD, CSV, API, etc.")
    source_reference: Optional[str] = Field(None, description="e.g., filename, bank ID, partner name")

    class Config:
        strict = True


class LoanExposureSyncResult(BaseModel):
    """Result of loan exposure sync operation."""

    sync_id: str = Field(description="Unique sync operation ID (UUID)")
    total_records: int = Field(description="Total records submitted")
    created_count: int = Field(description="New loan accounts created")
    updated_count: int = Field(description="Existing accounts updated")
    skipped_count: int = Field(description="Records skipped due to errors")
    errors: List[str] = Field(description="Validation/insert errors")
    warnings: List[str] = Field(description="Non-fatal warnings")
    audit_log_id: str = Field(description="Compliance audit log entry ID")
    timestamp: str = Field(description="Sync completion timestamp")

    class Config:
        strict = True


class LoanExposureSyncScheduleRequest(BaseModel):
    """Request to create/update a sync schedule (Phase 8.3 Option B)."""

    name: str = Field(description="Schedule name (e.g., 'Daily Bank Export')")
    description: Optional[str] = Field(None, description="Long description")

    # Frequency
    frequency: str = Field(description="'daily', 'weekly', 'hourly', 'manual'")
    scheduled_time_utc: Optional[str] = Field(None, description="Time in HH:MM UTC (for daily/weekly)")
    day_of_week: Optional[int] = Field(None, description="0=Mon, 6=Sun (for weekly only)")

    # Source
    sync_source: str = Field(description="'BANK_API', 'FINACLE_CBS', 'CSV_UPLOAD'")
    source_config: Optional[dict] = Field(None, description="JSON config (webhook URL, API endpoint, etc.)")

    # Alerting thresholds
    alert_on_dscr_below: Optional[Decimal] = Field(None, description="Alert if DSCR < this value")
    alert_on_ltv_above: Optional[Decimal] = Field(None, description="Alert if LTV > this value (%)")
    alert_on_concentration_above: Optional[Decimal] = Field(None, description="Alert if concentration > this value (%)")
    alert_email_addresses: Optional[str] = Field(None, description="Comma-separated email list")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanExposureSyncScheduleResponse(BaseModel):
    """Response containing sync schedule details."""

    id: str = Field(description="Schedule UUID")
    name: str
    description: Optional[str]
    frequency: str
    scheduled_time_utc: Optional[str]
    day_of_week: Optional[int]
    sync_source: str
    source_config: Optional[dict]

    is_active: str

    last_sync_at: Optional[str]
    last_sync_status: Optional[str]
    last_sync_record_count: int
    last_sync_error: Optional[str]

    alert_on_dscr_below: Optional[Decimal]
    alert_on_ltv_above: Optional[Decimal]
    alert_on_concentration_above: Optional[Decimal]
    alert_email_addresses: Optional[str]

    created_at: str
    updated_at: str

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class LoanExposureSyncHistoryItem(BaseModel):
    """Single entry in sync history log."""

    id: str = Field(description="Sync history ID")
    schedule_id: str = Field(description="Parent schedule ID")
    sync_source: str
    status: str = Field(description="'success', 'failed', 'partial_success'")

    total_records: int
    created_count: int
    updated_count: int
    skipped_count: int

    error_message: Optional[str]
    alerts_triggered: Optional[List[str]]

    started_at: Optional[str]
    completed_at: Optional[str]
    duration_seconds: Optional[int]

    created_at: str

    class Config:
        strict = True


class LoanExposureSyncAlertResponse(BaseModel):
    """Alert triggered during sync operation."""

    alert_type: str = Field(description="'dscr_violation', 'ltv_violation', 'concentration_violation'")
    severity: str = Field(description="'critical', 'high', 'medium', 'low'")
    project_id: str = Field(description="Affected project UUID")
    project_code: str = Field(description="Project code")

    current_value: Decimal = Field(description="Current metric value")
    threshold_value: Decimal = Field(description="Configured threshold")

    message: str = Field(description="Human-readable alert message")
    timestamp: str

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}
