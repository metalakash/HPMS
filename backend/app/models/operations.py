"""Operations data models for Generation, PPA, Hydrology, Land, ESG, and Maintenance."""
from sqlalchemy import Column, String, Numeric, Integer, Date, Text, ForeignKey, Index, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import date
import uuid
from decimal import Decimal
from .base import Base, TimestampedMixin


# ============================================================================
# Generation & PPA Models
# ============================================================================

class PPAAgreement(Base, TimestampedMixin):
    """Power Purchase Agreement with NEA or private buyers."""

    __tablename__ = 'ppa_agreements'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    agreement_number = Column(String(100), unique=True, nullable=False)
    purchaser = Column(String(255), nullable=False)  # NEA, private utility, etc.

    effective_date_ad = Column(Date, nullable=False)
    effective_date_bs = Column(String(10))
    expiry_date_ad = Column(Date)
    expiry_date_bs = Column(String(10))

    tariff_type = Column(String(50))  # ROR (Run of River), PROR, Hybrid, etc.
    escalation_pct_annual = Column(Numeric(7, 4), default=Decimal("0"))  # Annual escalation

    status = Column(String(50), default='active', index=True)  # active, expired, renewed
    renewal_date_ad = Column(Date)
    renewal_date_bs = Column(String(10))

    # Data provenance
    data_provenance = Column(String(50), default='MANUAL_ENTRY')
    source_reference = Column(String(255))
    created_by = Column(String(255))
    updated_by = Column(String(255))

    project = relationship("Project", back_populates="ppa_agreements")
    generation_data = relationship("EnergyGenerationData", back_populates="ppa_agreement")
    tariff_structures = relationship("TariffStructure", back_populates="ppa_agreement")

    __table_args__ = (
        Index('ix_ppa_project_status', 'project_id', 'status'),
        Index('ix_ppa_expiry_date', 'expiry_date_ad'),
    )


class EnergyGenerationData(Base, TimestampedMixin):
    """Monthly energy generation data with performance metrics."""

    __tablename__ = 'energy_generation_data'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    ppa_agreement_id = Column(UUID(as_uuid=True), ForeignKey('ppa_agreements.id'))

    month_ad = Column(Date, nullable=False)  # First day of month for sorting
    month_bs = Column(String(10))
    season = Column(String(20))  # wet, dry

    contract_energy_mwh = Column(Numeric(14, 2))  # Contractually expected
    actual_energy_mwh = Column(Numeric(14, 2), nullable=False)  # Actual generation

    availability_pct = Column(Numeric(5, 2))  # Plant availability percentage
    curtailment_mwh = Column(Numeric(14, 2), default=Decimal("0"))  # NEA curtailment

    revenue_npr = Column(Numeric(18, 2))  # Calculated as actual_mwh * tariff_rate

    # Data provenance
    data_provenance = Column(String(50), default='MANUAL_ENTRY')
    source_reference = Column(String(255))  # SCADA export, manual reading, etc.

    ppa_agreement = relationship("PPAAgreement", back_populates="generation_data")

    __table_args__ = (
        Index('ix_generation_project_month', 'project_id', 'month_ad'),
        Index('ix_generation_season', 'project_id', 'season', 'month_ad'),
        UniqueConstraint('project_id', 'month_ad', name='uq_generation_project_month'),
    )


class NEAPPARate(Base, TimestampedMixin):
    """NEA tariff rates for reference (used in revenue calculations)."""

    __tablename__ = 'nea_ppa_rates'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    valid_from_ad = Column(Date, nullable=False)
    valid_from_bs = Column(String(10))
    valid_to_ad = Column(Date)
    valid_to_bs = Column(String(10))

    season = Column(String(20))  # wet, dry, or null for flat year-round
    rate_per_mwh_npr = Column(Numeric(10, 4), nullable=False)  # NPR per MWh

    fixed_charge_npr = Column(Numeric(18, 2), default=Decimal("0"))  # Monthly fixed charge
    variable_charge_pct = Column(Numeric(5, 4), default=Decimal("0"))  # % surcharge

    is_current = Column(Boolean, default=True, index=True)

    # Data provenance
    data_provenance = Column(String(50), default='NEA_OFFICIAL')
    source_reference = Column(String(255))

    __table_args__ = (
        Index('ix_nea_rates_project_current', 'project_id', 'is_current'),
        Index('ix_nea_rates_validity', 'valid_from_ad', 'valid_to_ad'),
    )


