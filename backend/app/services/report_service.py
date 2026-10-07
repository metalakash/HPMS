"""Report service for PowerBI export endpoints.

Generates flat CSV/Excel output from core tables with audit logging.
"""

import logging
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import joinedload

from backend.app.models.project import Project, ProjectCapacityHistory
from backend.app.models.financial import LoanAccount, LoanAccountRateHistory, BudgetLine
from backend.app.models.audit import AuditLog, AuditLogRead
from backend.app.services import covenant_engine
from backend.app.services.report_dates import add_bs_columns
from backend.app.schemas.report_schema import (
    PortfolioReportRow,
    CovenantReportRow,
    CapexReportRow,
    ExportFilter,
)

logger = logging.getLogger(__name__)


# The bank-wide defaults; a project with its own sanction terms is tested against those by the engine
COVENANT_THRESHOLDS = covenant_engine.DEFAULT_TERMS.as_thresholds()


def covenant_shortfall_row(account, project) -> Dict[str, Any]:
    """One loan's covenant values, gaps against COVENANT_THRESHOLDS, and breach list."""
    t = COVENANT_THRESHOLDS
    breached = []
    dscr_gap = ltv_gap = icr_gap = None
    if account.dscr is not None and account.dscr < t["dscr_min"]:
        breached.append("DSCR")
        dscr_gap = float(t["dscr_min"] - account.dscr)
    if account.ltv is not None and account.ltv > t["ltv_max"]:
        breached.append("LTV")
        ltv_gap = float(account.ltv - t["ltv_max"])
    if account.icr is not None and account.icr < t["icr_min"]:
        breached.append("ICR")
        icr_gap = float(t["icr_min"] - account.icr)

    def num(v):
        return float(v) if v is not None else None

    return {
        "project_code": project.project_code,
        "project_name_en": project.name_en,
        "province": project.province,
        "district": project.district or "",
        "local_level": project.local_level or "",
        "finacle_account_id": account.finacle_account_id,
        "facility_type": account.facility_type,
        "sanctioned_amount": float(account.sanctioned_amount or 0),
        "outstanding_principal": float(account.outstanding_principal or 0),
        "dscr": num(account.dscr),
        "dscr_shortfall": dscr_gap,
        "ltv": num(account.ltv),
        "ltv_excess": ltv_gap,
        "icr": num(account.icr),
        "icr_shortfall": icr_gap,
        "breached_covenants": ", ".join(breached),
        "shortfall_count": len(breached),
        "metric_as_of_date_ad": account.metric_as_of_date.strftime("%Y-%m-%d") if account.metric_as_of_date else None,
        "metric_as_of_date_bs": None,
    }


def geography_conditions(filters: Optional[ExportFilter]) -> list:
    """Province / District / Local-level conditions on Project (RFP F.10)."""
    if not filters:
        return []
    conditions = []
    if filters.province:
        conditions.append(Project.province == filters.province)
    if filters.district:
        conditions.append(Project.district == filters.district)
    if filters.local_level:
        conditions.append(Project.local_level == filters.local_level)
    return conditions


