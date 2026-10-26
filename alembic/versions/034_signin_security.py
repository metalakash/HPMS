"""Sign-in security: every attempt recorded (throttling, lockout, security record) and revoked tokens (logout)."""
from alembic import op
import sqlalchemy as sa

revision = '034_signin_security'
down_revision = '033_row_security'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'login_attempts',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('username', sa.String(255), nullable=False),
        sa.Column('source_ip', sa.String(64)),
        sa.Column('succeeded', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('outcome', sa.String(40), nullable=False),
        sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_login_attempts_username', 'login_attempts', ['username'])
    op.create_index('ix_login_attempts_source_ip', 'login_attempts', ['source_ip'])
    op.create_index('ix_login_attempts_attempted_at', 'login_attempts', ['attempted_at'])
    op.create_table(
        'revoked_tokens',
        sa.Column('jti', sa.String(64), primary_key=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_revoked_tokens_expires_at', 'revoked_tokens', ['expires_at'])


def downgrade():
    op.drop_table('revoked_tokens')
    op.drop_table('login_attempts')
