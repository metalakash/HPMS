"""Regulatory filing calendar, user reminders and stakeholder contacts (RFP E.7, E.15, E.22, E.23, C.9)."""

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.routes_projects import _get_visible_project
from backend.app.database import get_db
from backend.app.models.regulatory import (
    AUTHORITIES, FilingCalendarEntry, RegulatoryRequirement, StakeholderContact, UserReminder,
)
from backend.app.security.auth_middleware import CurrentUser, get_current_user, require_role
from backend.app.security.ldap_provider import UserRole
from backend.app.services.filing_calendar import FREQUENCIES
from backend.app.services.regulatory_service import generate_filings
from backend.app.services.report_dates import bs_string

router = APIRouter(prefix="/api/v1", tags=["regulatory"])

require_admin = require_role(UserRole.ADMIN)
require_portfolio_access = require_role(UserRole.ADMIN, UserRole.AUDITOR)
require_filer = require_role(UserRole.ADMIN, UserRole.MAKER)

Authority = Literal["NRB", "MOEWRI", "NEA", "DOED", "ERC", "OTHER"]
Frequency = Literal["monthly", "quarterly", "semi_annual", "annual"]
EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
ALERT_TYPES = ("PPA", "LICENSE", "INSURANCE", "PERMIT", "MILESTONE", "FILING")


def _uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


# ================================================================ requirements

class RequirementBody(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=255)
    authority: Authority
    description: Optional[str] = None
    legal_reference: Optional[str] = Field(default=None, max_length=255)
    frequency: Frequency
    lag_days: int = Field(default=0, ge=0, le=366)
    applies_to: Literal["portfolio", "project"] = "portfolio"
    is_active: bool = True


class RequirementPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    legal_reference: Optional[str] = Field(default=None, max_length=255)
    lag_days: Optional[int] = Field(default=None, ge=0, le=366)
    is_active: Optional[bool] = None


class GenerateBody(BaseModel):
    from_date: date
    to_date: date
    project_ids: Optional[List[uuid.UUID]] = None


def _req_view(r: RegulatoryRequirement) -> Dict[str, Any]:
    return {c: getattr(r, c) for c in (
        "code", "title", "authority", "description", "legal_reference", "frequency", "lag_days",
        "applies_to", "is_active")} | {"id": str(r.id)}


async def _get_requirement(db: AsyncSession, requirement_id: str) -> RegulatoryRequirement:
    r = (await db.execute(select(RegulatoryRequirement).where(
        RegulatoryRequirement.id == _uuid(requirement_id)))).scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="Not found")
    return r


@router.get("/regulatory/requirements")
async def list_requirements(authority: Optional[Authority] = None, db: AsyncSession = Depends(get_db),
                            user: CurrentUser = Depends(require_portfolio_access)):
    q = select(RegulatoryRequirement).order_by(RegulatoryRequirement.authority, RegulatoryRequirement.code)
    if authority:
        q = q.where(RegulatoryRequirement.authority == authority)
    return {"requirements": [_req_view(r) for r in (await db.execute(q)).scalars().all()]}


@router.post("/regulatory/requirements", status_code=201)
async def create_requirement(body: RequirementBody, db: AsyncSession = Depends(get_db),
                             user: CurrentUser = Depends(require_admin)):
    r = RegulatoryRequirement(**body.model_dump(), created_by=user.username, updated_by=user.username)
    db.add(r)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail=f"Requirement code already exists: {body.code}")
    return _req_view(r)


