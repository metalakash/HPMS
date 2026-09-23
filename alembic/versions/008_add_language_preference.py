"""Add language_preference to user table (Phase 4 Task 5).

Revision ID: 008
Revises: 007
Create Date: 2026-09-23
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add language_preference column to user table
    op.add_column('user', sa.Column('language_preference', sa.String(10), nullable=True, server_default='en'))

    # Create index for language preference lookups
    op.create_index('ix_user_language', 'user', ['language_preference'])


def downgrade() -> None:
    op.drop_index('ix_user_language')
    op.drop_column('user', 'language_preference')
