"""Protect MFA secrets at rest.

* ``user_mfa.totp_secret`` was VARCHAR(32) plain text; it becomes VARCHAR(255) and every existing seed is
  encrypted (``enc1:`` prefix, see backend/app/security/secret_box.py).
* ``backup_code.code`` was VARCHAR(8) although the application stores a 64-character hash there, so generating
  backup codes failed on PostgreSQL; it becomes VARCHAR(64).

The data step needs the same key the application will use (``MFA_ENCRYPTION_KEY`` or ``SECRET_KEY``). Run this
migration with the production environment, not a different one, or the seeds will be unreadable.

Downgrade decrypts the seeds again and narrows the columns; it fails if a backup-code hash is longer than 8
characters, because that data cannot be represented in the old column.
"""
from alembic import op
import sqlalchemy as sa

revision = '017_protect_mfa_secrets'
down_revision = '016_loan_sync_schedule_tables'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('user_mfa', 'totp_secret', type_=sa.String(255), existing_type=sa.String(32), existing_nullable=True)
    op.alter_column('backup_code', 'code', type_=sa.String(64), existing_type=sa.String(8), existing_nullable=False)

    if op.get_context().as_sql:
        op.execute("-- existing TOTP seeds are encrypted by the online run of this migration (python step skipped in --sql mode)")
        return

    from backend.app.security.secret_box import encrypt, is_encrypted
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, totp_secret FROM user_mfa WHERE totp_secret IS NOT NULL")).fetchall()
    for row_id, secret in rows:
        if not is_encrypted(secret):
            bind.execute(sa.text("UPDATE user_mfa SET totp_secret = :s WHERE id = :i"),
                         {"s": encrypt(secret), "i": row_id})


def downgrade():
    if not op.get_context().as_sql:
        from backend.app.security.secret_box import decrypt, is_encrypted
        bind = op.get_bind()
        rows = bind.execute(sa.text("SELECT id, totp_secret FROM user_mfa WHERE totp_secret IS NOT NULL")).fetchall()
        for row_id, secret in rows:
            if is_encrypted(secret):
                bind.execute(sa.text("UPDATE user_mfa SET totp_secret = :s WHERE id = :i"),
                             {"s": decrypt(secret), "i": row_id})
    op.alter_column('backup_code', 'code', type_=sa.String(8), existing_type=sa.String(64), existing_nullable=False)
    op.alter_column('user_mfa', 'totp_secret', type_=sa.String(32), existing_type=sa.String(255), existing_nullable=True)