@router.patch("/regulatory/requirements/{requirement_id}")
async def update_requirement(requirement_id: str, body: RequirementPatch, db: AsyncSession = Depends(get_db),
                             user: CurrentUser = Depends(require_admin)):
    r = await _get_requirement(db, requirement_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(r, key, value)
    r.updated_by = user.username
    await db.flush()
    return _req_view(r)


@router.delete("/regulatory/requirements/{requirement_id}", status_code=204)
async def delete_requirement(requirement_id: str, db: AsyncSession = Depends(get_db),
                             user: CurrentUser = Depends(require_admin)):
    r = await _get_requirement(db, requirement_id)
    await db.delete(r)  # cascades to its calendar rows; deactivate instead to keep history
    await db.flush()
    return Response(status_code=204)


@router.post("/regulatory/requirements/{requirement_id}/generate")
async def generate_calendar(requirement_id: str, body: GenerateBody, db: AsyncSession = Depends(get_db),
                            user: CurrentUser = Depends(require_admin)):
    """Create calendar rows for every BS fiscal period ending in the range. Safe to re-run."""
    r = await _get_requirement(db, requirement_id)
    try:
        created = await generate_filings(db, r, body.from_date, body.to_date, body.project_ids, user.username)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"requirement": r.code, "created": created}


# ================================================================ calendar

class FilingPatch(BaseModel):
    status: Optional[Literal["pending", "filed", "waived"]] = None
    filed_date_ad: Optional[date] = None
    reference_no: Optional[str] = Field(default=None, max_length=100)
    assigned_to: Optional[str] = Field(default=None, max_length=255)
    remarks: Optional[str] = None


def _filing_view(e: FilingCalendarEntry, r: Optional[RegulatoryRequirement] = None) -> Dict[str, Any]:
    r = r or e.requirement
    return {
        "id": str(e.id), "requirement_id": str(e.requirement_id), "requirement_code": r.code,
        "title": r.title, "authority": r.authority,
        "project_id": str(e.project_id) if e.project_id else None, "period_label": e.period_label,
        "period_end_ad": _iso(e.period_end_ad), "period_end_bs": e.period_end_bs,
        "due_date_ad": _iso(e.due_date_ad), "due_date_bs": e.due_date_bs, "status": e.status,
        "filed_date_ad": _iso(e.filed_date_ad), "filed_date_bs": e.filed_date_bs,
        "reference_no": e.reference_no, "assigned_to": e.assigned_to, "remarks": e.remarks,
    }


def _calendar_query(from_date: Optional[date], to_date: Optional[date], authority: Optional[str],
                    status: Optional[str]):
    q = (select(FilingCalendarEntry, RegulatoryRequirement)
         .join(RegulatoryRequirement, RegulatoryRequirement.id == FilingCalendarEntry.requirement_id)
         .order_by(FilingCalendarEntry.due_date_ad, RegulatoryRequirement.code))
    if from_date:
        q = q.where(FilingCalendarEntry.due_date_ad >= from_date)
    if to_date:
        q = q.where(FilingCalendarEntry.due_date_ad <= to_date)
    if authority:
        q = q.where(RegulatoryRequirement.authority == authority)
    if status:
        q = q.where(FilingCalendarEntry.status == status)
    return q


@router.get("/regulatory/calendar")
async def get_calendar(
    from_date: Optional[date] = None, to_date: Optional[date] = None, authority: Optional[Authority] = None,
    status: Optional[Literal["pending", "filed", "overdue", "waived"]] = None,
    project_id: Optional[str] = Query(default=None, description="a project id, or 'portfolio' for portfolio-level"),
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_portfolio_access),
):
    q = _calendar_query(from_date, to_date, authority, status)
    if project_id == "portfolio":
        q = q.where(FilingCalendarEntry.project_id.is_(None))
    elif project_id:
        q = q.where(FilingCalendarEntry.project_id == _uuid(project_id))
    rows = (await db.execute(q)).all()
    return {"filings": [_filing_view(e, r) for e, r in rows], "count": len(rows)}


