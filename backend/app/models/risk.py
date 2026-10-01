"""Phase 11 domain models: milestones, risk register, insurance, permits, ESIA monitoring, community engagement."""
import uuid
from decimal import Decimal

from sqlalchemy import Column, String, Numeric, Integer, Date, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampedMixin


class Milestone(Base, TimestampedMixin):
    """Construction / financing milestone (RFP C.5, F.15). Feeds Gantt and slippage alerts."""

    __tablename__ = 'milestones'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    category = Column(String(50))  # CIVIL, ELECTROMECHANICAL, TRANSMISSION, FINANCING, REGULATORY, COD
    sequence = Column(Integer, default=0)

    planned_date_ad = Column(Date, nullable=False)
    planned_date_bs = Column(String(10))
    forecast_date_ad = Column(Date)
    forecast_date_bs = Column(String(10))
    actual_date_ad = Column(Date)
    actual_date_bs = Column(String(10))

    status = Column(String(30), default='planned', index=True)  # planned, in_progress, completed, delayed
    percent_complete = Column(Numeric(5, 2), default=Decimal("0"))
    remarks = Column(Text)

    project = relationship("Project")

    __table_args__ = (
        Index('ix_milestone_project_planned', 'project_id', 'planned_date_ad'),
    )


class RiskRegisterEntry(Base, TimestampedMixin):
    """Project-specific risk with severity and mitigation tracking (RFP E.9, E.19, E.20)."""

    __tablename__ = 'risk_register'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text)
    risk_type = Column(String(30), nullable=False, index=True)  # financial, technical, legal, environmental, social, climate
    likelihood = Column(Integer, nullable=False)  # 1-5
    impact = Column(Integer, nullable=False)  # 1-5
    severity = Column(String(20), nullable=False, index=True)  # low, medium, high, critical (derived from likelihood*impact)

    mitigation_action = Column(Text)
    mitigation_owner = Column(String(255))
    mitigation_due_ad = Column(Date)
    mitigation_status = Column(String(30), default='open', index=True)  # open, in_progress, mitigated, accepted

    trigger_source = Column(String(50))  # manual, milestone_delay, compliance_breach, repeated_alert

    project = relationship("Project")


class InsurancePolicy(Base, TimestampedMixin):
    """Project insurance policy with expiry tracking (RFP E.11, E.16)."""

    __tablename__ = 'insurance_policies'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    policy_number = Column(String(100), nullable=False, unique=True)
    insurer = Column(String(255), nullable=False)
    policy_type = Column(String(50), nullable=False)  # CAR, operational_all_risk, third_party, business_interruption
    sum_insured_npr = Column(Numeric(18, 2))
    premium_npr = Column(Numeric(18, 2))

    valid_from_ad = Column(Date, nullable=False)
    valid_from_bs = Column(String(10))
    valid_to_ad = Column(Date, nullable=False)
    valid_to_bs = Column(String(10))

    status = Column(String(30), default='active', index=True)  # active, expired, renewed, cancelled

    project = relationship("Project")

    __table_args__ = (
        Index('ix_insurance_valid_to', 'valid_to_ad'),
    )


class ProjectPermit(Base, TimestampedMixin):
    """Environmental / regulatory permit with validity (RFP E.2, E.16)."""

    __tablename__ = 'project_permits'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    permit_type = Column(String(50), nullable=False)  # EIA_APPROVAL, FOREST_CLEARANCE, CONSTRUCTION_LICENSE, GENERATION_LICENSE
    permit_number = Column(String(100), nullable=False)
    issuing_authority = Column(String(255))

    valid_from_ad = Column(Date)
    valid_to_ad = Column(Date, index=True)
    valid_to_bs = Column(String(10))

    status = Column(String(30), default='active', index=True)  # active, expired, renewed

    project = relationship("Project")


class EsiaMonitoringRecord(Base, TimestampedMixin):
    """ESIA / EIA monitoring record (RFP E.17)."""

    __tablename__ = 'esia_monitoring_records'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    monitoring_date_ad = Column(Date, nullable=False)
    monitoring_date_bs = Column(String(10))
    parameter = Column(String(100), nullable=False)  # water quality, noise, biodiversity, resettlement
    finding = Column(Text)
    compliance_status = Column(String(30), default='compliant')  # compliant, non_compliant, observation
    corrective_action = Column(Text)

    project = relationship("Project")


class CommunityEngagement(Base, TimestampedMixin):
    """Community consultation or grievance with resolution tracking (RFP E.18)."""

    __tablename__ = 'community_engagements'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    engagement_type = Column(String(20), nullable=False, index=True)  # consultation, grievance
    engagement_date_ad = Column(Date, nullable=False)
    engagement_date_bs = Column(String(10))
    stakeholder_group = Column(String(255))
    summary = Column(Text, nullable=False)

    status = Column(String(30), default='open', index=True)  # open, in_progress, resolved, closed
    resolution = Column(Text)
    resolved_date_ad = Column(Date)

    project = relationship("Project")
