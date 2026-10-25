"""Put a demo instance back to the synthetic test portfolio, from the Admin screen.

This is the same data as running seed_realistic_data, seed_test_workflows, seed_demo_documents and seed_demo_budgets, but it also clears
the records a demo audience may have added since (insurance, contacts, documents and the like),
which those scripts do not know about. Users and the audit log are kept: the reset itself is
audited.

Off unless DEMO_RESET_ENABLED is true and the demo accounts are allowed, so it can only exist where
the published demo passwords already make the data public. It also refuses to run on a database
holding anything loaded from the bank's workbooks.
"""

import time
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import Table, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.models.base import Base
from backend.app.security.auth_selection import dev_auth_allowed

BANK_PROVENANCE = "BANK_WORKBOOK"  # what backend/scripts/import_bank_portfolio.py stamps on its rows


class DemoResetRefused(Exception):
    """The reset is switched off here, or the database holds data that must not be replaced."""


def reset_enabled() -> bool:
    return bool(settings.DEMO_RESET_ENABLED) and dev_auth_allowed(
        settings.USE_LDAP, settings.ALLOW_DEV_AUTH, settings.DEBUG)


def project_dependent_tables() -> List[Table]:
    """Every table that points at a project, directly or through another such table, children first."""
    import backend.app.models  # noqa: F401  (registers every table on the metadata)

    tables = Base.metadata.tables
    reached = {"projects"}
    dependents: set = set()
    grown = True
    while grown:
        grown = False
        for table in tables.values():
            if table.name not in reached and any(fk.column.table.name in reached for fk in table.foreign_keys):
                reached.add(table.name)
                dependents.add(table.name)
                grown = True
    return [table for table in reversed(Base.metadata.sorted_tables) if table.name in dependents]


async def holds_bank_data(db: AsyncSession) -> bool:
    import backend.app.models  # noqa: F401

    for table in Base.metadata.sorted_tables:
        column = table.columns.get("data_provenance")
        if column is not None and (await db.execute(select(exists().where(column == BANK_PROVENANCE)))).scalar():
            return True
    return False


async def clear_project_records(db: AsyncSession) -> None:
    """Delete what hangs off the projects. A row with an optional link (a contact, a filing) goes only if linked."""
    tables = project_dependent_tables()
    linked = {"projects", *(table.name for table in tables)}
    for table in tables:
        links = [fk.parent for fk in table.foreign_keys if fk.column.table.name in linked]
        await db.execute(table.delete().where(or_(*(link.is_not(None) for link in links))))
    # Document file content is keyed by path, not linked; every document belongs to a project
    await db.execute(Base.metadata.tables["document_blobs"].delete())


async def reset_demo_data(db: AsyncSession, today: Optional[date] = None) -> Dict[str, Any]:
    """Replace the portfolio with the synthetic one. The caller audits and commits."""
    from backend.scripts import seed_demo_budgets, seed_demo_documents, seed_realistic_data, seed_test_workflows

    if not reset_enabled():
        raise DemoResetRefused("Resetting demo data is not enabled on this instance")
    if await holds_bank_data(db):
        raise DemoResetRefused("This database holds data loaded from the bank; it cannot be reset to demo data")

    started = time.monotonic()
    await clear_project_records(db)
    projects = await seed_realistic_data.seed(db, today=today)
    # Settings and approval rules a demo audience changed go back to the defaults (their requests are gone now)
    await db.execute(Base.metadata.tables["app_parameters"].delete())
    await db.execute(Base.metadata.tables["workflow_definitions"].delete())
    requests = await seed_test_workflows.seed(db)
    documents = await seed_demo_documents.seed(db)
    budget_lines = await seed_demo_budgets.seed(db)
    return {"projects": projects, "change_requests": len(requests), "documents": documents,
            "budget_lines": budget_lines,
            "duration_seconds": round(time.monotonic() - started, 1)}