@router.get("/projects/{project_id}/filings")
async def project_filings(
    project_id: str, from_date: Optional[date] = None, to_date: Optional[date] = None,
    status: Optional[Literal["pending", "filed", "overdue", "waived"]] = None,
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user),
):
    project = await _get_visible_project(db, user, project_id)
    q = _calendar_query(from_date, to_date, None, status).where(FilingCalendarEntry.project_id == project.id)
    rows = (await db.execute(q)).all()
    return {"filings": [_filing_view(e, r) for e, r in rows], "count": len(rows)}


@router.patch("/regulatory/calendar/{filing_id}")
async def update_filing(filing_id: str, body: FilingPatch, db: AsyncSession = Depends(get_db),
                        user: CurrentUser = Depends(require_filer)):
    """Record a filing (status=filed with the regulator's reference), waive it, or edit its notes."""
    row = (await db.execute(
        select(FilingCalendarEntry, RegulatoryRequirement)
        .join(RegulatoryRequirement, RegulatoryRequirement.id == FilingCalendarEntry.requirement_id)
        .where(FilingCalendarEntry.id == _uuid(filing_id)))).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    entry, requirement = row

    changes = body.model_dump(exclude_unset=True)
    new_status = changes.get("status", entry.status)
    if new_status == "filed":
        reference = changes.get("reference_no", entry.reference_no)
        if not reference:
            raise HTTPException(status_code=422, detail="reference_no is required to mark a filing as filed")
        filed_on = changes.get("filed_date_ad") or entry.filed_date_ad or datetime.utcnow().date()
        if filed_on > datetime.utcnow().date():
            raise HTTPException(status_code=422, detail="filed_date_ad cannot be in the future")
        entry.filed_date_ad, entry.filed_date_bs = filed_on, bs_string(filed_on)
    elif "status" in changes:  # reopening or waiving clears the filing record
        entry.filed_date_ad = entry.filed_date_bs = None
    for key in ("status", "reference_no", "assigned_to", "remarks"):
        if key in changes:
            setattr(entry, key, changes[key])
    entry.updated_by = user.username
    await db.flush()
    return _filing_view(entry, requirement)


# ================================================================ reminders (E.22)

class ReminderBody(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    note: Optional[str] = None
    remind_on_ad: date
    project_id: Optional[uuid.UUID] = None
    entity_type: Optional[Literal["MILESTONE", "FILING", "PERMIT", "INSURANCE", "PPA", "LICENSE", "OTHER"]] = None
    entity_id: Optional[str] = Field(default=None, max_length=64)


class ReminderPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    note: Optional[str] = None
    remind_on_ad: Optional[date] = None
    status: Optional[Literal["active", "dismissed"]] = None


def _reminder_view(r: UserReminder) -> Dict[str, Any]:
    return {
        "id": str(r.id), "title": r.title, "note": r.note, "remind_on_ad": _iso(r.remind_on_ad),
        "remind_on_bs": r.remind_on_bs, "project_id": str(r.project_id) if r.project_id else None,
        "entity_type": r.entity_type, "entity_id": r.entity_id, "status": r.status, "sent_at": _iso(r.sent_at),
    }


async def _own_reminder(db: AsyncSession, user: CurrentUser, reminder_id: str) -> UserReminder:
    r = (await db.execute(select(UserReminder).where(
        UserReminder.id == _uuid(reminder_id), UserReminder.owner_username == user.username))).scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="Not found")
    return r


