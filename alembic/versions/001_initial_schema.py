"""Initial schema: projects, loans, consortium, governance, audit

Revision ID: 001
Revises:
Create Date: 2026-09-21 21:55:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM types for statuses and actions
    op.execute("""
    CREATE TYPE pipelinestatus AS ENUM (
        'proposal_under_pipeline', 'under_review', 'approved', 'dropped',
        'yet_to_start_drawdown', 'under_construction', 'under_operation', 'settled'
    );
    """)

    op.execute("CREATE TYPE projectstage AS ENUM ('feasibility', 'construction', 'operation');")
    op.execute("CREATE TYPE synctype AS ENUM ('realtime_inquiry', 'eod_batch', 'bod_batch');")
    op.execute("""
    CREATE TYPE approvalstate AS ENUM (
        'draft', 'submitted', 'under_recommendation', 'recommended', 'approved',
        'disbursed', 'rejected', 'sent_back'
    );
    """)
    op.execute("""
    CREATE TYPE auditaction AS ENUM (
        'create', 'update', 'submit', 'recommend', 'approve', 'reject', 'send_back',
        'disburse', 'sync', 'export', 'login', 'logout', 'view', 'delete'
    );
    """)

    # Projects
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_code', sa.String(50), unique=True, nullable=False),
        sa.Column('name_en', sa.String(255), nullable=False),
        sa.Column('name_np', sa.String(255), nullable=False),
        sa.Column('province', sa.String(100)),
        sa.Column('district', sa.String(100)),
        sa.Column('local_level', sa.String(100)),
        sa.Column('installed_capacity_mw', sa.Numeric(12, 4), nullable=False),
        sa.Column('project_stage', sa.String(50), nullable=False),
        sa.Column('pipeline_status', sa.String(50), nullable=False),
        sa.Column('original_cod_ad', sa.Date),
        sa.Column('original_cod_bs', sa.String(10)),
        sa.Column('current_approved_cod_ad', sa.Date),
        sa.Column('current_approved_cod_bs', sa.String(10)),
        sa.Column('forecast_cod_ad', sa.Date),
        sa.Column('forecast_cod_bs', sa.String(10)),
        sa.Column('actual_cod_ad', sa.Date),
        sa.Column('actual_cod_bs', sa.String(10)),
        sa.Column('drop_reason', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_project_code', 'projects', ['project_code'])
    op.create_index('ix_pipeline_status', 'projects', ['pipeline_status'])

    # Project Technical Specs
    op.create_table(
        'project_technical_specs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), unique=True, nullable=False),
        sa.Column('design_head_m', sa.Numeric(10, 2)),
        sa.Column('design_discharge_cumecs', sa.Numeric(12, 4)),
        sa.Column('plant_type', sa.String(100)),
        sa.Column('turbine_type', sa.String(100)),
        sa.Column('transmission_km', sa.Numeric(8, 2)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    # Hydrology Records
    op.create_table(
        'hydrology_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('river_name', sa.String(255)),
        sa.Column('river_basin', sa.String(255)),
        sa.Column('sub_basin', sa.String(255)),
        sa.Column('measurement_date_ad', sa.Date),
        sa.Column('measurement_date_bs', sa.String(10)),
        sa.Column('flow_cumecs', sa.Numeric(12, 4)),
        sa.Column('q40_design_flow', sa.Numeric(12, 4)),
        sa.Column('catchment_area_sqkm', sa.Numeric(12, 2)),
        sa.Column('source', sa.String(100)),
        sa.Column('is_verified', sa.String(50), default='unverified'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_hydrology_project', 'hydrology_records', ['project_id'])

    # Water Licenses
    op.create_table(
        'water_licenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('license_number', sa.String(100), unique=True),
        sa.Column('issuing_authority', sa.String(255)),
        sa.Column('river_basin', sa.String(255)),
        sa.Column('validity_from_ad', sa.Date),
        sa.Column('validity_from_bs', sa.String(10)),
        sa.Column('validity_to_ad', sa.Date),
        sa.Column('validity_to_bs', sa.String(10)),
        sa.Column('terms', sa.Text),
        sa.Column('status', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_water_license_project', 'water_licenses', ['project_id'])

    # Land Records
    op.create_table(
        'land_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('plot_id', sa.String(100)),
        sa.Column('ownership_status', sa.String(100)),
        sa.Column('acquisition_progress_pct', sa.Numeric(5, 2)),
        sa.Column('compensation_amount', sa.Numeric(20, 4)),
        sa.Column('compensation_status', sa.String(100)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_land_record_project', 'land_records', ['project_id'])

    # Loan Accounts
    op.create_table(
        'loan_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('finacle_account_id', sa.String(500), unique=True, nullable=False),
        sa.Column('facility_type', sa.String(100)),
        sa.Column('sanctioned_amount', sa.Numeric(20, 4), nullable=False),
        sa.Column('disbursed_amount', sa.Numeric(20, 4), default=0),
        sa.Column('outstanding_principal', sa.Numeric(20, 4), default=0),
        sa.Column('outstanding_interest', sa.Numeric(20, 4), default=0),
        sa.Column('overdue_principal', sa.Numeric(20, 4), default=0),
        sa.Column('overdue_interest', sa.Numeric(20, 4), default=0),
        sa.Column('currency_code', sa.String(3), default='NPR'),
        sa.Column('fx_rate_to_npr', sa.Numeric(18, 8), default=1),
        sa.Column('fx_rate_asof_ad', sa.Date),
        sa.Column('interest_rate_pct', sa.Numeric(7, 4)),
        sa.Column('moratorium_end_ad', sa.Date),
        sa.Column('moratorium_end_bs', sa.String(10)),
        sa.Column('maturity_ad', sa.Date),
        sa.Column('maturity_bs', sa.String(10)),
        sa.Column('last_synced_at', sa.String(100)),
        sa.Column('sync_status', sa.String(50), default='pending'),
        sa.Column('data_provenance', sa.String(50), default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_loan_project', 'loan_accounts', ['project_id'])
    op.create_index('ix_loan_sync', 'loan_accounts', ['sync_status', 'last_synced_at'])

    # Disbursement Tranches
    op.create_table(
        'disbursement_tranches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loan_accounts.id'), nullable=False),
        sa.Column('tranche_no', sa.Integer),
        sa.Column('planned_amount', sa.Numeric(20, 4)),
        sa.Column('actual_amount', sa.Numeric(20, 4)),
        sa.Column('planned_date_ad', sa.Date),
        sa.Column('planned_date_bs', sa.String(10)),
        sa.Column('actual_date_ad', sa.Date),
        sa.Column('actual_date_bs', sa.String(10)),
        sa.Column('pro_rata_share_pct', sa.Numeric(9, 6)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_tranche_loan', 'disbursement_tranches', ['loan_account_id'])

    # Repayments
    op.create_table(
        'repayments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loan_accounts.id'), nullable=False),
        sa.Column('due_date_ad', sa.Date),
        sa.Column('due_date_bs', sa.String(10)),
        sa.Column('principal_due', sa.Numeric(20, 4)),
        sa.Column('interest_due', sa.Numeric(20, 4)),
        sa.Column('principal_paid', sa.Numeric(20, 4), default=0),
        sa.Column('interest_paid', sa.Numeric(20, 4), default=0),
        sa.Column('paid_date_ad', sa.Date),
        sa.Column('paid_date_bs', sa.String(10)),
        sa.Column('days_past_due', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_repayment_loan', 'repayments', ['loan_account_id'])

    # CBS Sync Log
    op.create_table(
        'cbs_sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loan_accounts.id'), nullable=True),
        sa.Column('sync_type', sa.String(50), nullable=False),
        sa.Column('request_ref', sa.String(255)),
        sa.Column('response_code', sa.String(50)),
        sa.Column('started_at', sa.String(100)),
        sa.Column('completed_at', sa.String(100)),
        sa.Column('record_count', sa.Integer, default=0),
        sa.Column('raw_payload', sa.String(10000)),
        sa.Column('error_detail', sa.Text),
        sa.Column('retry_count', sa.Integer, default=0),
        sa.Column('dlq_flag', sa.String(50), default='ok'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_cbs_sync_dlq', 'cbs_sync_logs', ['dlq_flag'])

    # Budget Lines
    op.create_table(
        'budget_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('category', sa.String(100)),
        sa.Column('budgeted_amount', sa.Numeric(20, 4)),
        sa.Column('actual_amount', sa.Numeric(20, 4), default=0),
        sa.Column('variance_amount', sa.Numeric(20, 4)),
        sa.Column('variance_pct', sa.Numeric(7, 4)),
        sa.Column('upload_batch_id', sa.String(255)),
        sa.Column('data_provenance', sa.String(50), default='MANUAL_ENTRY'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_budget_project', 'budget_lines', ['project_id'])

    # Consortium Facilities
    op.create_table(
        'consortium_facilities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, unique=True),
        sa.Column('facility_name', sa.String(255), nullable=False),
        sa.Column('total_facility_limit', sa.Numeric(20, 4), nullable=False),
        sa.Column('currency_code', sa.String(3), default='NPR'),
        sa.Column('sbl_role', sa.String(50), nullable=False),
        sa.Column('lead_bank_name', sa.String(255)),
        sa.Column('facility_agreement_date_ad', sa.Date),
        sa.Column('facility_agreement_date_bs', sa.String(10)),
        sa.Column('security_type', sa.String(100)),
        sa.Column('charge_ranking', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    # Consortium Members
    op.create_table(
        'consortium_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('consortium_facility_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('consortium_facilities.id'), nullable=False),
        sa.Column('institution_name', sa.String(255), nullable=False),
        sa.Column('institution_type', sa.String(100)),
        sa.Column('is_lead', sa.Boolean, default=False),
        sa.Column('is_current', sa.Boolean, default=True),
        sa.Column('committed_amount', sa.Numeric(20, 4), nullable=False),
        sa.Column('share_pct', sa.Numeric(9, 6), nullable=False),
        sa.Column('disbursed_to_date', sa.Numeric(20, 4), default=0),
        sa.Column('valid_from_ad', sa.Date, nullable=False),
        sa.Column('valid_from_bs', sa.String(10)),
        sa.Column('valid_to_ad', sa.Date),
        sa.Column('valid_to_bs', sa.String(10)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_consortium_current', 'consortium_members', ['consortium_facility_id', 'is_current'])
    op.create_index('ix_consortium_effective', 'consortium_members', ['valid_from_ad', 'valid_to_ad'])

    # Audit Logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.BIGINT, primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('user_role', sa.String(100)),
        sa.Column('source_ip', sa.String(50)),
        sa.Column('session_id', sa.String(255)),
        sa.Column('timestamp', sa.String(100), nullable=False, server_default='now()'),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(255), nullable=False),
        sa.Column('action_performed', sa.String(50), nullable=False),
        sa.Column('reason_for_action', sa.Text, nullable=False),
        sa.Column('pre_state', sa.String(10000)),
        sa.Column('post_state', sa.String(10000)),
        sa.Column('state_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('prev_hash', sa.String(64)),
    )
    op.create_index('ix_audit_user', 'audit_logs', ['user_id', 'action_performed', 'timestamp'])
    op.create_index('ix_audit_entity', 'audit_logs', ['entity_type', 'entity_id', 'action_performed'])

    # Audit Log Reads
    op.create_table(
        'audit_log_reads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('timestamp', sa.String(100), nullable=False, server_default='now()'),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(255), nullable=False),
        sa.Column('export_format', sa.String(50)),
        sa.Column('record_count', sa.Integer),
    )
    op.create_index('ix_read_user_ts', 'audit_log_reads', ['user_id', 'timestamp'])

    # Roles
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), unique=True, nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    # Permissions
    op.create_table(
        'permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('field_name', sa.String(255)),
        sa.Column('access_level', sa.String(50), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_permission_unique', 'permissions', ['entity_type', 'field_name', 'access_level'], unique=True)

    # Role Permissions
    op.create_table(
        'role_permissions',
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id'), primary_key=True),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('permissions.id'), primary_key=True),
    )

    # Workflow Definitions
    op.create_table(
        'workflow_definitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), unique=True, nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('workflow_steps', sa.String(10000)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('version', sa.Integer, default=1),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_workflow_entity', 'workflow_definitions', ['entity_type'])

    # Approval Requests
    op.create_table(
        'approval_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workflow_definitions.id'), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(255), nullable=False),
        sa.Column('current_state', sa.String(50), nullable=False, default='draft'),
        sa.Column('maker_id', sa.String(255), nullable=False),
        sa.Column('recommender_id', sa.String(255)),
        sa.Column('approver_id', sa.String(255)),
        sa.Column('submitted_at', sa.String(100)),
        sa.Column('completed_at', sa.String(100)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_approval_entity', 'approval_requests', ['entity_type', 'entity_id', 'current_state'])

    # Approval Steps
    op.create_table(
        'approval_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('approval_request_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('approval_requests.id'), nullable=False),
        sa.Column('step_no', sa.Integer),
        sa.Column('actor_id', sa.String(255), nullable=False),
        sa.Column('actor_role', sa.String(100)),
        sa.Column('from_state', sa.String(50)),
        sa.Column('to_state', sa.String(50), nullable=False),
        sa.Column('acted_at', sa.String(100)),
        sa.Column('remarks', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_approval_step_request', 'approval_steps', ['approval_request_id'])

    print("✓ Initial schema created")


def downgrade() -> None:
    # Drop all tables
    op.drop_table('approval_steps')
    op.drop_table('approval_requests')
    op.drop_table('workflow_definitions')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
    op.drop_table('roles')
    op.drop_table('audit_log_reads')
    op.drop_table('audit_logs')
    op.drop_table('consortium_members')
    op.drop_table('consortium_facilities')
    op.drop_table('budget_lines')
    op.drop_table('cbs_sync_logs')
    op.drop_table('repayments')
    op.drop_table('disbursement_tranches')
    op.drop_table('loan_accounts')
    op.drop_table('land_records')
    op.drop_table('water_licenses')
    op.drop_table('hydrology_records')
    op.drop_table('project_technical_specs')
    op.drop_table('projects')

    # Drop ENUM types
    op.execute("DROP TYPE IF EXISTS auditaction;")
    op.execute("DROP TYPE IF EXISTS approvalstate;")
    op.execute("DROP TYPE IF EXISTS synctype;")
    op.execute("DROP TYPE IF EXISTS projectstage;")
    op.execute("DROP TYPE IF EXISTS pipelinestatus;")
