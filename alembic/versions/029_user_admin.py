"""Admin user management: a role set in HPMS that overrides the directory's, and why an account was blocked.

``role_override`` is used instead of the role from the directory at sign-in, until cleared.
"""
from alembic import op
import sqlalchemy as sa

revision = '029_user_admin'
down_revision = '028_document_storage'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('role_override', sa.String(50)))
    op.add_column('user', sa.Column('status_reason', sa.Text))


def downgrade():
    op.drop_column('user', 'status_reason')
    op.drop_column('user', 'role_override')
