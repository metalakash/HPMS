"""Add authentication and user management tables

Revision ID: 005
Revises: 004
Create Date: 2026-09-23 08:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM type for user roles
    op.execute("""
    CREATE TYPE userrole AS ENUM (
        'admin', 'maker', 'approver', 'auditor', 'guest'
    );
    """)

    # Create user table
    op.create_table(
        'user',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(255), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('full_name', sa.String(255)),
        sa.Column('ad_distinguished_name', sa.String(1000)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('is_ad_synced', sa.Boolean, default=False),
        sa.Column('last_login_at', sa.Date),
        sa.Column('last_ad_sync_at', sa.Date),
        sa.Column('default_role', sa.String(50), server_default='guest'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_user_username', 'user', ['username'])
    op.create_index('ix_user_email', 'user', ['email'])
    op.create_index('ix_user_is_active', 'user', ['is_active'])

    # Create user role assignment table
    op.create_table(
        'user_role_assignment',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('valid_from', sa.Date),
        sa.Column('valid_to', sa.Date),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_role_user_role', 'user_role_assignment', ['user_id', 'role'])

    # Create project owner table (for row-level security - Phase 3 Task 2)
    op.create_table(
        'project_owner',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('ownership_type', sa.String(50)),
        sa.Column('valid_from', sa.Date),
        sa.Column('valid_to', sa.Date),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
    )

    op.create_index('ix_owner_user_project', 'project_owner', ['user_id', 'project_id'])
    op.create_index('ix_owner_project', 'project_owner', ['project_id'])


def downgrade() -> None:
    # Drop project owner indexes and table
    op.drop_index('ix_owner_project', table_name='project_owner')
    op.drop_index('ix_owner_user_project', table_name='project_owner')
    op.drop_table('project_owner')

    # Drop role assignment indexes and table
    op.drop_index('ix_role_user_role', table_name='user_role_assignment')
    op.drop_table('user_role_assignment')

    # Drop user indexes and table
    op.drop_index('ix_user_is_active', table_name='user')
    op.drop_index('ix_user_email', table_name='user')
    op.drop_index('ix_user_username', table_name='user')
    op.drop_table('user')

    # Drop ENUM type
    op.execute("DROP TYPE userrole;")
