#!/usr/bin/env python3
"""
Seed HPMS database with real Nepalese hydropower projects from Niti Foundation dataset.
"""
import csv
import asyncio
import random
from datetime import datetime, timedelta, date
from decimal import Decimal
import uuid
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.project import (
    Project, ProjectTechnicalSpecs, PipelineStatus, ProjectStage
)
from app.models.loan import LoanAccount, LoanStatus
from app.models.consortium import ConsortiumFacility, ConsortiumMember


async def seed_projects_from_csv(csv_path: str, limit: int = 50):
    """Load projects from Niti Foundation CSV and seed database."""

    # Create async engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
    )

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    try:
        async with async_session() as session:
            projects_data = []

            # Parse CSV
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for i, row in enumerate(reader):
                    if i >= limit:
                        break
                    projects_data.append(row)

            print(f"📊 Loaded {len(projects_data)} projects from CSV")

            # Map license types to pipeline status
            license_to_status = {
                'Survey': PipelineStatus.PROPOSAL_UNDER_PIPELINE,
                'Generation': PipelineStatus.APPROVED,
                'Operation': PipelineStatus.UNDER_OPERATION,
            }

            license_to_stage = {
                'Survey': ProjectStage.FEASIBILITY,
                'Generation': ProjectStage.CONSTRUCTION,
                'Operation': ProjectStage.OPERATION,
            }

            # Insert projects
            for idx, row in enumerate(projects_data, 1):
                try:
                    project_name = row.get('Project', '').strip()
                    if not project_name:
                        continue

                    capacity = float(row.get('Capacity (MW)', 0) or 0)
                    if capacity <= 0:
                        capacity = random.uniform(1, 100)

                    license_type = row.get('License Type', 'Survey').strip()
                    status = license_to_status.get(license_type, PipelineStatus.PROPOSAL_UNDER_PIPELINE)
                    stage = license_to_stage.get(license_type, ProjectStage.FEASIBILITY)

                    # Generate project code
                    project_code = f"HPM-{row.get('Province', 'XX')[:3].upper()}-{idx:04d}"

                    # Estimate COD based on stage
                    today = date.today()
                    if stage == ProjectStage.FEASIBILITY:
                        cod_years = random.randint(2, 4)
                    elif stage == ProjectStage.CONSTRUCTION:
                        cod_years = random.randint(1, 3)
                    else:
                        cod_years = 0

                    forecast_cod = today + timedelta(days=365 * cod_years) if cod_years > 0 else today
                    actual_cod = today if stage == ProjectStage.OPERATION else None

                    # Create project
                    project = Project(
                        id=uuid.uuid4(),
                        project_code=project_code,
                        name_en=project_name,
                        name_np=project_name,  # In production, would translate
                        province=row.get('Province', 'Unknown').strip(),
                        district=row.get('District', '').strip(),
                        local_level=row.get('Municipality', '').strip(),
                        installed_capacity_mw=Decimal(str(capacity)),
                        project_stage=stage.value,
                        pipeline_status=status.value,
                        forecast_cod_ad=forecast_cod,
                        actual_cod_ad=actual_cod,
                    )

                    session.add(project)
                    await session.flush()

                    # Add technical specs
                    head_m = random.uniform(50, 500)
                    discharge = capacity / (9.81 * head_m / 1000) if capacity > 0 else 1

                    tech_specs = ProjectTechnicalSpecs(
                        id=uuid.uuid4(),
                        project_id=project.id,
                        design_head_m=Decimal(str(round(head_m, 2))),
                        design_discharge_cumecs=Decimal(str(round(discharge, 2))),
                        plant_type="Run-of-River" if capacity < 50 else "Storage" if capacity > 200 else "Peaking RoR",
                        turbine_type="Pelton" if head_m > 300 else "Turgo" if head_m > 150 else "Crossflow" if head_m < 30 else "Pelton",
                        transmission_km=Decimal(str(random.uniform(5, 100))),
                    )

                    session.add(tech_specs)

                    # Create loan account for operational and under-construction projects
                    if stage in [ProjectStage.CONSTRUCTION, ProjectStage.OPERATION]:
                        loan_amount = Decimal(str(capacity * random.uniform(50, 200)))  # INR Crores approx
                        loan = LoanAccount(
                            id=uuid.uuid4(),
                            project_id=project.id,
                            facility_code=f"LOAN-{project_code}",
                            facility_type="Term Loan",
                            sanctioned_amount=loan_amount,
                            outstanding_principal=loan_amount * Decimal(str(random.uniform(0.4, 1.0))),
                            currency="NPR",
                            interest_rate=Decimal(str(random.uniform(6, 12))),
                            tenor_months=random.choice([60, 84, 120, 180]),
                            loan_status=LoanStatus.ACTIVE.value if stage == ProjectStage.OPERATION else LoanStatus.UNDER_CONSTRUCTION.value,
                            collateral_security="Mortgage on assets",
                        )
                        session.add(loan)

                    if idx % 10 == 0:
                        print(f"  ✓ Seeded {idx} projects...")

                except Exception as e:
                    print(f"  ⚠ Skipped project {idx}: {str(e)[:100]}")
                    continue

            # Commit
            await session.commit()
            print(f"\n✅ Successfully seeded {len(projects_data)} projects!")

    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        raise
    finally:
        await engine.dispose()


async def main():
    csv_path = "C:\\Users\\ACER\\Downloads\\Niti Foundation Datasets.csv"
    limit = 50  # Seed first 50 projects for demo

    print(f"🌊 HPMS Hydropower Project Seeding")
    print(f"📂 CSV: {csv_path}")
    print(f"🔢 Limit: {limit} projects")
    print(f"🗄️  Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'unknown'}")
    print("-" * 60)

    await seed_projects_from_csv(csv_path, limit)


if __name__ == "__main__":
    asyncio.run(main())
