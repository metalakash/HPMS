"""Phase 11.4: audit_logs append-only trigger and retention checkpoints."""
from alembic import op
import sqlalchemy as sa

revision = '015_audit_immutability_retention'
down_revision = '014_regulatory_calendar'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'audit_retention_checkpoints',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('purged_through_id', sa.BIGINT, nullable=False),
        sa.Column('last_purged_hash', sa.String(64), nullable=False),
        sa.Column('purged_count', sa.Integer, nullable=False),
        sa.Column('retention_years', sa.Integer, nullable=False),
        sa.Column('cutoff_date', sa.Date, nullable=False),
        sa.Column('purged_by', sa.String(255), nullable=False),
        sa.Column('purged_at', sa.String(100), nullable=False, server_default=sa.text("now()::text")),
    )

    # Append-only: no UPDATE, no DELETE, no TRUNCATE. The one exception is the retention purge, which sets
    # `hpms.audit_purge = 'on'` for its own transaction (SET LOCAL) and may only DELETE.
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' AND current_setting('hpms.audit_purge', true) = 'on' THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
                USING ERRCODE = 'insufficient_privilege';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER audit_logs_no_update_delete
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
    """)
    op.execute("""
        CREATE TRIGGER audit_logs_no_truncate
        BEFORE TRUNCATE ON audit_logs
        FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
    """)


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS audit_logs_append_only()")
    op.drop_table('audit_retention_checkpoints')
