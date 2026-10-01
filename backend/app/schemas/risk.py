"""Request schemas for Phase 11 domain tables (milestones, risks, insurance, permits, ESIA, community)."""
from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

MilestoneStatus = Literal["planned", "in_progress", "completed", "delayed"]
RiskType = Literal["financial", "technical", "legal", "environmental", "social", "climate"]
MitigationStatus = Literal["open", "in_progress", "mitigated", "accepted"]
PolicyStatus = Literal["active", "expired", "renewed", "cancelled"]
PermitStatus = Literal["active", "expired", "renewed"]
EsiaStatus = Literal["compliant", "non_compliant", "observation"]
EngagementStatus = Literal["open", "in_progress", "resolved", "closed"]


class MilestoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=50)
    sequence: int = 0
    planned_date_ad: date
    forecast_date_ad: Optional[date] = None
    actual_date_ad: Optional[date] = None
    status: MilestoneStatus = "planned"
    percent_complete: Decimal = Field(Decimal("0"), ge=0, le=100)
    remarks: Optional[str] = None


class MilestoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=50)
    sequence: Optional[int] = None
    planned_date_ad: Optional[date] = None
    forecast_date_ad: Optional[date] = None
    actual_date_ad: Optional[date] = None
    status: Optional[MilestoneStatus] = None
    percent_complete: Optional[Decimal] = Field(None, ge=0, le=100)
    remarks: Optional[str] = None


class RiskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    risk_type: RiskType
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    mitigation_action: Optional[str] = None
    mitigation_owner: Optional[str] = Field(None, max_length=255)
    mitigation_due_ad: Optional[date] = None
    mitigation_status: MitigationStatus = "open"


class RiskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    risk_type: Optional[RiskType] = None
    likelihood: Optional[int] = Field(None, ge=1, le=5)
    impact: Optional[int] = Field(None, ge=1, le=5)
    mitigation_action: Optional[str] = None
    mitigation_owner: Optional[str] = Field(None, max_length=255)
    mitigation_due_ad: Optional[date] = None
    mitigation_status: Optional[MitigationStatus] = None


class InsuranceCreate(BaseModel):
    policy_number: str = Field(min_length=1, max_length=100)
    insurer: str = Field(min_length=1, max_length=255)
    policy_type: str = Field(min_length=1, max_length=50)
    sum_insured_npr: Optional[Decimal] = Field(None, ge=0)
    premium_npr: Optional[Decimal] = Field(None, ge=0)
    valid_from_ad: date
    valid_to_ad: date
    status: PolicyStatus = "active"


class InsuranceUpdate(BaseModel):
    insurer: Optional[str] = Field(None, min_length=1, max_length=255)
    policy_type: Optional[str] = Field(None, max_length=50)
    sum_insured_npr: Optional[Decimal] = Field(None, ge=0)
    premium_npr: Optional[Decimal] = Field(None, ge=0)
    valid_from_ad: Optional[date] = None
    valid_to_ad: Optional[date] = None
    status: Optional[PolicyStatus] = None


class PermitCreate(BaseModel):
    permit_type: str = Field(min_length=1, max_length=50)
    permit_number: str = Field(min_length=1, max_length=100)
    issuing_authority: Optional[str] = Field(None, max_length=255)
    valid_from_ad: Optional[date] = None
    valid_to_ad: Optional[date] = None
    status: PermitStatus = "active"


class PermitUpdate(BaseModel):
    issuing_authority: Optional[str] = Field(None, max_length=255)
    valid_from_ad: Optional[date] = None
    valid_to_ad: Optional[date] = None
    status: Optional[PermitStatus] = None


class EsiaCreate(BaseModel):
    monitoring_date_ad: date
    parameter: str = Field(min_length=1, max_length=100)
    finding: Optional[str] = None
    compliance_status: EsiaStatus = "compliant"
    corrective_action: Optional[str] = None


class EsiaUpdate(BaseModel):
    finding: Optional[str] = None
    compliance_status: Optional[EsiaStatus] = None
    corrective_action: Optional[str] = None


class CommunityCreate(BaseModel):
    engagement_type: Literal["consultation", "grievance"]
    engagement_date_ad: date
    stakeholder_group: Optional[str] = Field(None, max_length=255)
    summary: str = Field(min_length=1)
    status: EngagementStatus = "open"


class CommunityUpdate(BaseModel):
    stakeholder_group: Optional[str] = Field(None, max_length=255)
    summary: Optional[str] = Field(None, min_length=1)
    status: Optional[EngagementStatus] = None
    resolution: Optional[str] = None
    resolved_date_ad: Optional[date] = None
