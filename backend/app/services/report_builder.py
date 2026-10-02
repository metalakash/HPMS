"""Filter-driven report builder (RFP F.5, F.6, F.10).

A report is a *source* (one of the vetted loaders below), an ordered column selection,
filters (province / district / local level / status / dates / facility type) and a sort.
There is deliberately no query language: users pick from what the sources offer.
"""

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.schemas.report_schema import ExportFilter
from backend.app.services.report_service import ReportService

Loader = Callable[[AsyncSession, Optional[ExportFilter], str], Awaitable[Tuple[List[Dict[str, Any]], int]]]


@dataclass(frozen=True)
class ReportSource:
    key: str
    label: str
    loader: Loader
    columns: Tuple[str, ...]
    filters: Tuple[str, ...]


SOURCES: Dict[str, ReportSource] = {s.key: s for s in [
    ReportSource(
        "portfolio", "Portfolio overview", ReportService.export_portfolio_report,
        ("project_code", "project_name_en", "project_name_np", "province", "district", "local_level",
         "capacity_mw", "project_stage", "pipeline_status", "lead_bank", "consortium_members_count",
         "total_sanctioned_amount", "currency", "loan_accounts_count",
         "created_date_ad", "created_date_bs", "updated_date_ad", "updated_date_bs"),
        ("province", "district", "local_level", "status", "date_range_start", "date_range_end"),
    ),
    ReportSource(
        "covenant_summary", "Loan rates and sync status", ReportService.export_covenant_report,
        ("project_code", "project_name_en", "province", "district", "local_level", "loan_account_id",
         "finacle_account_id", "facility_type", "sanctioned_amount", "current_rate_percent",
         "rate_effective_date_ad", "rate_effective_date_bs", "rate_expiry_date_ad", "rate_expiry_date_bs",
         "last_sync_date", "sync_status"),
        ("province", "district", "local_level", "facility_type"),
    ),
    ReportSource(
        "capex_progress", "Capex budget vs actual", ReportService.export_capex_report,
        ("project_code", "project_name_en", "province", "district", "local_level", "capacity_mw",
         "project_stage", "budget_category", "budgeted_amount", "actual_amount", "spent_percent", "currency"),
        ("province", "district", "local_level", "status"),
    ),
    ReportSource(
        "covenant_shortfall", "Covenant shortfall (DSCR / LTV / ICR)",
        ReportService.export_covenant_shortfall_report,
        ("project_code", "project_name_en", "province", "district", "local_level", "finacle_account_id",
         "facility_type", "sanctioned_amount", "outstanding_principal", "dscr", "dscr_shortfall", "ltv",
         "ltv_excess", "icr", "icr_shortfall", "breached_covenants", "shortfall_count",
         "metric_as_of_date_ad", "metric_as_of_date_bs"),
        ("province", "district", "local_level", "facility_type"),
    ),
]}


class DefinitionError(ValueError):
    """The definition names an unknown source, column or sort key."""


def validate_definition(source: str, columns: Optional[List[str]], sort_by: Optional[str]) -> ReportSource:
    src = SOURCES.get(source)
    if src is None:
        raise DefinitionError(f"Unknown source: {source}")
    if columns is not None:
        if not columns:
            raise DefinitionError("columns must not be empty (omit it to include all columns)")
        unknown = [c for c in columns if c not in src.columns]
        if unknown:
            raise DefinitionError(f"Unknown columns for {source}: {', '.join(unknown)}")
        if len(set(columns)) != len(columns):
            raise DefinitionError("columns must not repeat")
    if sort_by is not None and sort_by not in src.columns:
        raise DefinitionError(f"Unknown sort_by for {source}: {sort_by}")
    return src


def shape_rows(rows: List[Dict[str, Any]], columns: Optional[List[str]], sort_by: Optional[str],
               sort_desc: bool) -> List[Dict[str, Any]]:
    """Sort on the full row (so a sort key need not be displayed), then keep only ``columns`` in order."""
    if sort_by:
        present = [r for r in rows if r.get(sort_by) is not None]
        missing = [r for r in rows if r.get(sort_by) is None]  # blanks always last
        present.sort(key=lambda r: r[sort_by], reverse=sort_desc)
        rows = present + missing
    if columns:
        rows = [{c: r.get(c) for c in columns} for r in rows]
    return rows


async def run_report(db: AsyncSession, source: str, columns: Optional[List[str]] = None,
                     filters: Optional[Dict[str, Any]] = None, sort_by: Optional[str] = None,
                     sort_desc: bool = False, user_id: str = "SYSTEM") -> List[Dict[str, Any]]:
    src = validate_definition(source, columns, sort_by)
    export_filter = ExportFilter(**(filters or {}))
    rows, _ = await src.loader(db, export_filter, user_id)
    return shape_rows(rows, columns, sort_by, sort_desc)
