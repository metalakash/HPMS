"""CRUD routes for Phase 11 domain tables, scoped to a project the caller can see.

Resources under /api/v1/projects/{project_id}/: milestones, risks, insurance, permits,
esia-monitoring, community-engagements. Writes require update rights on the project.
Plus POST .../risks/auto-scan to raise risks from milestone delays and covenant breaches.
"""
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Type

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes_projects import _get_audit_metadata, _get_response_meta, _get_visible_project
from backend.app.database import get_db
from backend.app.models.risk import (
    CommunityEngagement, EsiaMonitoringRecord, InsurancePolicy, Milestone, ProjectPermit, RiskRegisterEntry,
)
from backend.app.schemas import risk as s
from backend.app.schemas.common import ApiResponse
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.security.rls_service import RLSService
from backend.app.services.risk_service import bs_string, compute_severity, sync_automatic_risks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/projects/{project_id}", tags=["risk-domain"])


def _row(obj) -> Dict[str, Any]:
    return jsonable_encoder({c.name: getattr(obj, c.name) for c in obj.__table__.columns})


def _envelope(data: Any, user: CurrentUser, action: str, count: Optional[int] = None) -> ApiResponse:
    return ApiResponse(
        data=data,
        meta=_get_response_meta(total_count=count),
        audit=_get_audit_metadata(user_id=user.username or "unknown", action=action),
    )


def _fill_bs(values: Dict[str, Any]) -> Dict[str, Any]:
    """Add the paired Bikram Sambat string for every *_ad date that was set."""
    for key in [k for k in values if k.endswith("_ad") and values[k] is not None]:
        values[key[:-3] + "_bs"] = bs_string(values[key])
    return values


async def _require_write(db: AsyncSession, user: CurrentUser, project_id: str) -> uuid.UUID:
    project = await _get_visible_project(db, user, project_id)
    if not await RLSService.can_update_project(db, user, project.id):
        raise HTTPException(status_code=403, detail="Not permitted to modify this project")
    return project.id


async def _get_owned(db: AsyncSession, model, project_uuid: uuid.UUID, item_id: str):
    try:
        iid = uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    obj = (await db.execute(
        select(model).where(model.id == iid, model.project_id == project_uuid)
    )).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj


def _register(path: str, model, create_schema: Type[BaseModel], update_schema: Type[BaseModel],
              order_by, derive=None) -> None:
    """Attach list/create/update/delete routes for one resource. ``derive`` fills computed fields."""

    @router.get(f"/{path}", response_model=ApiResponse[list[dict]], name=f"list_{path}")
    async def list_items(project_id: str, db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(get_current_user)):
        project = await _get_visible_project(db, user, project_id)
        rows = (await db.execute(
            select(model).where(model.project_id == project.id).order_by(order_by)
        )).scalars().all()
        return _envelope([_row(r) for r in rows], user, f"list_{path}", len(rows))

    @router.post(f"/{path}", response_model=ApiResponse[dict], status_code=201, name=f"create_{path}")
    async def create_item(project_id: str, body: create_schema, db: AsyncSession = Depends(get_db),  # type: ignore[valid-type]
                          user: CurrentUser = Depends(get_current_user)):
        pid = await _require_write(db, user, project_id)
        values = _fill_bs(body.model_dump())
        if derive:
            values.update(derive(values))
        obj = model(project_id=pid, created_by=user.username, **values)
        db.add(obj)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status_code=409, detail="Duplicate or invalid record")
        await db.refresh(obj)
        return _envelope(_row(obj), user, f"create_{path}")

    @router.patch(f"/{path}/{{item_id}}", response_model=ApiResponse[dict], name=f"update_{path}")
    async def update_item(project_id: str, item_id: str, body: update_schema,  # type: ignore[valid-type]
                          db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
        pid = await _require_write(db, user, project_id)
        obj = await _get_owned(db, model, pid, item_id)
        values = _fill_bs(body.model_dump(exclude_unset=True))
        if derive:
            merged = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
            merged.update(values)
            values.update(derive(merged))
        for key, value in values.items():
            setattr(obj, key, value)
        obj.updated_by = user.username
        await db.commit()
        await db.refresh(obj)
        return _envelope(_row(obj), user, f"update_{path}")

    @router.delete(f"/{path}/{{item_id}}", response_model=ApiResponse[dict], name=f"delete_{path}")
    async def delete_item(project_id: str, item_id: str, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
        pid = await _require_write(db, user, project_id)
        obj = await _get_owned(db, model, pid, item_id)
        await db.delete(obj)
        await db.commit()
        return _envelope({"deleted": item_id}, user, f"delete_{path}")


def _risk_severity(values: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return {"severity": compute_severity(values["likelihood"], values["impact"])}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


_register("milestones", Milestone, s.MilestoneCreate, s.MilestoneUpdate, Milestone.planned_date_ad)
_register("risks", RiskRegisterEntry, s.RiskCreate, s.RiskUpdate, RiskRegisterEntry.created_at.desc(),
          derive=_risk_severity)
_register("insurance", InsurancePolicy, s.InsuranceCreate, s.InsuranceUpdate, InsurancePolicy.valid_to_ad)
_register("permits", ProjectPermit, s.PermitCreate, s.PermitUpdate, ProjectPermit.valid_to_ad)
_register("esia-monitoring", EsiaMonitoringRecord, s.EsiaCreate, s.EsiaUpdate,
          EsiaMonitoringRecord.monitoring_date_ad.desc())
_register("community-engagements", CommunityEngagement, s.CommunityCreate, s.CommunityUpdate,
          CommunityEngagement.engagement_date_ad.desc())


@router.post("/risks/auto-scan", response_model=ApiResponse[dict])
async def auto_scan_risks(project_id: str, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
    """Raise risk entries from slipped milestones and breached covenants (idempotent)."""
    pid = await _require_write(db, user, project_id)
    created = await sync_automatic_risks(db, pid, datetime.utcnow().date())
    await db.commit()
    return _envelope({"risks_created": created}, user, "auto_scan_risks")
