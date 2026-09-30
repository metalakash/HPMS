"""ESG metrics and sustainability tracking service."""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, Optional
import logging

from backend.app.models.operations import ESGMetrics, EIAMitigationChecklist

logger = logging.getLogger(__name__)


class ESGService:
    """Service for ESG metrics aggregation and reporting."""

    @staticmethod
    async def get_esg_data(
        db: AsyncSession,
        project_id: str,
    ) -> Dict[str, Any]:
        """Get ESG metrics and EIA mitigation progress.

        Args:
            db: Database session
            project_id: Project ID

        Returns:
            Dict with ESG metrics and EIA mitigation checklist
        """
        try:
            # Get latest ESG metrics
            esg_stmt = (
                select(ESGMetrics)
                .where(ESGMetrics.project_id == project_id)
                .order_by(desc(ESGMetrics.metric_date_ad))
                .limit(1)
            )
            esg_result = await db.execute(esg_stmt)
            latest_esg = esg_result.scalars().first()

            # Get EIA mitigation checklist
            eia_stmt = (
                select(EIAMitigationChecklist)
                .where(EIAMitigationChecklist.project_id == project_id)
                .order_by(EIAMitigationChecklist.status)
            )
            eia_result = await db.execute(eia_stmt)
            eia_measures = eia_result.scalars().all()

            # Build EIA summary
            eia_summary = ESGService._calculate_eia_progress(eia_measures)

            return {
                "project_id": project_id,
                "environmental": {
                    "carbon_credits_generated": float(latest_esg.carbon_credits_generated) if latest_esg and latest_esg.carbon_credits_generated else 0,
                    "ghg_emissions_avoided_tonnes": float(latest_esg.ghg_emissions_avoided_tonnes) if latest_esg and latest_esg.ghg_emissions_avoided_tonnes else 0,
                    "co2_avoided_tonnes_per_year": float(latest_esg.co2_avoided_tonnes_per_year) if latest_esg and latest_esg.co2_avoided_tonnes_per_year else 0,
                } if latest_esg else {
                    "carbon_credits_generated": 0,
                    "ghg_emissions_avoided_tonnes": 0,
                    "co2_avoided_tonnes_per_year": 0,
                },
                "social": {
                    "local_employment_count": latest_esg.local_employment_count if latest_esg and latest_esg.local_employment_count else 0,
                    "community_grievance_count": latest_esg.community_grievance_count if latest_esg and latest_esg.community_grievance_count else 0,
                    "grievance_resolution_rate_pct": float(latest_esg.grievance_resolution_rate_pct) if latest_esg and latest_esg.grievance_resolution_rate_pct else 0,
                } if latest_esg else {
                    "local_employment_count": 0,
                    "community_grievance_count": 0,
                    "grievance_resolution_rate_pct": 0,
                },
                "metrics_as_of": latest_esg.metric_date_ad.isoformat() if latest_esg and latest_esg.metric_date_ad else None,
                "eia_mitigation": {
                    "total_measures": len(eia_measures),
                    "completed_measures": eia_summary["completed"],
                    "in_progress_measures": eia_summary["in_progress"],
                    "planned_measures": eia_summary["planned"],
                    "overall_completion_pct": eia_summary["overall_pct"],
                    "measures": ESGService._format_eia_measures(eia_measures),
                },
                "calculation_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching ESG data: {e}")
            raise

    @staticmethod
    def _calculate_eia_progress(measures) -> Dict[str, Any]:
        """Calculate EIA mitigation progress."""
        if not measures:
            return {
                "completed": 0,
                "in_progress": 0,
                "planned": 0,
                "overall_pct": 0,
            }

        completed = sum(1 for m in measures if m.status == "completed")
        in_progress = sum(1 for m in measures if m.status == "in_progress")
        planned = sum(1 for m in measures if m.status == "planned")

        # Calculate overall completion as weighted average
        total_pct = sum(m.completion_pct or 0 for m in measures)
        overall_pct = total_pct / len(measures) if measures else 0

        return {
            "completed": completed,
            "in_progress": in_progress,
            "planned": planned,
            "overall_pct": round(float(overall_pct), 2),
        }

    @staticmethod
    def _format_eia_measures(measures) -> list:
        """Format EIA measures for API response."""
        formatted = []
        for measure in measures:
            formatted.append({
                "id": str(measure.id),
                "measure": measure.mitigation_measure,
                "description": measure.description,
                "status": measure.status,
                "completion_pct": float(measure.completion_pct) if measure.completion_pct else 0,
                "responsible_party": measure.responsible_party,
                "due_date": measure.due_date_ad.isoformat() if measure.due_date_ad else None,
                "due_date_bs": measure.due_date_bs,
                "completion_date": measure.completion_date_ad.isoformat() if measure.completion_date_ad else None,
            })
        return formatted
