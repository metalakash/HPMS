"""One report across sources, a row per project (RFP FUNC F.6): identity, lending, covenants and budget together.

Each figure comes from the same place its own report reads it, so the totals agree with the separate reports:
balances from the loan accounts (in NPR, foreign facilities converted at the rate in force on the report
date), covenant results from the latest tested quarter, budget and cost from the budget lines.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import BudgetLine, LoanAccount
from backend.app.models.project import Project
from backend.app.schemas.report_schema import ExportFilter
from backend.app.services import fx
from backend.app.services.covenant_service import CovenantService
from backend.app.services.report_service import geography_conditions

COLUMNS = (
    "project_code", "project_name_en", "province", "district", "local_level", "capacity_mw", "project_stage",
    "pipeline_status", "loan_accounts_count", "sanctioned_amount_npr", "outstanding_principal_npr",
    "overdue_principal_npr", "latest_quarter", "dscr", "ltv", "icr", "covenant_status", "budgeted_amount",
    "actual_amount", "variance_amount", "overspent_heads",
)


def _number(value: Optional[Decimal]) -> Optional[float]:
    return float(value) if value is not None else None


async def export_consolidated_report(db: AsyncSession, filters: Optional[ExportFilter] = None,
                                     user_id: str = "SYSTEM") -> Tuple[List[Dict[str, Any]], int]:
    query = select(Project).order_by(Project.project_code)
    conditions = geography_conditions(filters)
    if filters and filters.status:
        conditions.append(Project.project_stage == filters.status)
    if conditions:
        query = query.where(and_(*conditions))
    projects = (await db.execute(query)).scalars().all()
    ids = [p.id for p in projects]
    if not ids:
        return [], 0

    on_date = (filters.date_range_end if filters and filters.date_range_end else None) or date.today()
    rates = await fx.load(db)
    lending: Dict[Any, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "sanctioned": Decimal("0"),
                                                               "outstanding": Decimal("0"), "overdue": Decimal("0"),
                                                               "unconverted": False})
    for loan in (await db.execute(select(LoanAccount).where(LoanAccount.project_id.in_(ids)))).scalars():
        entry = lending[loan.project_id]
        entry["count"] += 1
        for key, field in (("sanctioned", "sanctioned_amount"), ("outstanding", "outstanding_principal"),
                           ("overdue", "overdue_principal")):
            converted = rates.to_npr(getattr(loan, field) or Decimal("0"), loan.currency_code, on_date)
            if converted is None:
                entry["unconverted"] = True  # no rate on file: leave the total blank rather than understate it
            else:
                entry[key] += converted

    budget: Dict[Any, Dict[str, Any]] = defaultdict(lambda: {"budgeted": Decimal("0"), "actual": Decimal("0"), "over": 0, "lines": 0})
    for line in (await db.execute(select(BudgetLine).where(BudgetLine.project_id.in_(ids)))).scalars():
        entry = budget[line.project_id]
        entry["lines"] += 1
        entry["budgeted"] += line.budgeted_amount or Decimal("0")
        entry["actual"] += line.actual_amount or Decimal("0")
        entry["over"] += 1 if (line.variance_amount or 0) > 0 else 0

    covenants = {row["project_id"]: row for row in await CovenantService.portfolio(db, ids)}

    rows = []
    for project in projects:
        money = lending.get(project.id)
        spend = budget.get(project.id)
        covenant = covenants.get(str(project.id))
        rows.append({
            "project_code": project.project_code, "project_name_en": project.name_en, "province": project.province,
            "district": project.district or "", "local_level": project.local_level or "",
            "capacity_mw": _number(project.installed_capacity_mw), "project_stage": project.project_stage,
            "pipeline_status": project.pipeline_status,
            "loan_accounts_count": money["count"] if money else 0,
            "sanctioned_amount_npr": None if not money or money["unconverted"] else _number(money["sanctioned"]),
            "outstanding_principal_npr": None if not money or money["unconverted"] else _number(money["outstanding"]),
            "overdue_principal_npr": None if not money or money["unconverted"] else _number(money["overdue"]),
            "latest_quarter": covenant["quarter"] if covenant else None,
            **{name: _number(covenant[name]["value"]) if covenant else None for name in ("dscr", "ltv", "icr")},
            "covenant_status": covenant["overall_status"] if covenant else None,
            "budgeted_amount": _number(spend["budgeted"]) if spend else None,
            "actual_amount": _number(spend["actual"]) if spend else None,
            "variance_amount": _number(spend["actual"] - spend["budgeted"]) if spend else None,
            "overspent_heads": spend["over"] if spend else None,
        })
    return rows, len(rows)
