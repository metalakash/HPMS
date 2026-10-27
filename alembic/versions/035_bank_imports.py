"""Bank workbook imports: uploaded files held (encrypted) from preview until a second admin approves the load."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '035_bank_imports'
down_revision = '034_signin_security'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'bank_imports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='previewed'),
        sa.Column('projection_filename', sa.String(255), nullable=False),
        sa.Column('generation_filename', sa.String(255), nullable=False),
        sa.Column('projection_sha256', sa.String(64), nullable=False),
        sa.Column('generation_sha256', sa.String(64), nullable=False),
        sa.Column('projection_content', sa.LargeBinary, nullable=False),
        sa.Column('generation_content', sa.LargeBinary, nullable=False),
        sa.Column('summary', postgresql.JSONB, nullable=False),
        sa.Column('agrees', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('replaces', postgresql.JSONB),
        sa.Column('uploaded_by', sa.String(100), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('applied_by', sa.String(100)),
        sa.Column('applied_at', sa.DateTime(timezone=True)),
        sa.Column('result', postgresql.JSONB),
    )
    op.create_index('ix_bank_imports_uploaded_at', 'bank_imports', ['uploaded_at'])


def downgrade():
    op.drop_table('bank_imports')
