"""Phase 11.2: saved report definitions; export jobs can reference one."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

revision = '013_report_definitions'
down_revision = '012_phase_11_risk_domain'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'report_definitions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('source', sa.String(50), nullable=False, index=True),
        sa.Column('columns', JSONB),
        sa.Column('filters', JSONB),
        sa.Column('sort_by', sa.String(100)),
        sa.Column('sort_desc', sa.Boolean, server_default=sa.false()),
        sa.Column('default_format', sa.String(20), server_default='excel'),
        sa.Column('is_shared', sa.Boolean, server_default=sa.false()),
        sa.Column('owner_username', sa.String(255), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )
    op.add_column('export_job', sa.Column(
        'definition_id', UUID(as_uuid=True), sa.ForeignKey('report_definitions.id', ondelete='SET NULL'),
        nullable=True, index=True))


def downgrade():
    op.drop_column('export_job', 'definition_id')
    op.drop_table('report_definitions')
