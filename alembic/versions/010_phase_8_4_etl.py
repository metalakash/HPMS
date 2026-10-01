"""Phase 8.4 Enterprise ETL - Add Airflow integration tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

# revision identifiers, used by Alembic.
revision = '010_phase_8_4_etl'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    """Create Phase 8.4 ETL tables."""
    
    # Airflow DAG run tracking
    op.create_table(
        'airflow_loan_dag_runs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('dag_id', sa.String(255), nullable=False, index=True),
        sa.Column('run_id', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('start_time', sa.DateTime, nullable=True),
        sa.Column('end_time', sa.DateTime, nullable=True),
        sa.Column('duration_seconds', sa.Integer, nullable=True),
        sa.Column('total_extracted', sa.Integer, server_default='0'),
        sa.Column('total_reconciled', sa.Integer, server_default='0'),
        sa.Column('total_loaded', sa.Integer, server_default='0'),
        sa.Column('reconciliation_conflicts', sa.Integer, server_default='0'),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), index=True),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Loan reconciliation log
    op.create_table(
        'loan_reconciliation_log',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('loan_account_id', UUID(as_uuid=True), sa.ForeignKey('loan_accounts.id'), nullable=False, index=True),
        sa.Column('dag_run_id', UUID(as_uuid=True), sa.ForeignKey('airflow_loan_dag_runs.id'), nullable=True, index=True),
        sa.Column('source_a', sa.String(50), nullable=False),
        sa.Column('source_b', sa.String(50), nullable=True),
        sa.Column('conflict_type', sa.String(100), nullable=True),
        sa.Column('resolution', sa.String(50), nullable=True),
        sa.Column('resolved_by', sa.String(100), nullable=True),
        sa.Column('conflict_details', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    
    # Data provenance tracking
    op.create_table(
        'loan_data_provenance',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('loan_account_id', UUID(as_uuid=True), sa.ForeignKey('loan_accounts.id'), nullable=False, index=True),
        sa.Column('field_name', sa.String(100), nullable=False),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('last_updated_at', sa.DateTime, nullable=True),
        sa.Column('last_updated_by_dag_run_id', UUID(as_uuid=True), sa.ForeignKey('airflow_loan_dag_runs.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    
    # Create composite index for provenance lookups
    op.create_index('idx_data_provenance_loan_field', 'loan_data_provenance', ['loan_account_id', 'field_name'])


def downgrade():
    """Drop Phase 8.4 ETL tables."""
    op.drop_index('idx_data_provenance_loan_field', table_name='loan_data_provenance')
    op.drop_table('loan_data_provenance')
    op.drop_table('loan_reconciliation_log')
    op.drop_table('airflow_loan_dag_runs')