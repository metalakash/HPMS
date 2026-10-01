"""Phase 11: milestones, risk register, insurance, permits, ESIA monitoring, community engagement."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = '012_phase_11_risk_domain'
down_revision = '011_phase_10_operations'
branch_labels = None
depends_on = None


def _audit_cols():
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    ]


def _pk():
    return sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _project_fk():
    return sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True)


def upgrade():
    op.create_table(
        'milestones', _pk(), _project_fk(),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(50)),
        sa.Column('sequence', sa.Integer, server_default='0'),
        sa.Column('planned_date_ad', sa.Date, nullable=False),
        sa.Column('planned_date_bs', sa.String(10)),
        sa.Column('forecast_date_ad', sa.Date),
        sa.Column('forecast_date_bs', sa.String(10)),
        sa.Column('actual_date_ad', sa.Date),
        sa.Column('actual_date_bs', sa.String(10)),
        sa.Column('status', sa.String(30), server_default='planned', index=True),
        sa.Column('percent_complete', sa.Numeric(5, 2), server_default='0'),
        sa.Column('remarks', sa.Text),
        *_audit_cols(),
    )
    op.create_index('ix_milestone_project_planned', 'milestones', ['project_id', 'planned_date_ad'])

    op.create_table(
        'risk_register', _pk(), _project_fk(),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('risk_type', sa.String(30), nullable=False, index=True),
        sa.Column('likelihood', sa.Integer, nullable=False),
        sa.Column('impact', sa.Integer, nullable=False),
        sa.Column('severity', sa.String(20), nullable=False, index=True),
        sa.Column('mitigation_action', sa.Text),
        sa.Column('mitigation_owner', sa.String(255)),
        sa.Column('mitigation_due_ad', sa.Date),
        sa.Column('mitigation_status', sa.String(30), server_default='open', index=True),
        sa.Column('trigger_source', sa.String(50)),
        *_audit_cols(),
        sa.CheckConstraint('likelihood BETWEEN 1 AND 5', name='ck_risk_likelihood'),
        sa.CheckConstraint('impact BETWEEN 1 AND 5', name='ck_risk_impact'),
    )

    op.create_table(
        'insurance_policies', _pk(), _project_fk(),
        sa.Column('policy_number', sa.String(100), nullable=False, unique=True),
        sa.Column('insurer', sa.String(255), nullable=False),
        sa.Column('policy_type', sa.String(50), nullable=False),
        sa.Column('sum_insured_npr', sa.Numeric(18, 2)),
        sa.Column('premium_npr', sa.Numeric(18, 2)),
        sa.Column('valid_from_ad', sa.Date, nullable=False),
        sa.Column('valid_from_bs', sa.String(10)),
        sa.Column('valid_to_ad', sa.Date, nullable=False),
        sa.Column('valid_to_bs', sa.String(10)),
        sa.Column('status', sa.String(30), server_default='active', index=True),
        *_audit_cols(),
    )
    op.create_index('ix_insurance_valid_to', 'insurance_policies', ['valid_to_ad'])

    op.create_table(
        'project_permits', _pk(), _project_fk(),
        sa.Column('permit_type', sa.String(50), nullable=False),
        sa.Column('permit_number', sa.String(100), nullable=False),
        sa.Column('issuing_authority', sa.String(255)),
        sa.Column('valid_from_ad', sa.Date),
        sa.Column('valid_to_ad', sa.Date, index=True),
        sa.Column('valid_to_bs', sa.String(10)),
        sa.Column('status', sa.String(30), server_default='active', index=True),
        *_audit_cols(),
    )

    op.create_table(
        'esia_monitoring_records', _pk(), _project_fk(),
        sa.Column('monitoring_date_ad', sa.Date, nullable=False),
        sa.Column('monitoring_date_bs', sa.String(10)),
        sa.Column('parameter', sa.String(100), nullable=False),
        sa.Column('finding', sa.Text),
        sa.Column('compliance_status', sa.String(30), server_default='compliant'),
        sa.Column('corrective_action', sa.Text),
        *_audit_cols(),
    )

    op.create_table(
        'community_engagements', _pk(), _project_fk(),
        sa.Column('engagement_type', sa.String(20), nullable=False, index=True),
        sa.Column('engagement_date_ad', sa.Date, nullable=False),
        sa.Column('engagement_date_bs', sa.String(10)),
        sa.Column('stakeholder_group', sa.String(255)),
        sa.Column('summary', sa.Text, nullable=False),
        sa.Column('status', sa.String(30), server_default='open', index=True),
        sa.Column('resolution', sa.Text),
        sa.Column('resolved_date_ad', sa.Date),
        *_audit_cols(),
    )


def downgrade():
    op.drop_table('community_engagements')
    op.drop_table('esia_monitoring_records')
    op.drop_table('project_permits')
    op.drop_index('ix_insurance_valid_to', table_name='insurance_policies')
    op.drop_table('insurance_policies')
    op.drop_table('risk_register')
    op.drop_index('ix_milestone_project_planned', table_name='milestones')
    op.drop_table('milestones')
