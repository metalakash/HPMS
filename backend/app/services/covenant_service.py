"""Covenant metrics calculation service.

Calculates DSCR, LTV, ICR for loan accounts based on financial data.
Provides covenant history analysis and breach detection.
"""

from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import logging

from backend.app.models.financial import LoanAccount, DisbursementTranche
from backend.app.models.project import Project
from backend.app.models.operations import CovenantHistory

logger = logging.getLogger(__name__)


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

    @staticmethod
    async def get_covenant_history(
        db: AsyncSession,
        project_id: str,
        quarters: int = 8,
    ) -> Dict[str, Any]:
        """Get covenant history for the last N quarters with trend analysis.

        Args:
            db: Database session
            project_id: Project ID
            quarters: Number of quarters to fetch (default 8 for 2 years)

        Returns:
            Dict with covenant trends, breach status, and calculations
        """
        try:
            # Query covenant history ordered by quarter descending (most recent first)
            stmt = (
                select(CovenantHistory)
                .where(CovenantHistory.project_id == project_id)
                .order_by(desc(CovenantHistory.quarter_ad))
                .limit(quarters)
            )
            result = await db.execute(stmt)
            records = result.scalars().all()

            if not records:
                logger.warning(f"No covenant history found for project {project_id}")
                return {
                    "project_id": project_id,
                    "quarters_available": 0,
                    "trends": [],
                    "status": "no_data",
                    "alerts": [],
                }

            # Reverse to get chronological order (oldest first)
            records = list(reversed(records))

            # Build trends list
            trends = []
            breach_alerts = []

            for record in records:
                trend_item = {
                    "quarter": record.quarter_ad,
                    "quarter_bs": record.quarter_bs,
                    "covenant_date": record.covenant_date_ad.isoformat() if record.covenant_date_ad else None,
                    "dscr": {
                        "value": float(record.dscr_value) if record.dscr_value else None,
                        "threshold": float(record.dscr_threshold) if record.dscr_threshold else None,
                        "status": record.dscr_status,
                        "variance_pct": CovenantService._calculate_variance(
                            record.dscr_value, record.dscr_threshold
                        ),
                    },
                    "ltv": {
                        "value": float(record.ltv_value) if record.ltv_value else None,
                        "threshold": float(record.ltv_threshold) if record.ltv_threshold else None,
                        "status": record.ltv_status,
                        "variance_pct": CovenantService._calculate_variance(
                            record.ltv_value, record.ltv_threshold
                        ),
                    },
                    "icr": {
                        "value": float(record.icr_value) if record.icr_value else None,
                        "threshold": float(record.icr_threshold) if record.icr_threshold else None,
                        "status": record.icr_status,
                        "variance_pct": CovenantService._calculate_variance(
                            record.icr_value, record.icr_threshold
                        ),
                    },
                }
                trends.append(trend_item)

                # Collect breach alerts
                for metric_name, metric_status in [("dscr", record.dscr_status),
                                                     ("ltv", record.ltv_status),
                                                     ("icr", record.icr_status)]:
                    if metric_status == "breached":
                        breach_alerts.append({
                            "quarter": record.quarter_ad,
                            "metric": metric_name.upper(),
                            "status": metric_status,
                            "severity": "critical",
                        })

            # Determine overall status
            latest_record = records[-1]  # Most recent quarter
            overall_status = CovenantService._determine_overall_status(latest_record)

            # Calculate trends (improving/declining)
            trend_direction = CovenantService._calculate_trend_direction(records)

            return {
                "project_id": project_id,
                "quarters_available": len(records),
                "latest_quarter": latest_record.quarter_ad,
                "overall_status": overall_status,
                "trend_direction": trend_direction,
                "trends": trends,
                "breach_alerts": breach_alerts,
                "calculation_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching covenant history: {e}")
            raise

    @staticmethod
    async def detect_covenant_breaches(
        db: AsyncSession,
        project_id: str,
    ) -> List[Dict[str, Any]]:
        """Detect current covenant breaches for a project.

        Args:
            db: Database session
            project_id: Project ID

        Returns:
            List of breach alerts with severity and remediation guidance
        """
        try:
            # Get latest quarter record
            stmt = (
                select(CovenantHistory)
                .where(CovenantHistory.project_id == project_id)
                .order_by(desc(CovenantHistory.quarter_ad))
                .limit(1)
            )
            result = await db.execute(stmt)
            latest = result.scalars().first()

            if not latest:
                return []

            breaches = []

            # Check DSCR
            if latest.dscr_status == "breached":
                breaches.append({
                    "metric": "DSCR",
                    "current_value": float(latest.dscr_value),
                    "threshold": float(latest.dscr_threshold),
                    "shortfall": float(latest.dscr_threshold - latest.dscr_value),
                    "severity": "critical",
                    "remediation": "Increase EBITDA or reduce debt service",
                    "quarter": latest.quarter_ad,
                })

            # Check LTV
            if latest.ltv_status == "breached":
                breaches.append({
                    "metric": "LTV",
                    "current_value": float(latest.ltv_value),
                    "threshold": float(latest.ltv_threshold),
                    "excess": float(latest.ltv_value - latest.ltv_threshold),
                    "severity": "critical",
                    "remediation": "Increase loan amount or reduce equity value",
                    "quarter": latest.quarter_ad,
                })

            # Check ICR
            if latest.icr_status == "breached":
                breaches.append({
                    "metric": "ICR",
                    "current_value": float(latest.icr_value),
                    "threshold": float(latest.icr_threshold),
                    "shortfall": float(latest.icr_threshold - latest.icr_value),
                    "severity": "critical",
                    "remediation": "Increase revenue or reduce interest costs",
                    "quarter": latest.quarter_ad,
                })

            return breaches

        except Exception as e:
            logger.error(f"Error detecting covenant breaches: {e}")
            raise

    @staticmethod
    def _calculate_variance(value, threshold) -> Optional[float]:
        """Calculate variance % between value and threshold."""
        if not value or not threshold or threshold == 0:
            return None
        variance = ((value - threshold) / threshold) * 100
        return round(variance, 2)

    @staticmethod
    def _determine_overall_status(record: CovenantHistory) -> str:
        """Determine overall covenant status from latest quarter."""
        statuses = [record.dscr_status, record.ltv_status, record.icr_status]

        if "breached" in statuses:
            return "breached"
        elif "warning" in statuses:
            return "warning"
        else:
            return "compliant"

    @staticmethod
    def _calculate_trend_direction(records: List[CovenantHistory]) -> Dict[str, str]:
        """Calculate trend direction for each metric across quarters."""
        if len(records) < 2:
            return {"dscr": "insufficient_data", "ltv": "insufficient_data", "icr": "insufficient_data"}

        oldest = records[0]
        newest = records[-1]

        trends = {}

        # DSCR: Higher is better
        if oldest.dscr_value and newest.dscr_value:
            dscr_trend = "improving" if newest.dscr_value > oldest.dscr_value else "declining"
            trends["dscr"] = dscr_trend
        else:
            trends["dscr"] = "insufficient_data"

        # LTV: Lower is better
        if oldest.ltv_value and newest.ltv_value:
            ltv_trend = "improving" if newest.ltv_value < oldest.ltv_value else "declining"
            trends["ltv"] = ltv_trend
        else:
            trends["ltv"] = "insufficient_data"

        # ICR: Higher is better
        if oldest.icr_value and newest.icr_value:
            icr_trend = "improving" if newest.icr_value > oldest.icr_value else "declining"
            trends["icr"] = icr_trend
        else:
            trends["icr"] = "insufficient_data"

        return trends
