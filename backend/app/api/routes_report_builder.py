"""Report builder endpoints: source catalogue, saved definitions, run (RFP F.5, F.6, F.10)."""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes_reports import FILE_FORMATS, require_portfolio_access
from backend.app.database import get_db
from backend.app.models.reporting import ReportDefinition
from backend.app.schemas.report_schema import ExportFilter
from backend.app.security.auth_middleware import CurrentUser
from backend.app.security.ldap_provider import UserRole
from backend.app.services.export_service import ExportService
from backend.app.services.report_builder import SOURCES, DefinitionError, run_report, validate_definition

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["report-builder"])

ReportFormat = Literal["json", "csv", "excel", "word"]


class DefinitionBody(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    source: str
    columns: Optional[List[str]] = None
    filters: Optional[ExportFilter] = None
    sort_by: Optional[str] = None
    sort_desc: bool = False
    default_format: ReportFormat = "excel"
    is_shared: bool = False


class DefinitionPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    columns: Optional[List[str]] = None
    filters: Optional[ExportFilter] = None
    sort_by: Optional[str] = None
    sort_desc: Optional[bool] = None
    default_format: Optional[ReportFormat] = None
    is_shared: Optional[bool] = None


class AdHocBody(BaseModel):
    source: str
    columns: Optional[List[str]] = None
    filters: Optional[ExportFilter] = None
    sort_by: Optional[str] = None
    sort_desc: bool = False
    format: ReportFormat = "json"


def _filters_dict(f: Optional[ExportFilter]) -> Optional[Dict[str, Any]]:
    return f.model_dump(exclude_none=True, mode="json") if f else None


def _view(d: ReportDefinition) -> Dict[str, Any]:
    return {
        "id": str(d.id), "name": d.name, "description": d.description, "source": d.source,
        "columns": d.columns, "filters": d.filters, "sort_by": d.sort_by, "sort_desc": bool(d.sort_desc),
        "default_format": d.default_format, "is_shared": bool(d.is_shared), "owner": d.owner_username,
    }


def _check(source: str, columns, sort_by) -> None:
    try:
        validate_definition(source, columns, sort_by)
    except DefinitionError as e:
        raise HTTPException(status_code=422, detail=str(e))


async def _visible(db: AsyncSession, user: CurrentUser, definition_id: str) -> ReportDefinition:
    try:
        did = uuid.UUID(definition_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    d = (await db.execute(select(ReportDefinition).where(
        ReportDefinition.id == did,
        or_(ReportDefinition.owner_username == user.username, ReportDefinition.is_shared.is_(True)),
    ))).scalar_one_or_none()
    if d is None:
        raise HTTPException(status_code=404, detail="Not found")
    return d


def _require_owner(d: ReportDefinition, user: CurrentUser) -> None:
    if d.owner_username != user.username and UserRole.ADMIN not in user.roles:
        raise HTTPException(status_code=403, detail="Only the owner or an admin can change this report")


async def _render(db, user, source, columns, filters, sort_by, sort_desc, fmt, title):
    try:
        rows = await run_report(db, source, columns, filters, sort_by, sort_desc, user.username)
    except DefinitionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if fmt == "json":
        return {"source": source, "record_count": len(rows), "generated_at": datetime.utcnow().isoformat() + "Z",
                "data": rows}
    if not rows:
        raise HTTPException(status_code=404, detail="No data for the selected filters")
    media_type, build = FILE_FORMATS[fmt]
    content = build(source, rows, filters)
    filename = ExportService.get_export_filename(title or source, fmt)
    return Response(content=content, media_type=media_type,
                    headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/sources")
async def list_sources(user: CurrentUser = Depends(require_portfolio_access)):
    """What the builder can report on: sources, their selectable columns and supported filters."""
    return {"sources": [
        {"key": s.key, "label": s.label, "columns": list(s.columns), "filters": list(s.filters)}
        for s in SOURCES.values()
    ]}


@router.get("/definitions")
async def list_definitions(db: AsyncSession = Depends(get_db),
                           user: CurrentUser = Depends(require_portfolio_access)):
    rows = (await db.execute(
        select(ReportDefinition)
        .where(or_(ReportDefinition.owner_username == user.username, ReportDefinition.is_shared.is_(True)))
        .order_by(ReportDefinition.name)
    )).scalars().all()
    return {"definitions": [_view(d) for d in rows]}


@router.post("/definitions", status_code=201)
async def create_definition(body: DefinitionBody, db: AsyncSession = Depends(get_db),
                            user: CurrentUser = Depends(require_portfolio_access)):
    _check(body.source, body.columns, body.sort_by)
    d = ReportDefinition(
        name=body.name, description=body.description, source=body.source, columns=body.columns,
        filters=_filters_dict(body.filters), sort_by=body.sort_by, sort_desc=body.sort_desc,
        default_format=body.default_format, is_shared=body.is_shared,
        owner_username=user.username, created_by=user.username, updated_by=user.username,
    )
    db.add(d)
    await db.flush()
    return _view(d)


@router.get("/definitions/{definition_id}")
async def get_definition(definition_id: str, db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(require_portfolio_access)):
    return _view(await _visible(db, user, definition_id))


@router.patch("/definitions/{definition_id}")
async def update_definition(definition_id: str, body: DefinitionPatch, db: AsyncSession = Depends(get_db),
                            user: CurrentUser = Depends(require_portfolio_access)):
    d = await _visible(db, user, definition_id)
    _require_owner(d, user)
    changes = body.model_dump(exclude_unset=True)
    if "filters" in changes:
        changes["filters"] = _filters_dict(body.filters)
    _check(d.source, changes.get("columns", d.columns), changes.get("sort_by", d.sort_by))
    for key, value in changes.items():
        setattr(d, key, value)
    d.updated_by = user.username
    await db.flush()
    return _view(d)


@router.delete("/definitions/{definition_id}", status_code=204)
async def delete_definition(definition_id: str, db: AsyncSession = Depends(get_db),
                            user: CurrentUser = Depends(require_portfolio_access)):
    d = await _visible(db, user, definition_id)
    _require_owner(d, user)
    await db.delete(d)
    await db.flush()
    return Response(status_code=204)


@router.post("/definitions/{definition_id}/run")
async def run_definition(definition_id: str, format: Optional[ReportFormat] = Query(default=None),
                         db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(require_portfolio_access)):
    """Run a saved report; JSON inline or csv/excel/word as a file (defaults to the saved format)."""
    d = await _visible(db, user, definition_id)
    return await _render(db, user, d.source, d.columns, d.filters, d.sort_by, bool(d.sort_desc),
                         format or d.default_format, d.name.replace(" ", "_"))


@router.post("/builder/run")
async def run_adhoc(body: AdHocBody, db: AsyncSession = Depends(get_db),
                    user: CurrentUser = Depends(require_portfolio_access)):
    """Run an unsaved definition (what the builder UI previews before saving)."""
    return await _render(db, user, body.source, body.columns, _filters_dict(body.filters), body.sort_by,
                         body.sort_desc, body.format, body.source)
