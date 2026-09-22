"""Add multi-factor authentication tables

Revision ID: 007
Revises: 006
Create Date: 2026-10-06 08:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create user_mfa table
    op.create_table(
        'user_mfa',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False, unique=True),
        sa.Column('is_mfa_enabled', sa.Boolean, default=False),
        sa.Column('primary_method', sa.String(50)),
        sa.Column('totp_secret', sa.String(32)),
        sa.Column('totp_enabled', sa.Boolean, default=False),
        sa.Column('totp_verified_at', sa.DateTime(timezone=True)),
        sa.Column('phone_number', sa.String(20)),
        sa.Column('sms_enabled', sa.Boolean, default=False),
        sa.Column('sms_verified_at', sa.DateTime(timezone=True)),
        sa.Column('email_enabled', sa.Boolean, default=False),
        sa.Column('email_verified_at', sa.DateTime(timezone=True)),
        sa.Column('trusted_devices_enabled', sa.Boolean, default=True),
        sa.Column('trust_duration_days', sa.String(5), server_default='30'),
        sa.Column('backup_codes_generated_at', sa.DateTime(timezone=True)),
        sa.Column('backup_codes_regenerated_count', sa.String(5), server_default='0'),
        sa.Column('mfa_required', sa.Boolean, default=False),
        sa.Column('last_mfa_used_at', sa.DateTime(timezone=True)),
        sa.Column('failed_attempts', sa.String(5), server_default='0'),
        sa.Column('locked_until', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_mfa_enabled', 'user_mfa', ['is_mfa_enabled'])
    op.create_index('ix_mfa_locked', 'user_mfa', ['locked_until'])

    # Create totp_verification table
    op.create_table(
        'totp_verification',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_mfa_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user_mfa.id'), nullable=False),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('success', sa.Boolean, default=False),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.String(500)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_totp_user_date', 'totp_verification', ['user_mfa_id', 'created_at'])

    # Create sms_verification table
    op.create_table(
        'sms_verification',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_mfa_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user_mfa.id'), nullable=False),
        sa.Column('phone_number', sa.String(20), nullable=False),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('success', sa.Boolean, default=False),
        sa.Column('attempts', sa.String(5), server_default='0'),
        sa.Column('sms_provider', sa.String(50)),
        sa.Column('sms_id', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_sms_user_date', 'sms_verification', ['user_mfa_id', 'created_at'])

    # Create backup_code table
    op.create_table(
        'backup_code',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_mfa_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user_mfa.id'), nullable=False),
        sa.Column('code', sa.String(8), nullable=False),
        sa.Column('is_used', sa.Boolean, default=False),
        sa.Column('used_at', sa.DateTime(timezone=True)),
        sa.Column('used_ip', sa.String(45)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_backup_code_user', 'backup_code', ['user_mfa_id', 'is_used'])

    # Create trusted_device table
    op.create_table(
        'trusted_device',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_mfa_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user_mfa.id'), nullable=False),
        sa.Column('device_name', sa.String(255)),
        sa.Column('device_fingerprint', sa.String(255), nullable=False, unique=True),
        sa.Column('browser', sa.String(100)),
        sa.Column('os', sa.String(100)),
        sa.Column('trusted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True)),
        sa.Column('last_ip', sa.String(45)),
        sa.Column('use_count', sa.String(10), server_default='1'),
        sa.Column('revoked_at', sa.DateTime(timezone=True)),
        sa.Column('revoke_reason', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_device_fingerprint', 'trusted_device', ['device_fingerprint'])
    op.create_index('ix_device_expires', 'trusted_device', ['user_mfa_id', 'expires_at'])


def downgrade() -> None:
    # Drop trusted_device indexes and table
    op.drop_index('ix_device_expires', table_name='trusted_device')
    op.drop_index('ix_device_fingerprint', table_name='trusted_device')
    op.drop_table('trusted_device')

    # Drop backup_code indexes and table
    op.drop_index('ix_backup_code_user', table_name='backup_code')
    op.drop_table('backup_code')

    # Drop sms_verification indexes and table
    op.drop_index('ix_sms_user_date', table_name='sms_verification')
    op.drop_table('sms_verification')

    # Drop totp_verification indexes and table
    op.drop_index('ix_totp_user_date', table_name='totp_verification')
    op.drop_table('totp_verification')

    # Drop user_mfa indexes and table
    op.drop_index('ix_mfa_locked', table_name='user_mfa')
    op.drop_index('ix_mfa_enabled', table_name='user_mfa')
    op.drop_table('user_mfa')
