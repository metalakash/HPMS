"""Seed a realistic test portfolio: 50 real hydropower projects with synthetic lending data.

Project identity (name, capacity, river, province, district, municipality, licence stage) comes
from backend/data/merged_hydropower_master.csv, the Niti Foundation / DoED licence list. Everything
about the bank's relationship with a project (loans, schedules, covenants, milestones, risks,
operations, governance, ESG) is synthetic, generated from the project's size and stage. So are the
bank-wide figures built on top of the loans: the quarterly loan projection, the energy bonds, the
bank's total lending and the regulator's minimum share for energy, and the planned new limits. The output
is deterministic, including project ids, so tests and links survive a reseed.

WARNING: this deletes every project and everything that hangs off one (loans, schedules, milestones,
risks, licences, operations records, ownership), the loan projection, bonds and energy-financing
figures, and all maker-checker requests, then reseeds. Run
seed_test_workflows afterwards to recreate the change requests.

Run from the repository root:
    python -m backend.scripts.seed_realistic_data
"""

import asyncio
import csv
import random
import uuid
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine
from backend.app.models.auth import ProjectOwner
from backend.app.models.financial import (
    DisbursementTranche, EnergyBond, EnergyFinancingQuarter, LoanAccount, LoanAccountRateHistory,
    LoanProjectionQuarter, NewLoanDisbursementQuarter, NewLoanLimit, Repayment,
)
from backend.app.models.governance import ApprovalRequest, ApprovalStep
from backend.app.models.operations import (
    BoardOfDirectors, CovenantHistory, CovenantTerms, EIAMitigationChecklist, EnergyGenerationData, ESGMetrics,
    FinancialPeriod, HydrologyDetailed, LandAcquisitionTracking, MaintenanceLog, MaintenanceSchedule, NEAPPARate,
    PlantPerformance, PPAAgreement, ShareholdingHierarchy,
)
from backend.app.models.project import Project, ProjectTechnicalSpecs, WaterLicense
from backend.app.models.risk import Milestone, RiskRegisterEntry
from backend.app.services import energy_financing
from backend.app.services.covenant_engine import Quarter
from backend.app.services.covenant_service import CovenantService
from backend.app.services.filing_calendar import FilingPeriod, period_ends
from backend.app.services.risk_service import bs_string, compute_severity

SEED = 20261005
SOURCE = Path(__file__).resolve().parent.parent / "data" / "merged_hydropower_master.csv"
ID_NAMESPACE = uuid.UUID("6f0f3b52-5d0a-4a3e-9d0b-2b7f3f1c9a10")
COST_PER_MW = Decimal("200000000")  # NPR 20 crore per MW, typical for run-of-river
MONEY = Decimal("0.01")

# DoED province numbers -> the names the web UI filters on, and the code used in project_code.
# Madhesh (Province 2) has no licensed hydropower in the source list.
PROVINCES = {
    "Province 1": ("Koshi", "KO"), "Province 2": ("Madhesh", "MA"), "Province 3": ("Bagmati", "BA"),
    "Province 4": ("Gandaki", "GA"), "Province 5": ("Lumbini", "LU"), "Province 6": ("Karnali", "KA"),
    "Province 7": ("Sudurpashchim", "SU"),
}
PROVINCE_CODES = dict(PROVINCES.values())
BASINS = {"Koshi": "Koshi", "Madhesh": "Bagmati", "Bagmati": "Bagmati", "Gandaki": "Gandaki",
          "Lumbini": "West Rapti", "Karnali": "Karnali", "Sudurpashchim": "Mahakali"}

# DoED licence type -> project stage, how many of each to take, and the statuses that fit the stage
STAGES = {
    "Operation": ("operation", 17, ["under_operation"]),
    "Generation": ("construction", 17, ["yet_to_start_drawdown", "under_construction", "under_construction"]),
    "Survey": ("feasibility", 16, ["proposal_under_pipeline", "under_review", "approved"]),
}
WET_MONTHS = {6, 7, 8, 9, 10, 11}
# Share of installed capacity generated, and the PPA rate in NPR per MWh (posted rate after escalation)
SEASONS = {True: ("wet", Decimal("0.85"), Decimal("5600")), False: ("dry", Decimal("0.45"), Decimal("9800"))}
FINANCIAL_QUARTERS = 11  # three more than the eight shown, so the oldest shown has a full year behind it

