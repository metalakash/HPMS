"""Admin endpoints for HPMS (seeding, data management)."""
import csv
import random
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
import uuid

from fastapi import APIRouter, HTTPException, Request, status, File, UploadFile, Depends
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import select
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


@router.get("/demo-reset")
async def demo_reset_status(current_user=Depends(require_admin)):
    """Whether this instance offers the demo data reset (hosted demo only)."""
    from ..services.demo_reset import reset_enabled

    return {"enabled": reset_enabled()}


@router.post("/demo-reset")
async def reset_demo_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Replace all project data with the synthetic demo portfolio. Users and the audit log are kept."""
    from ..config import settings
    from ..middleware.security import client_ip
    from ..services.audit_chain import append_audit_log
    from ..services.demo_reset import DemoResetRefused, reset_demo_data as reset

    try:
        result = await reset(db)
    except DemoResetRefused as refused:  # refused before anything is written
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(refused))
    await append_audit_log(
        db, user_id=current_user.id or current_user.username, user_role="admin", entity_type="DEMO_DATA",
        entity_id="portfolio", action="RESET", reason="Demo data reset to the synthetic portfolio",
        post_state=result, source_ip=client_ip(request.scope, settings.TRUSTED_PROXY_HOPS))
    await db.commit()
    return {"data": result}


# ---------------------------------------------------------------- user administration (FUNC A.2)

class UserStatusChange(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class UserRoleChange(BaseModel):
    role: Optional[str] = None  # None clears the override; the directory's role applies again
    reason: str = Field(min_length=3, max_length=500)


def _effective_role(user) -> str:
    return user.role_override or getattr(user.default_role, "value", user.default_role)


async def _user_for_change(db: AsyncSession, user_id: str, current_user):
    from ..models.auth import User

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.get(User, uid)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=409, detail="You cannot change your own account; ask another administrator")
    return user


async def _would_leave_no_admin(db: AsyncSession, user, *, active: bool, role: str) -> bool:
    """True when this change removes the last active administrator."""
    from ..models.auth import User

    if not user.is_active or _effective_role(user) != "admin" or (active and role == "admin"):
        return False
    others = (await db.execute(select(User).where(User.is_active.is_(True), User.id != user.id))).scalars().all()
    return not any(_effective_role(other) == "admin" for other in others)


async def _audit_user(db, request: Request, current_user, user, action: str, reason: str, pre, post) -> None:
    from ..config import settings
    from ..middleware.security import client_ip
    from ..services.audit_chain import append_audit_log

    await append_audit_log(
        db, user_id=current_user.id or current_user.username, user_role="admin", entity_type="USER",
        entity_id=user.id, action=action, reason=reason, pre_state=pre, post_state=post,
        source_ip=client_ip(request.scope, settings.TRUSTED_PROXY_HOPS))


def _account(user) -> dict:
    return {"id": str(user.id), "username": user.username, "is_active": bool(user.is_active),
            "role": _effective_role(user), "role_override": user.role_override, "status_reason": user.status_reason}


@router.post("/users/{user_id}/block")
async def block_user(user_id: str, body: UserStatusChange, request: Request, db: AsyncSession = Depends(get_db),
                     current_user=Depends(require_admin)):
    """Block an account: it cannot sign in, and its open sessions stop working at once."""
    user = await _user_for_change(db, user_id, current_user)
    if not user.is_active:
        raise HTTPException(status_code=409, detail=f"{user.username} is already blocked")
    if await _would_leave_no_admin(db, user, active=False, role=_effective_role(user)):
        raise HTTPException(status_code=409, detail="This is the last active administrator; it cannot be blocked")
    user.is_active, user.status_reason, user.updated_by = False, body.reason.strip(), current_user.username
    await _audit_user(db, request, current_user, user, "USER_BLOCKED", body.reason.strip(),
                      {"is_active": True}, {"is_active": False})
    payload = _account(user)
    await db.commit()
    return {"data": payload}


@router.post("/users/{user_id}/unblock")
async def unblock_user(user_id: str, body: UserStatusChange, request: Request, db: AsyncSession = Depends(get_db),
                       current_user=Depends(require_admin)):
    user = await _user_for_change(db, user_id, current_user)
    if user.is_active:
        raise HTTPException(status_code=409, detail=f"{user.username} is not blocked")
    user.is_active, user.status_reason, user.updated_by = True, body.reason.strip(), current_user.username
    await _audit_user(db, request, current_user, user, "USER_UNBLOCKED", body.reason.strip(),
                      {"is_active": False}, {"is_active": True})
    payload = _account(user)
    await db.commit()
    return {"data": payload}


@router.post("/users/{user_id}/role")
async def change_user_role(user_id: str, body: UserRoleChange, request: Request, db: AsyncSession = Depends(get_db),
                           current_user=Depends(require_admin)):
    """Set the role HPMS uses for this user instead of the directory's, or clear it. Applies at the next sign-in."""
    from ..models.auth import UserRole as DBUserRole

    valid = {role.value for role in DBUserRole}
    if body.role is not None and body.role not in valid:
        raise HTTPException(status_code=422, detail=f"Unknown role {body.role!r}; one of {sorted(valid)}")
    user = await _user_for_change(db, user_id, current_user)
    before = _effective_role(user)
    new_role = body.role or getattr(user.default_role, "value", user.default_role)
    if await _would_leave_no_admin(db, user, active=True, role=new_role):
        raise HTTPException(status_code=409, detail="This is the last active administrator; its role cannot change")
    user.role_override, user.updated_by = body.role, current_user.username
    await _audit_user(db, request, current_user, user, "USER_ROLE_CHANGED", body.reason.strip(),
                      {"role": before, "role_override": None if body.role is None else before},
                      {"role": new_role, "role_override": body.role})
    payload = _account(user)
    await db.commit()
    return {"data": payload}


# ---------------------------------------------------------------- settings and approval rules (FUNC A.3, A.5)

@router.get("/settings")
async def list_settings(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """Every admin-managed setting with its current value, default and limits. Changes are change requests."""
    from ..services import app_settings

    return {"data": await app_settings.listing(db)}


@router.get("/approval-rules")
async def list_approval_rules(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """The approval rule in force for each type of change request."""
    from ..services import approval_rules

    return {"data": await approval_rules.current_rules(db)}


@router.get("/exchange-rates")
async def list_exchange_rates(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """Each currency's rate in force today and its history. New rates are change requests (EXCHANGE_RATE)."""
    from ..services import fx

    return {"data": await fx.listing(db)}
