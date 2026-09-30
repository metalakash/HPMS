"""Analytics and reporting schemas."""

from typing import Optional
from pydantic import BaseModel, Field
from decimal import Decimal


class PortfolioMetricsResponse(BaseModel):
    """Portfolio-level summary metrics."""

    total_projects: int = Field(description="Total number of projects")
    active_projects: int = Field(description="Projects in under_construction or under_operation")
    total_capacity_mw: Decimal = Field(description="Sum of installed_capacity_mw")
    average_interest_rate: Optional[Decimal] = Field(None, description="Average interest rate across active loans")
    total_sanctioned_amount: Decimal = Field(description="Sum of sanctioned_amount across loans")
    total_disbursed_amount: Decimal = Field(description="Sum of disbursed_amount across loans")
    total_outstanding_principal: Decimal = Field(description="Sum of outstanding_principal across loans")

    class Config:
        strict = True
        json_encoders = {Decimal: str}


class ProjectAnalyticsResponse(BaseModel):
    """Per-project analytics and performance metrics."""

    project_id: str = Field(description="Project UUID")
    project_code: str = Field(description="Project code")
    name_en: str = Field(description="English project name")
    name_np: Optional[str] = Field(None, description="Nepali project name")
    installed_capacity_mw: Decimal = Field(description="Installed capacity in MW")
    pipeline_status: str = Field(description="Project status (under_construction, under_operation, etc.)")
    project_stage: str = Field(description="Project stage (feasibility, construction, operation)")
    province: Optional[str] = Field(None, description="Province/location")

    # Financial metrics
    total_sanctioned_amount: Decimal = Field(description="Total sanctioned loan amount")
    total_disbursed_amount: Decimal = Field(description="Total disbursed loan amount")
    total_outstanding_principal: Decimal = Field(description="Outstanding principal balance")

    # Loan account count
    loan_account_count: int = Field(description="Number of associated loan accounts")

    # Timeline
    created_at: Optional[str] = Field(None, description="Project creation date (ISO)")
    updated_at: Optional[str] = Field(None, description="Last update date (ISO)")

    class Config:
        strict = True
        json_encoders = {Decimal: str}
