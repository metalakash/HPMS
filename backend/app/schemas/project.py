"""Project-related request/response schemas.

Schemas for project creation, listing, and detailed views with COD history.
"""

from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field
import uuid

from .common import DualCalendarDate, NumericFieldResponse


class ProjectCreateRequest(BaseModel):
    """Create new project request."""

    project_code: str = Field(min_length=1, max_length=50, description="Unique project code (e.g., SBL-HPP-0001)")
    name_en: str = Field(min_length=1, max_length=255, description="Project name in English")
    name_np: str = Field(min_length=1, max_length=255, description="Project name in Nepali")

    province: str = Field(description="Province name")
    district: str = Field(description="District name")
    local_level: Optional[str] = Field(None, description="Local level (municipality)")

    installed_capacity_mw: Decimal = Field(gt=0, description="Installed capacity in MW")
    project_stage: str = Field(description="Stage: feasibility, construction, operation")
    pipeline_status: str = Field(description="Pipeline status (proposal_under_pipeline, under_review, approved, etc.)")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class CODHistoryEntry(BaseModel):
    """Single COD (Commercial Operation Date) entry in history."""

    cod_type: str = Field(description="original_cod, current_approved_cod, forecast_cod, actual_cod")
    date_ad: Optional[date] = Field(None, description="Date in Gregorian (AD)")
    date_bs: Optional[str] = Field(None, description="Date in Bikram Sambat (BS)")
    version: int = Field(description="Version number (if revised)")
    revision_reason: Optional[str] = Field(None, description="Why this COD was revised")
    source: str = Field(description="Data source (CBS_SYNCED, MANUAL_ENTRY, DOCUMENT_VERIFIED)")


class ProjectDetailResponse(BaseModel):
    """Detailed project view with full history and linked entities."""

    id: str = Field(description="Project UUID")
    project_code: str
    name_en: str
    name_np: str

    location: dict = Field(description="Province, district, local_level")
    installed_capacity_mw: Decimal = Field(description="Current installed capacity")

    project_stage: str
    pipeline_status: str
    drop_reason: Optional[str] = Field(None)

    # COD tracking
    cod_history: List[CODHistoryEntry] = Field(description="All COD versions with dates")

    # Timestamps
    created_at: str = Field(description="ISO format timestamp")
    updated_at: str = Field(description="ISO format timestamp")
    created_by: str
    updated_by: str

    # Related counts
    loan_accounts_count: int = Field(description="Number of linked loan accounts")
    documents_count: int = Field(description="Number of uploaded documents")

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class ProjectListResponse(BaseModel):
    """Project summary for list views."""

    id: str
    project_code: str
    name_en: str
    name_np: str

    province: str
    installed_capacity_mw: Decimal
    project_stage: str
    pipeline_status: str

    # Most recent COD
    latest_cod_ad: Optional[date] = Field(None, description="Most recent COD date")
    latest_cod_bs: Optional[str] = Field(None)

    created_at: str
    created_by: str

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class ProjectListRequest(BaseModel):
    """Query parameters for listing projects."""

    status: Optional[str] = Field(None, description="Filter by pipeline_status")
    stage: Optional[str] = Field(None, description="Filter by project_stage")
    province: Optional[str] = Field(None, description="Filter by province")
    capacity_min_mw: Optional[Decimal] = Field(None, description="Minimum capacity filter")
    capacity_max_mw: Optional[Decimal] = Field(None, description="Maximum capacity filter")

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    class Config:
        strict = True
        json_encoders = {Decimal: lambda v: str(v)}


class ProjectUpdateRequest(BaseModel):
    """Update project fields."""

    name_en: Optional[str] = Field(None)
    name_np: Optional[str] = Field(None)
    project_stage: Optional[str] = Field(None)
    pipeline_status: Optional[str] = Field(None)
    drop_reason: Optional[str] = Field(None, description="Required if transitioning to DROPPED status")

    class Config:
        strict = True
