"""Stakeholder performance history (RFP FUNC C.9): dated interactions with an optional rating."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '031_stakeholder_interactions'
down_revision = '030_app_parameters'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stakeholder_interactions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('contact_id', UUID(as_uuid=True), sa.ForeignKey('stakeholder_contacts.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('interaction_date_ad', sa.Date, nullable=False),
        sa.Column('interaction_date_bs', sa.String(10)),
        sa.Column('kind', sa.String(20), nullable=False, server_default='meeting'),
        sa.Column('rating', sa.Integer),
        sa.Column('summary', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255)),
        sa.Column('updated_by', sa.String(255)),
        sa.CheckConstraint('rating BETWEEN 1 AND 5', name='ck_stakeholder_interaction_rating'),
    )
    op.create_index('ix_stakeholder_interactions_contact_id', 'stakeholder_interactions', ['contact_id'])


def downgrade():
    op.drop_index('ix_stakeholder_interactions_contact_id', table_name='stakeholder_interactions')
    op.drop_table('stakeholder_interactions')
