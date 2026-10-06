"""Seed 50 synthetic hydropower projects with loans for Phase 11 testing.

Project names are illustrative (some borrow the names of real Nepalese schemes); every
figure is synthetic. The output is deterministic so E2E tests can rely on it.

WARNING: this deletes every project, loan, tranche and repayment before seeding, along with
project ownership and the generation, hydrology, land, governance and ESG records of projects.

Run from the repository root:
    python -m backend.scripts.seed_realistic_data
"""

import asyncio
import random
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine
from backend.app.models.auth import ProjectOwner
from backend.app.models.financial import DisbursementTranche, LoanAccount, LoanAccountRateHistory, Repayment
from backend.app.models.operations import (
    BoardOfDirectors, EIAMitigationChecklist, EnergyGenerationData, ESGMetrics, HydrologyDetailed,
    LandAcquisitionTracking, PPAAgreement, ShareholdingHierarchy,
)
from backend.app.models.project import Project, ProjectTechnicalSpecs

SEED = 20261005
PROJECT_COUNT = 50
COST_PER_MW = Decimal("300000000")  # NPR 30 crore per MW
MONEY = Decimal("0.01")

# The seven provinces the web UI filters on, with the code used in project_code.
PROVINCES = {
    "Koshi": "KO", "Madhesh": "MA", "Bagmati": "BA", "Gandaki": "GA",
    "Lumbini": "LU", "Karnali": "KA", "Sudurpashchim": "SU",
}

# Pipeline statuses that make sense for each stage (see models.project.PipelineStatus).
STATUS_BY_STAGE = {
    "feasibility": ["proposal_under_pipeline", "under_review", "approved"],
    "construction": ["yet_to_start_drawdown", "under_construction"],
    "operation": ["under_operation"],
}

NAMED_PROJECTS = [
    ("Upper Marsyangdi", 50, "Gandaki"),
    ("Tamor Storage", 756, "Koshi"),
    ("Likhu-4", 52, "Bagmati"),
    ("Khimti", 60, "Bagmati"),
    ("Kali Gandaki A", 144, "Gandaki"),
    ("Bhotekoshi", 45, "Bagmati"),
    ("Nyadi", 30, "Gandaki"),
    ("Upper Indrawati", 35, "Bagmati"),
    ("Modi", 25, "Gandaki"),
    ("Arun-3", 900, "Koshi"),
    ("Budhigandaki", 1200, "Gandaki"),
    ("Sunkoshi-3", 536, "Bagmati"),
    ("Upper Karnali", 900, "Karnali"),
    ("West Seti", 750, "Sudurpashchim"),
    ("Rapti Diversion", 18, "Lumbini"),
]


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY)


def build_projects(rng: random.Random) -> List[Dict[str, Any]]:
    projects = [{"name_en": n, "capacity_mw": c, "province": p} for n, c, p in NAMED_PROJECTS]
    provinces = list(PROVINCES)
    while len(projects) < PROJECT_COUNT:
        projects.append({
            "name_en": f"Synthetic Hydro {len(projects) + 1}",
            "capacity_mw": rng.randint(15, 500),
            "province": provinces[len(projects) % len(provinces)],
        })
    stages = list(STATUS_BY_STAGE)
    for i, project in enumerate(projects, start=1):
        project["code"] = f"HPM-{PROVINCES[project['province']]}-{i:04d}"
        project["stage"] = stages[i % len(stages)]
        project["status"] = rng.choice(STATUS_BY_STAGE[project["stage"]])
    return projects


def build_tranches(rng: random.Random, disbursed: Decimal, first: date) -> List[Dict[str, Any]]:
    count = rng.randint(3, 5)
    share = money(disbursed / count)
    tranches = []
    for i in range(count):
        amount = disbursed - share * (count - 1) if i == count - 1 else share
        planned = first + timedelta(days=120 * i)
        tranches.append({
            "tranche_no": i + 1,
            "planned_amount": amount,
            "actual_amount": amount,
            "planned_date_ad": planned,
            "actual_date_ad": planned + timedelta(days=rng.randint(0, 15)),
        })
    return tranches


