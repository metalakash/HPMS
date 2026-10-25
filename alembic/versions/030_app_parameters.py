"""Admin-managed application settings (RFP FUNC A.5).

A row exists only for a setting changed from its default; defaults live in services/app_settings.py.
"""
from alembic import op
import sqlalchemy as sa

revision = '030_app_parameters'
down_revision = '029_user_admin'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'app_parameters',
        sa.Column('name', sa.String(100), primary_key=True),
        sa.Column('value', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )


def downgrade():
    op.drop_table('app_parameters')
