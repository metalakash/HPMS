"""Covenant testing: gathers a project's financials and loan schedule, runs the engine, stores the result.

The arithmetic and its definitions live in ``covenant_engine``. This module reads the inputs
(``project_financial_periods``, ``covenant_terms``, the repayment schedule and disbursements),
writes one ``covenant_history`` row per tested quarter and copies the latest result onto the
project's loan accounts, which is where the reports and alerts read it.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple
from uuid import UUID
import logging

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import DisbursementTranche, LoanAccount, Repayment
from backend.app.models.operations import CovenantHistory, CovenantTerms, FinancialPeriod
from backend.app.models.project import Project
from backend.app.services import covenant_engine as engine
from backend.app.services.covenant_engine import Calculation, PeriodFinancials, Quarter, Terms
from backend.app.services.risk_service import bs_string

logger = logging.getLogger(__name__)

ZERO = Decimal("0")
PERIOD_AMOUNTS = ("revenue_npr", "operating_expenses_npr", "royalty_npr", "tax_paid_npr", "depreciation_npr",
                  "security_value_npr")
TERM_FIELDS = ("dscr_min", "ltv_max", "icr_min", "warning_margin_pct")


def _uuid(value: Any) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _period_inputs(row: FinancialPeriod) -> PeriodFinancials:
    return PeriodFinancials(
        quarter=Quarter.parse(row.quarter_ad), revenue=row.revenue_npr,
        operating_expenses=row.operating_expenses_npr, royalty=row.royalty_npr, tax_paid=row.tax_paid_npr,
        depreciation=row.depreciation_npr, security_value=row.security_value_npr)


def period_to_dict(row: FinancialPeriod) -> Dict[str, Any]:
    return {
        "quarter": row.quarter_ad, "period_end_ad": row.period_end_ad.isoformat(), "period_end_bs": row.period_end_bs,
        **{name: getattr(row, name) for name in PERIOD_AMOUNTS},
        "is_audited": bool(row.is_audited), "source_reference": row.source_reference,
        "data_provenance": row.data_provenance, "updated_by": row.updated_by or row.created_by,
    }


def calculation_to_dict(calc: Calculation) -> Dict[str, Any]:
    """The result with the figures behind it, so the test can be re-performed by hand."""
    def metric(m: engine.Metric) -> Dict[str, Any]:
        return {"value": m.value, "threshold": m.threshold, "status": m.status, "note": m.note}

    start, end = engine.window_of(calc.quarter)
    return {
        "quarter": calc.quarter.label, "test_date": end.isoformat(),
        "window": {"from": start.isoformat(), "to": end.isoformat(), "quarters_used": calc.quarters_used},
        "overall_status": calc.overall_status,
        "dscr": metric(calc.dscr), "icr": metric(calc.icr), "ltv": metric(calc.ltv),
        "inputs": {
            "revenue": calc.revenue, "ebitda": calc.ebitda, "cfads": calc.cfads, "ebit": calc.ebit,
            "principal_due": calc.principal_due, "interest_due": calc.interest_due,
            "debt_service": calc.principal_due + calc.interest_due,
            "outstanding_principal": calc.outstanding_principal, "security_value": calc.security_value,
        },
    }


class _LoanBook:
    """A project's loans with their schedules, answering what was due in a window and owed at a date."""

    def __init__(self, loans: Sequence[LoanAccount], repayments: Sequence[Repayment],
                 tranches: Sequence[DisbursementTranche]):
        self.loans = list(loans)
        self._fx = {loan.id: loan.fx_rate_to_npr or Decimal("1") for loan in loans}
        self._repayments = list(repayments)
        self._tranches = list(tranches)
        self._drawn_loans = {t.loan_account_id for t in tranches if t.actual_date_ad}

    def due_between(self, start: date, end: date) -> Tuple[Decimal, Decimal]:
        principal = interest = ZERO
        for r in self._repayments:
            if r.due_date_ad and start <= r.due_date_ad <= end:
                fx = self._fx[r.loan_account_id]
                principal += (r.principal_due or ZERO) * fx
                interest += (r.interest_due or ZERO) * fx
        return principal, interest

    def outstanding_at(self, day: date, is_latest: bool) -> Optional[Decimal]:
        """Principal owed on ``day`` in NPR, rebuilt from drawdowns and repayments.

        A loan with no drawdown records (balances that came straight from the core banking
        system) only has today's balance, so it can stand in for the latest quarter but not
        for earlier ones.
        """
        if not self.loans:
            return None
        total = ZERO
        for loan in self.loans:
            fx = self._fx[loan.id]
            if loan.id in self._drawn_loans:
                drawn = sum((t.actual_amount or ZERO for t in self._tranches
                             if t.loan_account_id == loan.id and t.actual_date_ad and t.actual_date_ad <= day), ZERO)
                repaid = sum((r.principal_paid or ZERO for r in self._repayments
                              if r.loan_account_id == loan.id and r.paid_date_ad and r.paid_date_ad <= day), ZERO)
                total += (drawn - repaid) * fx
            elif is_latest:
                total += (loan.outstanding_principal or ZERO) * fx
            else:
                return None
        return total


