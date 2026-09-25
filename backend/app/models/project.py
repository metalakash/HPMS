"""Project Information Management models."""
from sqlalchemy import Column, String, Numeric, Integer, Date, Text, ForeignKey, Enum, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import date
import enum
import uuid
from .base import Base, TimestampedMixin

class PipelineStatus(str, enum.Enum):
    """Project pipeline status lifecycle."""
    PROPOSAL_UNDER_PIPELINE = "proposal_under_pipeline"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    DROPPED = "dropped"
    YET_TO_START_DRAWDOWN = "yet_to_start_drawdown"
    UNDER_CONSTRUCTION = "under_construction"
    UNDER_OPERATION = "under_operation"
    SETTLED = "settled"

class ProjectStage(str, enum.Enum):
    """Current project construction stage."""
    FEASIBILITY = "feasibility"
    CONSTRUCTION = "construction"
    OPERATION = "operation"

class Project(Base, TimestampedMixin):
    """Core project master record."""
    
    __tablename__ = 'projects'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code = Column(String(50), unique=True, nullable=False, index=True)
    name_en = Column(String(255), nullable=False)
    name_np = Column(String(255), nullable=False)
    
    # Location - references to geo tables would go here
    province = Column(String(100))
    district = Column(String(100))
    local_level = Column(String(100))
    
    # Technical specs
    installed_capacity_mw = Column(Numeric(12, 4), nullable=False)
    project_stage = Column(String(50), nullable=False)
    pipeline_status = Column(String(50), nullable=False, index=True)
    
    # Dates - effective-dated fields
    original_cod_ad = Column(Date)
    original_cod_bs = Column(String(10))
    current_approved_cod_ad = Column(Date)
    current_approved_cod_bs = Column(String(10))
    forecast_cod_ad = Column(Date)
    forecast_cod_bs = Column(String(10))
    actual_cod_ad = Column(Date)
    actual_cod_bs = Column(String(10))
    
    # Lifecycle
    drop_reason = Column(Text)  # MANDATORY when pipeline_status = DROPPED
    
    # Relationships
    technical_specs = relationship("ProjectTechnicalSpecs", back_populates="project", uselist=False)
    hydrology_records = relationship("HydrologyRecord", back_populates="project")
    water_licenses = relationship("WaterLicense", back_populates="project")
    land_records = relationship("LandRecord", back_populates="project")
    loan_accounts = relationship("LoanAccount", back_populates="project")
    capacity_history = relationship("ProjectCapacityHistory", back_populates="project")
    rcod_events = relationship("RCODEvent", back_populates="project")
    documents = relationship("Document", back_populates="project")
    project_owners = relationship("ProjectOwner", back_populates="project", cascade="all, delete-orphan")  # Phase 3: RLS
    consortium = relationship("ConsortiumFacility", back_populates="project", uselist=False)
    consortium_members = relationship(
        "ConsortiumMember",
        secondary="consortium_facilities",
        primaryjoin="Project.id == ConsortiumFacility.project_id",
        secondaryjoin="ConsortiumFacility.id == ConsortiumMember.consortium_facility_id",
        viewonly=True,
    )
    
    __table_args__ = (
        UniqueConstraint('project_code', name='uq_project_code'),
        Index('ix_pipeline_status', 'pipeline_status'),
    )

class ProjectTechnicalSpecs(Base, TimestampedMixin):
    """Technical specifications for a project."""
    
    __tablename__ = 'project_technical_specs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), unique=True, nullable=False)
    
    design_head_m = Column(Numeric(10, 2))
    design_discharge_cumecs = Column(Numeric(12, 4))
    plant_type = Column(String(100))
    turbine_type = Column(String(100))
    transmission_km = Column(Numeric(8, 2))
    
    project = relationship("Project", back_populates="technical_specs")

class HydrologyRecord(Base, TimestampedMixin):
    """Hydrological data for environmental assessment."""
    
    __tablename__ = 'hydrology_records'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    river_name = Column(String(255))
    river_basin = Column(String(255))
    sub_basin = Column(String(255))
    measurement_date_ad = Column(Date)
    measurement_date_bs = Column(String(10))
    flow_cumecs = Column(Numeric(12, 4))
    q40_design_flow = Column(Numeric(12, 4))
    catchment_area_sqkm = Column(Numeric(12, 2))
    
    source = Column(String(100))  # DHM / consultant
    is_verified = Column(String(50), default='unverified')
    
    project = relationship("Project", back_populates="hydrology_records")

class WaterLicense(Base, TimestampedMixin):
    """Water license and rights for the project."""
    
    __tablename__ = 'water_licenses'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    license_number = Column(String(100), unique=True)
    issuing_authority = Column(String(255))
    river_basin = Column(String(255))
    
    validity_from_ad = Column(Date)
    validity_from_bs = Column(String(10))
    validity_to_ad = Column(Date)
    validity_to_bs = Column(String(10))
    
    terms = Column(Text)
    status = Column(String(50))
    
    project = relationship("Project", back_populates="water_licenses")

class LandRecord(Base, TimestampedMixin):
    """Land acquisition and ownership records."""
    
    __tablename__ = 'land_records'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    plot_id = Column(String(100))
    ownership_status = Column(String(100))
    acquisition_progress_pct = Column(Numeric(5, 2))
    
    compensation_amount = Column(Numeric(20, 4))
    compensation_status = Column(String(100))
    
    project = relationship("Project", back_populates="land_records")


class ProjectCapacityHistory(Base, TimestampedMixin):
    """Effective-dated capacity changes during design/construction phases."""
    
    __tablename__ = 'project_capacity_history'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    capacity_mw = Column(Numeric(12, 4), nullable=False)

    valid_from_ad = Column(Date, nullable=False, index=True)
    valid_from_bs = Column(String(10))
    valid_to_ad = Column(Date, index=True)
    valid_to_bs = Column(String(10))
    is_current = Column(String(5), default='Y', index=True)

    revision_reason = Column(String(255))

    # Data provenance
    data_provenance = Column(String(50), default='DOCUMENT_VERIFIED')
    source_reference = Column(String(255))

    project = relationship("Project", back_populates="capacity_history")

    __table_args__ = (
        Index('ix_capacity_current', 'project_id', 'is_current'),
        Index('ix_capacity_validity', 'valid_from_ad', 'valid_to_ad'),
    )


class RCODEvent(Base, TimestampedMixin):
    """Revised Commercial Operation Date events with classification review triggers."""
    
    __tablename__ = 'rcod_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    # RCOD dates
    rcod_ad = Column(Date, nullable=False)
    rcod_bs = Column(String(10))

    previous_rcod_ad = Column(Date)
    previous_rcod_bs = Column(String(10))

    # Classification and review
    rcod_classification = Column(String(100))  # e.g., minor_revision, major_revision, contract_amendment
    requires_classification_review = Column(String(5), default='Y')

    reason_for_revision = Column(Text)
    contract_amendment_reference = Column(String(255))

    # Data provenance
    data_provenance = Column(String(50), default='MANUAL_ENTRY')
    source_reference = Column(String(255))

    project = relationship("Project", back_populates="rcod_events")

    __table_args__ = (
        Index('ix_rcod_classification', 'rcod_classification', 'requires_classification_review'),
        Index('ix_rcod_dates', 'rcod_ad', 'previous_rcod_ad'),
    )
