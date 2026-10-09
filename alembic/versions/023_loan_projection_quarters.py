"""The bank's quarterly loan projection: planned disbursement, repayment and outstanding per borrower."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '023_loan_projection_quarters'
down_revision = '022_loan_customer_cif'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'loan_projection_quarters',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('fiscal_year', sa.String(7), nullable=False),
        sa.Column('quarter', sa.Integer, nullable=False),
        sa.Column('period_end_ad', sa.Date, nullable=False),
        sa.Column('period_end_bs', sa.String(10)),
        sa.Column('is_opening', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('projected_disbursement', sa.Numeric(20, 4), nullable=False, server_default='0'),
        sa.Column('projected_repayment', sa.Numeric(20, 4), nullable=False, server_default='0'),
        sa.Column('projected_outstanding', sa.Numeric(20, 4), nullable=False, server_default='0'),
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.UniqueConstraint('project_id', 'period_end_ad', name='uq_loan_projection_project_quarter'),
    )
    op.create_index('ix_loan_projection_quarters_project_id', 'loan_projection_quarters', ['project_id'])
    op.create_index('ix_loan_projection_quarters_period_end_ad', 'loan_projection_quarters', ['period_end_ad'])


def downgrade():
    op.drop_index('ix_loan_projection_quarters_period_end_ad', table_name='loan_projection_quarters')
    op.drop_index('ix_loan_projection_quarters_project_id', table_name='loan_projection_quarters')
    op.drop_table('loan_projection_quarters')