class CovenantService:
    """Calculate, store and report covenant results."""

    # ------------------------------------------------------------------ inputs

    @staticmethod
    async def terms_for(db: AsyncSession, project_id: Any) -> Tuple[Terms, Optional[CovenantTerms]]:
        """The project's thresholds, and the stored row they came from (None when the defaults apply)."""
        row = (await db.execute(
            select(CovenantTerms).where(CovenantTerms.project_id == _uuid(project_id)))).scalar_one_or_none()
        if row is None:
            return engine.DEFAULT_TERMS, None
        return Terms(dscr_min=row.dscr_min, ltv_max=row.ltv_max, icr_min=row.icr_min,
                     warning_margin_pct=row.warning_margin_pct), row

    @staticmethod
    async def _periods(db: AsyncSession, project_id: UUID) -> List[FinancialPeriod]:
        return list((await db.execute(
            select(FinancialPeriod).where(FinancialPeriod.project_id == project_id)
            .order_by(FinancialPeriod.period_end_ad))).scalars())

    @staticmethod
    async def _loan_book(db: AsyncSession, project_id: UUID) -> _LoanBook:
        loans = list((await db.execute(select(LoanAccount).where(LoanAccount.project_id == project_id))).scalars())
        ids = [loan.id for loan in loans]
        if not ids:
            return _LoanBook([], [], [])
        repayments = (await db.execute(select(Repayment).where(Repayment.loan_account_id.in_(ids)))).scalars().all()
        tranches = (await db.execute(
            select(DisbursementTranche).where(DisbursementTranche.loan_account_id.in_(ids)))).scalars().all()
        return _LoanBook(loans, repayments, tranches)

    @staticmethod
    async def save_period(db: AsyncSession, project_id: Any, quarter_label: str, values: Dict[str, Any],
                          actor: str, today: Optional[date] = None) -> Tuple[FinancialPeriod, Dict[str, Any]]:
        """Create or correct one quarter's figures. Returns the row and its previous values ({} if new).

        ValueError when the quarter is malformed, has not ended, or an amount is negative.
        """
        quarter = Quarter.parse(quarter_label)
        if quarter.end >= (today or date.today()):
            raise ValueError(f"{quarter.label} has not ended yet")
        for name in PERIOD_AMOUNTS:
            amount = values.get(name)
            if amount is not None and amount < 0:
                raise ValueError(f"{name} cannot be negative")
        if values.get("security_value_npr") == 0:
            raise ValueError("security_value_npr must be greater than zero when given")

        pid = _uuid(project_id)
        row = (await db.execute(select(FinancialPeriod).where(
            FinancialPeriod.project_id == pid, FinancialPeriod.quarter_ad == quarter.label))).scalar_one_or_none()
        before: Dict[str, Any] = {}
        if row is None:
            row = FinancialPeriod(project_id=pid, quarter_ad=quarter.label, period_end_ad=quarter.end,
                                  period_end_bs=bs_string(quarter.end), created_by=actor)
            db.add(row)
        else:
            before = {name: getattr(row, name) for name in (*PERIOD_AMOUNTS, "is_audited", "source_reference")}
            row.updated_by = actor
        for name in (*PERIOD_AMOUNTS, "is_audited", "source_reference", "data_provenance"):
            if name in values:
                setattr(row, name, values[name])
        await db.flush()
        return row, before

    @staticmethod
    async def save_terms(db: AsyncSession, project_id: Any, values: Dict[str, Any], actor: str
                         ) -> Tuple[CovenantTerms, Dict[str, Any]]:
        """Record the project's thresholds. Returns the row and the thresholds that applied before."""
        for name in TERM_FIELDS:
            if values[name] is None or values[name] <= 0:
                raise ValueError(f"{name} must be greater than zero")
        if values["ltv_max"] > 100:
            raise ValueError("ltv_max is a percentage and cannot exceed 100")
        if values["warning_margin_pct"] >= 100:
            raise ValueError("warning_margin_pct must be below 100")

        previous, row = await CovenantService.terms_for(db, project_id)
        before = {name: getattr(previous, name) for name in TERM_FIELDS}
        if row is None:
            row = CovenantTerms(project_id=_uuid(project_id), created_by=actor)
            db.add(row)
        else:
            row.updated_by = actor
        for name in (*TERM_FIELDS, "source_reference"):
            if name in values:
                setattr(row, name, values[name])
        await db.flush()
        return row, before

    # ------------------------------------------------------------------ calculation

    @staticmethod
    async def recalculate_project(db: AsyncSession, project_id: Any, today: Optional[date] = None
                                  ) -> List[Calculation]:
        """Test every completed quarter that has figures on file, oldest first, and store the results.

        The latest result is copied onto the project's loan accounts. A project with no figures
        gets no results and its loans' metrics are cleared, rather than keeping stale numbers.
        """
        pid = _uuid(project_id)
        today = today or date.today()
        terms, _ = await CovenantService.terms_for(db, pid)
        rows = [r for r in await CovenantService._periods(db, pid) if r.period_end_ad < today]
        periods = [_period_inputs(r) for r in rows]
        book = await CovenantService._loan_book(db, pid)
        latest_completed = Quarter.of(today).shift(-1)

        calculations = []
        for period in periods:
            start, end = engine.window_of(period.quarter)
            principal_due, interest_due = book.due_between(start, end)
            outstanding = book.outstanding_at(end, is_latest=period.quarter == latest_completed)
            calculations.append(engine.calculate(period.quarter, periods, principal_due, interest_due,
                                                 outstanding, terms))

        existing = {h.quarter_ad: h for h in (await db.execute(
            select(CovenantHistory).where(CovenantHistory.project_id == pid))).scalars()}
        for calc in calculations:
            history = existing.get(calc.quarter.label)
            if history is None:
                history = CovenantHistory(project_id=pid, quarter_ad=calc.quarter.label)
                db.add(history)
            end = calc.quarter.end
            end_bs = bs_string(end)
            history.quarter_bs = calc.quarter.label
            history.covenant_date_ad, history.covenant_date_bs = end, end_bs
            for name in ("dscr", "ltv", "icr"):
                metric = getattr(calc, name)
                setattr(history, f"{name}_value", metric.value)
                setattr(history, f"{name}_threshold", metric.threshold)
                setattr(history, f"{name}_status", metric.status)
            history.calculation_date_ad = today
            history.data_provenance = "CALCULATED"
            history.source_reference = "covenant engine"

        latest = calculations[-1] if calculations else None
        for loan in book.loans:
            loan.dscr = latest.dscr.value if latest else None
            loan.ltv = latest.ltv.value if latest else None
            loan.icr = latest.icr.value if latest else None
            loan.metric_as_of_date = latest.quarter.end if latest else None
        await db.flush()
        return calculations

    @staticmethod
    async def recalculate_all(db: AsyncSession, today: Optional[date] = None) -> int:
        """Recalculate every project that has figures on file. Returns how many were tested."""
        ids = (await db.execute(select(FinancialPeriod.project_id).distinct())).scalars().all()
        for project_id in ids:
            await CovenantService.recalculate_project(db, project_id, today=today)
        return len(ids)

    @staticmethod
    async def calculate_metrics(db: AsyncSession, loan_account: LoanAccount, project: Optional[Project] = None) -> None:
        """Bring a loan's DSCR/LTV/ICR up to date by testing its project."""
        await CovenantService.recalculate_project(db, loan_account.project_id)

    @staticmethod
    async def explain(db: AsyncSession, project_id: Any, quarter_label: Optional[str] = None,
                      today: Optional[date] = None) -> Optional[Dict[str, Any]]:
        """The working behind one quarter's result (the latest when no quarter is named). Stores nothing."""
        pid = _uuid(project_id)
        today = today or date.today()
        rows = [r for r in await CovenantService._periods(db, pid) if r.period_end_ad < today]
        if quarter_label:
            quarter = Quarter.parse(quarter_label)
            if quarter.label not in {r.quarter_ad for r in rows}:
                return None
        elif rows:
            quarter = Quarter.parse(rows[-1].quarter_ad)
        else:
            return None
        terms, stored = await CovenantService.terms_for(db, pid)
        book = await CovenantService._loan_book(db, pid)
        start, end = engine.window_of(quarter)
        principal_due, interest_due = book.due_between(start, end)
        outstanding = book.outstanding_at(end, is_latest=quarter == Quarter.of(today).shift(-1))
        calc = engine.calculate(quarter, [_period_inputs(r) for r in rows], principal_due, interest_due,
                                outstanding, terms)
        return {**calculation_to_dict(calc), "terms_source": "sanction terms" if stored else "bank defaults"}

    @staticmethod
    async def get_financials(db: AsyncSession, project_id: Any) -> Dict[str, Any]:
        pid = _uuid(project_id)
        terms, stored = await CovenantService.terms_for(db, pid)
        periods = await CovenantService._periods(db, pid)
        return {
            "project_id": str(pid),
            "terms": {**{name: getattr(terms, name) for name in TERM_FIELDS},
                      "source": "sanction terms" if stored else "bank defaults",
                      "source_reference": stored.source_reference if stored else None},
            "periods": [period_to_dict(p) for p in reversed(periods)],  # newest first
        }

    # ------------------------------------------------------------------ reporting

    @staticmethod
    async def portfolio(db: AsyncSession, project_ids: Optional[Sequence[UUID]] = None) -> List[Dict[str, Any]]:
        """Each project's most recent covenant result, worst first. ``project_ids`` None = every project."""
        query = (select(CovenantHistory, Project)
                 .join(Project, Project.id == CovenantHistory.project_id)
                 .distinct(CovenantHistory.project_id)
                 .order_by(CovenantHistory.project_id, desc(CovenantHistory.quarter_ad)))
        if project_ids is not None:
            query = query.where(CovenantHistory.project_id.in_(list(project_ids)))
        rows = []
        for record, project in (await db.execute(query)).all():
            rows.append({
                "project_id": str(project.id), "project_code": project.project_code, "project_name": project.name_en,
                "project_stage": project.project_stage, "quarter": record.quarter_ad,
                "test_date": record.covenant_date_ad.isoformat() if record.covenant_date_ad else None,
                "overall_status": CovenantService._determine_overall_status(record),
                **{name: {"value": getattr(record, f"{name}_value"), "threshold": getattr(record, f"{name}_threshold"),
                          "status": getattr(record, f"{name}_status")} for name in ("dscr", "ltv", "icr")},
            })
        rank = {engine.BREACHED: 0, engine.WARNING: 1, engine.COMPLIANT: 2, engine.NOT_TESTED: 3}
        rows.sort(key=lambda r: (rank.get(r["overall_status"], 4), r["project_name"]))
        return rows

    @staticmethod
    async def get_covenant_history(
        db: AsyncSession,
        project_id: str,
        quarters: int = 8,
    ) -> Dict[str, Any]:
        """Covenant results for the last N quarters, oldest first, with breach alerts and trend direction."""
        stmt = (
            select(CovenantHistory)
            .where(CovenantHistory.project_id == _uuid(project_id))
            .order_by(desc(CovenantHistory.quarter_ad))
            .limit(quarters)
        )
        records = list(reversed((await db.execute(stmt)).scalars().all()))

        if not records:
            return {
                "project_id": project_id,
                "quarters_available": 0,
                "trends": [],
                "status": "no_data",
                "alerts": [],
            }

        trends = []
        breach_alerts = []
        for record in records:
            item: Dict[str, Any] = {
                "quarter": record.quarter_ad,
                "quarter_bs": record.quarter_bs,
                "covenant_date": record.covenant_date_ad.isoformat() if record.covenant_date_ad else None,
            }
            for name in ("dscr", "ltv", "icr"):
                value = getattr(record, f"{name}_value")
                threshold = getattr(record, f"{name}_threshold")
                status = getattr(record, f"{name}_status")
                item[name] = {
                    "value": float(value) if value is not None else None,
                    "threshold": float(threshold) if threshold is not None else None,
                    "status": status,
                    "variance_pct": CovenantService._calculate_variance(value, threshold),
                }
                if status == engine.BREACHED:
                    breach_alerts.append({"quarter": record.quarter_ad, "metric": name.upper(),
                                          "status": status, "severity": "critical"})
            trends.append(item)

        latest_record = records[-1]
        return {
            "project_id": project_id,
            "quarters_available": len(records),
            "latest_quarter": latest_record.quarter_ad,
            "overall_status": CovenantService._determine_overall_status(latest_record),
            "trend_direction": CovenantService._calculate_trend_direction(records),
            "trends": trends,
            "breach_alerts": breach_alerts,
            "calculation_date": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def detect_covenant_breaches(
        db: AsyncSession,
        project_id: str,
    ) -> List[Dict[str, Any]]:
        """Breaches in the project's most recent tested quarter, with the size of each shortfall."""
        latest = (await db.execute(
            select(CovenantHistory)
            .where(CovenantHistory.project_id == _uuid(project_id))
            .order_by(desc(CovenantHistory.quarter_ad))
            .limit(1)
        )).scalars().first()
        if not latest:
            return []

        breaches = []
        if latest.dscr_status == engine.BREACHED:
            breaches.append({
                "metric": "DSCR",
                "current_value": float(latest.dscr_value),
                "threshold": float(latest.dscr_threshold),
                "shortfall": float(latest.dscr_threshold - latest.dscr_value),
                "severity": "critical",
                "remediation": "Increase cash flow available for debt service or reschedule debt service",
                "quarter": latest.quarter_ad,
            })
        if latest.ltv_status == engine.BREACHED:
            breaches.append({
                "metric": "LTV",
                "current_value": float(latest.ltv_value),
                "threshold": float(latest.ltv_threshold),
                "excess": float(latest.ltv_value - latest.ltv_threshold),
                "severity": "critical",
                "remediation": "Reduce the outstanding principal or obtain additional security",
                "quarter": latest.quarter_ad,
            })
        if latest.icr_status == engine.BREACHED:
            breaches.append({
                "metric": "ICR",
                "current_value": float(latest.icr_value),
                "threshold": float(latest.icr_threshold),
                "shortfall": float(latest.icr_threshold - latest.icr_value),
                "severity": "critical",
                "remediation": "Increase operating profit or reduce interest costs",
                "quarter": latest.quarter_ad,
            })
        return breaches

    @staticmethod
    def _calculate_variance(value, threshold) -> Optional[float]:
        """Calculate variance % between value and threshold."""
        if value is None or not threshold:
            return None
        return round(float((value - threshold) / threshold * 100), 2)

    @staticmethod
    def _determine_overall_status(record: CovenantHistory) -> str:
        """Worst status among the ratios tested in the quarter."""
        return engine.overall_status([record.dscr_status, record.ltv_status, record.icr_status])

    @staticmethod
    def _calculate_trend_direction(records: List[CovenantHistory]) -> Dict[str, str]:
        """Direction of each ratio between its first and last tested quarter in ``records``."""
        trends = {}
        for name, higher_is_better in (("dscr", True), ("ltv", False), ("icr", True)):
            values = [v for v in (getattr(r, f"{name}_value") for r in records) if v is not None]
            if len(values) < 2:
                trends[name] = "insufficient_data"
            else:
                trends[name] = "improving" if (values[-1] > values[0]) == higher_is_better else "declining"
        return trends
