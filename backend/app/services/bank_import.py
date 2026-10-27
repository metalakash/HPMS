"""Load the bank's portfolio workbooks through the application, under maker-checker.

An administrator uploads the two workbooks the bank already keeps (the loan projection workbook and
the generation workbook). The application reads them at once and shows the reconciliation: what it
found, against the totals each workbook states for itself, and what loading it would replace.
Nothing changes yet. The administrator then submits it as a change request (BANK_IMPORT); another
administrator's final approval replaces the portfolio with the workbooks'.

The files are kept encrypted between preview and approval, and the request is bound to their
content hashes, so what is approved is exactly what was previewed. The reading and loading code is
the same as the command-line loader's (backend/scripts/import_bank_portfolio.py).

Off unless BANK_IMPORT_ENABLED is true, and never where demo reset is on: a public demo must not hold
customer data.

    BANK_IMPORT   entity_id = the import's id   {"files": <hash of both files>}
"""

import asyncio
import hashlib
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.models.bank_import import BankImport
from backend.app.security import secret_box
from backend.app.services.change_kinds import ChangeKind, bank_wide_kinds, only_fields, register

KIND = "BANK_IMPORT"
ADMINS = frozenset({"admin"})
XLSX_SIGNATURE = b"PK\x03\x04"


class ImportRefused(Exception):
    """Importing is switched off here, or the files cannot be imported."""


def enabled() -> bool:
    return bool(settings.BANK_IMPORT_ENABLED) and not settings.DEMO_RESET_ENABLED


def _check_file(name: str, content: bytes, what: str) -> None:
    if not name.lower().endswith(".xlsx"):
        raise ImportRefused(f"The {what} must be an Excel workbook (.xlsx)")
    if not content.startswith(XLSX_SIGNATURE):
        raise ImportRefused(f"{name}: the content is not an Excel workbook")
    if len(content) > settings.BANK_IMPORT_MAX_MB * 1024 * 1024:
        raise ImportRefused(f"{name} is larger than {settings.BANK_IMPORT_MAX_MB} MB")


def _read(projection: Tuple[str, bytes], generation: Tuple[str, bytes]):
    """Parse the two workbooks from bytes. Runs in a worker thread: openpyxl is slow and blocking."""
    from backend.scripts import import_bank_portfolio as reader

    with tempfile.TemporaryDirectory() as folder:
        paths = []
        for index, (_name, content) in enumerate((projection, generation)):
            path = Path(folder) / f"workbook{index}.xlsx"
            path.write_bytes(content)
            paths.append(path)
        try:
            portfolio, issues = reader.parse(paths[0], paths[1])
        except Exception as error:  # a workbook not laid out like the bank's
            raise ImportRefused(f"The workbooks could not be read as the bank's portfolio workbooks: {error}") from error
    return portfolio, issues, reader.summary(portfolio, issues)


def binding(row: BankImport) -> str:
    """One hash for both files: what a change request names, so it can only load what was previewed."""
    return hashlib.sha256(f"{row.projection_sha256}:{row.generation_sha256}".encode()).hexdigest()


async def portfolio_counts(db: AsyncSession) -> Dict[str, int]:
    """What loading would replace."""
    from backend.app.models.document import Document
    from backend.app.models.financial import LoanAccount
    from backend.app.models.governance import ApprovalRequest
    from backend.app.models.project import Project

    async def count(model, *where) -> int:
        return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar() or 0

    return {"projects": await count(Project), "loans": await count(LoanAccount), "documents": await count(Document),
            "change_requests": await count(ApprovalRequest, ApprovalRequest.entity_type.not_in(bank_wide_kinds()))}


async def preview(db: AsyncSession, projection: Tuple[str, bytes], generation: Tuple[str, bytes],
                  uploaded_by: str) -> BankImport:
    """Read and reconcile the workbooks and keep them for approval. Changes nothing else."""
    if not enabled():
        raise ImportRefused("Importing bank workbooks is not enabled on this instance")
    _check_file(projection[0], projection[1], "loan projection workbook")
    _check_file(generation[0], generation[1], "generation workbook")
    _portfolio, _issues, summary = await asyncio.to_thread(_read, projection, generation)
    row = BankImport(
        status="previewed", projection_filename=projection[0][:255], generation_filename=generation[0][:255],
        projection_sha256=hashlib.sha256(projection[1]).hexdigest(),
        generation_sha256=hashlib.sha256(generation[1]).hexdigest(),
        projection_content=secret_box.encrypt_bytes(projection[1]),
        generation_content=secret_box.encrypt_bytes(generation[1]),
        summary=summary, agrees=summary["agrees"], replaces=await portfolio_counts(db), uploaded_by=uploaded_by)
    db.add(row)
    await db.flush()
    return row