# Loan projection and energy financing. The projection opens at the last fiscal quarter end reached.
PROJECTION_QUARTERS = 16        # quarters projected after the opening position
RECORDED_QUARTERS = 8           # quarters before the opening for which the energy share is on record
DRAWDOWN_QUARTERS = 6           # a project still building draws the rest of its limit over this many
OPENING_ENERGY_SHARE = Decimal("0.108")   # energy financing over the bank's lending at the opening
BANK_LOAN_GROWTH = Decimal("0.010")       # the bank's total lending, per quarter
HYDRO_BOOK_GROWTH = Decimal("0.025")      # the hydropower book, per quarter, before the opening
# Minimum energy share: (quarters from the opening at which it takes effect, per cent). Illustrative steps.
MINIMUM_SHARE_STEPS = [(-RECORDED_QUARTERS, Decimal("6.5")), (-4, Decimal("7")), (0, Decimal("8")), (6, Decimal("10"))]
# Bonds: (name, share of the opening hydropower book, years since investment, tenor in years, yield)
BONDS = [
    ("Infrastructure Energy Bond 7%", Decimal("0.025"), 3, 7, Decimal("7")),
    ("Green Energy Debenture 7.5%", Decimal("0.020"), 2, 10, Decimal("7.5")),
    ("Hydropower Development Bond 4%", Decimal("0.015"), 4, 6, Decimal("4")),
]
NEW_LIMIT_SHARES = [Decimal("0.15"), Decimal("0.18"), Decimal("0.20")]  # of the opening book, one per fiscal year
NEW_LIMIT_DRAWDOWN = [Decimal("10"), Decimal("30"), Decimal("40"), Decimal("20")]  # per cent drawn in each year
CRORE = Decimal("10000000")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY)


def _num(rng: random.Random, low: float, high: float, places: int = 2) -> Decimal:
    return Decimal(str(round(rng.uniform(low, high), places)))


