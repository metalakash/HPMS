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
