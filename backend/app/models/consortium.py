"""Consortium and syndication models."""
from sqlalchemy import Column, String, Numeric, Date, Text, ForeignKey, Boolean, UniqueConstraint, Index, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import date
import uuid
from decimal import Decimal
from .base import Base, TimestampedMixin

class ConsortiumFacility(Base, TimestampedMixin):
    """Consortium credit facility structure."""
    
    __tablename__ = 'consortium_facilities'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, unique=True, index=True)
    
    facility_name = Column(String(255), nullable=False)
    total_facility_limit = Column(Numeric(20, 4), nullable=False)
    currency_code = Column(String(3), default='NPR')
    
    sbl_role = Column(String(50), nullable=False)  # LEAD_BANK or PARTICIPANT
    lead_bank_name = Column(String(255))
    
    facility_agreement_date_ad = Column(Date)
    facility_agreement_date_bs = Column(String(10))
    
    security_type = Column(String(100))
    charge_ranking = Column(String(50))
    
    project = relationship("Project", back_populates="consortium")
    members = relationship("ConsortiumMember", back_populates="facility")

class ConsortiumMember(Base, TimestampedMixin):
    """Consortium member with effective-dating for changes."""
    
    __tablename__ = 'consortium_members'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consortium_facility_id = Column(UUID(as_uuid=True), ForeignKey('consortium_facilities.id'), nullable=False, index=True)
    
    institution_name = Column(String(255), nullable=False)
    institution_type = Column(String(100))
    
    is_lead = Column(Boolean, default=False)
    is_current = Column(Boolean, default=True, index=True)
    
    committed_amount = Column(Numeric(20, 4), nullable=False)
    share_pct = Column(Numeric(9, 6), nullable=False)
    
    disbursed_to_date = Column(Numeric(20, 4), default=Decimal("0"))
    
    # Effective dating
    valid_from_ad = Column(Date, nullable=False)
    valid_from_bs = Column(String(10))
    valid_to_ad = Column(Date)
    valid_to_bs = Column(String(10))
    
    facility = relationship("ConsortiumFacility", back_populates="members")
    
    __table_args__ = (
        CheckConstraint("share_pct >= 0 AND share_pct <= 100", name="ck_share_pct_range"),
        Index('ix_consortium_current', 'consortium_facility_id', 'is_current'),
        Index('ix_consortium_effective', 'valid_from_ad', 'valid_to_ad'),
    )

class ConsortiumExposureView(Base):
    """Materialized view for consortium exposure (read-only reference)."""
    
    __tablename__ = 'consortium_exposure_v'
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True))
    project_code = Column(String(50))
    facility_id = Column(UUID(as_uuid=True))
    
    institution_name = Column(String(255))
    sbl_role = Column(String(50))
    
    committed_amount = Column(Numeric(20, 4))
    share_pct = Column(Numeric(9, 6))
    disbursed_to_date = Column(Numeric(20, 4))
    outstanding = Column(Numeric(20, 4))
