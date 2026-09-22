"""Finacle CBS field mapping and schema definitions.

Defines canonical field names from Finacle CBS and how they map to HPMS loan_accounts.
This layer decouples HPMS from CBS schema changes.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import date
import enum


class FinacleSyncType(str, enum.Enum):
    """CBS synchronization types."""
    REALTIME_INQUIRY = "realtime_inquiry"
    EOD_BATCH = "eod_batch"  # End-of-day batch
    BOD_BATCH = "bod_batch"  # Beginning-of-day batch


class FinalceAccountStatus(str, enum.Enum):
    """Finacle account lifecycle status."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    CLOSED = "CLOSED"
    DORMANT = "DORMANT"
    SUSPENDED = "SUSPENDED"


@dataclass
class FinacleAccountRecord:
    """Canonical mapping of Finacle account to HPMS LoanAccount fields.

    These are the fields CBS provides that HPMS cares about.
    Sensitive fields are encrypted at rest via pgcrypto in the DB layer.
    """

    # CBS unique identifier (encrypted in HPMS)
    finacle_account_id: str

    # Account metadata
    customer_id: str  # Encrypted: SBL customer ID from CBS
    account_status: str  # ACTIVE, INACTIVE, CLOSED, DORMANT, SUSPENDED
    account_type: str  # e.g., "Term Loan", "Overdraft", "Working Capital"

    # Facility terms
    facility_type: str  # Maps to HPMS facility_type
    sanctioned_amount: Decimal  # Numeric(20,4)
    currency_code: str  # e.g., "NPR", "USD"

    # Current balances (as of sync_datetime)
    disbursed_amount: Decimal
    outstanding_principal: Decimal
    outstanding_interest: Decimal
    overdue_principal: Decimal
    overdue_interest: Decimal

    # Rates and terms
    interest_rate_pct: Decimal  # Numeric(7,4)
    rate_reset_date: Optional[date]  # When rate last changed

    # Key dates
    sanction_date: Optional[date]
    disbursement_date: Optional[date]
    moratorium_end_date: Optional[date]
    maturity_date: Optional[date]

    # Additional context
    linked_project_code: Optional[str]  # If CBS knows the SBL project code
    collateral_value: Optional[Decimal]
    security_type: Optional[str]

    # Sync metadata
    last_updated_at_cbs: str  # ISO format timestamp from CBS
    record_version: int  # For optimistic locking if needed

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for JSON serialization (sensitive fields masked)."""
        return {
            'finacle_account_id': '***MASKED***',
            'customer_id': '***MASKED***',
            'account_status': self.account_status,
            'account_type': self.account_type,
            'facility_type': self.facility_type,
            'sanctioned_amount': str(self.sanctioned_amount),
            'currency_code': self.currency_code,
            'disbursed_amount': str(self.disbursed_amount),
            'outstanding_principal': str(self.outstanding_principal),
            'outstanding_interest': str(self.outstanding_interest),
            'overdue_principal': str(self.overdue_principal),
            'overdue_interest': str(self.overdue_interest),
            'interest_rate_pct': str(self.interest_rate_pct),
            'rate_reset_date': self.rate_reset_date.isoformat() if self.rate_reset_date else None,
            'sanction_date': self.sanction_date.isoformat() if self.sanction_date else None,
            'disbursement_date': self.disbursement_date.isoformat() if self.disbursement_date else None,
            'moratorium_end_date': self.moratorium_end_date.isoformat() if self.moratorium_end_date else None,
            'maturity_date': self.maturity_date.isoformat() if self.maturity_date else None,
            'collateral_value': str(self.collateral_value) if self.collateral_value else None,
            'security_type': self.security_type,
        }


@dataclass
class FinacleSyncRequest:
    """Request to synchronize data from Finacle CBS."""

    sync_type: FinacleSyncType
    request_id: str  # Unique request identifier for idempotency
    account_ids: Optional[list[str]] = None  # If None, fetch all accounts
    date_range: Optional[tuple[date, date]] = None  # For EOD/BOD batch

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for logging (masks sensitive account IDs)."""
        return {
            'sync_type': self.sync_type.value,
            'request_id': self.request_id,
            'account_count': len(self.account_ids) if self.account_ids else 'ALL',
            'date_range': f"{self.date_range[0]} to {self.date_range[1]}" if self.date_range else None,
        }


@dataclass
class FinacleSyncResponse:
    """Response from Finacle CBS synchronization."""

    request_id: str
    response_code: str  # "000" = success, other codes = error
    response_message: str
    account_records: list[FinacleAccountRecord]
    sync_timestamp: str  # ISO format
    total_records: int
    records_processed: int
    records_failed: int

    is_success: bool = False

    def __post_init__(self):
        self.is_success = self.response_code == "000"

    def to_dict(self, mask_sensitive: bool = True) -> Dict[str, Any]:
        """Convert to dict for logging."""
        return {
            'request_id': self.request_id,
            'response_code': self.response_code,
            'response_message': self.response_message,
            'is_success': self.is_success,
            'sync_timestamp': self.sync_timestamp,
            'total_records': self.total_records,
            'records_processed': self.records_processed,
            'records_failed': self.records_failed,
            'account_records': [r.to_dict() for r in self.account_records] if mask_sensitive else None,
        }


class FinacleFieldMapping:
    """Static mapping of Finacle CBS fields to HPMS LoanAccount fields.

    This allows HPMS to remain decoupled from CBS schema changes.
    If CBS renames a field, only this mapping needs updating.
    """

    # Finacle field name → HPMS column name
    ACCOUNT_MAPPING = {
        # CBS field → HPMS field
        'ACCT_MASTER_ID': 'finacle_account_id',
        'CUSTOMER_ID': 'customer_id',
        'ACCT_STATUS': 'account_status',
        'PROD_CODE': 'account_type',
        'LIM_FACILITY_TYPE': 'facility_type',
        'SANCTION_LIMIT': 'sanctioned_amount',
        'CURRENCY': 'currency_code',
        'DISBURSE_AMOUNT': 'disbursed_amount',
        'OUTSTANDING_PRIN': 'outstanding_principal',
        'OUTSTANDING_INT': 'outstanding_interest',
        'OVERDUE_PRINCIPAL': 'overdue_principal',
        'OVERDUE_INTEREST': 'overdue_interest',
        'INT_RATE_PERCENT': 'interest_rate_pct',
        'RATE_RESET_DATE': 'rate_reset_date',
        'SANCTION_DATE': 'sanction_date',
        'DISBURSE_DATE': 'disbursement_date',
        'MORATORIUM_END_DT': 'moratorium_end_date',
        'MATURITY_DATE': 'maturity_date',
        'COLLATERAL_VALUE': 'collateral_value',
        'SECURITY_TYPE': 'security_type',
        'LAST_UPDATE_TMSP': 'last_updated_at_cbs',
        'REC_VERSION': 'record_version',
    }

    @staticmethod
    def get_hpms_field(finacle_field: str) -> Optional[str]:
        """Get HPMS field name for a Finacle field."""
        return FinacleFieldMapping.ACCOUNT_MAPPING.get(finacle_field)

    @staticmethod
    def get_finacle_field(hpms_field: str) -> Optional[str]:
        """Get Finacle field name for an HPMS field (reverse lookup)."""
        reverse_map = {v: k for k, v in FinacleFieldMapping.ACCOUNT_MAPPING.items()}
        return reverse_map.get(hpms_field)
