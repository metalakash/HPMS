"""Seed sample projects and loan accounts for local development.

Run with:
    python -m backend.scripts.seed_sample_data
"""

import asyncio
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import engine
from backend.app.models.project import Project, ProjectTechnicalSpecs
from backend.app.models.financial import LoanAccount, DisbursementTranche, Repayment

SAMPLE_PROJECTS = [
    {
        "project_code": "HP-001",
        "name_en": "Upper Marsyangdi Hydropower Project",
        "name_np": "माथिल्लो मार्स्याङ्दी जलविद्युत आयोजना",
        "province": "Gandaki",
        "district": "Lamjung",
        "local_level": "Besisahar",
        "installed_capacity_mw": Decimal("50"),
        "project_stage": "operation",
        "pipeline_status": "under_operation",
        "original_cod_ad": date(2018, 6, 1),
        "actual_cod_ad": date(2018, 9, 15),
        "tech": {"design_head_m": Decimal("120.5"), "design_discharge_cumecs": Decimal("45.2"),
                  "plant_type": "run_of_river", "turbine_type": "francis", "transmission_km": Decimal("32.0")},
        "loan": {"sanctioned_amount": Decimal("4500000000"), "disbursed_amount": Decimal("4500000000"),
                  "outstanding_principal": Decimal("2800000000"), "interest_rate_pct": Decimal("9.5"),
                  "facility_type": "term_loan", "maturity_ad": date(2033, 6, 1), "sync_status": "success",
                  "tranches": [
                      {"tranche_no": 1, "planned_amount": Decimal("1500000000"), "actual_amount": Decimal("1500000000"),
                       "planned_date_ad": date(2016, 3, 1), "actual_date_ad": date(2016, 3, 10)},
                      {"tranche_no": 2, "planned_amount": Decimal("1800000000"), "actual_amount": Decimal("1800000000"),
                       "planned_date_ad": date(2017, 3, 1), "actual_date_ad": date(2017, 3, 5)},
                      {"tranche_no": 3, "planned_amount": Decimal("1200000000"), "actual_amount": Decimal("1200000000"),
                       "planned_date_ad": date(2018, 3, 1), "actual_date_ad": date(2018, 2, 20)},
                  ],
                  "repayments": [
                      {"due_date_ad": date(2019, 6, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("213750000"),
                       "principal_paid": Decimal("225000000"), "interest_paid": Decimal("213750000"), "paid_date_ad": date(2019, 5, 28), "days_past_due": 0},
                      {"due_date_ad": date(2019, 12, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("203344000"),
                       "principal_paid": Decimal("225000000"), "interest_paid": Decimal("203344000"), "paid_date_ad": date(2019, 11, 30), "days_past_due": 0},
                      {"due_date_ad": date(2020, 6, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("192938000"),
                       "principal_paid": Decimal("225000000"), "interest_paid": Decimal("192938000"), "paid_date_ad": date(2020, 6, 1), "days_past_due": 0},
                      {"due_date_ad": date(2020, 12, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("182531000"),
                       "principal_paid": Decimal("225000000"), "interest_paid": Decimal("182531000"), "paid_date_ad": date(2020, 12, 3), "days_past_due": 0},
                      {"due_date_ad": date(2021, 6, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("172125000"),
                       "principal_paid": Decimal("225000000"), "interest_paid": Decimal("172125000"), "paid_date_ad": date(2021, 5, 30), "days_past_due": 0},
                      {"due_date_ad": date(2025, 6, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("140000000"),
                       "principal_paid": Decimal("100000000"), "interest_paid": Decimal("140000000"), "paid_date_ad": date(2025, 6, 15), "days_past_due": 14},
                      {"due_date_ad": date(2026, 12, 1), "principal_due": Decimal("225000000"), "interest_due": Decimal("130000000"),
                       "principal_paid": Decimal("0"), "interest_paid": Decimal("0"), "paid_date_ad": None, "days_past_due": 0},
                  ]},
    },
    {
        "project_code": "HP-002",
        "name_en": "Tamor Storage Hydropower Project",
        "name_np": "तमोर जलाशययुक्त जलविद्युत आयोजना",
        "province": "Koshi",
        "district": "Taplejung",
        "local_level": "Phaktanglung",
        "installed_capacity_mw": Decimal("756"),
        "project_stage": "construction",
        "pipeline_status": "under_construction",
        "original_cod_ad": date(2027, 1, 1),
        "current_approved_cod_ad": date(2027, 9, 1),
        "forecast_cod_ad": date(2028, 3, 1),
        "tech": {"design_head_m": Decimal("210.0"), "design_discharge_cumecs": Decimal("410.0"),
                  "plant_type": "storage", "turbine_type": "francis", "transmission_km": Decimal("85.0")},
        "loan": {"sanctioned_amount": Decimal("95000000000"), "disbursed_amount": Decimal("38000000000"),
                  "outstanding_principal": Decimal("38000000000"), "interest_rate_pct": Decimal("10.25"),
                  "facility_type": "syndicated_term_loan", "maturity_ad": date(2043, 1, 1), "sync_status": "success",
                  "tranches": [
                      {"tranche_no": 1, "planned_amount": Decimal("15000000000"), "actual_amount": Decimal("15000000000"),
                       "planned_date_ad": date(2024, 2, 1), "actual_date_ad": date(2024, 2, 10), "pro_rata_share_pct": Decimal("100")},
                      {"tranche_no": 2, "planned_amount": Decimal("23000000000"), "actual_amount": Decimal("23000000000"),
                       "planned_date_ad": date(2025, 2, 1), "actual_date_ad": date(2025, 2, 8), "pro_rata_share_pct": Decimal("100")},
                      {"tranche_no": 3, "planned_amount": Decimal("30000000000"), "actual_amount": None,
                       "planned_date_ad": date(2026, 12, 1), "actual_date_ad": None, "pro_rata_share_pct": Decimal("100")},
                      {"tranche_no": 4, "planned_amount": Decimal("27000000000"), "actual_amount": None,
                       "planned_date_ad": date(2027, 10, 1), "actual_date_ad": None, "pro_rata_share_pct": Decimal("100")},
                  ],
                  "repayments": []},
    },
    {
        "project_code": "HP-003",
        "name_en": "Likhu-4 Hydropower Project",
        "name_np": "लिखु-४ जलविद्युत आयोजना",
        "province": "Bagmati",
        "district": "Ramechhap",
        "local_level": "Likhu",
        "installed_capacity_mw": Decimal("28.5"),
        "project_stage": "feasibility",
        "pipeline_status": "under_review",
        "forecast_cod_ad": date(2029, 12, 1),
        "tech": {"design_head_m": Decimal("95.0"), "design_discharge_cumecs": Decimal("18.5"),
                  "plant_type": "run_of_river", "turbine_type": "pelton", "transmission_km": Decimal("12.0")},
        "loan": None,
    },
    {
        "project_code": "HP-004",
        "name_en": "Budhi Gandaki Peaking Run-of-River Project",
        "name_np": "बूढीगण्डकी पिकिङ रन-अफ-रिभर आयोजना",
        "province": "Gandaki",
        "district": "Gorkha",
        "local_level": "Arughat",
        "installed_capacity_mw": Decimal("264"),
        "project_stage": "construction",
        "pipeline_status": "under_construction",
        "original_cod_ad": date(2026, 8, 1),
        "forecast_cod_ad": date(2027, 5, 1),
        "tech": {"design_head_m": Decimal("140.0"), "design_discharge_cumecs": Decimal("220.0"),
                  "plant_type": "peaking_run_of_river", "turbine_type": "francis", "transmission_km": Decimal("55.0")},
        "loan": {"sanctioned_amount": Decimal("32000000000"), "disbursed_amount": Decimal("21000000000"),
                  "outstanding_principal": Decimal("21000000000"), "interest_rate_pct": Decimal("9.75"),
                  "facility_type": "term_loan", "maturity_ad": date(2039, 8, 1), "sync_status": "failed",
                  "tranches": [
                      {"tranche_no": 1, "planned_amount": Decimal("9000000000"), "actual_amount": Decimal("9000000000"),
                       "planned_date_ad": date(2024, 6, 1), "actual_date_ad": date(2024, 6, 12)},
                      {"tranche_no": 2, "planned_amount": Decimal("12000000000"), "actual_amount": Decimal("12000000000"),
                       "planned_date_ad": date(2025, 6, 1), "actual_date_ad": date(2025, 6, 20)},
                      {"tranche_no": 3, "planned_amount": Decimal("11000000000"), "actual_amount": None,
                       "planned_date_ad": date(2026, 12, 1), "actual_date_ad": None},
                  ],
                  "repayments": []},
    },
    {
        "project_code": "HP-005",
        "name_en": "Dordi Khola Small Hydropower Project",
        "name_np": "दोर्दी खोला साना जलविद्युत आयोजना",
        "province": "Gandaki",
        "district": "Lamjung",
        "local_level": "Dordi",
        "installed_capacity_mw": Decimal("25"),
        "project_stage": "operation",
        "pipeline_status": "settled",
        "original_cod_ad": date(2015, 3, 1),
        "actual_cod_ad": date(2015, 4, 20),
        "tech": {"design_head_m": Decimal("88.0"), "design_discharge_cumecs": Decimal("14.0"),
                  "plant_type": "run_of_river", "turbine_type": "pelton", "transmission_km": Decimal("9.0")},
        "loan": {"sanctioned_amount": Decimal("2200000000"), "disbursed_amount": Decimal("2200000000"),
                  "outstanding_principal": Decimal("0"), "interest_rate_pct": Decimal("8.5"),
                  "facility_type": "term_loan", "maturity_ad": date(2025, 3, 1), "sync_status": "success",
                  "tranches": [
                      {"tranche_no": 1, "planned_amount": Decimal("1200000000"), "actual_amount": Decimal("1200000000"),
                       "planned_date_ad": date(2013, 6, 1), "actual_date_ad": date(2013, 6, 5)},
                      {"tranche_no": 2, "planned_amount": Decimal("1000000000"), "actual_amount": Decimal("1000000000"),
                       "planned_date_ad": date(2014, 6, 1), "actual_date_ad": date(2014, 5, 28)},
                  ],
                  "repayments": [
                      {"due_date_ad": date(2020, 3, 1), "principal_due": Decimal("440000000"), "interest_due": Decimal("187000000"),
                       "principal_paid": Decimal("440000000"), "interest_paid": Decimal("187000000"), "paid_date_ad": date(2020, 2, 25), "days_past_due": 0},
                      {"due_date_ad": date(2021, 3, 1), "principal_due": Decimal("440000000"), "interest_due": Decimal("150000000"),
                       "principal_paid": Decimal("440000000"), "interest_paid": Decimal("150000000"), "paid_date_ad": date(2021, 3, 1), "days_past_due": 0},
                      {"due_date_ad": date(2022, 3, 1), "principal_due": Decimal("440000000"), "interest_due": Decimal("112000000"),
                       "principal_paid": Decimal("440000000"), "interest_paid": Decimal("112000000"), "paid_date_ad": date(2022, 2, 28), "days_past_due": 0},
                      {"due_date_ad": date(2023, 3, 1), "principal_due": Decimal("440000000"), "interest_due": Decimal("75000000"),
                       "principal_paid": Decimal("440000000"), "interest_paid": Decimal("75000000"), "paid_date_ad": date(2023, 3, 1), "days_past_due": 0},
                      {"due_date_ad": date(2025, 3, 1), "principal_due": Decimal("440000000"), "interest_due": Decimal("37000000"),
                       "principal_paid": Decimal("440000000"), "interest_paid": Decimal("37000000"), "paid_date_ad": date(2025, 2, 26), "days_past_due": 0},
                  ]},
    },
]


async def seed() -> None:
    async with AsyncSession(engine) as db:
        codes = [entry["project_code"] for entry in SAMPLE_PROJECTS]
        existing_ids = (
            await db.execute(select(Project.id).where(Project.project_code.in_(codes)))
        ).scalars().all()
        if existing_ids:
            existing_loan_ids = (
                await db.execute(select(LoanAccount.id).where(LoanAccount.project_id.in_(existing_ids)))
            ).scalars().all()
            if existing_loan_ids:
                await db.execute(delete(DisbursementTranche).where(DisbursementTranche.loan_account_id.in_(existing_loan_ids)))
                await db.execute(delete(Repayment).where(Repayment.loan_account_id.in_(existing_loan_ids)))
            await db.execute(delete(LoanAccount).where(LoanAccount.project_id.in_(existing_ids)))
            await db.execute(
                delete(ProjectTechnicalSpecs).where(ProjectTechnicalSpecs.project_id.in_(existing_ids))
            )
            await db.execute(delete(Project).where(Project.id.in_(existing_ids)))
            await db.flush()

        for entry in SAMPLE_PROJECTS:
            project = Project(
                id=uuid.uuid4(),
                project_code=entry["project_code"],
                name_en=entry["name_en"],
                name_np=entry["name_np"],
                province=entry["province"],
                district=entry["district"],
                local_level=entry["local_level"],
                installed_capacity_mw=entry["installed_capacity_mw"],
                project_stage=entry["project_stage"],
                pipeline_status=entry["pipeline_status"],
                original_cod_ad=entry.get("original_cod_ad"),
                current_approved_cod_ad=entry.get("current_approved_cod_ad"),
                forecast_cod_ad=entry.get("forecast_cod_ad"),
                actual_cod_ad=entry.get("actual_cod_ad"),
                created_by="seed_script",
                updated_by="seed_script",
            )
            db.add(project)
            await db.flush()

            tech = entry["tech"]
            db.add(ProjectTechnicalSpecs(
                id=uuid.uuid4(),
                project_id=project.id,
                design_head_m=tech["design_head_m"],
                design_discharge_cumecs=tech["design_discharge_cumecs"],
                plant_type=tech["plant_type"],
                turbine_type=tech["turbine_type"],
                transmission_km=tech["transmission_km"],
                created_by="seed_script",
                updated_by="seed_script",
            ))

            loan = entry.get("loan")
            if loan:
                loan_account = LoanAccount(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    finacle_account_id=f"FIN-{entry['project_code']}-{uuid.uuid4().hex[:8]}",
                    facility_type=loan["facility_type"],
                    sanctioned_amount=loan["sanctioned_amount"],
                    disbursed_amount=loan["disbursed_amount"],
                    outstanding_principal=loan["outstanding_principal"],
                    interest_rate_pct=loan["interest_rate_pct"],
                    maturity_ad=loan["maturity_ad"],
                    currency_code="NPR",
                    sync_status=loan.get("sync_status", "pending"),
                    data_provenance="MANUAL_ENTRY",
                    created_by="seed_script",
                    updated_by="seed_script",
                )
                db.add(loan_account)
                await db.flush()

                for tranche in loan.get("tranches", []):
                    db.add(DisbursementTranche(
                        id=uuid.uuid4(),
                        loan_account_id=loan_account.id,
                        tranche_no=tranche["tranche_no"],
                        planned_amount=tranche["planned_amount"],
                        actual_amount=tranche.get("actual_amount"),
                        planned_date_ad=tranche.get("planned_date_ad"),
                        actual_date_ad=tranche.get("actual_date_ad"),
                        pro_rata_share_pct=tranche.get("pro_rata_share_pct"),
                        data_provenance="MANUAL_ENTRY",
                        created_by="seed_script",
                        updated_by="seed_script",
                    ))

                for repayment in loan.get("repayments", []):
                    db.add(Repayment(
                        id=uuid.uuid4(),
                        loan_account_id=loan_account.id,
                        due_date_ad=repayment["due_date_ad"],
                        principal_due=repayment["principal_due"],
                        interest_due=repayment["interest_due"],
                        principal_paid=repayment.get("principal_paid", Decimal("0")),
                        interest_paid=repayment.get("interest_paid", Decimal("0")),
                        paid_date_ad=repayment.get("paid_date_ad"),
                        days_past_due=repayment.get("days_past_due", 0),
                        data_provenance="MANUAL_ENTRY",
                        created_by="seed_script",
                        updated_by="seed_script",
                    ))

            print(f"Seeded {entry['project_code']}: {entry['name_en']}")

        await db.commit()

    await engine.dispose()
    print(f"\nDone. Seeded {len(SAMPLE_PROJECTS)} projects.")


if __name__ == "__main__":
    asyncio.run(seed())
