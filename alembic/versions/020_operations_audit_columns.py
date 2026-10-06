"""Add the created_by/updated_by columns the Phase 10 models declare but migration 013+ never created.

Without them every ORM query on these tables fails with UndefinedColumn, which made the project
generation, hydrology, land-governance, ESG, maintenance and covenant-history endpoints return 500.
"""
from alembic import op
import sqlalchemy as sa

revision = '020_operations_audit_columns'
down_revision = '019_approval_submission_link'
branch_labels = None
depends_on = None

MISSING = {
    'board_of_directors': ('created_by', 'updated_by'),
    'covenant_history': ('created_by', 'updated_by'),
    'energy_generation_data': ('created_by', 'updated_by'),
    'esg_metrics': ('created_by', 'updated_by'),
    'hydrology_detailed': ('created_by', 'updated_by'),
    'land_acquisition_tracking': ('created_by',),
    'maintenance_logs': ('updated_by',),
    'nea_ppa_rates': ('created_by', 'updated_by'),
    'plant_performance': ('created_by', 'updated_by'),
    'shareholding_hierarchy': ('created_by', 'updated_by'),
    'tariff_structures': ('created_by', 'updated_by'),
}


def upgrade():
    for table, columns in MISSING.items():
        for column in columns:
            op.add_column(table, sa.Column(column, sa.String(255), nullable=True))


def downgrade():
    for table, columns in MISSING.items():
        for column in columns:
            op.drop_column(table, column)
