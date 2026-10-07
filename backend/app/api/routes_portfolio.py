"""Portfolio-wide views built from the operations data: plant performance, maintenance, users.

- GET /api/v1/analytics/performance   generation, plant performance and open risks per operating project
- GET /api/v1/maintenance             upcoming and completed maintenance across visible projects
- GET /api/v1/admin/users             user accounts (admin only)

All three are read-only and respect project visibility.
"""

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.auth import User
from backend.app.models.operations import (
    CovenantHistory, EnergyGenerationData, MaintenanceLog, MaintenanceSchedule, PlantPerformance,
)
from backend.app.models.project import Project
from backend.app.models.risk import RiskRegisterEntry
from backend.app.schemas.common import ApiResponse, AuditMetadata, ResponseMeta
from backend.app.security.auth_middleware import CurrentUser, get_current_user, require_admin
from backend.app.security.rls_service import RLSService
from backend.app.services import covenant_engine

router = APIRouter(prefix="/api/v1", tags=["portfolio"])

OPEN_RISK_STATES = ("open", "in_progress")
MWH_PER_GWH = Decimal("1000")


def _respond(data: Any, user: CurrentUser, action: str) -> ApiResponse[Any]:
    now = datetime.utcnow().isoformat()
    return ApiResponse(
        data=data,
        meta=ResponseMeta(timestamp=now, version="0.1.0", page=None, page_size=None, total_count=None),
        audit=AuditMetadata(user_id=user.username, action=action, timestamp=now),
    )


def _pct(part: Decimal, whole: Decimal) -> Decimal | None:
    return (part / whole * 100).quantize(Decimal("0.01")) if whole else None


