"""Regulatory filing calendar, user reminders and stakeholder contacts (RFP E.7, E.15, E.22, E.23, C.9)."""
import uuid

from sqlalchemy import Boolean, Column, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampedMixin

AUTHORITIES = ("NRB", "MOEWRI", "NEA", "DOED", "ERC", "OTHER")
FILING_STATUSES = ("pending", "filed", "overdue", "waived")


class RegulatoryRequirement(Base, TimestampedMixin):
    """A recurring (or one-off) filing owed to a regulator, e.g. a quarterly NRB return.

    Entered by the compliance team; the system ships no requirement data of its own.
    """

    __tablename__ = 'regulatory_requirements'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=False, unique=True)
    title = Column(String(255), nullable=False)
    authority = Column(String(20), nullable=False, index=True)  # AUTHORITIES
    description = Column(Text)
    legal_reference = Column(String(255))  # directive / section the obligation comes from
    frequency = Column(String(20), nullable=False)  # monthly, quarterly, semi_annual, annual (BS fiscal periods)
    lag_days = Column(Integer, nullable=False, default=0)  # due this many days after the period ends
    applies_to = Column(String(20), nullable=False, default='portfolio')  # portfolio | project
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    filings = relationship("FilingCalendarEntry", back_populates="requirement", cascade="all, delete-orphan")


class FilingCalendarEntry(Base, TimestampedMixin):
    """One due filing: a requirement for a period, optionally for one project."""

    __tablename__ = 'filing_calendar'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey('regulatory_requirements.id', ondelete='CASCADE'),
                            nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=True, index=True)  # null = portfolio

    period_label = Column(String(50), nullable=False)
    period_end_ad = Column(Date, nullable=False)
    period_end_bs = Column(String(10))
    due_date_ad = Column(Date, nullable=False, index=True)
    due_date_bs = Column(String(10))

    status = Column(String(20), nullable=False, default='pending', index=True)  # FILING_STATUSES
    filed_date_ad = Column(Date)
    filed_date_bs = Column(String(10))
    reference_no = Column(String(100))
    assigned_to = Column(String(255))
    remarks = Column(Text)

    requirement = relationship("RegulatoryRequirement", back_populates="filings")

    __table_args__ = (
        # one row per requirement/project/period; portfolio rows (project_id NULL) are de-duplicated in migration 014
        UniqueConstraint('requirement_id', 'project_id', 'period_end_ad', name='uq_filing_req_project_period'),
        Index('ix_filing_status_due', 'status', 'due_date_ad'),
    )


class UserReminder(Base, TimestampedMixin):
    """Personal reminder on a date, optionally tied to a project and an entity (RFP E.22)."""

    __tablename__ = 'user_reminders'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_username = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    note = Column(Text)
    remind_on_ad = Column(Date, nullable=False, index=True)
    remind_on_bs = Column(String(10))
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=True, index=True)
    entity_type = Column(String(30))  # MILESTONE, FILING, PERMIT, INSURANCE, ...
    entity_id = Column(String(64))
    status = Column(String(20), nullable=False, default='active', index=True)  # active, sent, dismissed
    sent_at = Column(Date)


class StakeholderContact(Base, TimestampedMixin):
    """Person or organisation that receives alerts, internal or external (RFP E.15, C.9)."""

    __tablename__ = 'stakeholder_contacts'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    organization = Column(String(255))
    role = Column(String(100))
    category = Column(String(30), nullable=False, default='external', index=True)  # internal, external
    email = Column(String(255), nullable=False)
    phone = Column(String(50))
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=True, index=True)  # null = every project
    alert_types = Column(JSONB)  # list of entity types (PPA, PERMIT, INSURANCE, FILING, ...); null = all
    min_urgency = Column(String(20), nullable=False, default='critical')  # warning | critical
    is_active = Column(Boolean, nullable=False, default=True, index=True)
