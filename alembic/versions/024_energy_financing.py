"""Energy-sector financing: the bond register and the quarterly inputs to the regulatory ratio."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '024_energy_financing'
down_revision = '023_loan_projection_quarters'
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
        'energy_bonds',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('amount', sa.Numeric(20, 4), nullable=False),
        sa.Column('yield_pct', sa.Numeric(7, 4)),
        sa.Column('investment_date_ad', sa.Date),
        sa.Column('investment_date_bs', sa.String(10)),
        sa.Column('maturity_date_ad', sa.Date),
        sa.Column('maturity_date_bs', sa.String(10)),
        *_bookkeeping(),
    )
    op.create_table(
        'energy_financing_quarters',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('fiscal_year', sa.String(7), nullable=False),
        sa.Column('quarter', sa.Integer, nullable=False),
        sa.Column('period_end_ad', sa.Date, nullable=False),
        sa.Column('period_end_bs', sa.String(10)),
        sa.Column('bank_total_loans', sa.Numeric(22, 4)),
        sa.Column('required_pct', sa.Numeric(7, 4)),
        sa.Column('hydro_outstanding_actual', sa.Numeric(20, 4)),
        sa.Column('energy_bond_actual', sa.Numeric(20, 4)),
        *_bookkeeping(),
        sa.UniqueConstraint('period_end_ad', name='uq_energy_financing_quarter'),
    )


def downgrade():
    op.drop_table('energy_financing_quarters')
    op.drop_table('energy_bonds')
