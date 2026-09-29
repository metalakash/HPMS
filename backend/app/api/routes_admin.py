"""Admin endpoints for HPMS (seeding, data management)."""
import csv
import random
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
import uuid

from fastapi import APIRouter, HTTPException, status, File, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.project import Project, ProjectTechnicalSpecs, PipelineStatus, ProjectStage
from ..security.auth_middleware import require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/seed-projects", status_code=status.HTTP_201_CREATED)
async def seed_projects_from_upload(
    file: UploadFile = File(...),
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin),
):
    """
    Admin-only endpoint to seed projects from CSV upload.

    Expects CSV with columns: Project, Province, District, Municipality, Capacity (MW),
    River, License Type (Survey/Generation/Operation), etc.

    **Required**: Admin role (ADMIN)
    """
    try:
        # Read CSV
        content = await file.read()
        text = content.decode('utf-8')
        reader = csv.DictReader(StringIO(text))
        projects_data = list(reader)[:limit]

        if not projects_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV file is empty or unreadable"
            )

        # Map license types to HPMS pipeline/stage
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

        inserted_count = 0

        for idx, row in enumerate(projects_data, 1):
            try:
                project_name = row.get('Project', '').strip()
                if not project_name:
                    continue

                capacity = float(row.get('Capacity (MW)', 0) or 0)
                if capacity <= 0:
                    capacity = random.uniform(1, 100)

                license_type = row.get('License Type', 'Survey').strip()
                status_val = license_to_status.get(license_type, PipelineStatus.PROPOSAL_UNDER_PIPELINE)
                stage = license_to_stage.get(license_type, ProjectStage.FEASIBILITY)

                # Generate project code from province + index
                province_code = row.get('Province', 'XX')[:3].upper()
                project_code = f"HPM-{province_code}-{idx:04d}"

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
                    name_np=project_name,  # In production, translate via NLP API
                    province=row.get('Province', 'Unknown').strip(),
                    district=row.get('District', '').strip(),
                    local_level=row.get('Municipality', '').strip(),
                    installed_capacity_mw=Decimal(str(capacity)),
                    project_stage=stage.value,
                    pipeline_status=status_val.value,
                    forecast_cod_ad=forecast_cod,
                    actual_cod_ad=actual_cod,
                )

                db.add(project)
                await db.flush()

                # Add technical specifications (hydrology + equipment)
                head_m = random.uniform(50, 500)
                discharge = capacity / (9.81 * head_m / 1000) if capacity > 0 else 1

                if capacity < 50:
                    plant_type = "Run-of-River"
                elif capacity > 200:
                    plant_type = "Storage"
                else:
                    plant_type = "Peaking RoR"

                if head_m > 300:
                    turbine = "Pelton"
                elif head_m > 150:
                    turbine = "Turgo"
                elif head_m < 30:
                    turbine = "Crossflow"
                else:
                    turbine = "Pelton"

                tech_specs = ProjectTechnicalSpecs(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    design_head_m=Decimal(str(round(head_m, 2))),
                    design_discharge_cumecs=Decimal(str(round(discharge, 2))),
                    plant_type=plant_type,
                    turbine_type=turbine,
                    transmission_km=Decimal(str(random.uniform(5, 100))),
                )

                db.add(tech_specs)
                inserted_count += 1

            except Exception as e:
                # Log but continue with next row
                print(f"⚠️  Skipped row {idx}: {str(e)[:100]}")
                continue

        await db.commit()

        return {
            "status": "success",
            "message": f"✅ Seeded {inserted_count} projects from CSV",
            "inserted": inserted_count,
            "data_source": file.filename,
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding failed: {str(e)}"
        )
