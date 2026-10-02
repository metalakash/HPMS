"""Create the loan exposure sync schedule and history tables.

Phase 8.3 added the models, API and background executor for these tables but no migration, so a database
built with ``alembic upgrade head`` had no ``loan_exposure_sync_schedules`` / ``loan_exposure_sync_history``
and every schedule endpoint failed. Found while generating the data dictionary (Phase 11.5).

Idempotent: environments that created the tables by other means (create_all) are left untouched.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

revision = '016_loan_sync_schedule_tables'
down_revision = '015_audit_immutability_retention'
branch_labels = None
depends_on = None


def _audit_cols():
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    ]


def upgrade():
    # offline (--sql) mode has no connection to inspect: emit everything
    existing = set() if op.get_context().as_sql else set(sa.inspect(op.get_bind()).get_table_names())

    if 'loan_exposure_sync_schedules' not in existing:
        op.create_table(
            'loan_exposure_sync_schedules',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('description', sa.Text),
            sa.Column('frequency', sa.String(50), nullable=False, index=True),
            sa.Column('scheduled_time_utc', sa.String(5)),
            sa.Column('day_of_week', sa.Integer),
            sa.Column('sync_source', sa.String(100), nullable=False),
            sa.Column('source_config', JSONB),
            sa.Column('is_active', sa.String(1), server_default='Y', index=True),
            sa.Column('last_sync_at', sa.String(100)),
            sa.Column('last_sync_status', sa.String(50)),
            sa.Column('last_sync_record_count', sa.Integer, server_default='0'),
            sa.Column('last_sync_error', sa.Text),
            sa.Column('alert_on_dscr_below', sa.Numeric(10, 4)),
            sa.Column('alert_on_ltv_above', sa.Numeric(10, 4)),
            sa.Column('alert_on_concentration_above', sa.Numeric(10, 4)),
            sa.Column('alert_email_addresses', sa.String(500)),
            *_audit_cols(),
        )
        op.create_index('ix_sync_schedule_active', 'loan_exposure_sync_schedules', ['is_active', 'frequency'])

    if 'loan_exposure_sync_history' not in existing:
        op.create_table(
            'loan_exposure_sync_history',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('schedule_id', UUID(as_uuid=True), sa.ForeignKey('loan_exposure_sync_schedules.id'), index=True),
            sa.Column('sync_source', sa.String(100), nullable=False),
            sa.Column('status', sa.String(50), nullable=False, index=True),
            sa.Column('total_records', sa.Integer, server_default='0'),
            sa.Column('created_count', sa.Integer, server_default='0'),
            sa.Column('updated_count', sa.Integer, server_default='0'),
            sa.Column('skipped_count', sa.Integer, server_default='0'),
            sa.Column('error_message', sa.Text),
            sa.Column('alerts_triggered', JSONB),
            sa.Column('started_at', sa.String(100)),
            sa.Column('completed_at', sa.String(100)),
            sa.Column('duration_seconds', sa.Integer),
            sa.Column('data_provenance', sa.String(50), server_default='AUTO_SYNC'),
            sa.Column('source_reference', sa.String(255)),
            *_audit_cols(),
        )
        op.create_index('ix_sync_history_status_date', 'loan_exposure_sync_history', ['status', 'created_at'])


def downgrade():
    op.drop_table('loan_exposure_sync_history')
    op.drop_table('loan_exposure_sync_schedules')
