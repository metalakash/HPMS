"""Project budget and actual cost lines as change requests (RFP FUNC B.2, C.4, F.9, G.3).

One request changes any number of a project's lines at once, so a bulk upload is a single request:

    {"lines": [{"id": optional existing line, "category": "Civil works",
                "budgeted_amount": "1200000000", "actual_amount": "950000000.50"}],
     "remove": [line ids], "source_reference": "Board-approved budget FY 2082/83",
     "upload_batch_id": optional}

Variance is calculated here, never entered: actual minus budget, and that as a share of budget.
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.financial import BudgetLine
from backend.app.models.project import Project
from backend.app.services.change_kinds import (
    ChangeKind, amount, only_fields, plain, project_uuid, register, require_source,
)

KIND = "BUDGET_LINE"
LINE_FIELDS = ["id", "category", "budgeted_amount", "actual_amount"]
MAX_LINES = 500
HUNDRED = Decimal("100")


def variance(budgeted: Optional[Decimal], actual: Optional[Decimal]) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """(actual - budget, that as % of budget). Positive means over budget."""
    if budgeted is None or actual is None:
        return None, None
    difference = actual - budgeted
    pct = (difference / budgeted * HUNDRED).quantize(Decimal("0.0001")) if budgeted else None
    return difference, pct


def line_view(line: BudgetLine) -> Dict[str, Any]:
    return plain({"id": str(line.id), "category": line.category, "budgeted_amount": line.budgeted_amount,
                  "actual_amount": line.actual_amount, "variance_amount": line.variance_amount,
                  "variance_pct": line.variance_pct})


def _checked(changes: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[UUID], str]:
    only_fields(changes, ["lines", "remove", "source_reference", "upload_batch_id"], KIND)
    source = require_source(changes)
    raw_lines = changes.get("lines") or []
    remove_raw = changes.get("remove") or []
    if not isinstance(raw_lines, list) or not isinstance(remove_raw, list):
        raise ValueError("lines and remove must be lists")
    if not raw_lines and not remove_raw:
        raise ValueError("Nothing to change: give at least one line to add, change or remove")
    if len(raw_lines) > MAX_LINES:
        raise ValueError(f"At most {MAX_LINES} lines in one request")
    lines = []
    for number, raw in enumerate(raw_lines, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"Line {number}: not a line")
        only_fields(raw, LINE_FIELDS, f"budget line {number}")
        category = str(raw.get("category") or "").strip()
        if not category:
            raise ValueError(f"Line {number}: a category is required")
        if len(category) > 100:
            raise ValueError(f"Line {number}: category is longer than 100 characters")
        if raw.get("budgeted_amount") in (None, ""):
            raise ValueError(f"Line {number} ({category}): a budgeted amount is required")
        line = {"category": category,
                "budgeted_amount": amount(raw["budgeted_amount"], f"Line {number} budgeted amount"),
                "actual_amount": amount(raw.get("actual_amount") or 0, f"Line {number} actual amount")}
        if raw.get("id"):
            try:
                line["id"] = UUID(str(raw["id"]))
            except ValueError:
                raise ValueError(f"Line {number}: unknown line id") from None
        lines.append(line)
    try:
        remove = [UUID(str(value)) for value in remove_raw]
    except ValueError:
        raise ValueError("remove: unknown line id") from None
    return lines, remove, source


async def _existing(db: AsyncSession, project_id: UUID) -> Dict[UUID, BudgetLine]:
    rows = (await db.execute(select(BudgetLine).where(BudgetLine.project_id == project_id))).scalars().all()
    return {row.id: row for row in rows}


def _check_against(lines, remove, existing: Dict[UUID, BudgetLine]) -> None:
    for target in [line["id"] for line in lines if "id" in line] + remove:
        if target not in existing:
            raise ValueError(f"Budget line {target} is not on this project")
    # The resulting budget must not list a category twice
    after = {line_id: row.category for line_id, row in existing.items() if line_id not in remove}
    for line in lines:
        after[line.get("id") or uuid4()] = line["category"]
    seen = set()
    for category in after.values():
        key = (category or "").strip().lower()
        if key in seen:
            raise ValueError(f"Category {category!r} would appear twice in the budget")
        seen.add(key)


async def prepare(db: AsyncSession, entity_id: Any, changes: Dict[str, Any]) -> Dict[str, Any]:
    project_id = project_uuid(entity_id)
    if await db.get(Project, project_id) is None:
        raise LookupError(f"Project {entity_id} not found")
    lines, remove, _ = _checked(changes)
    existing = await _existing(db, project_id)
    _check_against(lines, remove, existing)
    touched = {line["id"] for line in lines if "id" in line} | set(remove)
    return {"lines": [line_view(existing[line_id]) for line_id in touched]}


async def apply(db: AsyncSession, entity_id: Any, changes: Dict[str, Any], approver: str):
    project_id = project_uuid(entity_id)
    lines, remove, source = _checked(changes)
    existing = await _existing(db, project_id)
    _check_against(lines, remove, existing)  # the budget may have changed since submission
    before = [line_view(existing[line_id]) for line_id in remove]
    after = []
    provenance = "BULK_UPLOAD" if changes.get("upload_batch_id") else "MANUAL_ENTRY"
    for line_id in remove:
        await db.delete(existing[line_id])
    for line in lines:
        row = existing.get(line.get("id")) if "id" in line else None
        if row is None:
            row = BudgetLine(id=uuid4(), project_id=project_id, created_by=approver)
            db.add(row)
        else:
            before.append(line_view(row))
        row.category = line["category"]
        row.budgeted_amount = line["budgeted_amount"]
        row.actual_amount = line["actual_amount"]
        row.variance_amount, row.variance_pct = variance(row.budgeted_amount, row.actual_amount)
        row.upload_batch_id = changes.get("upload_batch_id")
        row.data_provenance = provenance
        row.updated_by = approver
        after.append(line_view(row))
    await db.flush()
    return {"lines": before}, {"lines": after, "source_reference": source}


register(ChangeKind(name=KIND, project_scoped=True, prepare=prepare, apply=apply, label="Budget for"))
