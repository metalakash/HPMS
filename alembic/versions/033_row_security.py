"""Database-level row security on project data (RFP TECH A.6), a second barrier behind the application's checks.

Every table that belongs to a project gets a PostgreSQL row policy: a row is visible, and writable, only when
``hpms_can_see_project`` says the session's user may see its project. The application describes the user to
the database per transaction (``hpms.rls``, ``hpms.user_id``, ``hpms.roles``; see security/db_row_security.py)
when ``DB_ROW_SECURITY`` is on. A session that sets nothing (migrations, scheduled jobs, the setting off) is
not restricted, so this migration changes no behaviour by itself.

Rules, matching the application: admins, auditors and approvers reach every project (approvers decide changes
on any project); makers reach the projects they own; guests none. Rows with no project (bank-wide filing
calendar entries, contacts, reminders) are not restricted. ``project_owner`` itself has no policy: the rule
reads it.

FORCE makes the policies apply to the tables' owner too, which is the account the application connects as.
A database superuser is never subject to row security, so the application must not connect as one.
"""
from alembic import op

revision = '033_row_security'
down_revision = '032_exchange_rates'
branch_labels = None
depends_on = None

TABLES = (
    'board_of_directors', 'budget_lines', 'community_engagements', 'consortium_facilities', 'covenant_history',
    'covenant_terms', 'documents', 'eia_mitigation_checklist', 'energy_generation_data', 'esg_metrics',
    'esia_monitoring_records', 'filing_calendar', 'hydrology_detailed', 'hydrology_records', 'insurance_policies',
    'land_acquisition_tracking', 'land_records', 'loan_accounts', 'loan_projection_quarters', 'maintenance_logs',
    'maintenance_schedules', 'milestones', 'nea_ppa_rates', 'plant_performance', 'ppa_agreements',
    'project_capacity_history', 'project_financial_periods', 'project_permits', 'project_technical_specs',
    'rcod_events', 'risk_register', 'shareholding_hierarchy', 'stakeholder_contacts', 'tariff_structures',
    'user_reminders', 'water_licenses',
)


def upgrade():
    op.execute("""
        CREATE OR REPLACE FUNCTION hpms_can_see_project(pid uuid) RETURNS boolean
        LANGUAGE sql STABLE AS $$
            SELECT coalesce(current_setting('hpms.rls', true), '') <> 'on'
                OR string_to_array(coalesce(current_setting('hpms.roles', true), ''), ',')
                   && ARRAY['admin', 'auditor', 'approver']
                OR ('maker' = ANY(string_to_array(coalesce(current_setting('hpms.roles', true), ''), ','))
                    AND EXISTS (SELECT 1 FROM project_owner o
                                WHERE o.project_id = pid
                                  AND o.user_id::text = current_setting('hpms.user_id', true)))
        $$
    """)
    op.execute("ALTER TABLE projects ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE projects FORCE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY hpms_project_rows ON projects USING (hpms_can_see_project(id)) "
               "WITH CHECK (hpms_can_see_project(id))")
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY hpms_project_rows ON {table} "
                   f"USING (project_id IS NULL OR hpms_can_see_project(project_id)) "
                   f"WITH CHECK (project_id IS NULL OR hpms_can_see_project(project_id))")


def downgrade():
    for table in ('projects',) + TABLES:
        op.execute(f"DROP POLICY IF EXISTS hpms_project_rows ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP FUNCTION IF EXISTS hpms_can_see_project(uuid)")