async def _load_row(db: AsyncSession, entity_id: Any) -> BankImport:
    try:
        key = UUID(str(entity_id))
    except ValueError:
        raise LookupError(f"Import {entity_id} not found") from None
    row = await db.get(BankImport, key)
    if row is None:
        raise LookupError(f"Import {entity_id} not found")
    return row


def _check_request(row: BankImport, changes: Dict[str, Any]) -> None:
    only_fields(changes, ["files", "projection", "generation"], KIND)
    if row.status != "previewed":
        raise ValueError(f"This import has already been {row.status}")
    if not row.agrees:
        raise ValueError("The workbooks' rows do not add up to their own totals; correct them and upload again")
    if changes.get("files") != binding(row):
        raise ValueError("The request does not name the files that were previewed")


async def prepare(db: AsyncSession, entity_id: Any, changes: Dict[str, Any]) -> Dict[str, Any]:
    from backend.app.models.governance import ApprovalRequest

    if not enabled():
        raise ValueError("Importing bank workbooks is not enabled on this instance")
    row = await _load_row(db, entity_id)
    _check_request(row, changes)
    pending = (await db.execute(select(func.count()).select_from(ApprovalRequest).where(
        ApprovalRequest.entity_type == KIND, ApprovalRequest.entity_id == str(row.id),
        ApprovalRequest.current_state.in_(("submitted", "recommended"))))).scalar()
    if pending:
        raise ValueError("This import is already waiting for approval")
    return {"portfolio": await portfolio_counts(db)}


async def _clear_project_requests(db: AsyncSession) -> None:
    """Change requests about projects and loans point at rows that are about to go. Bank-wide ones
    (settings, rules, rates, imports, including the request being applied) stay."""
    from backend.app.models.governance import ApprovalRequest, ApprovalStep

    stale = select(ApprovalRequest.id).where(ApprovalRequest.entity_type.not_in(bank_wide_kinds()))
    await db.execute(delete(ApprovalStep).where(ApprovalStep.approval_request_id.in_(stale)))
    await db.execute(delete(ApprovalRequest).where(ApprovalRequest.entity_type.not_in(bank_wide_kinds())))


async def apply(db: AsyncSession, entity_id: Any, changes: Dict[str, Any], approver: str):
    from backend.app.services.demo_reset import clear_project_records
    from backend.scripts import import_bank_portfolio as reader
    from backend.scripts.seed_realistic_data import DELETE_ORDER

    if not enabled():
        raise ValueError("Importing bank workbooks is not enabled on this instance")
    row = await _load_row(db, entity_id)
    _check_request(row, changes)
    projection = (row.projection_filename, secret_box.decrypt_bytes(row.projection_content))
    generation = (row.generation_filename, secret_box.decrypt_bytes(row.generation_content))
    if (hashlib.sha256(projection[1]).hexdigest(), hashlib.sha256(generation[1]).hexdigest()) != (
            row.projection_sha256, row.generation_sha256):
        raise ValueError("The stored workbooks do not match what was previewed; upload them again")
    try:
        portfolio, _issues, summary = await asyncio.to_thread(_read, projection, generation)
    except ImportRefused as error:
        raise ValueError(str(error)) from error
    if not summary["agrees"]:
        raise ValueError("The workbooks' rows no longer add up to their own totals")

    before = await portfolio_counts(db)
    await clear_project_records(db)
    await _clear_project_requests(db)
    # The projects themselves and the bank-wide figures the workbooks also carry (bonds, ratio inputs, planned limits)
    for model in DELETE_ORDER:
        if model.__tablename__ not in ("approval_requests", "approval_steps"):
            await db.execute(delete(model))
    loaded = await reader.write(db, portfolio, row.projection_filename, row.generation_filename)
    row.status, row.applied_by, row.applied_at, row.result = "applied", approver, datetime.now(timezone.utc), loaded
    await db.flush()
    return {"replaced": before}, {"loaded": loaded, "import": str(row.id),
                                  "files": [row.projection_filename, row.generation_filename]}


register(ChangeKind(name=KIND, project_scoped=False, prepare=prepare, apply=apply,
                    label="Bank workbook import", author_roles=ADMINS, names_entity=False))
