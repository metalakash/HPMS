"""Covenant tests move from calendar quarters to Nepali fiscal quarters.

Reported financials and covenant results are keyed by quarter label. A calendar quarter's figures
(2026-Q2 = April to June) are not a fiscal quarter's (2082-83-Q4 = Baisakh to Ashad), so the old
rows cannot be relabelled: they are removed, and the figures are re-entered or reseeded per fiscal
quarter. Loan metrics derived from them are cleared with them.
"""
from alembic import op

revision = '026_fiscal_quarter_covenants'
down_revision = '025_new_loan_pipeline'
branch_labels = None
depends_on = None

CALENDAR_LABEL = r'^\d{4}-Q[1-4]$'


def upgrade():
    op.execute(f"DELETE FROM covenant_history WHERE quarter_ad ~ '{CALENDAR_LABEL}'")
    op.execute(f"DELETE FROM project_financial_periods WHERE quarter_ad ~ '{CALENDAR_LABEL}'")
    op.execute("""
        UPDATE loan_accounts SET dscr = NULL, icr = NULL, ltv = NULL, metric_as_of_date = NULL
        WHERE project_id NOT IN (SELECT project_id FROM covenant_history)
    """)


def downgrade():
    # The removed rows cannot be restored; fiscal-quarter rows are left for the older code to reject.
    pass
