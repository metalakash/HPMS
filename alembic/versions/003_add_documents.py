"""Add document vault tables with versioning and approval workflow

Revision ID: 003
Revises: 002
Create Date: 2026-09-22 12:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM types for document classification and status
    op.execute("""
    CREATE TYPE documentclassification AS ENUM (
        'project_charter', 'ppa', 'environmental_clearance', 'land_deed',
        'water_license', 'board_approval', 'technical_report',
        'financial_analysis', 'contract', 'insurance', 'other'
    );
    """)

    op.execute("""
    CREATE TYPE documentstatus AS ENUM (
        'draft', 'under_review', 'approved', 'rejected', 'archived', 'expired'
    );
    """)

    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('document_code', sa.String(100), unique=True, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('classification', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('document_date', sa.Date),
        sa.Column('expiry_date', sa.Date),
        sa.Column('requires_approval', sa.String(5), server_default='N'),
        sa.Column('approved_by', sa.String(255)),
        sa.Column('approval_date', sa.Date),
        sa.Column('approval_remarks', sa.Text),
        sa.Column('file_count', sa.Integer, server_default='0'),
        sa.Column('total_size_bytes', sa.Integer, server_default='0'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_document_code', 'documents', ['document_code'])
    op.create_index('ix_document_project', 'documents', ['project_id'])
    op.create_index('ix_document_classification', 'documents', ['classification'])
    op.create_index('ix_document_status', 'documents', ['status'])
    op.create_index('ix_project_classification', 'documents', ['project_id', 'classification'])
    op.create_index('ix_status_date', 'documents', ['status', 'document_date'])

    # Document version table
    op.create_table(
        'document_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id'), nullable=False),
        sa.Column('version_number', sa.Integer, nullable=False),
        sa.Column('is_current', sa.String(5), server_default='Y'),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size_bytes', sa.Integer, nullable=False),
        sa.Column('file_hash', sa.String(64), unique=True, nullable=False),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('storage_backend', sa.String(50), server_default='local'),
        sa.Column('content_encrypted', sa.String(5), server_default='N'),
        sa.Column('content_checksum', sa.String(64)),
        sa.Column('upload_comment', sa.Text),
        sa.Column('change_summary', sa.Text),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_version_document', 'document_versions', ['document_id'])
    op.create_index('ix_document_current', 'document_versions', ['document_id', 'is_current'])
    op.create_index('ix_version_date', 'document_versions', ['document_id', 'created_at'])
    op.create_index('ix_version_hash', 'document_versions', ['file_hash'])

    # Document approval workflow table
    op.create_table(
        'document_approval_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id'), nullable=False),
        sa.Column('document_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('document_versions.id'), nullable=False),
        sa.Column('requested_by', sa.String(255), nullable=False),
        sa.Column('request_date', sa.Date, nullable=False),
        sa.Column('approver_id', sa.String(255)),
        sa.Column('approver_role', sa.String(100)),
        sa.Column('approval_status', sa.String(50), server_default='pending'),
        sa.Column('approval_date', sa.Date),
        sa.Column('approval_remarks', sa.Text),
        sa.Column('reminder_count', sa.Integer, server_default='0'),
        sa.Column('last_reminder_date', sa.Date),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_approval_document', 'document_approval_requests', ['document_id'])
    op.create_index('ix_approval_status', 'document_approval_requests', ['approval_status', 'approver_role'])
    op.create_index('ix_approval_date', 'document_approval_requests', ['approval_date'])


def downgrade() -> None:
    # Drop approval workflow table
    op.drop_index('ix_approval_date', table_name='document_approval_requests')
    op.drop_index('ix_approval_status', table_name='document_approval_requests')
    op.drop_index('ix_approval_document', table_name='document_approval_requests')
    op.drop_table('document_approval_requests')

    # Drop document version table
    op.drop_index('ix_version_hash', table_name='document_versions')
    op.drop_index('ix_version_date', table_name='document_versions')
    op.drop_index('ix_document_current', table_name='document_versions')
    op.drop_index('ix_version_document', table_name='document_versions')
    op.drop_table('document_versions')

    # Drop documents table
    op.drop_index('ix_status_date', table_name='documents')
    op.drop_index('ix_project_classification', table_name='documents')
    op.drop_index('ix_document_status', table_name='documents')
    op.drop_index('ix_document_classification', table_name='documents')
    op.drop_index('ix_document_project', table_name='documents')
    op.drop_index('ix_document_code', table_name='documents')
    op.drop_table('documents')

    # Drop ENUM types
    op.execute("DROP TYPE documentstatus;")
    op.execute("DROP TYPE documentclassification;")
