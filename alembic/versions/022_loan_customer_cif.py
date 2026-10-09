"""The bank's customer number (CIF) on a loan account, so a borrower can be matched to the core banking system."""
from alembic import op
import sqlalchemy as sa

revision = '022_loan_customer_cif'
down_revision = '021_covenant_inputs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('loan_accounts', sa.Column('customer_cif', sa.String(50)))
    op.create_index('ix_loan_accounts_customer_cif', 'loan_accounts', ['customer_cif'])


def downgrade():
    op.drop_index('ix_loan_accounts_customer_cif', table_name='loan_accounts')
    op.drop_column('loan_accounts', 'customer_cif')
