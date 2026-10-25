"""Exchange rates for facilities in other currencies (RFP FUNC B.3)."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '032_exchange_rates'
down_revision = '031_stakeholder_interactions'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'exchange_rates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('currency_code', sa.String(3), nullable=False),
        sa.Column('rate_to_npr', sa.Numeric(18, 6), nullable=False),
        sa.Column('effective_from_ad', sa.Date, nullable=False),
        sa.Column('effective_from_bs', sa.String(10)),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.UniqueConstraint('currency_code', 'effective_from_ad', name='uq_exchange_rate_day'),
        sa.CheckConstraint('rate_to_npr > 0', name='ck_exchange_rate_positive'),
    )
    op.create_index('ix_exchange_rates_currency_code', 'exchange_rates', ['currency_code'])


def downgrade():
    op.drop_index('ix_exchange_rates_currency_code', table_name='exchange_rates')
    op.drop_table('exchange_rates')