class TariffStructure(Base, TimestampedMixin):
    """Tariff structure configuration for revenue calculation."""

    __tablename__ = 'tariff_structures'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    ppa_agreement_id = Column(UUID(as_uuid=True), ForeignKey('ppa_agreements.id'))

    structure_type = Column(String(50))  # seasonal, fixed, tiered, etc.

    fixed_component_npr = Column(Numeric(18, 4), default=Decimal("0"))  # Fixed monthly charge
    variable_component_npr = Column(Numeric(10, 6), default=Decimal("0"))  # Per MWh rate

    escalation_formula = Column(Text)  # e.g., "3% annual" or JSON formula

    valid_from_ad = Column(Date)
    valid_to_ad = Column(Date)
    is_current = Column(Boolean, default=True, index=True)

    ppa_agreement = relationship("PPAAgreement", back_populates="tariff_structures")

    __table_args__ = (
        Index('ix_tariff_project_current', 'project_id', 'is_current'),
    )


# ============================================================================
# Hydrology Models (Extend existing hydrology_records)
# ============================================================================

class HydrologyDetailed(Base, TimestampedMixin):
    """Extended hydrology data with flow curves and detailed basin info."""

    __tablename__ = 'hydrology_detailed'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    river_basin = Column(String(255), nullable=False)  # Koshi, Gandaki, Karnali, etc.
    sub_basin = Column(String(255))

    catchment_area_sqkm = Column(Numeric(12, 2))  # Sq km
    design_discharge_m3s = Column(Numeric(12, 4))  # Q90 design flow (m³/s)
    median_flow_m3s = Column(Numeric(12, 4))  # Q50 median flow (m³/s)

    flow_duration_curve_url = Column(String(500))  # Reference to stored file/chart

    measurement_date_ad = Column(Date)
    measurement_date_bs = Column(String(10))

    # Data provenance
    data_provenance = Column(String(50), default='CONSULTANT_REPORT')
    source_reference = Column(String(255))  # DPR, DHM report, etc.

    __table_args__ = (
        Index('ix_hydrology_project', 'project_id'),
        Index('ix_hydrology_basin', 'river_basin'),
    )


# ============================================================================
# Land & Governance Models
# ============================================================================

class LandAcquisitionTracking(Base, TimestampedMixin):
    """Land acquisition progress and compensation tracking."""

    __tablename__ = 'land_acquisition_tracking'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True, unique=True)

    total_area_required_ropani = Column(Numeric(12, 2), nullable=False)
    total_area_acquired_ropani = Column(Numeric(12, 2), default=Decimal("0"))
    acquisition_pct = Column(Numeric(5, 2), default=Decimal("0"))  # 0-100%

    compensation_paid_npr = Column(Numeric(20, 4), default=Decimal("0"))
    compensation_outstanding_npr = Column(Numeric(20, 4), default=Decimal("0"))

    last_update_date_ad = Column(Date)
    last_update_date_bs = Column(String(10))

    updated_by = Column(String(255))
    remarks = Column(Text)

    __table_args__ = (
        Index('ix_land_project', 'project_id'),
    )


class BoardOfDirectors(Base, TimestampedMixin):
    """Board of Directors composition."""

    __tablename__ = 'board_of_directors'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    director_name = Column(String(255), nullable=False)
    title = Column(String(100))  # Chairman, MD, Director, etc.

    appointment_date_ad = Column(Date)
    appointment_date_bs = Column(String(10))

    resignation_date_ad = Column(Date)
    resignation_date_bs = Column(String(10))

    is_current = Column(Boolean, default=True, index=True)

    seon_reference = Column(String(100))  # Company Registrar reference

    __table_args__ = (
        Index('ix_bod_project_current', 'project_id', 'is_current'),
    )