class ReportService:
    """Generate PowerBI-compatible export data."""

    @staticmethod
    async def export_portfolio_report(
        db: AsyncSession,
        filters: Optional[ExportFilter] = None,
        user_id: str = "SYSTEM",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Generate portfolio overview report.

        Args:
            db: async database session
            filters: date range, province, status filters
            user_id: who requested export (for audit)

        Returns:
            (list of report rows, record count)
        """

        # Base query: all projects
        query = select(Project).options(
            joinedload(Project.loan_accounts),
            joinedload(Project.consortium),
            joinedload(Project.consortium_members)
        )

        # Apply filters
        if filters:
            conditions = []
            conditions.extend(geography_conditions(filters))
            if filters.status:
                conditions.append(Project.pipeline_status == filters.status)
            if filters.date_range_start:
                conditions.append(Project.created_at >= filters.date_range_start)
            if filters.date_range_end:
                conditions.append(Project.created_at <= filters.date_range_end)

            if conditions:
                query = query.where(and_(*conditions))

        result = await db.execute(query)
        projects = result.unique().scalars().all()

        rows = []
        for project in projects:
            # Calculate totals
            total_sanctioned = Decimal("0")
            loan_count = 0
            if project.loan_accounts:
                for account in project.loan_accounts:
                    if account.sanctioned_amount:
                        total_sanctioned += account.sanctioned_amount
                    loan_count += 1

            consortium_members_count = len(project.consortium_members) if project.consortium_members else 0
            lead_bank = None
            if project.consortium:
                lead_bank = project.consortium.lead_bank_name

            row_dict = {
                "project_code": project.project_code,
                "project_name_en": project.name_en,
                "project_name_np": project.name_np,
                "province": project.province,
                "district": project.district or "",
                "local_level": project.local_level or "",
                "capacity_mw": float(project.installed_capacity_mw),
                "project_stage": project.project_stage,
                "pipeline_status": project.pipeline_status,
                "lead_bank": lead_bank,
                "consortium_members_count": consortium_members_count,
                "total_sanctioned_amount": float(total_sanctioned),
                "currency": "NPR",
                "loan_accounts_count": loan_count,
                "created_date_ad": project.created_at.strftime("%Y-%m-%d") if project.created_at else None,
                "created_date_bs": None,  # filled by add_bs_columns
                "updated_date_ad": project.updated_at.strftime("%Y-%m-%d") if project.updated_at else None,
                "updated_date_bs": None,
            }
            rows.append(row_dict)

        add_bs_columns(rows)

        # Audit export
        await ReportService._audit_export(
            db, "portfolio", len(rows), user_id
        )

        logger.info(f"Portfolio report exported: {len(rows)} rows by {user_id}")
        return rows, len(rows)

    @staticmethod
    async def export_covenant_report(
        db: AsyncSession,
        filters: Optional[ExportFilter] = None,
        user_id: str = "SYSTEM",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Generate covenant summary report (rate history).

        Args:
            db: async database session
            filters: date range, province, facility type filters
            user_id: who requested export

        Returns:
            (list of report rows, record count)
        """

        # Query: loan accounts with their current rate (if any). The is_current condition
        # belongs in the join, or accounts without rate history would be dropped.
        query = (
            select(LoanAccount, Project, LoanAccountRateHistory)
            .join(Project, LoanAccount.project_id == Project.id)
            .outerjoin(
                LoanAccountRateHistory,
                and_(
                    LoanAccountRateHistory.loan_account_id == LoanAccount.id,
                    LoanAccountRateHistory.is_current == "Y",  # Y/N flag, see migration 002
                ),
            )
        )

        # Apply filters
        if filters:
            conditions = []
            conditions.extend(geography_conditions(filters))
            if filters.facility_type:
                conditions.append(LoanAccount.facility_type == filters.facility_type)
            if conditions:
                query = query.where(and_(*conditions))

        result = await db.execute(query)
        rows_data = result.all()

        rows = []
        seen_accounts = set()

        for account, project, rate_history in rows_data:
            account_key = str(account.id)
            if account_key in seen_accounts:
                continue
            seen_accounts.add(account_key)

            row_dict = {
                "project_code": project.project_code,
                "project_name_en": project.name_en,
                "province": project.province,
                "district": project.district or "",
                "local_level": project.local_level or "",
                "loan_account_id": str(account.id),
                "finacle_account_id": account.finacle_account_id,
                "facility_type": account.facility_type,
                "sanctioned_amount": float(account.sanctioned_amount) if account.sanctioned_amount else 0,
                "current_rate_percent": float(rate_history.interest_rate_pct) if rate_history else None,
                "rate_effective_date_ad": rate_history.valid_from_ad.strftime("%Y-%m-%d") if rate_history and rate_history.valid_from_ad else None,
                "rate_effective_date_bs": rate_history.valid_from_bs if rate_history else None,
                "rate_expiry_date_ad": rate_history.valid_to_ad.strftime("%Y-%m-%d") if rate_history and rate_history.valid_to_ad else None,
                "rate_expiry_date_bs": rate_history.valid_to_bs if rate_history else None,
                "last_sync_date": account.last_synced_at[:10] if account.last_synced_at else None,
                "sync_status": account.sync_status or "pending",
            }
            rows.append(row_dict)

        add_bs_columns(rows)
        await ReportService._audit_export(
            db, "covenant_summary", len(rows), user_id
        )

        logger.info(f"Covenant report exported: {len(rows)} rows by {user_id}")
        return rows, len(rows)

    @staticmethod
    async def export_capex_report(
        db: AsyncSession,
        filters: Optional[ExportFilter] = None,
        user_id: str = "SYSTEM",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Generate capex progress report (budget tracking).

        Args:
            db: async database session
            filters: date range, province, stage filters
            user_id: who requested export

        Returns:
            (list of report rows, record count)
        """

        # Query: projects with budget lines
        query = (
            select(Project, BudgetLine)
            .join(BudgetLine, BudgetLine.project_id == Project.id)
        )

        # Apply filters
        if filters:
            conditions = []
            conditions.extend(geography_conditions(filters))
            if filters.status:
                conditions.append(Project.project_stage == filters.status)
            if conditions:
                query = query.where(and_(*conditions))

        result = await db.execute(query)
        rows_data = result.all()

        rows = []
        for project, budget in rows_data:
            spent_percent = None
            if budget.budgeted_amount and budget.budgeted_amount > 0 and budget.actual_amount:
                spent_percent = (budget.actual_amount / budget.budgeted_amount) * 100

            row_dict = {
                "project_code": project.project_code,
                "project_name_en": project.name_en,
                "province": project.province,
                "district": project.district or "",
                "local_level": project.local_level or "",
                "capacity_mw": float(project.installed_capacity_mw),
                "project_stage": project.project_stage,
                "budget_category": budget.category,
                "budgeted_amount": float(budget.budgeted_amount) if budget.budgeted_amount else 0,
                "actual_amount": float(budget.actual_amount) if budget.actual_amount else None,
                "spent_percent": float(spent_percent) if spent_percent else None,
                "currency": "NPR",
            }
            rows.append(row_dict)

        add_bs_columns(rows)
        await ReportService._audit_export(
            db, "capex_progress", len(rows), user_id
        )

        logger.info(f"Capex report exported: {len(rows)} rows by {user_id}")
        return rows, len(rows)

    @staticmethod
    async def export_covenant_shortfall_report(
        db: AsyncSession,
        filters: Optional[ExportFilter] = None,
        user_id: str = "SYSTEM",
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Loans that miss at least one covenant threshold, with the size of each gap (RFP F.10).

        Gap is positive when the covenant is breached: threshold - value for DSCR/ICR (floors),
        value - threshold for LTV (ceiling). Loans without computed metrics are not listed.
        """
        query = (
            select(LoanAccount, Project)
            .join(Project, LoanAccount.project_id == Project.id)
            .where(LoanAccount.dscr.isnot(None) | LoanAccount.ltv.isnot(None) | LoanAccount.icr.isnot(None))
        )
        conditions = geography_conditions(filters)
        if filters and filters.facility_type:
            conditions.append(LoanAccount.facility_type == filters.facility_type)
        if conditions:
            query = query.where(and_(*conditions))

        rows = []
        for account, project in (await db.execute(query)).all():
            row = covenant_shortfall_row(account, project)
            if row["shortfall_count"]:
                rows.append(row)
        rows.sort(key=lambda r: (-r["shortfall_count"], r["project_code"]))

        add_bs_columns(rows)
        await ReportService._audit_export(db, "covenant_shortfall", len(rows), user_id)
        logger.info(f"Covenant shortfall report exported: {len(rows)} rows by {user_id}")
        return rows, len(rows)

    @staticmethod
    async def _audit_export(
        db: AsyncSession,
        report_id: str,
        record_count: int,
        user_id: str,
    ) -> None:
        """Log export action in AuditLogRead table.

        Fails closed: if the read audit can't be written, the export must not be returned.

        Args:
            db: async database session
            report_id: which report was exported
            record_count: how many rows exported
            user_id: who requested export
        """

        db.add(
            AuditLogRead(
                user_id=user_id,
                entity_type="report",
                entity_id=report_id,
                record_count=record_count,
                timestamp=datetime.utcnow().isoformat() + "Z",
            )
        )
        # Commit before the data leaves the service so the read audit is durable
        await db.commit()
