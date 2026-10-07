"""Tables the covenant engine reads: quarterly borrower financials and per-project thresholds."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '021_covenant_inputs'
down_revision = '020_operations_audit_columns'
branch_labels = None
depends_on = None


def _bookkeeping():
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    ]


def upgrade():
    op.create_table(
        'project_financial_periods',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('quarter_ad', sa.String(10), nullable=False),
        sa.Column('period_end_ad', sa.Date, nullable=False),
        sa.Column('period_end_bs', sa.String(10)),
        sa.Column('revenue_npr', sa.Numeric(20, 2)),
        sa.Column('operating_expenses_npr', sa.Numeric(20, 2)),
        sa.Column('royalty_npr', sa.Numeric(20, 2)),
        sa.Column('tax_paid_npr', sa.Numeric(20, 2)),
        sa.Column('depreciation_npr', sa.Numeric(20, 2)),
        sa.Column('security_value_npr', sa.Numeric(20, 2)),
        sa.Column('is_audited', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        *_bookkeeping(),
        sa.UniqueConstraint('project_id', 'quarter_ad', name='uq_financial_period_project_quarter'),
    )
    op.create_index('ix_project_financial_periods_project_id', 'project_financial_periods', ['project_id'])

    op.create_table(
        'covenant_terms',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, unique=True),
        sa.Column('dscr_min', sa.Numeric(10, 4), nullable=False),
        sa.Column('ltv_max', sa.Numeric(10, 4), nullable=False),
        sa.Column('icr_min', sa.Numeric(10, 4), nullable=False),
        sa.Column('warning_margin_pct', sa.Numeric(6, 2), nullable=False),
        sa.Column('source_reference', sa.String(255)),
        *_bookkeeping(),
    )


def downgrade():
    op.drop_table('covenant_terms')
    op.drop_index('ix_project_financial_periods_project_id', table_name='project_financial_periods')
    op.drop_table('project_financial_periods')
