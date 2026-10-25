"""A project's quarterly loan projection as a change request (RFP FUNC B.6).

Planned disbursement and repayment are entered per future fiscal quarter; outstanding is never entered.
It is recalculated down the whole projection from the opening position: each quarter is the one before
plus disbursement less repayment, so a change in one quarter carries into every later one.

    {"quarters": [{"fiscal_year": "2083/84", "quarter": 2,
                   "projected_disbursement": "50000000", "projected_repayment": "12000000"}],
     "source_reference": "Revised drawdown plan from the developer, Kartik 2083"}

The opening quarter is the position on record and cannot be changed this way.
"""

from decimal import Decimal
from typing import Any, Dict, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import LoanProjectionQuarter
from backend.app.models.project import Project
from backend.app.services.change_kinds import (
    ChangeKind, amount, only_fields, plain, project_uuid, register, require_source,
)

KIND = "LOAN_PROJECTION"


def _key(row: LoanProjectionQuarter) -> Tuple[str, int]:
    return row.fiscal_year, row.quarter


def _view(row: LoanProjectionQuarter) -> Dict[str, Any]:
    return plain({"fiscal_year": row.fiscal_year, "quarter": row.quarter,
                  "projected_disbursement": row.projected_disbursement,
                  "projected_repayment": row.projected_repayment, "projected_outstanding": row.projected_outstanding})


def _checked(changes: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str]:
    only_fields(changes, ["quarters", "source_reference"], KIND)
    source = require_source(changes)
    quarters = changes.get("quarters")
    if not isinstance(quarters, list) or not quarters:
        raise ValueError("quarters: give at least one quarter to change")
    checked = []
    for raw in quarters:
        if not isinstance(raw, dict):
            raise ValueError("quarters: each entry is a quarter")
        only_fields(raw, ["fiscal_year", "quarter", "projected_disbursement", "projected_repayment"], "a quarter")
        label = f"FY {raw.get('fiscal_year')} Q{raw.get('quarter')}"
        checked.append({
            "key": (str(raw.get("fiscal_year")), int(raw.get("quarter") or 0)),
            "projected_disbursement": amount(raw.get("projected_disbursement") or 0, f"{label} disbursement"),
            "projected_repayment": amount(raw.get("projected_repayment") or 0, f"{label} repayment"),
        })
    if len({q["key"] for q in checked}) != len(checked):
        raise ValueError("A quarter is listed twice")
    return checked, source


async def _projection(db: AsyncSession, project_id) -> List[LoanProjectionQuarter]:
    return list((await db.execute(select(LoanProjectionQuarter).where(LoanProjectionQuarter.project_id == project_id)
                                  .order_by(LoanProjectionQuarter.period_end_ad))).scalars())


def _check_against(quarters, rows: List[LoanProjectionQuarter]) -> Dict[Tuple[str, int], LoanProjectionQuarter]:
    if not rows:
        raise ValueError("This project has no loan projection to change")
    by_key = {_key(row): row for row in rows}
    for q in quarters:
        row = by_key.get(q["key"])
        if row is None:
            raise ValueError(f"FY {q['key'][0]} Q{q['key'][1]} is not in this project's projection")
        if row.is_opening:
            raise ValueError("The opening quarter is the position on record; it cannot be changed here")
    # Outstanding may not go below zero anywhere once the change is carried down
    outstanding = None
    changes = {q["key"]: q for q in quarters}
    for row in rows:
        change = changes.get(_key(row), {})
        if row.is_opening or outstanding is None:
            outstanding = row.projected_outstanding
            continue
        outstanding = (outstanding + change.get("projected_disbursement", row.projected_disbursement)
                       - change.get("projected_repayment", row.projected_repayment))
        if outstanding < 0:
            raise ValueError(f"Repayments exceed the balance by FY {row.fiscal_year} Q{row.quarter}")
    return by_key


async def prepare(db: AsyncSession, entity_id: Any, changes: Dict[str, Any]) -> Dict[str, Any]:
    project_id = project_uuid(entity_id)
    if await db.get(Project, project_id) is None:
        raise LookupError(f"Project {entity_id} not found")
    quarters, _ = _checked(changes)
    by_key = _check_against(quarters, await _projection(db, project_id))
    return {"quarters": [_view(by_key[q["key"]]) for q in quarters]}


async def apply(db: AsyncSession, entity_id: Any, changes: Dict[str, Any], approver: str):
    project_id = project_uuid(entity_id)
    quarters, source = _checked(changes)
    rows = await _projection(db, project_id)
    by_key = _check_against(quarters, rows)
    before = [_view(row) for row in rows]
    for q in quarters:
        row = by_key[q["key"]]
        row.projected_disbursement = q["projected_disbursement"]
        row.projected_repayment = q["projected_repayment"]
        row.data_provenance, row.source_reference, row.updated_by = "MANUAL_ENTRY", source, approver
    outstanding = None
    for row in rows:  # carry the change down: outstanding is derived, never entered
        if row.is_opening or outstanding is None:
            outstanding = row.projected_outstanding
            continue
        outstanding = outstanding + row.projected_disbursement - row.projected_repayment
        row.projected_outstanding = outstanding
    await db.flush()
    return {"quarters": before}, {"quarters": [_view(row) for row in rows], "source_reference": source}


register(ChangeKind(name=KIND, project_scoped=True, prepare=prepare, apply=apply, label="Loan projection for"))
