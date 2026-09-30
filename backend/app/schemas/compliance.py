"""Compliance and audit schemas."""

from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AuditLogReadResponse(BaseModel):
    """Audit log read access record."""

    id: str = Field(description="Record ID")
    user_id: str = Field(description="User who accessed the data")
    timestamp: str = Field(description="Access timestamp (ISO format)")
    entity_type: str = Field(description="Entity accessed (project, loan, report, etc.)")
    entity_id: str = Field(description="Entity ID")
    export_format: Optional[str] = Field(None, description="Export format (PDF, JSON, CSV)")
    record_count: Optional[int] = Field(None, description="Number of records accessed")

    class Config:
        strict = True


class ComplianceExportRequest(BaseModel):
    """Request to export compliance audit log."""

    entity_type: Optional[str] = Field(None, description="Filter by entity type")
    entity_id: Optional[str] = Field(None, description="Filter by entity ID")
    date_from: Optional[str] = Field(None, description="Filter from date (ISO format)")
    date_to: Optional[str] = Field(None, description="Filter to date (ISO format)")

    class Config:
        strict = True


class ComplianceExportResponse(BaseModel):
    """Immutable compliance audit export."""

    record_count: int = Field(description="Total records in export")
    export_timestamp: str = Field(description="When export was generated (ISO format)")
    generated_by: str = Field(description="User who generated export")
    records: list[AuditLogReadResponse] = Field(description="Audit records")

    class Config:
        strict = True