class ShareholdingHierarchy(Base, TimestampedMixin):
    """Shareholding structure and ownership hierarchy."""

    __tablename__ = 'shareholding_hierarchy'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    entity_name = Column(String(255), nullable=False)
    entity_type = Column(String(100))  # individual, company, promoter, etc.

    share_pct = Column(Numeric(7, 4), nullable=False)  # 0-100%

    effective_from_ad = Column(Date, nullable=False)
    effective_from_bs = Column(String(10))

    effective_to_ad = Column(Date)
    effective_to_bs = Column(String(10))
    is_current = Column(Boolean, default=True, index=True)

    seon_reference = Column(String(100))  # Company Registrar reference

    __table_args__ = (
        Index('ix_shareholding_project_current', 'project_id', 'is_current'),
    )


# ============================================================================
# ESG Models
# ============================================================================

class ESGMetrics(Base, TimestampedMixin):
    """Environmental, Social, Governance metrics."""

    __tablename__ = 'esg_metrics'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    metric_date_ad = Column(Date, nullable=False)
    metric_date_bs = Column(String(10))

    # Environmental
    carbon_credits_generated = Column(Numeric(14, 2), default=Decimal("0"))  # tonnes CO2e
    ghg_emissions_avoided_tonnes = Column(Numeric(14, 2), default=Decimal("0"))  # Annual
    co2_avoided_tonnes_per_year = Column(Numeric(14, 2))  # Calculated

    # Social
    local_employment_count = Column(Integer, default=0)
    community_grievance_count = Column(Integer, default=0)
    grievance_resolution_rate_pct = Column(Numeric(5, 2))  # 0-100%

    # Data provenance
    data_provenance = Column(String(50), default='MANUAL_ENTRY')
    source_reference = Column(String(255))

    __table_args__ = (
        Index('ix_esg_project_date', 'project_id', 'metric_date_ad'),
    )


class EIAMitigationChecklist(Base, TimestampedMixin):
    """Environmental Impact Assessment mitigation measures tracking."""

    __tablename__ = 'eia_mitigation_checklist'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    mitigation_measure = Column(String(500), nullable=False)
    description = Column(Text)

    status = Column(String(50), default='planned', index=True)  # planned, in_progress, completed
    completion_pct = Column(Numeric(5, 2), default=Decimal("0"))  # 0-100%

    responsible_party = Column(String(255))
    due_date_ad = Column(Date)
    due_date_bs = Column(String(10))

    completion_date_ad = Column(Date)
    completion_date_bs = Column(String(10))

    created_by = Column(String(255))
    updated_by = Column(String(255))

    __table_args__ = (
        Index('ix_eia_project_status', 'project_id', 'status'),
    )


# ============================================================================
# Maintenance Models
# ============================================================================

class MaintenanceSchedule(Base, TimestampedMixin):
    """Planned maintenance schedules."""

    __tablename__ = 'maintenance_schedules'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    equipment_name = Column(String(255), nullable=False)
    maintenance_type = Column(String(100))  # preventive, corrective, predictive

    scheduled_date_ad = Column(Date, nullable=False, index=True)
    scheduled_date_bs = Column(String(10))

    estimated_duration_hours = Column(Integer)
    estimated_impact_mwh = Column(Numeric(14, 2))  # Estimated generation loss

    contractor_name = Column(String(255))

    status = Column(String(50), default='scheduled', index=True)  # scheduled, in_progress, completed, cancelled

    created_by = Column(String(255))
    updated_by = Column(String(255))

    __table_args__ = (
        Index('ix_maint_sched_project_date', 'project_id', 'scheduled_date_ad'),
        Index('ix_maint_sched_status', 'project_id', 'status'),
    )


class MaintenanceLog(Base, TimestampedMixin):
    """Executed maintenance activities and history."""

    __tablename__ = 'maintenance_logs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)
    maintenance_schedule_id = Column(UUID(as_uuid=True), ForeignKey('maintenance_schedules.id'))

    equipment_name = Column(String(255), nullable=False)
    maintenance_type = Column(String(100))

    actual_date_ad = Column(Date, nullable=False)
    actual_date_bs = Column(String(10))

    duration_hours = Column(Integer)
    downtime_mwh = Column(Numeric(14, 2))  # Actual generation loss

    contractor_name = Column(String(255))
    cost_npr = Column(Numeric(18, 2), default=Decimal("0"))

    notes = Column(Text)

    created_by = Column(String(255))

    __table_args__ = (
        Index('ix_maint_log_project_date', 'project_id', 'actual_date_ad'),
    )


