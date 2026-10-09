"""Portfolio-wide views built from the operations data: plant performance, maintenance, users.

- GET /api/v1/analytics/performance   generation, plant performance and open risks per operating project
- GET /api/v1/loans/projection        the quarterly loan projection, portfolio totals and per borrower
- GET /api/v1/energy-financing        energy-sector financing against the regulator's minimum, by quarter
- GET /api/v1/maintenance             upcoming and completed maintenance across visible projects
- GET /api/v1/admin/users             user accounts (admin only)

All are read-only and respect project visibility, except the energy-financing ratio, which is a
figure for the bank as a whole.
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
from backend.app.models.financial import (
    EnergyBond, EnergyFinancingQuarter, LoanAccount, LoanProjectionQuarter, NewLoanDisbursementQuarter, NewLoanLimit,
)
from backend.app.models.operations import (
    CovenantHistory, EnergyGenerationData, MaintenanceLog, MaintenanceSchedule, PlantPerformance,
)
from backend.app.models.project import Project
from backend.app.models.risk import RiskRegisterEntry
from backend.app.schemas.common import ApiResponse, AuditMetadata, ResponseMeta
from backend.app.security.auth_middleware import CurrentUser, get_current_user, require_admin
from backend.app.security.rls_service import RLSService
from backend.app.services import covenant_engine, energy_financing

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


QUARTER_LABELS = {1: "Ashoj end", 2: "Poush end", 3: "Chaitra end", 4: "Ashad end"}


@router.get("/loans/projection", response_model=ApiResponse[dict])
async def loan_projection(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """The quarterly loan projection for the visible projects.

    ``quarters`` are the portfolio totals per fiscal quarter, oldest first; the first is the
    opening position the projection starts from. ``projects`` carry each borrower's outstanding
    for the same quarters, in the same order. The figures are the lender's plan as it was
    prepared, not a forecast made here.
    """
    visible = await RLSService.get_authorized_project_ids(db, current_user)
    records = (await db.execute(
        select(LoanProjectionQuarter).where(LoanProjectionQuarter.project_id.in_(visible))
        .order_by(LoanProjectionQuarter.period_end_ad)
    )).scalars().all() if visible else []
    if not records:
        return _respond({"quarters": [], "projects": []}, current_user, "read_loan_projection")

    zero = Decimal("0")
    quarters: Dict[date, Dict[str, Any]] = {}
    by_project: Dict[Any, Dict[date, LoanProjectionQuarter]] = defaultdict(dict)
    for record in records:
        by_project[record.project_id][record.period_end_ad] = record
        quarter = quarters.setdefault(record.period_end_ad, {
            "fiscal_year": record.fiscal_year, "quarter": record.quarter, "label": QUARTER_LABELS.get(record.quarter),
            "period_end_ad": record.period_end_ad.isoformat(), "period_end_bs": record.period_end_bs,
            "is_opening": record.is_opening, "disbursement": zero, "repayment": zero, "outstanding": zero,
        })
        quarter["disbursement"] += record.projected_disbursement
        quarter["repayment"] += record.projected_repayment
        quarter["outstanding"] += record.projected_outstanding

    projects = {p.id: p for p in (await db.execute(select(Project).where(Project.id.in_(by_project)))).scalars()}
    limits = dict((await db.execute(
        select(LoanAccount.project_id, func.sum(LoanAccount.sanctioned_amount))
        .where(LoanAccount.project_id.in_(by_project)).group_by(LoanAccount.project_id)
    )).all())

    rows: List[Dict[str, Any]] = []
    for project_id, own in by_project.items():
        project = projects[project_id]
        outstanding = [own[end].projected_outstanding if end in own else None for end in quarters]
        held = [value for value in outstanding if value is not None]
        rows.append({
            "project_id": str(project.id), "project_code": project.project_code, "project_name": project.name_en,
            "pipeline_status": project.pipeline_status, "sanctioned_amount": limits.get(project_id),
            "opening_outstanding": held[0], "closing_outstanding": held[-1], "peak_outstanding": max(held),
            "total_disbursement": sum((r.projected_disbursement for r in own.values()), zero),
            "total_repayment": sum((r.projected_repayment for r in own.values()), zero),
            "outstanding": outstanding,
        })
    rows.sort(key=lambda r: (-r["total_disbursement"], r["project_name"]))
    return _respond({"quarters": list(quarters.values()), "projects": rows}, current_user, "read_loan_projection")


@router.get("/energy-financing", response_model=ApiResponse[dict])
async def energy_financing_ratio(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Energy-sector financing as a share of the bank's loans, against the regulator's minimum.

    Worked out here for every quarter on file (see services/energy_financing). It is a bank-wide
    figure, so it covers the whole hydropower book whatever projects the caller can open.

    Each quarter also carries ``with_pipeline``: the same test with the disbursement planned from
    new limits (lending not yet approved) added to the projected book.
    """
    inputs = (await db.execute(
        select(EnergyFinancingQuarter).order_by(EnergyFinancingQuarter.period_end_ad))).scalars().all()
    bonds = (await db.execute(select(EnergyBond).order_by(EnergyBond.investment_date_ad))).scalars().all()
    projected = dict((await db.execute(
        select(LoanProjectionQuarter.period_end_ad, func.sum(LoanProjectionQuarter.projected_outstanding))
        .group_by(LoanProjectionQuarter.period_end_ad)
    )).all())

    limits = (await db.execute(select(NewLoanLimit).order_by(NewLoanLimit.fiscal_year))).scalars().all()
    planned = (await db.execute(
        select(NewLoanDisbursementQuarter).order_by(NewLoanDisbursementQuarter.period_end_ad))).scalars().all()

    quarter_inputs = [energy_financing.QuarterInput(
        period_end=q.period_end_ad, bank_total_loans=q.bank_total_loans, required_pct=q.required_pct,
        hydro_outstanding_actual=q.hydro_outstanding_actual, energy_bond_actual=q.energy_bond_actual) for q in inputs]
    register = [energy_financing.Bond(b.amount, b.investment_date_ad, b.maturity_date_ad) for b in bonds]
    new_lending = energy_financing.cumulative(
        {p.period_end_ad: p.planned_disbursement for p in planned}, [q.period_end_ad for q in inputs])
    results = energy_financing.calculate(quarter_inputs, projected, register)
    scenario = energy_financing.calculate(quarter_inputs, projected, register, new_lending)

    today = date.today()
    quarters = [{
        "fiscal_year": q.fiscal_year, "quarter": q.quarter, "label": QUARTER_LABELS.get(q.quarter),
        "period_end_ad": q.period_end_ad.isoformat(), "period_end_bs": q.period_end_bs,
        "is_actual": r.is_actual, "hydro_outstanding": r.hydro_outstanding, "energy_bonds": r.energy_bonds,
        "energy_financing": r.energy_financing, "base_loans": r.base_loans, "ratio_pct": r.ratio_pct,
        "required_pct": r.required_pct, "requirement": r.requirement, "headroom": r.headroom, "status": r.status,
        "with_pipeline": {
            "new_loans_outstanding": Decimal("0") if r.is_actual else new_lending[q.period_end_ad],
            "ratio_pct": s.ratio_pct, "headroom": s.headroom, "status": s.status,
        } if planned else None,
    } for q, r, s in zip(inputs, results, scenario) if r.ratio_pct is not None]
    return _respond({
        "quarters": quarters,
        "pipeline": {
            "limits": [{"fiscal_year": l.fiscal_year, "new_limit": l.new_limit, "drawdown_pct": l.drawdown_pct}
                       for l in limits],
            "total_limit": sum((l.new_limit for l in limits), Decimal("0")),
            "quarters": [{
                "fiscal_year": p.fiscal_year, "quarter": p.quarter, "label": QUARTER_LABELS.get(p.quarter),
                "period_end_ad": p.period_end_ad.isoformat(), "period_end_bs": p.period_end_bs,
                "planned_disbursement": p.planned_disbursement,
            } for p in planned],
            "total_disbursement": sum((p.planned_disbursement for p in planned), Decimal("0")),
        },
        "bonds": [{
            "id": str(b.id), "name": b.name, "amount": b.amount, "yield_pct": b.yield_pct,
            "investment_date_ad": b.investment_date_ad.isoformat() if b.investment_date_ad else None,
            "maturity_date_ad": b.maturity_date_ad.isoformat() if b.maturity_date_ad else None,
            "maturity_date_bs": b.maturity_date_bs,
            "held": (b.investment_date_ad is None or b.investment_date_ad <= today)
                    and (b.maturity_date_ad is None or b.maturity_date_ad > today),
        } for b in bonds],
        "bonds_held": energy_financing.bonds_held(register, today),
    }, current_user, "read_energy_financing")


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
