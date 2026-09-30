"""Add covenant metrics columns to loan accounts.

Revision ID: 009
Revises: 008
Create Date: 2026-09-25 10:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('loan_accounts', sa.Column('dscr', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('loan_accounts', sa.Column('ltv', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('loan_accounts', sa.Column('icr', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('loan_accounts', sa.Column('metric_as_of_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('loan_accounts', 'metric_as_of_date')
    op.drop_column('loan_accounts', 'icr')
    op.drop_column('loan_accounts', 'ltv')
    op.drop_column('loan_accounts', 'dscr')