class PlantPerformance(Base, TimestampedMixin):
    """Monthly plant performance metrics (availability, efficiency, PLF)."""

    __tablename__ = 'plant_performance'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    month_ad = Column(Date, nullable=False)  # First day of month
    month_bs = Column(String(10))

    efficiency_pct = Column(Numeric(5, 2))  # Plant efficiency 0-100%
    availability_pct = Column(Numeric(5, 2))  # Hours available / total hours * 100

    availability_hours = Column(Integer)  # Hours available for generation
    outage_hours = Column(Integer)  # Total outage hours (planned + forced)

    forced_outage_count = Column(Integer, default=0)
    forced_outage_hours = Column(Integer, default=0)

    scheduled_maintenance_outage_hours = Column(Integer, default=0)

    plf_pct = Column(Numeric(5, 2))  # Plant Load Factor (actual_gen / max_gen * 100)

    data_provenance = Column(String(50), default='SCADA')
    source_reference = Column(String(255))

    __table_args__ = (
        Index('ix_perf_project_month', 'project_id', 'month_ad'),
        UniqueConstraint('project_id', 'month_ad', name='uq_perf_project_month'),
    )


# ============================================================================
# Covenant History (for trend analysis)
# ============================================================================

class CovenantHistory(Base, TimestampedMixin):
    """Quarterly covenant metric history for trend analysis."""

    __tablename__ = 'covenant_history'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False, index=True)

    quarter_ad = Column(String(10), nullable=False)  # e.g., "2026-Q3"
    quarter_bs = Column(String(10))  # e.g., "2083-Q3"
    covenant_date_ad = Column(Date)
    covenant_date_bs = Column(String(10))

    # DSCR - Debt Service Coverage Ratio
    dscr_value = Column(Numeric(10, 4))
    dscr_threshold = Column(Numeric(10, 4))
    dscr_status = Column(String(50))  # compliant, warning, breached

    # LTV - Loan-to-Value ratio
    ltv_value = Column(Numeric(10, 4))
    ltv_threshold = Column(Numeric(10, 4))
    ltv_status = Column(String(50))  # compliant, warning, breached

    # ICR - Interest Coverage Ratio
    icr_value = Column(Numeric(10, 4))
    icr_threshold = Column(Numeric(10, 4))
    icr_status = Column(String(50))  # compliant, warning, breached

    calculation_date_ad = Column(Date)
    data_provenance = Column(String(50), default='CALCULATED')
    source_reference = Column(String(255))

    __table_args__ = (
        Index('ix_covenant_project_quarter', 'project_id', 'quarter_ad'),
        UniqueConstraint('project_id', 'quarter_ad', name='uq_covenant_project_quarter'),
    )


# ============================================================================
# Update Project model relationships (reference at bottom)
# ============================================================================

# Note: Add these relationships to the Project model in project.py:
# ppa_agreements = relationship("PPAAgreement", back_populates="project")
# energy_generation_data = relationship("EnergyGenerationData", back_populates="project")
# nea_ppa_rates = relationship("NEAPPARate", back_populates="project")
# hydrology_detailed = relationship("HydrologyDetailed", back_populates="project")
# land_acquisition = relationship("LandAcquisitionTracking", back_populates="project", uselist=False)
# board_members = relationship("BoardOfDirectors", back_populates="project")
# shareholders = relationship("ShareholdingHierarchy", back_populates="project")
# esg_metrics = relationship("ESGMetrics", back_populates="project")
# eia_mitigations = relationship("EIAMitigationChecklist", back_populates="project")
# maintenance_schedules = relationship("MaintenanceSchedule", back_populates="project")
# maintenance_logs = relationship("MaintenanceLog", back_populates="project")
# plant_performance = relationship("PlantPerformance", back_populates="project")
# covenant_history = relationship("CovenantHistory", back_populates="project")
