#!/usr/bin/env python3
"""
Seed HPMS with synthetic loan exposure data linked to real hydropower projects.

Design: Synthetic-first, real-ready
- Generates realistic loan accounts tied to real DoED/Niti/NEA projects
- Uses Nepal hydropower market lending assumptions
- Creates disbursement tranches and repayment schedules
- Calculates covenant metrics (DSCR, LTV, ICR)
- Ready to swap real bank data into same schema
"""

import random
import sys
import uuid
from datetime import datetime, timedelta, date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.project import Project, ProjectStage
from app.models.financial import (
    LoanAccount, DisbursementTranche, Repayment, LoanAccountRateHistory
)


# ============================================================================
# NEPAL HYDROPOWER LENDING PARAMETERS
# ============================================================================

class NepalLendingParams:
    """Market-based lending assumptions for Nepali hydropower projects."""

    MIN_CAPACITY_MW = 5
    ELIGIBLE_STAGES = [ProjectStage.CONSTRUCTION.value, ProjectStage.OPERATION.value]

    LTV_MIN = Decimal("0.60")
    LTV_MAX = Decimal("0.75")
    PROJECT_COST_PER_MW_USD = {
        "Run-of-River": 2.0,
        "Storage": 3.5,
        "Peaking": 2.2,
    }
    USD_TO_NPR_RATE = Decimal("131")

    TENOR_YEARS_MIN = 8
    TENOR_YEARS_MAX = 15
    GRACE_YEARS_MIN = 2
    GRACE_YEARS_MAX = 5

    INTEREST_RATE_PCT_MIN = Decimal("9.0")
    INTEREST_RATE_PCT_MAX = Decimal("12.0")

    PLANT_FACTOR = {
        "Run-of-River": Decimal("0.45"),
        "Storage": Decimal("0.65"),
        "Peaking": Decimal("0.50"),
    }
    AVG_TARIFF_NPR_PER_KWH = Decimal("5.5")

    DSCR_TARGET_MIN = Decimal("1.2")
    DSCR_TARGET_MAX = Decimal("1.5")

    RISK_RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B"]
    RISK_RATING_WEIGHTS = [0.10, 0.25, 0.35, 0.20, 0.08, 0.02]

    IFRS9_STAGES = ["Stage 1", "Stage 2", "Stage 3"]
    IFRS9_STAGE_WEIGHTS = [0.85, 0.10, 0.05]

    FINANCING_PENETRATION = 0.30

    FACILITIES_PER_PROJECT = {
        "construction": {"type": "Construction Term Loan", "weight": 0.8},
        "working_capital": {"type": "Working Capital", "weight": 0.4},
    }


# ============================================================================
# LOAN DATA GENERATOR
# ============================================================================