@router.get("/analytics/performance", response_model=ApiResponse[list])
async def portfolio_performance(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[list]:
    """What each generating project delivered over the months on file, against its contract.

    One row per visible project that has generation data, weakest delivery first. Figures are
    sums and averages of the recorded months; nothing is forecast.
    """
    visible = await RLSService.get_authorized_project_ids(db, current_user)
    if not visible:
        return _respond([], current_user, "read_portfolio_performance")

    generation = (await db.execute(
        select(
            EnergyGenerationData.project_id,
            func.count().label("months"),
            func.min(EnergyGenerationData.month_ad).label("first_month"),
            func.max(EnergyGenerationData.month_ad).label("last_month"),
            func.sum(EnergyGenerationData.actual_energy_mwh).label("actual"),
            func.sum(EnergyGenerationData.contract_energy_mwh).label("contract"),
            func.sum(EnergyGenerationData.revenue_npr).label("revenue"),
        ).where(EnergyGenerationData.project_id.in_(visible)).group_by(EnergyGenerationData.project_id)
    )).all()
    ids = [row.project_id for row in generation]
    if not ids:
        return _respond([], current_user, "read_portfolio_performance")

    projects = {p.id: p for p in (await db.execute(select(Project).where(Project.id.in_(ids)))).scalars()}
    plant = {row.project_id: row for row in (await db.execute(
        select(
            PlantPerformance.project_id,
            func.avg(PlantPerformance.plf_pct).label("plf"),
            func.avg(PlantPerformance.availability_pct).label("availability"),
            func.sum(PlantPerformance.forced_outage_hours).label("forced_outage_hours"),
        ).where(PlantPerformance.project_id.in_(ids)).group_by(PlantPerformance.project_id)
    )).all()}

    risks: Dict[Any, Dict[str, int]] = defaultdict(lambda: {"open": 0, "serious": 0})
    for project_id, severity, count in (await db.execute(
        select(RiskRegisterEntry.project_id, RiskRegisterEntry.severity, func.count())
        .where(RiskRegisterEntry.project_id.in_(ids), RiskRegisterEntry.mitigation_status.in_(OPEN_RISK_STATES))
        .group_by(RiskRegisterEntry.project_id, RiskRegisterEntry.severity)
    )).all():
        risks[project_id]["open"] += count
        if severity in ("high", "critical"):
            risks[project_id]["serious"] += count

    covenants = {}
    for record in (await db.execute(
        select(CovenantHistory).where(CovenantHistory.project_id.in_(ids))
        .distinct(CovenantHistory.project_id)
        .order_by(CovenantHistory.project_id, CovenantHistory.quarter_ad.desc())
    )).scalars():
        covenants[record.project_id] = covenant_engine.overall_status(
            [record.dscr_status, record.ltv_status, record.icr_status])

    rows: List[Dict[str, Any]] = []
    for row in generation:
        project = projects[row.project_id]
        performance = plant.get(row.project_id)
        actual, contract = row.actual or Decimal("0"), row.contract or Decimal("0")
        rows.append({
            "project_id": str(project.id), "project_code": project.project_code, "project_name": project.name_en,
            "installed_capacity_mw": project.installed_capacity_mw,
            "months": row.months, "first_month": row.first_month.isoformat(), "last_month": row.last_month.isoformat(),
            "actual_gwh": (actual / MWH_PER_GWH).quantize(Decimal("0.01")),
            "contract_gwh": (contract / MWH_PER_GWH).quantize(Decimal("0.01")),
            "delivery_pct": _pct(actual, contract),
            "revenue_npr": row.revenue,
            "avg_plf_pct": performance.plf.quantize(Decimal("0.01")) if performance and performance.plf else None,
            "avg_availability_pct": (performance.availability.quantize(Decimal("0.01"))
                                     if performance and performance.availability else None),
            "forced_outage_hours": int(performance.forced_outage_hours or 0) if performance else None,
            "open_risks": risks[project.id]["open"], "serious_risks": risks[project.id]["serious"],
            "covenant_status": covenants.get(project.id),
        })
    rows.sort(key=lambda r: (r["delivery_pct"] if r["delivery_pct"] is not None else Decimal("999"),
                             r["project_name"]))
    return _respond(rows, current_user, "read_portfolio_performance")


@router.get("/maintenance", response_model=ApiResponse[dict])
async def portfolio_maintenance(
    days_back: int = Query(365, ge=1, le=1825, description="How far back to list completed work"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Maintenance still to do (soonest first) and work completed in the period (latest first)."""
    visible = await RLSService.get_authorized_project_ids(db, current_user)
    if not visible:
        return _respond({"upcoming": [], "completed": []}, current_user, "read_portfolio_maintenance")
    today = date.today()

    def base(project: Project) -> Dict[str, Any]:
        return {"project_id": str(project.id), "project_code": project.project_code,
                "project_name": project.name_en}

    upcoming = [{
        **base(project), "id": str(item.id), "equipment_name": item.equipment_name,
        "maintenance_type": item.maintenance_type, "scheduled_date_ad": item.scheduled_date_ad.isoformat(),
        "scheduled_date_bs": item.scheduled_date_bs, "estimated_duration_hours": item.estimated_duration_hours,
        "estimated_impact_mwh": item.estimated_impact_mwh, "contractor_name": item.contractor_name,
        "status": item.status, "overdue": item.scheduled_date_ad < today,
    } for item, project in (await db.execute(
        select(MaintenanceSchedule, Project).join(Project, Project.id == MaintenanceSchedule.project_id)
        .where(MaintenanceSchedule.project_id.in_(visible),
               MaintenanceSchedule.status.in_(("scheduled", "in_progress")))
        .order_by(MaintenanceSchedule.scheduled_date_ad, Project.name_en)
    )).all()]

    completed = [{
        **base(project), "id": str(item.id), "equipment_name": item.equipment_name,
        "maintenance_type": item.maintenance_type, "actual_date_ad": item.actual_date_ad.isoformat(),
        "actual_date_bs": item.actual_date_bs, "duration_hours": item.duration_hours,
        "downtime_mwh": item.downtime_mwh, "cost_npr": item.cost_npr, "contractor_name": item.contractor_name,
        "notes": item.notes,
    } for item, project in (await db.execute(
        select(MaintenanceLog, Project).join(Project, Project.id == MaintenanceLog.project_id)
        .where(MaintenanceLog.project_id.in_(visible),
               MaintenanceLog.actual_date_ad >= date.fromordinal(today.toordinal() - days_back))
        .order_by(MaintenanceLog.actual_date_ad.desc(), Project.name_en)
    )).all()]
    return _respond({"upcoming": upcoming, "completed": completed}, current_user, "read_portfolio_maintenance")


@router.get("/admin/users", response_model=ApiResponse[list])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
) -> ApiResponse[list]:
    """Accounts that have signed in or been provisioned, with their default role. Admin only."""
    users = (await db.execute(select(User).order_by(User.username))).scalars().all()
    return _respond([{
        "id": str(u.id), "username": u.username, "full_name": u.full_name, "email": u.email,
        "role": getattr(u.default_role, "value", u.default_role), "is_active": bool(u.is_active),
        "directory_synced": bool(u.is_ad_synced),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    } for u in users], current_user, "list_users")
