"""Add scheduler tables for automated exports

Revision ID: 006
Revises: 005
Create Date: 2026-09-23 14:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM type for job status
    op.execute("""
    CREATE TYPE jobstatus AS ENUM (
        'pending', 'running', 'success', 'failed', 'skipped'
    );
    """)

    # Create export_job table
    op.create_table(
        'export_job',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('report_id', sa.String(100), nullable=False),
        sa.Column('export_format', sa.String(50), nullable=False),
        sa.Column('schedule', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('recipients', postgresql.JSONB, nullable=False),
        sa.Column('subject_template', sa.String(255)),
        sa.Column('body_template', sa.Text),
        sa.Column('filters', postgresql.JSONB),
        sa.Column('is_enabled', sa.Boolean, default=True),
        sa.Column('last_run_at', sa.DateTime(timezone=True)),
        sa.Column('next_run_at', sa.DateTime(timezone=True)),
        sa.Column('max_retries', sa.String(5), server_default='3'),
        sa.Column('retry_backoff_seconds', sa.String(10), server_default='300'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_job_report_schedule', 'export_job', ['report_id', 'is_enabled'])
    op.create_index('ix_job_next_run', 'export_job', ['next_run_at'])

    # Create export_job_run table
    op.create_table(
        'export_job_run',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('export_job.id'), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('duration_seconds', sa.String(10)),
        sa.Column('record_count', sa.String(10)),
        sa.Column('file_url', sa.String(1000)),
        sa.Column('file_size_bytes', sa.String(20)),
        sa.Column('error_message', sa.Text),
        sa.Column('retry_count', sa.String(5), server_default='0'),
        sa.Column('next_retry_at', sa.DateTime(timezone=True)),
        sa.Column('emails_sent', sa.String(5), server_default='N'),
        sa.Column('email_send_time', sa.DateTime(timezone=True)),
        sa.Column('email_error', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_run_status_date', 'export_job_run', ['status', 'created_at'])
    op.create_index('ix_run_next_retry', 'export_job_run', ['job_id', 'next_retry_at'])


def downgrade() -> None:
    # Drop run indexes and table
    op.drop_index('ix_run_next_retry', table_name='export_job_run')
    op.drop_index('ix_run_status_date', table_name='export_job_run')
    op.drop_table('export_job_run')

    # Drop job indexes and table
    op.drop_index('ix_job_next_run', table_name='export_job')
    op.drop_index('ix_job_report_schedule', table_name='export_job')
    op.drop_table('export_job')

    # Drop ENUM type
    op.execute("DROP TYPE jobstatus;")