class SyntheticLoanGenerator:
    """Generate realistic synthetic loan accounts for hydropower projects."""

    def __init__(self, seed: int = 42):
        random.seed(seed)

    def estimate_project_cost(self, capacity_mw: Decimal, plant_type: str) -> Decimal:
        """Estimate total project cost (NPR) from capacity and plant type."""
        cost_per_mw_usd = Decimal(str(
            NepalLendingParams.PROJECT_COST_PER_MW_USD.get(plant_type, 2.0)
        ))
        total_cost_usd = capacity_mw * cost_per_mw_usd
        total_cost_npr = total_cost_usd * NepalLendingParams.USD_TO_NPR_RATE
        contingency = Decimal(str(random.uniform(1.10, 1.20)))
        return total_cost_npr * contingency

    def estimate_annual_revenue(self, capacity_mw: Decimal, plant_type: str) -> Decimal:
        """Estimate annual revenue (NPR) from capacity, plant type, and tariff."""
        plant_factor = NepalLendingParams.PLANT_FACTOR.get(plant_type, Decimal("0.45"))
        kwh_per_year = capacity_mw * Decimal("1000") * Decimal("8760") * plant_factor
        annual_revenue = kwh_per_year * NepalLendingParams.AVG_TARIFF_NPR_PER_KWH
        variation = Decimal(str(random.uniform(0.90, 1.05)))
        return annual_revenue * variation

    def generate_loan_account(
        self,
        project: Project,
        plant_type: str = "Run-of-River",
        facility_type: str = "Construction Term Loan",
    ) -> dict:
        """Generate a realistic loan account for a project."""

        project_cost = self.estimate_project_cost(project.installed_capacity_mw, plant_type)
        annual_revenue = self.estimate_annual_revenue(project.installed_capacity_mw, plant_type)

        ltv = Decimal(str(random.uniform(
            float(NepalLendingParams.LTV_MIN),
            float(NepalLendingParams.LTV_MAX)
        )))
        sanctioned_amount = project_cost * ltv

        tenor_years = random.randint(
            NepalLendingParams.TENOR_YEARS_MIN,
            NepalLendingParams.TENOR_YEARS_MAX
        )
        grace_years = random.randint(
            NepalLendingParams.GRACE_YEARS_MIN,
            NepalLendingParams.GRACE_YEARS_MAX
        )

        interest_rate = Decimal(str(random.uniform(
            float(NepalLendingParams.INTEREST_RATE_PCT_MIN),
            float(NepalLendingParams.INTEREST_RATE_PCT_MAX)
        )))

        if project.project_stage == ProjectStage.OPERATION.value:
            disbursed_amount = sanctioned_amount
            outstanding_principal = sanctioned_amount * Decimal(str(random.uniform(0.2, 0.6)))
        else:
            disbursed_amount = sanctioned_amount * Decimal(str(random.uniform(0.5, 0.9)))
            outstanding_principal = disbursed_amount

        today = date.today()
        sanction_date = today - timedelta(days=random.randint(180, 1095))
        disbursement_date = sanction_date + timedelta(days=random.randint(30, 180))
        maturity_date = disbursement_date + timedelta(days=365 * tenor_years)
        moratorium_end = disbursement_date + timedelta(days=365 * grace_years)

        r = interest_rate / Decimal("100") / Decimal("12")
        n = tenor_years * 12 - grace_years * 12
        if r > 0 and n > 0:
            monthly_payment = (outstanding_principal * r * (1 + r)**n) / ((1 + r)**n - 1)
            annual_debt_service = monthly_payment * 12
        else:
            annual_debt_service = outstanding_principal / Decimal(str(tenor_years - grace_years))

        dscr = annual_revenue / annual_debt_service if annual_debt_service > 0 else Decimal("0")
        # Cap DSCR to avoid numeric overflow
        dscr = min(dscr, Decimal("50.00"))

        ltv_pct = (outstanding_principal / project_cost * 100) if project_cost > 0 else Decimal("0")

        ebit = annual_revenue * Decimal("0.80")
        interest_expense = outstanding_principal * interest_rate / Decimal("100")
        icr = ebit / interest_expense if interest_expense > 0 else Decimal("0")
        # Cap ICR to avoid numeric overflow
        icr = min(icr, Decimal("50.00"))

        risk_rating = random.choices(
            NepalLendingParams.RISK_RATINGS,
            weights=NepalLendingParams.RISK_RATING_WEIGHTS
        )[0]
        ifrs9_stage = random.choices(
            NepalLendingParams.IFRS9_STAGES,
            weights=NepalLendingParams.IFRS9_STAGE_WEIGHTS
        )[0]
        npl_status = "NPL" if ifrs9_stage == "Stage 3" else ("SMA" if ifrs9_stage == "Stage 2" else "Performing")

        return {
            "project_id": project.id,
            "facility_type": facility_type,
            "sanctioned_amount": sanctioned_amount,
            "disbursed_amount": disbursed_amount,
            "outstanding_principal": outstanding_principal,
            "outstanding_interest": Decimal("0"),
            "interest_rate": interest_rate,
            "sanction_date": sanction_date,
            "disbursement_date": disbursement_date,
            "maturity_date": maturity_date,
            "moratorium_end": moratorium_end,
            "grace_years": grace_years,
            "tenor_years": tenor_years,
            "dscr": dscr,
            "ltv": ltv_pct,
            "icr": icr,
            "risk_rating": risk_rating,
            "ifrs9_stage": ifrs9_stage,
            "npl_status": npl_status,
            "annual_debt_service": annual_debt_service,
            "annual_revenue": annual_revenue,
        }

    def generate_disbursement_tranches(
        self,
        loan_id: uuid.UUID,
        sanctioned_amount: Decimal,
        disbursed_amount: Decimal,
        sanction_date: date,
        disbursement_date: date,
        moratorium_end: date,
    ) -> list:
        """Generate disbursement tranches (for construction phase)."""
        tranches = []

        num_tranches = random.randint(3, 6)
        tranche_amount = disbursed_amount / Decimal(str(num_tranches))

        days_between = (moratorium_end - sanction_date).days
        days_per_tranche = days_between // num_tranches

        for i in range(num_tranches):
            planned_date = sanction_date + timedelta(days=days_per_tranche * (i + 1))
            actual_amount = tranche_amount * Decimal(str(random.uniform(0.80, 1.0)))
            actual_date = planned_date + timedelta(days=random.randint(-30, 30))

            tranches.append({
                "loan_account_id": loan_id,
                "tranche_no": i + 1,
                "planned_amount": tranche_amount,
                "actual_amount": actual_amount,
                "planned_date": planned_date,
                "actual_date": actual_date,
            })

        return tranches

    def generate_repayment_schedule(
        self,
        loan_id: uuid.UUID,
        outstanding_principal: Decimal,
        interest_rate: Decimal,
        disbursement_date: date,
        moratorium_end: date,
        tenor_years: int,
        grace_years: int,
    ) -> list:
        """Generate monthly repayment schedule."""
        repayments = []

        r = interest_rate / Decimal("100") / Decimal("12")
        repayment_months = (tenor_years - grace_years) * 12

        if r > 0 and repayment_months > 0:
            monthly_payment = (outstanding_principal * r * (1 + r)**repayment_months) / (
                (1 + r)**repayment_months - 1
            )
        else:
            monthly_payment = outstanding_principal / Decimal(str(repayment_months)) if repayment_months > 0 else Decimal("0")

        remaining_principal = outstanding_principal
        current_date = moratorium_end + timedelta(days=1)
        now = datetime.now().date()

        for month in range(repayment_months):
            due_date = current_date + timedelta(days=30)

            interest_due = remaining_principal * r
            principal_due = monthly_payment - interest_due

            if month == repayment_months - 1:
                principal_due = remaining_principal

            if due_date <= now:
                principal_paid = principal_due
                interest_paid = interest_due
                paid_date = due_date + timedelta(days=random.randint(0, 20))
                days_past_due = 0
            else:
                principal_paid = Decimal("0")
                interest_paid = Decimal("0")
                paid_date = None
                days_past_due = 0

            repayments.append({
                "loan_account_id": loan_id,
                "due_date": due_date,
                "principal_due": principal_due,
                "interest_due": interest_due,
                "principal_paid": principal_paid,
                "interest_paid": interest_paid,
                "paid_date": paid_date,
                "days_past_due": days_past_due,
            })

            remaining_principal -= principal_due
            current_date = due_date

        return repayments


