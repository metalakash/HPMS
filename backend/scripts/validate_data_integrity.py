"""Check that project, loan and audit data are internally consistent.

Run from the repository root (exit code 1 if anything is wrong):
    python -m backend.scripts.validate_data_integrity
"""

import asyncio
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Iterable, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine
from backend.app.models.financial import DisbursementTranche, LoanAccount, Repayment
from backend.app.models.project import PipelineStatus, Project, ProjectStage
from backend.app.services.audit_chain import verify_stored_chain

TOLERANCE = Decimal("1")  # NPR; amounts are stored to 4 decimal places
ZERO = Decimal("0")

# A project cannot be further along (or further back) than its stage allows.
STATUSES_BY_STAGE = {
    ProjectStage.FEASIBILITY.value: {"proposal_under_pipeline", "under_review", "approved", "dropped"},
    ProjectStage.CONSTRUCTION.value: {"yet_to_start_drawdown", "under_construction", "dropped"},
    ProjectStage.OPERATION.value: {"under_operation", "settled"},
}


@dataclass
class Report:
    errors: List[str] = field(default_factory=list)
    projects: int = 0
    loans: int = 0
    audit_rows: int = 0

    @property
    def ok(self) -> bool:
        return not self.errors


def _d(value: Any) -> Decimal:
    return ZERO if value is None else Decimal(value)


def check_project(project: Any) -> List[str]:
    code = project.project_code
    errors = []
    if project.project_stage not in STATUSES_BY_STAGE:
        errors.append(f"{code}: unknown stage {project.project_stage!r}")
    elif project.pipeline_status not in {s.value for s in PipelineStatus}:
        errors.append(f"{code}: unknown pipeline status {project.pipeline_status!r}")
    elif project.pipeline_status not in STATUSES_BY_STAGE[project.project_stage]:
        errors.append(f"{code}: status {project.pipeline_status!r} does not fit stage {project.project_stage!r}")
    if not project.installed_capacity_mw or project.installed_capacity_mw <= 0:
        errors.append(f"{code}: installed capacity must be positive")
    return errors


def check_loan(label: str, loan: Any, tranches: Iterable[Any], repayments: Iterable[Any], today: date) -> List[str]:
    """Consistency of one loan with its tranches and repayment schedule."""
    errors = []
    tranches, repayments = list(tranches), sorted(repayments, key=lambda r: r.due_date_ad)
    sanctioned, disbursed = _d(loan.sanctioned_amount), _d(loan.disbursed_amount)

    if disbursed > sanctioned + TOLERANCE:
        errors.append(f"{label}: disbursed {disbursed} exceeds sanctioned {sanctioned}")

    drawn = sum((_d(t.actual_amount) for t in tranches), ZERO)
    if abs(drawn - disbursed) > TOLERANCE:
        errors.append(f"{label}: tranches total {drawn} but disbursed is {disbursed}")

    repaid = sum((_d(r.principal_paid) for r in repayments), ZERO)
    if abs(disbursed - repaid - _d(loan.outstanding_principal)) > TOLERANCE:
        errors.append(
            f"{label}: outstanding {loan.outstanding_principal} is not disbursed {disbursed} less repaid {repaid}")

    if not repayments:
        return errors

    scheduled = sum((_d(r.principal_due) for r in repayments), ZERO)
    if abs(scheduled - disbursed) > TOLERANCE:
        errors.append(f"{label}: schedule repays {scheduled} of {disbursed} disbursed")

    balance = disbursed
    previous_due = None
    for r in repayments:
        when = f"{label} instalment {r.due_date_ad}"
        expected_interest = balance * _d(loan.interest_rate_pct) / Decimal("200")
        if abs(_d(r.interest_due) - expected_interest) > TOLERANCE:
            errors.append(f"{when}: interest {r.interest_due}, expected {expected_interest:.2f} on balance {balance}")
        if previous_due and not 150 <= (r.due_date_ad - previous_due).days <= 215:
            errors.append(f"{when}: not semi-annual (previous {previous_due})")
        if _d(r.principal_paid) > _d(r.principal_due) + TOLERANCE or _d(r.interest_paid) > _d(r.interest_due) + TOLERANCE:
            errors.append(f"{when}: paid more than was due")
        if r.paid_date_ad and r.paid_date_ad > today:
            errors.append(f"{when}: paid on a future date {r.paid_date_ad}")

        paid_in_full = _d(r.principal_paid) >= _d(r.principal_due) and _d(r.interest_paid) >= _d(r.interest_due)
        overdue_days = (today - r.due_date_ad).days if r.due_date_ad < today and not paid_in_full else 0
        if (r.days_past_due or 0) != overdue_days:
            errors.append(f"{when}: days past due is {r.days_past_due or 0}, expected {overdue_days}")

        balance -= _d(r.principal_due)
        previous_due = r.due_date_ad
    return errors


async def validate(session: AsyncSession, today: date | None = None) -> Report:
    today = today or date.today()
    report = Report()

    projects = (await session.execute(select(Project))).scalars().all()
    codes = {p.id: p.project_code for p in projects}
    report.projects = len(projects)
    for project in projects:
        report.errors += check_project(project)

    tranches, repayments = defaultdict(list), defaultdict(list)
    for t in (await session.execute(select(DisbursementTranche))).scalars():
        tranches[t.loan_account_id].append(t)
    for r in (await session.execute(select(Repayment))).scalars():
        repayments[r.loan_account_id].append(r)

    loans = (await session.execute(select(LoanAccount))).scalars().all()
    report.loans = len(loans)
    for loan in loans:
        label = f"{codes.get(loan.project_id, loan.project_id)} loan"
        report.errors += check_loan(label, loan, tranches[loan.id], repayments[loan.id], today)

    chain = await verify_stored_chain(session)
    report.audit_rows = chain.checked
    if not chain.ok:
        report.errors.append(f"audit chain: {chain.problem}")
    return report


async def main() -> Report:
    async with AsyncSession(engine) as session:
        return await validate(session)


if __name__ == "__main__":
    result = asyncio.run(main())
    print(f"Checked {result.projects} projects, {result.loans} loans, {result.audit_rows} audit rows")
    for error in result.errors:
        print(f"  ERROR {error}")
    print("Validation passed" if result.ok else f"Validation FAILED: {len(result.errors)} error(s)")
    sys.exit(0 if result.ok else 1)
