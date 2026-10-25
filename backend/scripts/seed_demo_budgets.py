"""Give each financed project a synthetic budget against actual cost, so the Budget tab is not empty in a demo.

The budget is the project cost (capacity at NPR 20 crore per MW) split across the usual cost heads of a
run-of-river project. Operating projects have spent close to budget, some over; projects under
construction have spent part of it. Deterministic: the same projects get the same figures every time.
Nothing comes from the bank.

Run after seed_realistic_data (the demo reset runs it automatically):
    python -m backend.scripts.seed_demo_budgets
"""

import asyncio
import random
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine
from backend.app.models.financial import BudgetLine, LoanAccount
from backend.app.models.project import Project
from backend.app.services.budget_changes import variance

SEED = 20261019
COST_PER_MW = Decimal("200000000")
MONEY = Decimal("0.01")
# Cost head and its share of project cost
HEADS = [
    ("Civil works", Decimal("0.42")), ("Electromechanical equipment", Decimal("0.20")),
    ("Hydromechanical equipment", Decimal("0.07")), ("Transmission line", Decimal("0.08")),
    ("Land and compensation", Decimal("0.05")), ("Engineering and supervision", Decimal("0.06")),
    ("Interest during construction", Decimal("0.08")), ("Contingency", Decimal("0.04")),
]


async def seed(db: AsyncSession) -> int:
    """Add the demo budgets. Returns how many lines were added; 0 when budgets already exist."""
    if (await db.execute(select(BudgetLine.id).limit(1))).first():
        return 0
    rng = random.Random(SEED)
    projects = (await db.execute(
        select(Project).join(LoanAccount, LoanAccount.project_id == Project.id)
        .where(Project.project_stage.in_(("operation", "construction"))).order_by(Project.project_code))).scalars().unique()
    added = 0
    for project in projects:
        cost = Decimal(project.installed_capacity_mw) * COST_PER_MW
        progress = Decimal(str(round(rng.uniform(0.3, 0.85), 4)))
        for head, share in HEADS:
            budgeted = (cost * share).quantize(MONEY)
            if project.project_stage == "operation":
                spent = Decimal(str(round(rng.uniform(0.92, 1.14), 4)))  # some heads overran
            else:
                spent = progress * Decimal(str(round(rng.uniform(0.8, 1.2), 4)))
            actual = (budgeted * spent).quantize(MONEY)
            difference, pct = variance(budgeted, actual)
            db.add(BudgetLine(id=uuid.uuid4(), project_id=project.id, category=head, budgeted_amount=budgeted,
                              actual_amount=actual, variance_amount=difference, variance_pct=pct,
                              data_provenance="SYNTHETIC", created_by="seed_demo_budgets"))
            added += 1
    await db.flush()
    return added


async def main() -> int:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        count = await seed(session)
        await session.commit()
    return count


if __name__ == "__main__":
    print(f"Added {asyncio.run(main())} demo budget lines")