# ============================================================================
# SEEDING LOGIC
# ============================================================================

def seed_synthetic_loans(batch_size: int = 100, dry_run: bool = False):
    """Seed synthetic loan accounts for real hydropower projects."""

    engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
    )

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        print("\n" + "=" * 70)
        print("🌊 HPMS SYNTHETIC LOAN SEEDING – NEPAL HYDROPOWER")
        print("=" * 70)
        print(f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'unknown'}")
        print(f"LTV Range: {NepalLendingParams.LTV_MIN} – {NepalLendingParams.LTV_MAX}")
        print(f"Tenor: {NepalLendingParams.TENOR_YEARS_MIN}–{NepalLendingParams.TENOR_YEARS_MAX} years")
        print(f"Interest Rate: {NepalLendingParams.INTEREST_RATE_PCT_MIN}–{NepalLendingParams.INTEREST_RATE_PCT_MAX}% p.a.")
        print(f"Financing Penetration: {NepalLendingParams.FINANCING_PENETRATION * 100}% of eligible projects")
        print(f"Min Capacity: {NepalLendingParams.MIN_CAPACITY_MW}+ MW")
        print(f"Dry Run: {dry_run}")
        print("-" * 70)

        # Get all projects
        all_projects = session.execute(select(Project)).scalars().all()
        print(f"\n📊 Total projects in DB: {len(all_projects)}")

        # Filter eligible projects
        eligible_projects = [
            p for p in all_projects
            if p.installed_capacity_mw >= NepalLendingParams.MIN_CAPACITY_MW
            and p.project_stage in NepalLendingParams.ELIGIBLE_STAGES
        ]
        print(f"✅ Eligible for financing (≥{NepalLendingParams.MIN_CAPACITY_MW}MW, construction/operation): {len(eligible_projects)}")

        if not eligible_projects:
            print("⚠️  No eligible projects found. Exiting.")
            return

        # Decide which projects get financed
        num_to_finance = max(1, int(len(eligible_projects) * NepalLendingParams.FINANCING_PENETRATION))
        projects_to_finance = random.sample(eligible_projects, num_to_finance)
        print(f"🏦 Projects with bank exposure: {len(projects_to_finance)}")

        # Generate loans
        generator = SyntheticLoanGenerator()
        loans_created = 0
        tranches_created = 0
        repayments_created = 0

        for idx, project in enumerate(projects_to_finance, 1):
            try:
                plant_type = "Run-of-River"
                if project.technical_specs and project.technical_specs.plant_type:
                    plant_type = project.technical_specs.plant_type

                num_facilities = random.choice([1, 2])
                for fac_idx in range(num_facilities):
                    facility_type = random.choice(list(
                        NepalLendingParams.FACILITIES_PER_PROJECT.values()
                    ))["type"]

                    loan_data = generator.generate_loan_account(project, plant_type, facility_type)

                    # Create loan account
                    loan = LoanAccount(
                        id=uuid.uuid4(),
                        project_id=loan_data["project_id"],
                        finacle_account_id=f"FAC-{uuid.uuid4().hex[:12]}",
                        facility_type=facility_type,
                        sanctioned_amount=loan_data["sanctioned_amount"],
                        disbursed_amount=loan_data["disbursed_amount"],
                        outstanding_principal=loan_data["outstanding_principal"],
                        outstanding_interest=Decimal("0"),
                        currency_code="NPR",
                        fx_rate_to_npr=NepalLendingParams.USD_TO_NPR_RATE,
                        fx_rate_asof_ad=date.today(),
                        interest_rate_pct=loan_data["interest_rate"],
                        moratorium_end_ad=loan_data["moratorium_end"],
                        maturity_ad=loan_data["maturity_date"],
                        dscr=loan_data["dscr"],
                        ltv=loan_data["ltv"],
                        icr=loan_data["icr"],
                        metric_as_of_date=date.today(),
                        last_synced_at=datetime.utcnow().isoformat(),
                        sync_status="success",
                        data_provenance="SYNTHETIC",
                        source_reference=f"Phase8-Synthetic-{date.today().isoformat()}",
                    )

                    if not dry_run:
                        session.add(loan)
                        session.flush()

                    loans_created += 1

                    # Add rate history
                    rate_history = LoanAccountRateHistory(
                        id=uuid.uuid4(),
                        loan_account_id=loan.id,
                        interest_rate_pct=loan_data["interest_rate"],
                        valid_from_ad=loan_data["sanction_date"],
                        is_current="Y",
                        data_provenance="SYNTHETIC",
                        source_reference=f"Phase8-Synthetic-{date.today().isoformat()}",
                    )

                    if not dry_run:
                        session.add(rate_history)

                    # Generate disbursement tranches
                    tranches = generator.generate_disbursement_tranches(
                        loan.id,
                        loan_data["sanctioned_amount"],
                        loan_data["disbursed_amount"],
                        loan_data["sanction_date"],
                        loan_data["disbursement_date"],
                        loan_data["moratorium_end"],
                    )

                    for tranche_data in tranches:
                        tranche = DisbursementTranche(
                            id=uuid.uuid4(),
                            loan_account_id=tranche_data["loan_account_id"],
                            tranche_no=tranche_data["tranche_no"],
                            planned_amount=tranche_data["planned_amount"],
                            actual_amount=tranche_data["actual_amount"],
                            planned_date_ad=tranche_data["planned_date"],
                            actual_date_ad=tranche_data["actual_date"],
                            data_provenance="SYNTHETIC",
                            source_reference=f"Phase8-Synthetic-{date.today().isoformat()}",
                        )

                        if not dry_run:
                            session.add(tranche)

                        tranches_created += 1

                    # Generate repayment schedule
                    repayments = generator.generate_repayment_schedule(
                        loan.id,
                        loan_data["outstanding_principal"],
                        loan_data["interest_rate"],
                        loan_data["disbursement_date"],
                        loan_data["moratorium_end"],
                        loan_data["tenor_years"],
                        loan_data["grace_years"],
                    )

                    for repayment_data in repayments:
                        repayment = Repayment(
                            id=uuid.uuid4(),
                            loan_account_id=repayment_data["loan_account_id"],
                            due_date_ad=repayment_data["due_date"],
                            principal_due=repayment_data["principal_due"],
                            interest_due=repayment_data["interest_due"],
                            principal_paid=repayment_data["principal_paid"],
                            interest_paid=repayment_data["interest_paid"],
                            paid_date_ad=repayment_data["paid_date"],
                            days_past_due=repayment_data["days_past_due"],
                            data_provenance="SYNTHETIC",
                            source_reference=f"Phase8-Synthetic-{date.today().isoformat()}",
                        )

                        if not dry_run:
                            session.add(repayment)

                        repayments_created += 1

                    if loans_created % 10 == 0:
                        print(f"  ✓ Generated {loans_created} loans, {tranches_created} tranches, {repayments_created} repayments...")

            except Exception as e:
                print(f"  ⚠ Skipped project {idx}: {str(e)[:100]}")
                continue

        # Commit
        if not dry_run:
            session.commit()
            print(f"\n✅ SEED COMPLETE!")
        else:
            print(f"\n📋 DRY RUN COMPLETE (no changes committed)")

        print(f"\nGenerated:")
        print(f"  • {loans_created} loan accounts")
        print(f"  • {tranches_created} disbursement tranches")
        print(f"  • {repayments_created} repayment schedules")
        print("\n" + "=" * 70 + "\n")

    except Exception as e:
        print(f"\n❌ Seeding failed: {e}")
        raise
    finally:
        session.close()


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Seed synthetic loan data for HPMS")
    parser.add_argument("--dry-run", action="store_true", help="Run without committing changes")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for inserts")

    args = parser.parse_args()

    seed_synthetic_loans(batch_size=args.batch_size, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
