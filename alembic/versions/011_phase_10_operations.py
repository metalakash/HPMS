"""Phase 10: Operations - Add Generation, PPA, Hydrology, Land, ESG, Maintenance tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

# revision identifiers, used by Alembic.
revision = '011_phase_10_operations'
down_revision = '010_phase_8_4_etl'
branch_labels = None
depends_on = None


def upgrade():
    """Create Phase 10 Operations tables."""

    # ============================================================================
    # Generation & PPA Tables
    # ============================================================================

    op.create_table(
        'ppa_agreements',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('agreement_number', sa.String(100), unique=True, nullable=False),
        sa.Column('purchaser', sa.String(255), nullable=False),
        sa.Column('effective_date_ad', sa.Date, nullable=False),
        sa.Column('effective_date_bs', sa.String(10)),
        sa.Column('expiry_date_ad', sa.Date),
        sa.Column('expiry_date_bs', sa.String(10)),
        sa.Column('tariff_type', sa.String(50)),
        sa.Column('escalation_pct_annual', sa.Numeric(7, 4), server_default='0'),
        sa.Column('status', sa.String(50), server_default='active', index=True),
        sa.Column('renewal_date_ad', sa.Date),
        sa.Column('renewal_date_bs', sa.String(10)),
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_ppa_project_status', 'ppa_agreements', ['project_id', 'status'])
    op.create_index('ix_ppa_expiry_date', 'ppa_agreements', ['expiry_date_ad'])

    op.create_table(
        'energy_generation_data',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('ppa_agreement_id', UUID(as_uuid=True), sa.ForeignKey('ppa_agreements.id')),
        sa.Column('month_ad', sa.Date, nullable=False),
        sa.Column('month_bs', sa.String(10)),
        sa.Column('season', sa.String(20)),
        sa.Column('contract_energy_mwh', sa.Numeric(14, 2)),
        sa.Column('actual_energy_mwh', sa.Numeric(14, 2), nullable=False),
        sa.Column('availability_pct', sa.Numeric(5, 2)),
        sa.Column('curtailment_mwh', sa.Numeric(14, 2), server_default='0'),
        sa.Column('revenue_npr', sa.Numeric(18, 2)),
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('project_id', 'month_ad', name='uq_generation_project_month'),
    )
    op.create_index('ix_generation_project_month', 'energy_generation_data', ['project_id', 'month_ad'])
    op.create_index('ix_generation_season', 'energy_generation_data', ['project_id', 'season', 'month_ad'])

    op.create_table(
        'nea_ppa_rates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('valid_from_ad', sa.Date, nullable=False),
        sa.Column('valid_from_bs', sa.String(10)),
        sa.Column('valid_to_ad', sa.Date),
        sa.Column('valid_to_bs', sa.String(10)),
        sa.Column('season', sa.String(20)),
        sa.Column('rate_per_mwh_npr', sa.Numeric(10, 4), nullable=False),
        sa.Column('fixed_charge_npr', sa.Numeric(18, 2), server_default='0'),
        sa.Column('variable_charge_pct', sa.Numeric(5, 4), server_default='0'),
        sa.Column('is_current', sa.Boolean, server_default='true', index=True),
        sa.Column('data_provenance', sa.String(50), server_default='NEA_OFFICIAL'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_nea_rates_project_current', 'nea_ppa_rates', ['project_id', 'is_current'])
    op.create_index('ix_nea_rates_validity', 'nea_ppa_rates', ['valid_from_ad', 'valid_to_ad'])

    op.create_table(
        'tariff_structures',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('ppa_agreement_id', UUID(as_uuid=True), sa.ForeignKey('ppa_agreements.id')),
        sa.Column('structure_type', sa.String(50)),
        sa.Column('fixed_component_npr', sa.Numeric(18, 4), server_default='0'),
        sa.Column('variable_component_npr', sa.Numeric(10, 6), server_default='0'),
        sa.Column('escalation_formula', sa.Text),
        sa.Column('valid_from_ad', sa.Date),
        sa.Column('valid_to_ad', sa.Date),
        sa.Column('is_current', sa.Boolean, server_default='true', index=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_tariff_project_current', 'tariff_structures', ['project_id', 'is_current'])

    # ============================================================================
    # Hydrology, Land & Governance Tables
    # ============================================================================

    op.create_table(
        'hydrology_detailed',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('river_basin', sa.String(255), nullable=False),
        sa.Column('sub_basin', sa.String(255)),
        sa.Column('catchment_area_sqkm', sa.Numeric(12, 2)),
        sa.Column('design_discharge_m3s', sa.Numeric(12, 4)),
        sa.Column('median_flow_m3s', sa.Numeric(12, 4)),
        sa.Column('flow_duration_curve_url', sa.String(500)),
        sa.Column('measurement_date_ad', sa.Date),
        sa.Column('measurement_date_bs', sa.String(10)),
        sa.Column('data_provenance', sa.String(50), server_default='CONSULTANT_REPORT'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    # Note: hydrology_detailed already has indexes from existing table
    # op.create_index('ix_hydrology_project', 'hydrology_detailed', ['project_id'])
    # op.create_index('ix_hydrology_basin', 'hydrology_detailed', ['river_basin'])

    op.create_table(
        'land_acquisition_tracking',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True, unique=True),
        sa.Column('total_area_required_ropani', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_area_acquired_ropani', sa.Numeric(12, 2), server_default='0'),
        sa.Column('acquisition_pct', sa.Numeric(5, 2), server_default='0'),
        sa.Column('compensation_paid_npr', sa.Numeric(20, 4), server_default='0'),
        sa.Column('compensation_outstanding_npr', sa.Numeric(20, 4), server_default='0'),
        sa.Column('last_update_date_ad', sa.Date),
        sa.Column('last_update_date_bs', sa.String(10)),
        sa.Column('updated_by', sa.String(255)),
        sa.Column('remarks', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_land_project', 'land_acquisition_tracking', ['project_id'])

    op.create_table(
        'board_of_directors',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('director_name', sa.String(255), nullable=False),
        sa.Column('title', sa.String(100)),
        sa.Column('appointment_date_ad', sa.Date),
        sa.Column('appointment_date_bs', sa.String(10)),
        sa.Column('resignation_date_ad', sa.Date),
        sa.Column('resignation_date_bs', sa.String(10)),
        sa.Column('is_current', sa.Boolean, server_default='true', index=True),
        sa.Column('seon_reference', sa.String(100)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_bod_project_current', 'board_of_directors', ['project_id', 'is_current'])

    op.create_table(
        'shareholding_hierarchy',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('entity_name', sa.String(255), nullable=False),
        sa.Column('entity_type', sa.String(100)),
        sa.Column('share_pct', sa.Numeric(7, 4), nullable=False),
        sa.Column('effective_from_ad', sa.Date, nullable=False),
        sa.Column('effective_from_bs', sa.String(10)),
        sa.Column('effective_to_ad', sa.Date),
        sa.Column('effective_to_bs', sa.String(10)),
        sa.Column('is_current', sa.Boolean, server_default='true', index=True),
        sa.Column('seon_reference', sa.String(100)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_shareholding_project_current', 'shareholding_hierarchy', ['project_id', 'is_current'])

    # ============================================================================
    # ESG & Maintenance Tables
    # ============================================================================

    op.create_table(
        'esg_metrics',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('metric_date_ad', sa.Date, nullable=False),
        sa.Column('metric_date_bs', sa.String(10)),
        sa.Column('carbon_credits_generated', sa.Numeric(14, 2), server_default='0'),
        sa.Column('ghg_emissions_avoided_tonnes', sa.Numeric(14, 2), server_default='0'),
        sa.Column('co2_avoided_tonnes_per_year', sa.Numeric(14, 2)),
        sa.Column('local_employment_count', sa.Integer, server_default='0'),
        sa.Column('community_grievance_count', sa.Integer, server_default='0'),
        sa.Column('grievance_resolution_rate_pct', sa.Numeric(5, 2)),
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_esg_project_date', 'esg_metrics', ['project_id', 'metric_date_ad'])

    op.create_table(
        'eia_mitigation_checklist',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('mitigation_measure', sa.String(500), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('status', sa.String(50), server_default='planned', index=True),
        sa.Column('completion_pct', sa.Numeric(5, 2), server_default='0'),
        sa.Column('responsible_party', sa.String(255)),
        sa.Column('due_date_ad', sa.Date),
        sa.Column('due_date_bs', sa.String(10)),
        sa.Column('completion_date_ad', sa.Date),
        sa.Column('completion_date_bs', sa.String(10)),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_eia_project_status', 'eia_mitigation_checklist', ['project_id', 'status'])

    op.create_table(
        'maintenance_schedules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('equipment_name', sa.String(255), nullable=False),
        sa.Column('maintenance_type', sa.String(100)),
        sa.Column('scheduled_date_ad', sa.Date, nullable=False, index=True),
        sa.Column('scheduled_date_bs', sa.String(10)),
        sa.Column('estimated_duration_hours', sa.Integer),
        sa.Column('estimated_impact_mwh', sa.Numeric(14, 2)),
        sa.Column('contractor_name', sa.String(255)),
        sa.Column('status', sa.String(50), server_default='scheduled', index=True),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_maint_sched_project_date', 'maintenance_schedules', ['project_id', 'scheduled_date_ad'])
    op.create_index('ix_maint_sched_status', 'maintenance_schedules', ['project_id', 'status'])

    op.create_table(
        'maintenance_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('maintenance_schedule_id', UUID(as_uuid=True), sa.ForeignKey('maintenance_schedules.id')),
        sa.Column('equipment_name', sa.String(255), nullable=False),
        sa.Column('maintenance_type', sa.String(100)),
        sa.Column('actual_date_ad', sa.Date, nullable=False),
        sa.Column('actual_date_bs', sa.String(10)),
        sa.Column('duration_hours', sa.Integer),
        sa.Column('downtime_mwh', sa.Numeric(14, 2)),
        sa.Column('contractor_name', sa.String(255)),
        sa.Column('cost_npr', sa.Numeric(18, 2), server_default='0'),
        sa.Column('notes', sa.Text),
        sa.Column('created_by', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_maint_log_project_date', 'maintenance_logs', ['project_id', 'actual_date_ad'])

    op.create_table(
        'plant_performance',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('month_ad', sa.Date, nullable=False),
        sa.Column('month_bs', sa.String(10)),
        sa.Column('efficiency_pct', sa.Numeric(5, 2)),
        sa.Column('availability_pct', sa.Numeric(5, 2)),
        sa.Column('availability_hours', sa.Integer),
        sa.Column('outage_hours', sa.Integer),
        sa.Column('forced_outage_count', sa.Integer, server_default='0'),
        sa.Column('forced_outage_hours', sa.Integer, server_default='0'),
        sa.Column('scheduled_maintenance_outage_hours', sa.Integer, server_default='0'),
        sa.Column('plf_pct', sa.Numeric(5, 2)),
        sa.Column('data_provenance', sa.String(50), server_default='SCADA'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('project_id', 'month_ad', name='uq_perf_project_month'),
    )
    op.create_index('ix_perf_project_month', 'plant_performance', ['project_id', 'month_ad'])

    # ============================================================================
    # Covenant History Table
    # ============================================================================

    op.create_table(
        'covenant_history',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('quarter_ad', sa.String(10), nullable=False),
        sa.Column('quarter_bs', sa.String(10)),
        sa.Column('covenant_date_ad', sa.Date),
        sa.Column('covenant_date_bs', sa.String(10)),
        sa.Column('dscr_value', sa.Numeric(10, 4)),
        sa.Column('dscr_threshold', sa.Numeric(10, 4)),
        sa.Column('dscr_status', sa.String(50)),
        sa.Column('ltv_value', sa.Numeric(10, 4)),
        sa.Column('ltv_threshold', sa.Numeric(10, 4)),
        sa.Column('ltv_status', sa.String(50)),
        sa.Column('icr_value', sa.Numeric(10, 4)),
        sa.Column('icr_threshold', sa.Numeric(10, 4)),
        sa.Column('icr_status', sa.String(50)),
        sa.Column('calculation_date_ad', sa.Date),
        sa.Column('data_provenance', sa.String(50), server_default='CALCULATED'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('project_id', 'quarter_ad', name='uq_covenant_project_quarter'),
    )
    op.create_index('ix_covenant_project_quarter', 'covenant_history', ['project_id', 'quarter_ad'])


def downgrade():
    """Drop Phase 10 Operations tables."""
    op.drop_index('ix_covenant_project_quarter', table_name='covenant_history')
    op.drop_table('covenant_history')

    op.drop_index('ix_perf_project_month', table_name='plant_performance')
    op.drop_table('plant_performance')

    op.drop_index('ix_maint_log_project_date', table_name='maintenance_logs')
    op.drop_table('maintenance_logs')

    op.drop_index('ix_maint_sched_project_date', table_name='maintenance_schedules')
    op.drop_index('ix_maint_sched_status', table_name='maintenance_schedules')
    op.drop_table('maintenance_schedules')

    op.drop_index('ix_eia_project_status', table_name='eia_mitigation_checklist')
    op.drop_table('eia_mitigation_checklist')

    op.drop_index('ix_esg_project_date', table_name='esg_metrics')
    op.drop_table('esg_metrics')

    op.drop_index('ix_shareholding_project_current', table_name='shareholding_hierarchy')
    op.drop_table('shareholding_hierarchy')

    op.drop_index('ix_bod_project_current', table_name='board_of_directors')
    op.drop_table('board_of_directors')

    op.drop_index('ix_land_project', table_name='land_acquisition_tracking')
    op.drop_table('land_acquisition_tracking')

    op.drop_index('ix_hydrology_project', table_name='hydrology_detailed')
    op.drop_index('ix_hydrology_basin', table_name='hydrology_detailed')
    op.drop_table('hydrology_detailed')

    op.drop_index('ix_tariff_project_current', table_name='tariff_structures')
    op.drop_table('tariff_structures')

    op.drop_index('ix_nea_rates_project_current', table_name='nea_ppa_rates')
    op.drop_index('ix_nea_rates_validity', table_name='nea_ppa_rates')
    op.drop_table('nea_ppa_rates')

    op.drop_index('ix_generation_project_month', table_name='energy_generation_data')
    op.drop_index('ix_generation_season', table_name='energy_generation_data')
    op.drop_table('energy_generation_data')

    op.drop_index('ix_ppa_project_status', table_name='ppa_agreements')
    op.drop_index('ix_ppa_expiry_date', table_name='ppa_agreements')
    op.drop_table('ppa_agreements')