def build_repayments(rng: random.Random, principal: Decimal, rate_pct: Decimal, tenor_years: int,
                     grace_years: int, first_due: date, today: date, delinquent: bool) -> List[Dict[str, Any]]:
    """Semi-annual schedule: interest-only during grace, then equal principal instalments.

    Instalments due in the future are unpaid. A delinquent loan has missed its latest due instalment.
    """
    periods = tenor_years * 2
    amortising = periods - grace_years * 2
    instalment = money(principal / amortising)
    balance = principal
    rows = []
    for period in range(periods):
        due = date(first_due.year + period // 2, 6 if period % 2 == 0 else 12, 1)
        principal_due = Decimal("0") if period < grace_years * 2 else min(instalment, balance)
        if period == periods - 1:
            principal_due = balance
        interest_due = money(balance * rate_pct / Decimal("200"))
        rows.append({
            "due_date_ad": due, "principal_due": principal_due, "interest_due": interest_due,
            "principal_paid": Decimal("0"), "interest_paid": Decimal("0"),
            "paid_date_ad": None, "days_past_due": 0,
        })
        balance -= principal_due

    past = [r for r in rows if r["due_date_ad"] <= today]
    for row in past:
        row.update(principal_paid=row["principal_due"], interest_paid=row["interest_due"],
                   paid_date_ad=min(today, row["due_date_ad"] + timedelta(days=rng.randint(0, 10))))
    if delinquent and past:
        past[-1].update(principal_paid=Decimal("0"), interest_paid=Decimal("0"), paid_date_ad=None,
                        days_past_due=(today - past[-1]["due_date_ad"]).days)
    return rows


BASINS = {"Koshi": "Koshi", "Madhesh": "Bagmati", "Bagmati": "Bagmati", "Gandaki": "Gandaki",
          "Lumbini": "West Rapti", "Karnali": "Karnali", "Sudurpashchim": "Mahakali"}
WET_MONTHS = {6, 7, 8, 9, 10, 11}


def build_operations(rng: random.Random, project_id, data: Dict[str, Any], today: date) -> List[Any]:
    """Generation, hydrology, land, governance and ESG records for one operating project."""
    capacity = Decimal(data["capacity_mw"])
    ppa = PPAAgreement(
        id=uuid.uuid4(), project_id=project_id, agreement_number=f"NEA-{data['code']}",
        purchaser="Nepal Electricity Authority", effective_date_ad=date(2022, 7, 1), expiry_date_ad=date(2052, 7, 1),
        tariff_type="ROR", escalation_pct_annual=Decimal("3.00"), status="active")
    records: List[Any] = [ppa]

    first = date(today.year, today.month, 1)
    for back in range(1, 7):  # the six complete months before this one
        month = date(first.year + (first.month - back - 1) // 12, (first.month - back - 1) % 12 + 1, 1)
        wet = month.month in WET_MONTHS
        contract = money(capacity * Decimal("720") * Decimal("0.65" if wet else "0.35"))
        actual = money(contract * Decimal(str(round(rng.uniform(0.88, 1.06), 4))))
        rate = Decimal("4800" if wet else "8400")  # NPR per MWh
        records.append(EnergyGenerationData(
            id=uuid.uuid4(), project_id=project_id, ppa_agreement_id=ppa.id, month_ad=month,
            season="wet" if wet else "dry", contract_energy_mwh=contract, actual_energy_mwh=actual,
            availability_pct=Decimal(str(round(rng.uniform(90, 99), 2))), curtailment_mwh=Decimal("0"),
            revenue_npr=money(actual * rate)))

    records.append(HydrologyDetailed(
        id=uuid.uuid4(), project_id=project_id, river_basin=BASINS[data["province"]],
        catchment_area_sqkm=Decimal(rng.randint(300, 6000)),
        design_discharge_m3s=Decimal(str(round(rng.uniform(15, 250), 2))),
        median_flow_m3s=Decimal(str(round(rng.uniform(20, 320), 2))), measurement_date_ad=date(2021, 3, 1)))

    required = Decimal(rng.randint(300, 3000))
    acquired = money(required * Decimal(str(round(rng.uniform(0.85, 1.0), 2))))
    records.append(LandAcquisitionTracking(
        id=uuid.uuid4(), project_id=project_id, total_area_required_ropani=required,
        total_area_acquired_ropani=acquired, acquisition_pct=money(acquired / required * 100),
        compensation_paid_npr=money(acquired * Decimal("450000")),
        compensation_outstanding_npr=money((required - acquired) * Decimal("450000")),
        last_update_date_ad=today))
    for name, title in (("Director A", "Chairperson"), ("Director B", "Managing Director"), ("Director C", "Director")):
        records.append(BoardOfDirectors(id=uuid.uuid4(), project_id=project_id, director_name=name, title=title,
                                        appointment_date_ad=date(2021, 1, 15)))
    for entity, kind, share in (("Promoter group", "promoter", "51"), ("Institutional investor", "company", "30"),
                                ("Public shareholders", "public", "19")):
        records.append(ShareholdingHierarchy(id=uuid.uuid4(), project_id=project_id, entity_name=entity,
                                             entity_type=kind, share_pct=Decimal(share),
                                             effective_from_ad=date(2021, 1, 15)))

    avoided = money(capacity * Decimal("2500"))
    records.append(ESGMetrics(
        id=uuid.uuid4(), project_id=project_id, metric_date_ad=first, carbon_credits_generated=avoided,
        ghg_emissions_avoided_tonnes=avoided, co2_avoided_tonnes_per_year=avoided,
        local_employment_count=rng.randint(40, 600), community_grievance_count=rng.randint(0, 12),
        grievance_resolution_rate_pct=Decimal(str(round(rng.uniform(70, 100), 2)))))
    for measure, status, pct in (("Compensatory afforestation", "in_progress", "80"),
                                 ("Fish passage", "completed", "100"), ("Biodiversity monitoring", "planned", "0")):
        records.append(EIAMitigationChecklist(id=uuid.uuid4(), project_id=project_id, mitigation_measure=measure,
                                              status=status, completion_pct=Decimal(pct)))
    return records


async def seed(session: AsyncSession, today: date | None = None) -> int:
    """Replace all project and loan data in ``session`` with the synthetic set. The caller commits."""
    rng = random.Random(SEED)
    today = today or date.today()
    projects = build_projects(rng)

    for model in (Repayment, DisbursementTranche, LoanAccountRateHistory, LoanAccount,
                  EnergyGenerationData, PPAAgreement, HydrologyDetailed, LandAcquisitionTracking,
                  BoardOfDirectors, ShareholdingHierarchy, ESGMetrics, EIAMitigationChecklist,
                  ProjectTechnicalSpecs, ProjectOwner, Project):
        await session.execute(delete(model))

    for index, data in enumerate(projects):
        project = Project(
            id=uuid.UUID(int=rng.getrandbits(128), version=4),
            project_code=data["code"],
            name_en=data["name_en"],
            name_np=data["name_en"],
            province=data["province"],
            installed_capacity_mw=Decimal(data["capacity_mw"]),
            project_stage=data["stage"],
            pipeline_status=data["status"],
            original_cod_ad=date(2024 + index % 5, 1 + index % 12, 1),
        )
        session.add(project)
        session.add(ProjectTechnicalSpecs(
            id=uuid.uuid4(), project_id=project.id,
            design_head_m=Decimal(str(round(rng.uniform(50, 300), 2))),
            design_discharge_cumecs=Decimal(str(round(rng.uniform(10, 200), 4))),
            plant_type=rng.choice(["run_of_river", "storage", "cascade"]),
            turbine_type=rng.choice(["francis", "pelton", "turgo"]),
            transmission_km=Decimal(str(round(rng.uniform(5, 100), 2))),
        ))

        # Projects still in feasibility have no drawn loan yet.
        if data["stage"] == "feasibility":
            continue
        if data["stage"] == "operation":
            for record in build_operations(rng, project.id, data, today):
                session.add(record)

        project_cost = Decimal(data["capacity_mw"]) * COST_PER_MW
        debt_share = Decimal(str(round(rng.uniform(0.60, 0.75), 4)))
        sanctioned = money(project_cost * debt_share)
        disbursed = money(sanctioned * Decimal(str(round(rng.uniform(0.70, 1.0), 4))))
        rate = Decimal(str(round(rng.uniform(8.5, 11.5), 2)))
        tenor, grace = rng.randint(10, 15), rng.randint(1, 3)
        first_due = date(2024, 6, 1)
        delinquent = index % 10 == 4  # roughly one loan in ten has a missed instalment

        repayments = build_repayments(rng, disbursed, rate, tenor, grace, first_due, today, delinquent)
        repaid = sum((r["principal_paid"] for r in repayments), Decimal("0"))
        overdue = [r for r in repayments if r["days_past_due"] > 0]

        loan = LoanAccount(
            id=uuid.uuid4(), project_id=project.id,
            finacle_account_id=f"FIN-{data['code']}",
            facility_type="term_loan" if index % 3 else "syndicated_term_loan",
            sanctioned_amount=sanctioned, disbursed_amount=disbursed,
            outstanding_principal=disbursed - repaid,
            overdue_principal=sum((r["principal_due"] for r in overdue), Decimal("0")),
            overdue_interest=sum((r["interest_due"] for r in overdue), Decimal("0")),
            interest_rate_pct=rate,  # covenant metrics are left for the application to calculate
            maturity_ad=date(first_due.year + tenor, 6, 1),
            sync_status="success",
        )
        session.add(loan)
        for tranche in build_tranches(rng, disbursed, date(2022, 1, 15)):
            session.add(DisbursementTranche(id=uuid.uuid4(), loan_account_id=loan.id, **tranche))
        for repayment in repayments:
            session.add(Repayment(id=uuid.uuid4(), loan_account_id=loan.id, **repayment))

    await session.flush()
    return len(projects)


async def main() -> int:
    async with AsyncSession(engine) as session:
        count = await seed(session)
        await session.commit()
    return count


if __name__ == "__main__":
    print(f"Seeded {asyncio.run(main())} projects")
