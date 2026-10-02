"""MFA login: remember the last accepted TOTP time step so a code cannot be replayed."""
from alembic import op
import sqlalchemy as sa

revision = '018_mfa_totp_replay_guard'
down_revision = '017_protect_mfa_secrets'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user_mfa', sa.Column('last_totp_counter', sa.BigInteger(), nullable=True))


def downgrade():
    op.drop_column('user_mfa', 'last_totp_counter')
