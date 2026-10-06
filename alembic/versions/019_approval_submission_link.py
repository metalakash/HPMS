"""Maker-checker: link each approval request to the audit entry that recorded its submission.

The proposed changes and justification live in that (immutable) audit entry; the link lets the
approval queue show them and lets the final approval apply exactly what was recorded.
"""
from alembic import op
import sqlalchemy as sa

revision = '019_approval_submission_link'
down_revision = '018_mfa_totp_replay_guard'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('approval_requests', sa.Column('submit_audit_log_id', sa.BigInteger(), nullable=True))


def downgrade():
    op.drop_column('approval_requests', 'submit_audit_log_id')
