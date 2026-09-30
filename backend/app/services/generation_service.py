"""Generation and PPA revenue calculation service."""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Dict, Any, Optional
from decimal import Decimal
import logging

from backend.app.models.operations import EnergyGenerationData, PPAAgreement, NEAPPARate
from backend.app.models.project import Project

logger = logging.getLogger(__name__)


class GenerationService:
    """Service for generation data analysis and revenue calculations."""

    @staticmethod
    async def get_generation_ppa_data(
        db: AsyncSession,
        project_id: str,
        start_month: Optional[str] = None,
        end_month: Optional[str] = None,
        months: int = 24,
    ) -> Dict[str, Any]:
        """Get generation and PPA data with revenue calculations.

        Args:
            db: Database session
            project_id: Project ID
            start_month: Start date in ISO format (default: 24 months ago)
            end_month: End date in ISO format (default: today)
            months: Number of months to fetch if dates not provided

        Returns:
            Dict with generation data, PPA info, tariff rates, revenue, and variance
        """
        try:
            # Get PPA agreement
            ppa_stmt = (
                select(PPAAgreement)
                .where(PPAAgreement.project_id == project_id)
                .where(PPAAgreement.status == 'active')
                .order_by(desc(PPAAgreement.effective_date_ad))
                .limit(1)
            )
            ppa_result = await db.execute(ppa_stmt)
            ppa = ppa_result.scalars().first()

            # Get generation data
            gen_stmt = (
                select(EnergyGenerationData)
                .where(EnergyGenerationData.project_id == project_id)
                .order_by(desc(EnergyGenerationData.month_ad))
                .limit(months)
            )
            gen_result = await db.execute(gen_stmt)
            gen_records = list(reversed(gen_result.scalars().all()))

            if not gen_records:
                return {
                    "project_id": project_id,
                    "ppa": None,
                    "monthly_data": [],
                    "summary": {
                        "total_generated_mwh": 0,
                        "total_contract_mwh": 0,
                        "total_revenue_npr": 0,
                        "avg_variance_pct": 0,
                        "months_available": 0,
                    },
                }

            # Build monthly data with calculations
            monthly_data = []
            total_generated = Decimal("0")
            total_contract = Decimal("0")
            total_revenue = Decimal("0")
            variance_list = []

            for record in gen_records:
                # Revenue already calculated in model, but validate
                if record.actual_energy_mwh and record.revenue_npr:
                    revenue = record.revenue_npr
                else:
                    revenue = Decimal("0")

                # Calculate variance
                variance = GenerationService._calculate_variance(
                    record.actual_energy_mwh,
                    record.contract_energy_mwh
                )

                monthly_item = {
                    "month": record.month_ad.isoformat() if record.month_ad else None,
                    "month_bs": record.month_bs,
                    "season": record.season,
                    "contract_mwh": float(record.contract_energy_mwh) if record.contract_energy_mwh else None,
                    "actual_mwh": float(record.actual_energy_mwh) if record.actual_energy_mwh else None,
                    "variance_pct": variance,
                    "variance_status": GenerationService._get_variance_status(variance),
                    "availability_pct": float(record.availability_pct) if record.availability_pct else None,
                    "curtailment_mwh": float(record.curtailment_mwh) if record.curtailment_mwh else 0,
                    "revenue_npr": float(revenue) if revenue else None,
                }
                monthly_data.append(monthly_item)

                # Accumulate totals
                if record.actual_energy_mwh:
                    total_generated += record.actual_energy_mwh
                if record.contract_energy_mwh:
                    total_contract += record.contract_energy_mwh
                if record.revenue_npr:
                    total_revenue += record.revenue_npr
                if variance is not None:
                    variance_list.append(variance)

            # Calculate overall variance
            avg_variance = sum(variance_list) / len(variance_list) if variance_list else 0

            # Get tariff rates
            nea_rates = await GenerationService._get_current_tariff_rates(db, project_id)

            return {
                "project_id": project_id,
                "ppa": {
                    "agreement_number": ppa.agreement_number if ppa else None,
                    "purchaser": ppa.purchaser if ppa else None,
                    "tariff_type": ppa.tariff_type if ppa else None,
                    "escalation_pct": float(ppa.escalation_pct_annual) if ppa and ppa.escalation_pct_annual else None,
                    "status": ppa.status if ppa else None,
                } if ppa else None,
                "tariff_rates": nea_rates,
                "monthly_data": monthly_data,
                "summary": {
                    "total_generated_mwh": float(total_generated),
                    "total_contract_mwh": float(total_contract),
                    "total_revenue_npr": float(total_revenue),
                    "avg_variance_pct": round(avg_variance, 2),
                    "months_available": len(monthly_data),
                },
                "calculation_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching generation data: {e}")
            raise

    @staticmethod
    async def get_maintenance_impact(
        db: AsyncSession,
        project_id: str,
    ) -> Dict[str, Any]:
        """Get impact of maintenance on generation (outage analysis).

        Args:
            db: Database session
            project_id: Project ID

        Returns:
            Dict with maintenance impact metrics
        """
        # TODO: Implement when MaintenanceLog queries are ready
        return {
            "project_id": project_id,
            "total_planned_outage_mwh": 0,
            "total_forced_outage_mwh": 0,
            "impact_pct": 0,
        }

    @staticmethod
    async def _get_current_tariff_rates(db: AsyncSession, project_id: str) -> Dict[str, Any]:
        """Get current active tariff rates."""
        stmt = (
            select(NEAPPARate)
            .where(NEAPPARate.project_id == project_id)
            .where(NEAPPARate.is_current == True)
        )
        result = await db.execute(stmt)
        rates = result.scalars().all()

        if not rates:
            return {}

        rates_dict = {}
        for rate in rates:
            season = rate.season or "all_year"
            rates_dict[season] = {
                "rate_per_mwh_npr": float(rate.rate_per_mwh_npr),
                "fixed_charge_npr": float(rate.fixed_charge_npr) if rate.fixed_charge_npr else 0,
                "variable_charge_pct": float(rate.variable_charge_pct) if rate.variable_charge_pct else 0,
                "effective_date": rate.valid_from_ad.isoformat() if rate.valid_from_ad else None,
            }

        return rates_dict

    @staticmethod
    def _calculate_variance(actual, contract) -> Optional[float]:
        """Calculate variance % between actual and contract."""
        if not actual or not contract or contract == 0:
            return None
        variance = ((actual - contract) / contract) * 100
        return round(variance, 2)

    @staticmethod
    def _get_variance_status(variance) -> str:
        """Determine variance status (ok, warning, critical)."""
        if variance is None:
            return "unknown"
        if abs(variance) <= 5:
            return "ok"
        elif abs(variance) <= 10:
            return "warning"
        else:
            return "critical"
