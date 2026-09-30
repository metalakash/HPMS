"""Maintenance and plant performance service."""
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, Optional
import logging

from backend.app.models.operations import (
    MaintenanceSchedule,
    MaintenanceLog,
    PlantPerformance,
)

logger = logging.getLogger(__name__)


class MaintenanceService:
    """Service for maintenance tracking and plant performance analysis."""

    @staticmethod
    async def get_maintenance_data(
        db: AsyncSession,
        project_id: str,
        months: int = 12,
    ) -> Dict[str, Any]:
        """Get maintenance schedules, logs, and plant performance.

        Args:
            db: Database session
            project_id: Project ID
            months: Number of months to fetch

        Returns:
            Dict with schedules, logs, and performance metrics
        """
        try:
            # Get upcoming maintenance schedules
            today = datetime.utcnow().date()
            future_date = today + timedelta(days=90)

            sched_stmt = (
                select(MaintenanceSchedule)
                .where(MaintenanceSchedule.project_id == project_id)
                .where(MaintenanceSchedule.scheduled_date_ad >= today)
                .where(MaintenanceSchedule.scheduled_date_ad <= future_date)
                .order_by(MaintenanceSchedule.scheduled_date_ad)
            )
            sched_result = await db.execute(sched_stmt)
            schedules = sched_result.scalars().all()

            # Get recent maintenance logs
            log_stmt = (
                select(MaintenanceLog)
                .where(MaintenanceLog.project_id == project_id)
                .order_by(desc(MaintenanceLog.actual_date_ad))
                .limit(months * 3)  # Assume ~3 maintenance events per month
            )
            log_result = await db.execute(log_stmt)
            logs = log_result.scalars().all()

            # Get plant performance
            perf_stmt = (
                select(PlantPerformance)
                .where(PlantPerformance.project_id == project_id)
                .order_by(desc(PlantPerformance.month_ad))
                .limit(months)
            )
            perf_result = await db.execute(perf_stmt)
            performance = list(reversed(perf_result.scalars().all()))

            # Format schedules
            schedule_data = []
            for sched in schedules:
                schedule_data.append({
                    "id": str(sched.id),
                    "equipment_name": sched.equipment_name,
                    "maintenance_type": sched.maintenance_type,
                    "scheduled_date": sched.scheduled_date_ad.isoformat() if sched.scheduled_date_ad else None,
                    "estimated_duration_hours": sched.estimated_duration_hours,
                    "estimated_impact_mwh": float(sched.estimated_impact_mwh) if sched.estimated_impact_mwh else 0,
                    "contractor_name": sched.contractor_name,
                    "status": sched.status,
                })

            # Format logs
            log_data = []
            total_downtime_mwh = 0
            total_maintenance_cost = 0

            for log in logs[:months * 3]:  # Limit to recent logs
                downtime = float(log.downtime_mwh) if log.downtime_mwh else 0
                cost = float(log.cost_npr) if log.cost_npr else 0

                log_data.append({
                    "id": str(log.id),
                    "equipment_name": log.equipment_name,
                    "maintenance_type": log.maintenance_type,
                    "actual_date": log.actual_date_ad.isoformat() if log.actual_date_ad else None,
                    "duration_hours": log.duration_hours,
                    "downtime_mwh": downtime,
                    "contractor_name": log.contractor_name,
                    "cost_npr": cost,
                })

                total_downtime_mwh += downtime
                total_maintenance_cost += cost

            # Format performance
            perf_data = []
            avg_availability = 0
            avg_plf = 0

            for perf in performance:
                perf_data.append({
                    "month": perf.month_ad.isoformat() if perf.month_ad else None,
                    "month_bs": perf.month_bs,
                    "efficiency_pct": float(perf.efficiency_pct) if perf.efficiency_pct else 0,
                    "availability_pct": float(perf.availability_pct) if perf.availability_pct else 0,
                    "availability_hours": perf.availability_hours or 0,
                    "outage_hours": perf.outage_hours or 0,
                    "forced_outage_count": perf.forced_outage_count or 0,
                    "forced_outage_hours": perf.forced_outage_hours or 0,
                    "scheduled_maintenance_hours": perf.scheduled_maintenance_outage_hours or 0,
                    "plf_pct": float(perf.plf_pct) if perf.plf_pct else 0,
                })
                avg_availability += float(perf.availability_pct) if perf.availability_pct else 0
                avg_plf += float(perf.plf_pct) if perf.plf_pct else 0

            if performance:
                avg_availability = avg_availability / len(performance)
                avg_plf = avg_plf / len(performance)

            return {
                "project_id": project_id,
                "maintenance_schedules": {
                    "upcoming_count": len(schedule_data),
                    "schedules": schedule_data,
                },
                "maintenance_logs": {
                    "recent_count": len(log_data),
                    "total_downtime_mwh": round(total_downtime_mwh, 2),
                    "total_maintenance_cost_npr": round(total_maintenance_cost, 2),
                    "avg_maintenance_cost_per_event": round(total_maintenance_cost / len(log_data), 2) if log_data else 0,
                    "logs": log_data,
                },
                "plant_performance": {
                    "months_available": len(perf_data),
                    "avg_availability_pct": round(avg_availability, 2),
                    "avg_plf_pct": round(avg_plf, 2),
                    "monthly_data": perf_data,
                },
                "calculation_date": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching maintenance data: {e}")
            raise
