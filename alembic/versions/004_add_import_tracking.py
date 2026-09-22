"""Add import batch tracking tables for audit trail

Revision ID: 004
Revises: 003
Create Date: 2026-09-22 14:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM type for import status
    op.execute("""
    CREATE TYPE importstatus AS ENUM (
        'pending', 'validated', 'in_progress', 'completed', 'failed', 'partial'
    );
    """)

    # Create import_batches table
    op.create_table(
        'import_batches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size_bytes', sa.Integer),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('import_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('total_rows', sa.Integer, server_default='0'),
        sa.Column('successful_rows', sa.Integer, server_default='0'),
        sa.Column('failed_rows', sa.Integer, server_default='0'),
        sa.Column('error_summary', sa.Text),
        sa.Column('uploaded_by', sa.String(255), nullable=False),
        sa.Column('upload_timestamp', sa.Date, nullable=False),
        sa.Column('started_at', sa.Date),
        sa.Column('completed_at', sa.Date),
        sa.Column('processing_duration_seconds', sa.Integer),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_import_type', 'import_batches', ['import_type'])
    op.create_index('ix_import_status', 'import_batches', ['status'])
    op.create_index('ix_import_type_status', 'import_batches', ['import_type', 'status'])
    op.create_index('ix_import_date', 'import_batches', ['upload_timestamp'])

    # Create import_row_errors table
    op.create_table(
        'import_row_errors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('import_batches.id'), nullable=False),
        sa.Column('row_number', sa.Integer, nullable=False),
        sa.Column('error_type', sa.String(50)),
        sa.Column('column_name', sa.String(255)),
        sa.Column('error_message', sa.String(500), nullable=False),
        sa.Column('row_data_json', sa.String(5000)),
        sa.Column('is_retryable', sa.String(5), server_default='Y'),
        sa.Column('retry_count', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_error_batch', 'import_row_errors', ['batch_id'])
    op.create_index('ix_error_row', 'import_row_errors', ['batch_id', 'row_number'])


def downgrade() -> None:
    # Drop error index and table
    op.drop_index('ix_error_row', table_name='import_row_errors')
    op.drop_index('ix_error_batch', table_name='import_row_errors')
    op.drop_table('import_row_errors')

    # Drop batch indexes and table
    op.drop_index('ix_import_date', table_name='import_batches')
    op.drop_index('ix_import_type_status', table_name='import_batches')
    op.drop_index('ix_import_status', table_name='import_batches')
    op.drop_index('ix_import_type', table_name='import_batches')
    op.drop_table('import_batches')

    # Drop ENUM type
    op.execute("DROP TYPE importstatus;")
