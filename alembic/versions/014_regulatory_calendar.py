"""Phase 11.3: regulatory requirements, filing calendar, user reminders, stakeholder contacts."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

revision = '014_regulatory_calendar'
down_revision = '013_report_definitions'
branch_labels = None
depends_on = None


def _audit_cols():
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    ]


def _pk():
    return sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def upgrade():
    op.create_table(
        'regulatory_requirements', _pk(),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('authority', sa.String(20), nullable=False, index=True),
        sa.Column('description', sa.Text),
        sa.Column('legal_reference', sa.String(255)),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('lag_days', sa.Integer, nullable=False, server_default='0'),
        sa.Column('applies_to', sa.String(20), nullable=False, server_default='portfolio'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true(), index=True),
        *_audit_cols(),
    )
    op.create_table(
        'filing_calendar', _pk(),
        sa.Column('requirement_id', UUID(as_uuid=True),
                  sa.ForeignKey('regulatory_requirements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True, index=True),
        sa.Column('period_label', sa.String(50), nullable=False),
        sa.Column('period_end_ad', sa.Date, nullable=False),
        sa.Column('period_end_bs', sa.String(10)),
        sa.Column('due_date_ad', sa.Date, nullable=False, index=True),
        sa.Column('due_date_bs', sa.String(10)),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending', index=True),
        sa.Column('filed_date_ad', sa.Date),
        sa.Column('filed_date_bs', sa.String(10)),
        sa.Column('reference_no', sa.String(100)),
        sa.Column('assigned_to', sa.String(255)),
        sa.Column('remarks', sa.Text),
        *_audit_cols(),
        sa.UniqueConstraint('requirement_id', 'project_id', 'period_end_ad', name='uq_filing_req_project_period'),
    )
    op.create_index('ix_filing_status_due', 'filing_calendar', ['status', 'due_date_ad'])
    # NULL project_id never collides in the constraint above, so de-duplicate portfolio filings separately
    op.create_index('uq_filing_portfolio_period', 'filing_calendar', ['requirement_id', 'period_end_ad'],
                    unique=True, postgresql_where=sa.text('project_id IS NULL'))

    op.create_table(
        'user_reminders', _pk(),
        sa.Column('owner_username', sa.String(255), nullable=False, index=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('note', sa.Text),
        sa.Column('remind_on_ad', sa.Date, nullable=False, index=True),
        sa.Column('remind_on_bs', sa.String(10)),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True, index=True),
        sa.Column('entity_type', sa.String(30)),
        sa.Column('entity_id', sa.String(64)),
        sa.Column('status', sa.String(20), nullable=False, server_default='active', index=True),
        sa.Column('sent_at', sa.Date),
        *_audit_cols(),
    )
    op.create_table(
        'stakeholder_contacts', _pk(),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('organization', sa.String(255)),
        sa.Column('role', sa.String(100)),
        sa.Column('category', sa.String(30), nullable=False, server_default='external', index=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50)),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True, index=True),
        sa.Column('alert_types', JSONB),
        sa.Column('min_urgency', sa.String(20), nullable=False, server_default='critical'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true(), index=True),
        *_audit_cols(),
    )


def downgrade():
    op.drop_table('stakeholder_contacts')
    op.drop_table('user_reminders')
    op.drop_index('uq_filing_portfolio_period', table_name='filing_calendar')
    op.drop_table('filing_calendar')
    op.drop_table('regulatory_requirements')
