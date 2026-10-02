"""Scheduled report delivery: manage export jobs and see their run history (RFP F.11)."""

import re
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes_reports import require_portfolio_access
from backend.app.database import get_db
from backend.app.models.reporting import ReportDefinition
from backend.app.models.scheduler import ExportJob, ExportJobRun
from backend.app.schemas.report_schema import ExportFilter
from backend.app.security.auth_middleware import CurrentUser
from backend.app.services.report_builder import SOURCES
from backend.app.services.scheduler_service import EXPORT_FORMATS, SchedulerService, next_run_after, _now
from backend.app.services.email_service import get_email_service

router = APIRouter(prefix="/api/v1/reports/schedules", tags=["report-schedules"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ScheduleBody(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    schedule: str = Field(description="5-field cron expression in UTC, e.g. '0 6 * * 1' = Mondays 06:00")
    export_format: Literal["csv", "excel", "word", "json"] = "excel"
    recipients: List[str] = Field(min_length=1)
    definition_id: Optional[uuid.UUID] = None
    report_id: Optional[str] = Field(default=None, description="Source key; required without definition_id")
    filters: Optional[ExportFilter] = None
    subject_template: Optional[str] = Field(default=None, max_length=255)
    body_template: Optional[str] = None

    @field_validator("recipients")
    @classmethod
    def _emails(cls, v: List[str]) -> List[str]:
        bad = [r for r in v if not EMAIL_RE.match(r)]
        if bad:
            raise ValueError(f"Invalid email address: {', '.join(bad)}")
        return v


class SchedulePatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    schedule: Optional[str] = None
    export_format: Optional[Literal["csv", "excel", "word", "json"]] = None
    recipients: Optional[List[str]] = Field(default=None, min_length=1)
    is_enabled: Optional[bool] = None
    subject_template: Optional[str] = Field(default=None, max_length=255)
    body_template: Optional[str] = None

    _emails = field_validator("recipients")(ScheduleBody._emails.__func__)


def _view(j: ExportJob) -> Dict[str, Any]:
    return {
        "id": str(j.id), "name": j.name, "report_id": j.report_id,
        "definition_id": str(j.definition_id) if j.definition_id else None,
        "export_format": j.export_format, "schedule": j.schedule, "recipients": j.recipients,
        "filters": j.filters, "is_enabled": bool(j.is_enabled),
        "last_run_at": j.last_run_at.isoformat() if j.last_run_at else None,
        "next_run_at": j.next_run_at.isoformat() if j.next_run_at else None,
    }


def _run_view(r: ExportJobRun) -> Dict[str, Any]:
    return {
        "id": str(r.id), "status": r.status,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "record_count": r.record_count, "emails_sent": r.emails_sent,
        "error": r.error_message or r.email_error,
    }


async def _get_job(db: AsyncSession, job_id: str) -> ExportJob:
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    job = (await db.execute(select(ExportJob).where(ExportJob.id == jid))).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Not found")
    return job


def _validate_cron(expr: str) -> None:
    try:
        next_run_after(expr, _now())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("")
async def list_schedules(db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_portfolio_access)):
    jobs = (await db.execute(select(ExportJob).order_by(ExportJob.name))).scalars().all()
    return {"schedules": [_view(j) for j in jobs]}


@router.post("", status_code=201)
async def create_schedule(body: ScheduleBody, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(require_portfolio_access)):
    _validate_cron(body.schedule)
    report_id = body.report_id
    if body.definition_id:
        d = (await db.execute(select(ReportDefinition).where(ReportDefinition.id == body.definition_id))
             ).scalar_one_or_none()
        if d is None or not (d.is_shared or d.owner_username == user.username):
            raise HTTPException(status_code=404, detail="Report definition not found")
        report_id = d.source
    elif report_id not in SOURCES:
        raise HTTPException(status_code=422, detail="report_id must be a known source when no definition is given")

    job = await SchedulerService(get_email_service()).create_export_job(
        db, report_id=report_id, export_format=body.export_format, schedule=body.schedule,
        recipients=body.recipients, name=body.name,
        filters=body.filters.model_dump(exclude_none=True, mode="json") if body.filters else None,
        subject_template=body.subject_template, body_template=body.body_template,
        definition_id=body.definition_id,
    )
    job.created_by = job.updated_by = user.username
    await db.flush()
    return _view(job)


@router.patch("/{job_id}")
async def update_schedule(job_id: str, body: SchedulePatch, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(require_portfolio_access)):
    job = await _get_job(db, job_id)
    changes = body.model_dump(exclude_unset=True)
    if "schedule" in changes:
        _validate_cron(changes["schedule"])
        job.next_run_at = next_run_after(changes["schedule"], _now())
    for key, value in changes.items():
        setattr(job, key, value)
    if changes.get("is_enabled"):  # re-enabled after a pause: do not fire for the missed window
        job.next_run_at = next_run_after(job.schedule, _now())
    job.updated_by = user.username
    await db.flush()
    return _view(job)


@router.delete("/{job_id}", status_code=204)
async def delete_schedule(job_id: str, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(require_portfolio_access)):
    job = await _get_job(db, job_id)
    await db.delete(job)
    await db.flush()
    return Response(status_code=204)


@router.post("/{job_id}/run")
async def run_now(job_id: str, db: AsyncSession = Depends(get_db),
                  user: CurrentUser = Depends(require_portfolio_access)):
    """Deliver the report immediately (does not change the regular schedule)."""
    job = await _get_job(db, job_id)
    saved_next = job.next_run_at
    run = await SchedulerService(get_email_service()).execute_job(db, job.id)
    job.next_run_at = saved_next
    await db.flush()
    return _run_view(run)


@router.get("/{job_id}/runs")
async def list_runs(job_id: str, db: AsyncSession = Depends(get_db),
                    user: CurrentUser = Depends(require_portfolio_access)):
    job = await _get_job(db, job_id)
    runs = (await db.execute(
        select(ExportJobRun).where(ExportJobRun.job_id == job.id).order_by(ExportJobRun.started_at.desc()).limit(50)
    )).scalars().all()
    return {"runs": [_run_view(r) for r in runs]}
