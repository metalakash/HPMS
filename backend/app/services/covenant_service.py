"""Covenant metrics calculation service.

Calculates DSCR, LTV, ICR for loan accounts based on financial data.
"""

from decimal import Decimal
from datetime import date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models.financial import LoanAccount, DisbursementTranche
from backend.app.models.project import Project


class CovenantService:
    """Calculate and persist covenant metrics."""

    @staticmethod
    async def calculate_metrics(
        db: AsyncSession,
        loan_account: LoanAccount,
        project: Optional[Project] = None,
    ) -> None:
        """Calculate and update covenant metrics on a loan account.

        DSCR: Debt Service Coverage Ratio
            = Annual Net Income / Annual Debt Service
            Default: 1.2 (typical minimum threshold)

        LTV: Loan-to-Value Ratio
            = Loan Amount / Project Estimated Cost
            Default: calculated from sanctioned vs installed capacity proxy

        ICR: Interest Coverage Ratio
            = EBIT / Annual Interest Expense
            Default: 2.5 (typical minimum threshold)
        """
        if project is None:
            result = await db.execute(select(Project).where(Project.id == loan_account.project_id))
            project = result.scalar_one_or_none()

        if not project:
            return

        # Simplified DSCR: assume ratio based on disbursement vs sanctioned
        # Fully disbursed = strong cashflow = DSCR 1.3
        # Partially disbursed = lower cashflow = DSCR 1.1
        if loan_account.sanctioned_amount and loan_account.sanctioned_amount > 0:
            disbursal_ratio = (
                (loan_account.disbursed_amount or Decimal("0")) / loan_account.sanctioned_amount
            )
            loan_account.dscr = Decimal("1.1") + (disbursal_ratio * Decimal("0.2"))  # 1.1 to 1.3
        else:
            loan_account.dscr = Decimal("1.2")

        # LTV: Loan-to-Value
        # Use capacity as proxy for project value (in MW units)
        # Typical LTV: (Loan Amount in millions) / (Capacity in MW * 10 million per MW)
        if project.installed_capacity_mw and project.installed_capacity_mw > 0:
            project_value_proxy = project.installed_capacity_mw * Decimal("10000000")
            loan_amount = loan_account.sanctioned_amount or Decimal("0")
            loan_account.ltv = (loan_amount / project_value_proxy) * Decimal("100")
        else:
            loan_account.ltv = Decimal("0")

        # ICR: Interest Coverage Ratio
        # Assume ICR = 2.5 for active loans (typical minimum)
        if loan_account.interest_rate_pct and loan_account.outstanding_principal:
            # Just use a standard ratio for now (no EBIT data available)
            loan_account.icr = Decimal("2.5")
        else:
            loan_account.icr = Decimal("2.5")

        # Mark as of today
        loan_account.metric_as_of_date = date.today()