@router.get("/reminders")
async def list_reminders(status: Optional[Literal["active", "sent", "dismissed"]] = None,
                         db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    q = select(UserReminder).where(UserReminder.owner_username == user.username).order_by(UserReminder.remind_on_ad)
    if status:
        q = q.where(UserReminder.status == status)
    return {"reminders": [_reminder_view(r) for r in (await db.execute(q)).scalars().all()]}


@router.post("/reminders", status_code=201)
async def create_reminder(body: ReminderBody, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
    if body.project_id:
        await _get_visible_project(db, user, str(body.project_id))  # 404s for projects the user cannot see
    r = UserReminder(
        owner_username=user.username, title=body.title, note=body.note, remind_on_ad=body.remind_on_ad,
        remind_on_bs=bs_string(body.remind_on_ad), project_id=body.project_id, entity_type=body.entity_type,
        entity_id=body.entity_id, status="active", created_by=user.username, updated_by=user.username)
    db.add(r)
    await db.flush()
    return _reminder_view(r)


@router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, body: ReminderPatch, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
    r = await _own_reminder(db, user, reminder_id)
    changes = body.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(r, key, value)
    if "remind_on_ad" in changes:  # moving the date re-arms a reminder that already fired
        r.remind_on_bs = bs_string(r.remind_on_ad)
        if r.status == "sent" and "status" not in changes:
            r.status, r.sent_at = "active", None
    r.updated_by = user.username
    await db.flush()
    return _reminder_view(r)


@router.delete("/reminders/{reminder_id}", status_code=204)
async def delete_reminder(reminder_id: str, db: AsyncSession = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
    r = await _own_reminder(db, user, reminder_id)
    await db.delete(r)
    await db.flush()
    return Response(status_code=204)


# ================================================================ stakeholder contacts (E.15, C.9)

class ContactBody(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    organization: Optional[str] = Field(default=None, max_length=255)
    role: Optional[str] = Field(default=None, max_length=100)
    category: Literal["internal", "external"] = "external"
    email: str = Field(pattern=EMAIL_RE, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    project_id: Optional[uuid.UUID] = None
    alert_types: Optional[List[str]] = None
    min_urgency: Literal["warning", "critical"] = "critical"
    is_active: bool = True

    @field_validator("alert_types")
    @classmethod
    def _types(cls, v):
        if v is not None:
            bad = [t for t in v if t not in ALERT_TYPES]
            if bad or not v:
                raise ValueError(f"alert_types must be a non-empty subset of {', '.join(ALERT_TYPES)}")
        return v


class ContactPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    organization: Optional[str] = Field(default=None, max_length=255)
    role: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, pattern=EMAIL_RE, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    alert_types: Optional[List[str]] = None
    min_urgency: Optional[Literal["warning", "critical"]] = None
    is_active: Optional[bool] = None

    _types = field_validator("alert_types")(ContactBody._types.__func__)


def _contact_view(c: StakeholderContact) -> Dict[str, Any]:
    return {c_: getattr(c, c_) for c_ in (
        "name", "organization", "role", "category", "email", "phone", "alert_types", "min_urgency", "is_active")
    } | {"id": str(c.id), "project_id": str(c.project_id) if c.project_id else None}


async def _get_contact(db: AsyncSession, contact_id: str) -> StakeholderContact:
    c = (await db.execute(select(StakeholderContact).where(
        StakeholderContact.id == _uuid(contact_id)))).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="Not found")
    return c


@router.get("/stakeholders")
async def list_contacts(db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_portfolio_access)):
    rows = (await db.execute(select(StakeholderContact).order_by(StakeholderContact.name))).scalars().all()
    return {"contacts": [_contact_view(c) for c in rows]}


@router.post("/stakeholders", status_code=201)
async def create_contact(body: ContactBody, db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(require_admin)):
    c = StakeholderContact(**body.model_dump(), created_by=user.username, updated_by=user.username)
    db.add(c)
    await db.flush()
    return _contact_view(c)


@router.patch("/stakeholders/{contact_id}")
async def update_contact(contact_id: str, body: ContactPatch, db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(require_admin)):
    c = await _get_contact(db, contact_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(c, key, value)
    c.updated_by = user.username
    await db.flush()
    return _contact_view(c)


@router.delete("/stakeholders/{contact_id}", status_code=204)
async def delete_contact(contact_id: str, db: AsyncSession = Depends(get_db),
                         user: CurrentUser = Depends(require_admin)):
    c = await _get_contact(db, contact_id)
    await db.delete(c)
    await db.flush()
    return Response(status_code=204)
