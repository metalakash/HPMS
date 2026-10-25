"""Separate the bank's portfolio from the national hydro catalog.

The projects table holds every licensed project in the country (the DoED catalog) beside the
few the bank finances. ``is_bank_financed`` says which are the bank's: those with exposure
(a loan account, a consortium facility or a loan projection) are flagged here; a catalog
project is flagged later, when a proposal to finance it is approved.
"""
from alembic import op
import sqlalchemy as sa

revision = '027_project_bank_financed'
down_revision = '026_fiscal_quarter_covenants'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('is_bank_financed', sa.Boolean, nullable=False, server_default=sa.false()))
    op.create_index('ix_projects_is_bank_financed', 'projects', ['is_bank_financed'])
    op.execute("""
        UPDATE projects SET is_bank_financed = TRUE
        WHERE id IN (SELECT project_id FROM loan_accounts)
           OR id IN (SELECT project_id FROM consortium_facilities)
           OR id IN (SELECT project_id FROM loan_projection_quarters)
    """)


def downgrade():
    op.drop_index('ix_projects_is_bank_financed', table_name='projects')
    op.drop_column('projects', 'is_bank_financed')
