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
    
    __table_args__ = (
        UniqueConstraint('project_code', name='uq_project_code'),
        Index('ix_pipeline_status', 'pipeline_status'),
    )

class ProjectTechnicalSpecs(Base, TimestampedMixin):
    """Technical specifications for a project."""
    
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
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    
    plot_id = Column(String(100))
    ownership_status = Column(String(100))
    acquisition_progress_pct = Column(Numeric(5, 2))
    
    compensation_amount = Column(Numeric(20, 4))
    compensation_status = Column(String(100))
    
    project = relationship("Project", back_populates="land_records")