def _months_before(first_of_month: date, back: int) -> date:
    index = first_of_month.year * 12 + first_of_month.month - 1 - back
    return date(index // 12, index % 12 + 1, 1)


def _bs(day: date | None) -> str | None:
    return bs_string(day) if day else None


def load_source() -> List[Dict[str, str]]:
    with SOURCE.open(encoding="utf-8", newline="") as handle:
        return [row for row in csv.DictReader(handle) if row["province"] in PROVINCES and row["capacity_mw"]]


def build_projects(rng: random.Random) -> List[Dict[str, Any]]:
    """50 real projects: the largest of each licence stage plus a random spread of the rest."""
    source = load_source()
    chosen: List[Dict[str, Any]] = []
    for licence_type, (stage, count, statuses) in STAGES.items():
        pool = sorted((r for r in source if r["license_type"] == licence_type), key=lambda r: r["project_name"])
        largest = sorted(pool, key=lambda r: -float(r["capacity_mw"]))[:5]
        rest = [r for r in pool if r not in largest]
        picked = largest + rng.sample(rest, count - len(largest))
        # Every province this stage has should be findable through the UI's province filter:
        # swap a randomly drawn row from the best-represented province for one from each missing province.
        for province in sorted({r["province"] for r in pool} - {r["province"] for r in picked}):
            counts: Dict[str, int] = {}
            for row in picked[5:]:
                counts[row["province"]] = counts.get(row["province"], 0) + 1
            crowded = max(sorted(counts), key=counts.get)
            victim = next(i for i in range(5, len(picked)) if picked[i]["province"] == crowded)
            picked[victim] = next(r for r in rest if r["province"] == province and r not in picked)
        for row in sorted(picked, key=lambda r: r["project_name"]):
            chosen.append({
                "name_en": row["project_name"].strip(), "capacity_mw": Decimal(row["capacity_mw"]),
                "province": PROVINCES[row["province"]][0], "district": row["district"].strip().title() or None,
                "local_level": row["municipality"].strip() or None, "river": row["river"].strip() or None,
                "promoter": row["promoter"].strip() or None, "licence_number": row["license_number"].strip(),
                "stage": stage, "status": rng.choice(statuses),
            })
    for index, project in enumerate(chosen, start=1):
        project["code"] = f"HPM-{PROVINCE_CODES[project['province']]}-{index:04d}"
    return chosen


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


def fiscal_quarters(today: date) -> List[FilingPeriod]:
    """Fiscal quarter ends around today: the recorded quarters, the opening, the projected ones, and
    enough beyond to schedule the last new limit's drawdown. ``[RECORDED_QUARTERS]`` is the opening."""
    periods = period_ends("quarterly", today - timedelta(days=366 * 4), today + timedelta(days=366 * 9))
    opening = max(i for i, period in enumerate(periods) if period.end_ad <= today)
    return periods[opening - RECORDED_QUARTERS:]


def _fiscal_year(period: FilingPeriod) -> str:
    return period.label.split()[1]  # "FY 2082/83 Q1" -> "2082/83"


def _quarter(period: FilingPeriod) -> int:
    return int(period.label[-1])


def build_projection(status: str, sanctioned: Decimal, disbursed: Decimal, outstanding: Decimal,
                     repayments: List[Dict[str, Any]], quarters: List[FilingPeriod]) -> List[Dict[str, Any]]:
    """A loan's plan by fiscal quarter, starting from its position today.

    ``quarters[0]`` is the opening. Repayment is the principal falling due in each quarter on the
    loan's own schedule. A project that is still building draws what is left of its limit in equal
    parts; one in operation draws nothing more. Each quarter's outstanding is the one before plus
    disbursement less repayment.
    """
    undrawn = sanctioned - disbursed if status in ("under_construction", "yet_to_start_drawdown") else Decimal("0")
    draw = money(undrawn / DRAWDOWN_QUARTERS)
    rows = [{"period": quarters[0], "is_opening": True, "disbursement": Decimal("0"), "repayment": Decimal("0"),
             "outstanding": outstanding}]
    for index in range(1, len(quarters)):
        period, before = quarters[index], quarters[index - 1]
        disbursement = Decimal("0")
        if undrawn > 0 and index <= DRAWDOWN_QUARTERS:
            disbursement = undrawn - draw * (DRAWDOWN_QUARTERS - 1) if index == DRAWDOWN_QUARTERS else draw
        repayment = sum((r["principal_due"] for r in repayments
                         if before.end_ad < r["due_date_ad"] <= period.end_ad), Decimal("0"))
        repayment = min(repayment, rows[-1]["outstanding"] + disbursement)
        rows.append({"period": period, "is_opening": False, "disbursement": disbursement, "repayment": repayment,
                     "outstanding": rows[-1]["outstanding"] + disbursement - repayment})
    return rows


def build_energy_financing(today: date, quarters: List[FilingPeriod], projected: List[Decimal]) -> Dict[str, Any]:
    """Bank-wide figures behind the energy-financing ratio, sized from the hydropower book.

    ``projected`` is the book's outstanding at the opening and at each projected quarter end.
    Returns the bonds, one input row per quarter, the planned new limits and their drawdown.
    """
    opening = RECORDED_QUARTERS
    book = projected[0]
    bonds = []
    for name, share, held_years, tenor, rate in BONDS:
        invested = date(today.year - held_years, 2, 1)
        bonds.append({"name": name, "amount": (book * share / CRORE).quantize(Decimal("1")) * CRORE, "yield_pct": rate,
                      "investment_date_ad": invested, "maturity_date_ad": date(invested.year + tenor, 2, 1)})
    register = [energy_financing.Bond(b["amount"], b["investment_date_ad"], b["maturity_date_ad"]) for b in bonds]

    # The bank's lending two quarters before the opening is what the opening is measured against
    held = energy_financing.bonds_held(register, quarters[opening].end_ad)
    lending_at_base = (book + held) / OPENING_ENERGY_SHARE
    inputs = []
    for index, period in enumerate(quarters[:opening + PROJECTION_QUARTERS + 1]):
        offset = index - opening
        recorded = offset <= 0
        inputs.append({
            "period": period,
            "bank_total_loans": money(lending_at_base * (1 + BANK_LOAN_GROWTH) ** (offset + 2)),
            "required_pct": next(pct for start, pct in reversed(MINIMUM_SHARE_STEPS) if offset >= start),
            "hydro_outstanding_actual": money(book / (1 + HYDRO_BOOK_GROWTH) ** -offset) if recorded else None,
            "energy_bond_actual": energy_financing.bonds_held(register, period.end_ad) if recorded else None,
        })

    # One new limit per fiscal year from the first projected quarter's, drawn evenly through each year
    years = list(dict.fromkeys(_fiscal_year(period) for period in quarters[opening + 1:]))
    limits, planned = [], {}
    for approved, share in enumerate(NEW_LIMIT_SHARES):
        limit = (book * share / CRORE).quantize(Decimal("1")) * CRORE
        limits.append({"fiscal_year": years[approved], "new_limit": limit,
                       "drawdown_pct": [float(pct) for pct in NEW_LIMIT_DRAWDOWN]})
        for year, pct in enumerate(NEW_LIMIT_DRAWDOWN):
            in_year = [period for period in quarters[opening + 1:] if _fiscal_year(period) == years[approved + year]]
            for period in in_year:
                planned[period.end_ad] = planned.get(period.end_ad, Decimal("0")) + money(limit * pct / 100 / len(in_year))
    by_end = {period.end_ad: period for period in quarters}
    return {"bonds": bonds, "inputs": inputs, "limits": limits,
            "planned": [{"period": by_end[end], "planned_disbursement": amount} for end, amount in sorted(planned.items())]}


def cod_dates(rng: random.Random, stage: str, today: date) -> Dict[str, Any]:
    """Commercial operation dates that fit the stage: achieved, slipping, or only planned."""
    if stage == "operation":
        original = date(today.year - rng.randint(3, 9), rng.randint(1, 12), 1)
        actual = original + timedelta(days=rng.choice([0, 0, 45, 120, 210]))
        dates = {"original_cod_ad": original, "current_approved_cod_ad": actual, "actual_cod_ad": actual}
    elif stage == "construction":
        original = date(today.year + rng.randint(0, 2), rng.randint(1, 12), 1)
        approved = original + timedelta(days=rng.choice([0, 0, 90, 180, 300]))
        dates = {"original_cod_ad": original, "current_approved_cod_ad": approved,
                 "forecast_cod_ad": approved + timedelta(days=rng.choice([0, 0, 60]))}
    else:
        dates = {"original_cod_ad": date(today.year + rng.randint(3, 6), rng.randint(1, 12), 1)}
    return {**dates, **{key.replace("_ad", "_bs"): _bs(value) for key, value in dates.items()}}


MILESTONES = [
    ("Financial close", "FINANCING", 0.05), ("Access road and camp", "CIVIL", 0.20),
    ("Headworks and tunnel", "CIVIL", 0.55), ("Powerhouse electro-mechanical works", "ELECTROMECHANICAL", 0.80),
    ("Transmission line and grid connection", "TRANSMISSION", 0.92), ("Commercial operation", "COD", 1.00),
]


def build_milestones(rng: random.Random, project_id, stage: str, dates: Dict[str, Any], today: date) -> List[Milestone]:
    """Construction milestones over the four years up to COD; a slipped COD moves the forecasts with it."""
    slip = dates["current_approved_cod_ad"] - dates["original_cod_ad"]
    start = dates["original_cod_ad"] - timedelta(days=4 * 365)
    out = []
    for sequence, (name, category, fraction) in enumerate(MILESTONES, start=1):
        planned = start + timedelta(days=int(4 * 365 * fraction))
        forecast = planned + slip
        if stage == "operation" or forecast <= today - timedelta(days=30):
            status, done, actual = "completed", Decimal("100"), forecast
        elif forecast <= today + timedelta(days=200):
            status, done, actual = ("delayed" if slip else "in_progress"), _num(rng, 35, 90), None
        else:
            status, done, actual = "planned", Decimal("0"), None
        out.append(Milestone(
            id=uuid.uuid4(), project_id=project_id, name=name, category=category, sequence=sequence,
            planned_date_ad=planned, planned_date_bs=_bs(planned), forecast_date_ad=forecast,
            forecast_date_bs=_bs(forecast), actual_date_ad=actual, actual_date_bs=_bs(actual),
            status=status, percent_complete=done,
            remarks="Revised with the approved COD" if slip and status != "completed" else None))
    return out


RISKS = {
    "construction": [
        ("Tunnel geology worse than the DPR assumed", "technical", "Additional rock support; contingency drawdown"),
        ("Monsoon access road closures", "climate", "Pre-monsoon stockpiling of materials"),
        ("Cost overrun on electro-mechanical supply", "financial", "Fixed-price supply contract; FX hedge"),
        ("Transmission line right-of-way disputes", "social", "Compensation committee with the local level"),
    ],
    "operation": [
        ("Dry-season generation below the PPA contract energy", "climate", "Hydrology review; PPA energy table revision"),
        ("NEA payment delays", "financial", "Monitor receivables ageing; escrow sweep"),
        ("Sediment damage to turbine runners", "technical", "Annual runner overhaul; desander flushing"),
        ("Water use licence renewal", "legal", "File renewal six months before expiry"),
    ],
}


def build_risks(rng: random.Random, project_id, stage: str, today: date) -> List[RiskRegisterEntry]:
    out = []
    for title, risk_type, mitigation in rng.sample(RISKS[stage], rng.randint(2, 3)):
        likelihood, impact = rng.randint(1, 4), rng.randint(2, 5)
        out.append(RiskRegisterEntry(
            id=uuid.uuid4(), project_id=project_id, title=title, risk_type=risk_type, likelihood=likelihood,
            impact=impact, severity=compute_severity(likelihood, impact), mitigation_action=mitigation,
            mitigation_owner="Project monitoring unit", mitigation_due_ad=today + timedelta(days=rng.randint(30, 240)),
            mitigation_status=rng.choice(["open", "in_progress", "in_progress", "mitigated"]), trigger_source="manual"))
    return out


def monthly_energy(rng: random.Random, capacity: Decimal, month: date) -> Dict[str, Any]:
    """Contracted and delivered energy for a month, and what NEA pays for it."""
    season, factor, rate = SEASONS[month.month in WET_MONTHS]
    contract = money(capacity * Decimal("720") * factor)
    actual = money(contract * _num(rng, 0.86, 1.06, 4))
    return {"season": season, "contract": contract, "actual": actual, "revenue": money(actual * rate)}


def build_financial_periods(rng: random.Random, project_id, stage: str, capacity: Decimal, project_cost: Decimal,
                            monthly_revenue: Dict[date, Decimal], stressed: bool, today: date) -> List[FinancialPeriod]:
    """The quarterly figures the covenant engine tests.

    An operating project reports income for every quarter; revenue is the generation revenue of
    the quarter's months. A stressed project's operating costs climb (repairs after flood damage)
    until coverage fails. A project under construction has no income, only a yearly valuation.
    """
    latest = Quarter.of(today).shift(-1)
    valuation = money(project_cost * _num(rng, 1.0, 1.25, 4))
    cost_share = _num(rng, 0.10, 0.15, 4)
    rows = []
    for back in range(FINANCIAL_QUARTERS - 1, -1, -1):
        quarter = latest.shift(-back)
        row = FinancialPeriod(
            id=uuid.uuid4(), project_id=project_id, quarter_ad=quarter.label, period_end_ad=quarter.end,
            period_end_bs=_bs(quarter.end), is_audited=back >= 4, data_provenance="MANUAL_ENTRY",
            source_reference="Audited accounts" if back >= 4 else "Management accounts")
        if quarter.number == 2 or back == FINANCIAL_QUARTERS - 1:  # revalued once a year
            row.security_value_npr = valuation
            valuation = money(valuation * _num(rng, 0.98, 1.03, 4))
        if stage == "operation":
            revenue = Decimal("0")
            for offset in range(3):
                month = date(quarter.year, quarter.start.month + offset, 1)
                if month not in monthly_revenue:
                    monthly_revenue[month] = monthly_energy(rng, capacity, month)["revenue"]
                revenue += monthly_revenue[month]
            share = cost_share + (Decimal("0.07") * max(0, 6 - back) if stressed else Decimal("0"))
            row.revenue_npr = revenue
            row.operating_expenses_npr = money(revenue * share)
            row.royalty_npr = money(revenue * Decimal("0.025"))
            row.tax_paid_npr = Decimal("0")  # income tax holiday
            row.depreciation_npr = money(project_cost / 40 / 4)
        rows.append(row)
    return rows


def build_water_licence(rng: random.Random, project_id, data: Dict[str, Any], index: int, today: date) -> WaterLicense:
    """A DoED licence; a few are close to expiry or lapsed so the renewal alerts have something to show."""
    remaining = {3: 45, 7: 75, 11: -20}.get(index % 17, rng.randint(400, 3600))
    valid_to = today + timedelta(days=remaining)
    valid_from = valid_to - timedelta(days=rng.choice([5, 10, 35]) * 365)
    kind = "Generation" if data["stage"] != "feasibility" else "Survey"
    return WaterLicense(
        id=uuid.uuid4(), project_id=project_id, license_number=f"DoED-{kind[0]}-{data['licence_number']}-{data['code']}",
        issuing_authority="Department of Electricity Development", river_basin=BASINS[data["province"]],
        validity_from_ad=valid_from, validity_from_bs=_bs(valid_from), validity_to_ad=valid_to,
        validity_to_bs=_bs(valid_to),
        terms=f"{kind} licence for {data['capacity_mw']} MW on {data['river'] or 'the river'}",
        status="active" if remaining >= 0 else "expired")


def build_operations(rng: random.Random, project_id, data: Dict[str, Any], today: date) -> List[Any]:
    """Generation, tariff, plant performance, maintenance, hydrology, land, governance and ESG records."""
    capacity = data["capacity_mw"]
    first = date(today.year, today.month, 1)
    ppa = PPAAgreement(
        id=uuid.uuid4(), project_id=project_id, agreement_number=f"NEA-{data['code']}",
        purchaser="Nepal Electricity Authority", effective_date_ad=date(2018, 7, 1), expiry_date_ad=date(2048, 7, 1),
        tariff_type="ROR", escalation_pct_annual=Decimal("3.00"), status="active")
    records: List[Any] = [ppa]
    for season, _, rate in SEASONS.values():
        records.append(NEAPPARate(id=uuid.uuid4(), project_id=project_id, valid_from_ad=date(2018, 7, 1),
                                  season=season, rate_per_mwh_npr=rate, is_current=True))

    for back in range(1, 13):  # the twelve complete months before this one
        month = _months_before(first, back)
        wet = month.month in WET_MONTHS
        availability = _num(rng, 88, 99)
        energy = monthly_energy(rng, capacity, month)
        contract, actual = energy["contract"], energy["actual"]
        forced = rng.choice([0, 0, 0, 6, 14])
        scheduled = 0 if wet else rng.choice([0, 0, 24])
        records.append(EnergyGenerationData(
            id=uuid.uuid4(), project_id=project_id, ppa_agreement_id=ppa.id, month_ad=month, month_bs=_bs(month),
            season="wet" if wet else "dry", contract_energy_mwh=contract, actual_energy_mwh=actual,
            availability_pct=availability,
            curtailment_mwh=money(contract * _num(rng, 0, 0.03, 4)) if wet else Decimal("0"),
            revenue_npr=energy["revenue"]))
        records.append(PlantPerformance(
            id=uuid.uuid4(), project_id=project_id, month_ad=month, month_bs=_bs(month),
            efficiency_pct=_num(rng, 86, 93), availability_pct=availability,
            availability_hours=720 - forced - scheduled, outage_hours=forced + scheduled,
            forced_outage_count=1 if forced else 0, forced_outage_hours=forced,
            scheduled_maintenance_outage_hours=scheduled, plf_pct=money(actual / (capacity * 720) * 100)))

    equipment = ["Unit 1 turbine runner", "Unit 2 generator", "Main inlet valve", "Desander gates",
                 "Step-up transformer"]
    for name in rng.sample(equipment, 2):
        due = today + timedelta(days=rng.randint(10, 80))
        records.append(MaintenanceSchedule(
            id=uuid.uuid4(), project_id=project_id, equipment_name=name, maintenance_type="preventive",
            scheduled_date_ad=due, scheduled_date_bs=_bs(due),
            estimated_duration_hours=rng.choice([24, 48, 72]), estimated_impact_mwh=money(capacity * 12),
            contractor_name="O&M contractor", status="scheduled"))
    for name in rng.sample(equipment, 3):
        hours = rng.choice([8, 24, 48])
        done = today - timedelta(days=rng.randint(20, 330))
        records.append(MaintenanceLog(
            id=uuid.uuid4(), project_id=project_id, equipment_name=name,
            maintenance_type=rng.choice(["preventive", "preventive", "corrective"]),
            actual_date_ad=done, actual_date_bs=_bs(done), duration_hours=hours,
            downtime_mwh=money(capacity * hours * Decimal("0.4")), contractor_name="O&M contractor",
            cost_npr=money(capacity * Decimal(rng.randint(20000, 90000))), notes="Completed as planned"))

    records.append(HydrologyDetailed(
        id=uuid.uuid4(), project_id=project_id, river_basin=BASINS[data["province"]], sub_basin=data["river"],
        catchment_area_sqkm=money(capacity * _num(rng, 12, 60)),
        design_discharge_m3s=money(capacity * _num(rng, 0.5, 1.6)),
        median_flow_m3s=money(capacity * _num(rng, 0.7, 2.2)), measurement_date_ad=date(2016, 3, 1),
        source_reference="Detailed project report"))

    required = money(capacity * _num(rng, 8, 22))
    acquired = money(required * _num(rng, 0.9, 1.0))
    records.append(LandAcquisitionTracking(
        id=uuid.uuid4(), project_id=project_id, total_area_required_ropani=required,
        total_area_acquired_ropani=acquired, acquisition_pct=money(acquired / required * 100),
        compensation_paid_npr=money(acquired * Decimal("450000")),
        compensation_outstanding_npr=money((required - acquired) * Decimal("450000")), last_update_date_ad=today))
    for title in ("Chairperson", "Managing Director", "Director"):
        records.append(BoardOfDirectors(id=uuid.uuid4(), project_id=project_id, title=title,
                                        director_name=f"{title} (name not on file)",
                                        appointment_date_ad=date(2017, 1, 15)))
    promoter = data["promoter"] or "Promoter group"
    for entity, kind, share in ((promoter, "promoter", "51"), ("Institutional investors", "company", "30"),
                                ("Public shareholders", "public", "19")):
        records.append(ShareholdingHierarchy(id=uuid.uuid4(), project_id=project_id, entity_name=entity[:255],
                                             entity_type=kind, share_pct=Decimal(share),
                                             effective_from_ad=date(2017, 1, 15)))

    avoided = money(capacity * Decimal("2500"))
    records.append(ESGMetrics(
        id=uuid.uuid4(), project_id=project_id, metric_date_ad=first, carbon_credits_generated=avoided,
        ghg_emissions_avoided_tonnes=avoided, co2_avoided_tonnes_per_year=avoided,
        local_employment_count=rng.randint(25, 400), community_grievance_count=rng.randint(0, 12),
        grievance_resolution_rate_pct=_num(rng, 70, 100)))
    for measure, status, pct in (("Compensatory afforestation", "in_progress", "80"),
                                 ("Fish passage", "completed", "100"), ("Biodiversity monitoring", "planned", "0")):
        records.append(EIAMitigationChecklist(id=uuid.uuid4(), project_id=project_id, mitigation_measure=measure,
                                              status=status, completion_pct=Decimal(pct)))
    return records


# Children before parents; approval requests point at projects and loans by id, so they go too.
DELETE_ORDER = (
    ApprovalStep, ApprovalRequest, EnergyFinancingQuarter, EnergyBond, NewLoanDisbursementQuarter, NewLoanLimit,
    LoanProjectionQuarter, Repayment, DisbursementTranche, LoanAccountRateHistory,
    LoanAccount,
    EnergyGenerationData, NEAPPARate, PPAAgreement, PlantPerformance, MaintenanceLog, MaintenanceSchedule,
    HydrologyDetailed, LandAcquisitionTracking, BoardOfDirectors, ShareholdingHierarchy, ESGMetrics,
    EIAMitigationChecklist, CovenantHistory, FinancialPeriod, CovenantTerms, Milestone, RiskRegisterEntry, WaterLicense, ProjectTechnicalSpecs,
    ProjectOwner, Project,
)


async def seed(session: AsyncSession, today: date | None = None) -> int:
    """Replace all project data in ``session`` with the test portfolio. The caller commits."""
    rng = random.Random(SEED)
    today = today or date.today()
    projects = build_projects(rng)

    for model in DELETE_ORDER:
        await session.execute(delete(model))

    quarters = fiscal_quarters(today)
    projection_quarters = quarters[RECORDED_QUARTERS:RECORDED_QUARTERS + PROJECTION_QUARTERS + 1]
    book = [Decimal("0")] * len(projection_quarters)

    for index, data in enumerate(projects):
        stage, capacity = data["stage"], data["capacity_mw"]
        dates = cod_dates(rng, stage, today)
        project = Project(
            id=uuid.uuid5(ID_NAMESPACE, data["name_en"]), project_code=data["code"], name_en=data["name_en"],
            name_np=data["name_en"],  # the source has no Nepali names
            province=data["province"], district=data["district"], local_level=data["local_level"],
            installed_capacity_mw=capacity, project_stage=stage, pipeline_status=data["status"], **dates)
        session.add(project)
        await session.flush()
        session.add(ProjectTechnicalSpecs(
            id=uuid.uuid4(), project_id=project.id, design_head_m=_num(rng, 50, 600),
            design_discharge_cumecs=money(capacity * _num(rng, 0.5, 1.6)),
            plant_type="storage" if "Kulekhani" in data["name_en"] else "run_of_river",
            turbine_type=rng.choice(["francis", "pelton", "turgo"]), transmission_km=_num(rng, 3, 60)))
        session.add(build_water_licence(rng, project.id, data, index, today))

        # Projects still in feasibility have a survey licence and nothing else yet.
        if stage == "feasibility":
            continue

        project_cost = capacity * COST_PER_MW
        debt_share = _num(rng, 0.60, 0.75, 4)
        sanctioned = money(project_cost * debt_share)
        disbursed = money(sanctioned * _num(rng, 0.70, 1.0, 4))
        rate = _num(rng, 8.5, 11.5)
        tenor, grace = rng.randint(10, 15), rng.randint(1, 3)
        first_due = date(2024, 6, 1)
        delinquent = index % 10 == 4  # roughly one loan in ten has a missed instalment

        repayments = build_repayments(rng, disbursed, rate, tenor, grace, first_due, today, delinquent)
        repaid = sum((r["principal_paid"] for r in repayments), Decimal("0"))
        overdue = [r for r in repayments if r["days_past_due"] > 0]
        outstanding = disbursed - repaid
        maturity = date(first_due.year + tenor, 6, 1)

        loan = LoanAccount(
            id=uuid.uuid4(), project_id=project.id, finacle_account_id=f"FIN-{data['code']}",
            facility_type="term_loan" if index % 3 else "syndicated_term_loan",
            sanctioned_amount=sanctioned, disbursed_amount=disbursed, outstanding_principal=outstanding,
            overdue_principal=sum((r["principal_due"] for r in overdue), Decimal("0")),
            overdue_interest=sum((r["interest_due"] for r in overdue), Decimal("0")),
            interest_rate_pct=rate,  # covenant metrics are left for the application to calculate
            maturity_ad=maturity, maturity_bs=_bs(maturity), sync_status="success")
        session.add(loan)
        await session.flush()  # the unit of work does not order every child table after its parent
        for tranche in build_tranches(rng, disbursed, date(2022, 1, 15)):
            session.add(DisbursementTranche(id=uuid.uuid4(), loan_account_id=loan.id, **tranche))
        for repayment in repayments:
            session.add(Repayment(id=uuid.uuid4(), loan_account_id=loan.id, **repayment))
        for position, row in enumerate(build_projection(data["status"], sanctioned, disbursed, outstanding,
                                                        repayments, projection_quarters)):
            book[position] += row["outstanding"]
            session.add(LoanProjectionQuarter(
                id=uuid.uuid4(), project_id=project.id, fiscal_year=_fiscal_year(row["period"]),
                quarter=_quarter(row["period"]), period_end_ad=row["period"].end_ad, period_end_bs=row["period"].end_bs,
                is_opening=row["is_opening"], projected_disbursement=row["disbursement"],
                projected_repayment=row["repayment"], projected_outstanding=row["outstanding"],
                data_provenance="SYNTHETIC"))

        # One rate reset a year ago, so the loan has a history as well as a current rate
        reset = date(today.year - 1, 7, 16)
        session.add(LoanAccountRateHistory(
            id=uuid.uuid4(), loan_account_id=loan.id, interest_rate_pct=rate + _num(rng, 0.25, 1.0),
            valid_from_ad=date(2022, 1, 15), valid_to_ad=reset - timedelta(days=1), is_current="N",
            reason_for_change="Rate at sanction"))
        session.add(LoanAccountRateHistory(
            id=uuid.uuid4(), loan_account_id=loan.id, interest_rate_pct=rate, valid_from_ad=reset,
            is_current="Y", reason_for_change="Base rate reset"))

        for record in build_milestones(rng, project.id, stage, dates, today):
            session.add(record)
        for record in build_risks(rng, project.id, stage, today):
            session.add(record)
        monthly_revenue: Dict[date, Decimal] = {}
        if stage == "operation":
            for record in build_operations(rng, project.id, data, today):
                session.add(record)
                if isinstance(record, EnergyGenerationData):
                    monthly_revenue[record.month_ad] = record.revenue_npr
        for record in build_financial_periods(rng, project.id, stage, capacity, project_cost, monthly_revenue,
                                              stressed=index % 9 == 2, today=today):
            session.add(record)
        if index % 7 == 3:  # a few facilities were sanctioned on their own terms rather than the bank defaults
            session.add(CovenantTerms(
                id=uuid.uuid4(), project_id=project.id, dscr_min=Decimal("1.20"), ltv_max=Decimal("75"),
                icr_min=Decimal("1.75"), warning_margin_pct=Decimal("8"),
                source_reference=f"Sanction letter SL/{data['code']}"))

    energy = build_energy_financing(today, quarters, book)
    for bond in energy["bonds"]:
        session.add(EnergyBond(
            id=uuid.uuid4(), investment_date_bs=_bs(bond["investment_date_ad"]),
            maturity_date_bs=_bs(bond["maturity_date_ad"]), data_provenance="SYNTHETIC", **bond))
    for row in energy["inputs"]:
        period = row.pop("period")
        session.add(EnergyFinancingQuarter(
            id=uuid.uuid4(), fiscal_year=_fiscal_year(period), quarter=_quarter(period), period_end_ad=period.end_ad,
            period_end_bs=period.end_bs, data_provenance="SYNTHETIC", **row))
    for limit in energy["limits"]:
        session.add(NewLoanLimit(id=uuid.uuid4(), data_provenance="SYNTHETIC", **limit))
    for row in energy["planned"]:
        period = row["period"]
        session.add(NewLoanDisbursementQuarter(
            id=uuid.uuid4(), fiscal_year=_fiscal_year(period), quarter=_quarter(period), period_end_ad=period.end_ad,
            period_end_bs=period.end_bs, planned_disbursement=row["planned_disbursement"], data_provenance="SYNTHETIC"))

    await session.flush()
    # Covenant results are not seeded: the engine works them out from the figures above
    await CovenantService.recalculate_all(session, today=today)
    return len(projects)


async def main() -> int:
    async with AsyncSession(engine) as session:
        count = await seed(session)
        await session.commit()
    return count


if __name__ == "__main__":
    print(f"Seeded {asyncio.run(main())} projects")
