"""New hydropower limits the bank plans to approve, and the disbursement scheduled from them."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = '025_new_loan_pipeline'
down_revision = '024_energy_financing'
branch_labels = None
depends_on = None


def _bookkeeping():
    return [
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    ]


def upgrade():
    op.create_table(
        'new_loan_limits',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('fiscal_year', sa.String(7), nullable=False, unique=True),
        sa.Column('new_limit', sa.Numeric(20, 4), nullable=False),
        sa.Column('drawdown_pct', JSONB),
        *_bookkeeping(),
    )
    op.create_table(
        'new_loan_disbursement_quarters',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('fiscal_year', sa.String(7), nullable=False),
        sa.Column('quarter', sa.Integer, nullable=False),
        sa.Column('period_end_ad', sa.Date, nullable=False, unique=True),
        sa.Column('period_end_bs', sa.String(10)),
        sa.Column('planned_disbursement', sa.Numeric(20, 4), nullable=False),
        *_bookkeeping(),
    )


def downgrade():
    op.drop_table('new_loan_disbursement_quarters')
    op.drop_table('new_loan_limits')
