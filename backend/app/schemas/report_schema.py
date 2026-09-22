"""Report request/response schemas for PowerBI export endpoints."""

from typing import List, Optional, Dict, Any, Literal
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class ExportFilter(BaseModel):
    """Filter criteria for report export."""
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    province: Optional[str] = None  # Filter by province
    status: Optional[str] = None    # Filter by pipeline status
    facility_type: Optional[str] = None  # Filter by loan facility type

    class Config:
        json_schema_extra = {
            "example": {
                "date_range_start": "2026-01-01",
                "date_range_end": "2026-09-22",
                "province": "Gandaki",
                "status": "under_operation"
            }
        }


class ReportExportRequest(BaseModel):
    """Request to export a report."""
    report_id: Literal["portfolio", "covenant_summary", "capex_progress"] = Field(
        description="Type of report to export"
    )
    format: Literal["json", "csv", "excel"] = Field(
        default="json",
        description="Output format (PDF in Phase 3)"
    )
    filters: Optional[ExportFilter] = None

    class Config:
        json_schema_extra = {
            "example": {
                "report_id": "portfolio",
                "format": "excel",
                "filters": {
                    "province": "Gandaki",
                    "status": "under_operation"
                }
            }
        }


class PortfolioReportRow(BaseModel):
    """Single project row in portfolio report."""
    project_code: str
    project_name_en: str
    project_name_np: str
    province: str
    district: str
    capacity_mw: Decimal
    project_stage: str
    pipeline_status: str
    lead_bank: Optional[str]
    consortium_members_count: int
    total_sanctioned_amount: Decimal
    currency: str
    loan_accounts_count: int
    created_date_ad: Optional[str]
    created_date_bs: Optional[str]
    updated_date_ad: Optional[str]
    updated_date_bs: Optional[str]

    class Config:
        json_schema_extra = {
            "example": {
                "project_code": "SBL-HPP-0001",
                "project_name_en": "Kali Gandaki",
                "project_name_np": "काली गण्डकी",
                "province": "Gandaki",
                "district": "Kaski",
                "capacity_mw": Decimal("50.00"),
                "project_stage": "operation",
                "pipeline_status": "under_operation",
                "lead_bank": "SBL",
                "consortium_members_count": 2,
                "total_sanctioned_amount": Decimal("500000000.00"),
                "currency": "NPR",
                "loan_accounts_count": 2,
                "created_date_ad": "2026-01-15",
                "created_date_bs": "2082-10-01",
                "updated_date_ad": "2026-09-22",
                "updated_date_bs": "2083-06-08"
            }
        }


class CovenantReportRow(BaseModel):
    """Single row in covenant summary report."""
    project_code: str
    project_name_en: str
    province: str
    loan_account_id: str
    finacle_account_id: str
    facility_type: str
    sanctioned_amount: Decimal
    current_rate_percent: Decimal
    rate_effective_date_ad: Optional[str]
    rate_effective_date_bs: Optional[str]
    rate_expiry_date_ad: Optional[str]
    rate_expiry_date_bs: Optional[str]
    last_sync_date: Optional[str]
    sync_status: str

    class Config:
        json_schema_extra = {
            "example": {
                "project_code": "SBL-HPP-0001",
                "project_name_en": "Kali Gandaki",
                "province": "Gandaki",
                "loan_account_id": "550e8400-e29b-41d4-a716-446655440000",
                "finacle_account_id": "ACC0000001",
                "facility_type": "Term Loan",
                "sanctioned_amount": Decimal("500000000.00"),
                "current_rate_percent": Decimal("8.50"),
                "rate_effective_date_ad": "2026-01-15",
                "rate_effective_date_bs": "2082-10-01",
                "rate_expiry_date_ad": "2027-01-15",
                "rate_expiry_date_bs": "2083-10-01",
                "last_sync_date": "2026-09-22",
                "sync_status": "synced"
            }
        }


class CapexReportRow(BaseModel):
    """Single row in capex progress report."""
    project_code: str
    project_name_en: str
    province: str
    capacity_mw: Decimal
    project_stage: str
    budget_category: str
    budgeted_amount: Decimal
    actual_amount: Optional[Decimal]
    spent_percent: Optional[Decimal]
    currency: str

    class Config:
        json_schema_extra = {
            "example": {
                "project_code": "SBL-HPP-0001",
                "project_name_en": "Kali Gandaki",
                "province": "Gandaki",
                "capacity_mw": Decimal("50.00"),
                "project_stage": "construction",
                "budget_category": "Civil Works",
                "budgeted_amount": Decimal("400000000.00"),
                "actual_amount": Decimal("350000000.00"),
                "spent_percent": Decimal("87.50"),
                "currency": "NPR"
            }
        }


class ReportExportResponse(BaseModel):
    """Response from report export endpoint."""
    report_id: str
    format: str
    record_count: int
    export_timestamp: str
    filters_applied: Dict[str, Any]
    data: List[Dict[str, Any]] = Field(description="Report data rows")
    download_url: Optional[str] = Field(
        default=None,
        description="Presigned URL to download Excel/CSV file (Phase 3)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "report_id": "portfolio",
                "format": "json",
                "record_count": 25,
                "export_timestamp": "2026-09-22T10:30:00Z",
                "filters_applied": {"status": "under_operation"},
                "data": [
                    {
                        "project_code": "SBL-HPP-0001",
                        "project_name_en": "Kali Gandaki",
                        "capacity_mw": "50.00"
                    }
                ]
            }
        }
