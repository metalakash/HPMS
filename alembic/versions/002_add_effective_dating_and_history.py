"""Add effective-dating tables for capacity, rates, and RCOD events

Revision ID: 002
Revises: 001
Create Date: 2026-09-22 00:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add data_provenance and source_reference to disbursement_tranches
    op.add_column('disbursement_tranches', sa.Column('data_provenance', sa.String(50), server_default='CBS_SYNCED'))
    op.add_column('disbursement_tranches', sa.Column('source_reference', sa.String(255)))

    # Add data_provenance and source_reference to repayments
    op.add_column('repayments', sa.Column('data_provenance', sa.String(50), server_default='CBS_SYNCED'))
    op.add_column('repayments', sa.Column('source_reference', sa.String(255)))

    # Create project_capacity_history table for effective-dated capacity
    op.create_table(
        'project_capacity_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('capacity_mw', sa.Numeric(12, 4), nullable=False),
        sa.Column('valid_from_ad', sa.Date, nullable=False),
        sa.Column('valid_from_bs', sa.String(10)),
        sa.Column('valid_to_ad', sa.Date),
        sa.Column('valid_to_bs', sa.String(10)),
        sa.Column('is_current', sa.String(5), server_default='Y'),
        sa.Column('revision_reason', sa.String(255)),
        sa.Column('data_provenance', sa.String(50), server_default='DOCUMENT_VERIFIED'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_capacity_project', 'project_capacity_history', ['project_id'])
    op.create_index('ix_capacity_valid_from', 'project_capacity_history', ['valid_from_ad'])
    op.create_index('ix_capacity_valid_to', 'project_capacity_history', ['valid_to_ad'])
    op.create_index('ix_capacity_current', 'project_capacity_history', ['project_id', 'is_current'])
    op.create_index('ix_capacity_validity', 'project_capacity_history', ['valid_from_ad', 'valid_to_ad'])

    # Create rcod_events table for RCOD versioning with classification review triggers
    op.create_table(
        'rcod_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('rcod_ad', sa.Date, nullable=False),
        sa.Column('rcod_bs', sa.String(10)),
        sa.Column('previous_rcod_ad', sa.Date),
        sa.Column('previous_rcod_bs', sa.String(10)),
        sa.Column('rcod_classification', sa.String(100)),
        sa.Column('requires_classification_review', sa.String(5), server_default='Y'),
        sa.Column('reason_for_revision', sa.Text),
        sa.Column('contract_amendment_reference', sa.String(255)),
        sa.Column('data_provenance', sa.String(50), server_default='MANUAL_ENTRY'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_rcod_project', 'rcod_events', ['project_id'])
    op.create_index('ix_rcod_ad', 'rcod_events', ['rcod_ad'])
    op.create_index('ix_rcod_classification', 'rcod_events', ['rcod_classification', 'requires_classification_review'])
    op.create_index('ix_rcod_dates', 'rcod_events', ['rcod_ad', 'previous_rcod_ad'])

    # Create loan_account_rate_history table for effective-dated interest rates
    op.create_table(
        'loan_account_rate_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loan_accounts.id'), nullable=False),
        sa.Column('interest_rate_pct', sa.Numeric(7, 4), nullable=False),
        sa.Column('valid_from_ad', sa.Date, nullable=False),
        sa.Column('valid_from_bs', sa.String(10)),
        sa.Column('valid_to_ad', sa.Date),
        sa.Column('valid_to_bs', sa.String(10)),
        sa.Column('is_current', sa.String(5), server_default='Y'),
        sa.Column('reason_for_change', sa.String(255)),
        sa.Column('data_provenance', sa.String(50), server_default='CBS_SYNCED'),
        sa.Column('source_reference', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.create_index('ix_rate_loan_account', 'loan_account_rate_history', ['loan_account_id'])
    op.create_index('ix_rate_valid_from', 'loan_account_rate_history', ['valid_from_ad'])
    op.create_index('ix_rate_valid_to', 'loan_account_rate_history', ['valid_to_ad'])
    op.create_index('ix_rate_current', 'loan_account_rate_history', ['loan_account_id', 'is_current'])
    op.create_index('ix_rate_validity', 'loan_account_rate_history', ['valid_from_ad', 'valid_to_ad'])


def downgrade() -> None:
    # Drop rate history table
    op.drop_index('ix_rate_validity', table_name='loan_account_rate_history')
    op.drop_index('ix_rate_current', table_name='loan_account_rate_history')
    op.drop_index('ix_rate_valid_to', table_name='loan_account_rate_history')
    op.drop_index('ix_rate_valid_from', table_name='loan_account_rate_history')
    op.drop_index('ix_rate_loan_account', table_name='loan_account_rate_history')
    op.drop_table('loan_account_rate_history')

    # Drop RCOD events table
    op.drop_index('ix_rcod_dates', table_name='rcod_events')
    op.drop_index('ix_rcod_classification', table_name='rcod_events')
    op.drop_index('ix_rcod_ad', table_name='rcod_events')
    op.drop_index('ix_rcod_project', table_name='rcod_events')
    op.drop_table('rcod_events')

    # Drop capacity history table
    op.drop_index('ix_capacity_validity', table_name='project_capacity_history')
    op.drop_index('ix_capacity_current', table_name='project_capacity_history')
    op.drop_index('ix_capacity_valid_to', table_name='project_capacity_history')
    op.drop_index('ix_capacity_valid_from', table_name='project_capacity_history')
    op.drop_index('ix_capacity_project', table_name='project_capacity_history')
    op.drop_table('project_capacity_history')

    # Drop data_provenance columns from existing tables
    op.drop_column('repayments', 'source_reference')
    op.drop_column('repayments', 'data_provenance')
    op.drop_column('disbursement_tranches', 'source_reference')
    op.drop_column('disbursement_tranches', 'data_provenance')
