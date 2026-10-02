"""Audit log integrity check and retention (RFP E.1, E.4). Admin only; never purges automatically."""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.security.auth_middleware import CurrentUser, require_admin
from backend.app.services.audit_chain import preview_retention, purge_expired, verify_stored_chain

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin/audit", tags=["audit-admin"])


class PurgeBody(BaseModel):
    confirm_cutoff_date: date  # must equal the cutoff from GET /retention, so a stale preview cannot be acted on


def _today() -> date:
    return datetime.now(timezone.utc).date()


@router.get("/verify")
async def verify_chain_endpoint(db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    """Walk the whole hash chain and report the first broken link, if any."""
    report = await verify_stored_chain(db)
    return {"ok": report.ok, "rows_checked": report.checked, "first_bad_id": report.first_bad_id,
            "problem": report.problem}


@router.get("/retention")
async def retention_status(db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    """What a purge would remove under the configured retention period. Read-only."""
    p = await preview_retention(db, _today(), settings.AUDIT_RETENTION_YEARS)
    return {
        "retention_years": p.years, "cutoff_date": p.cutoff.isoformat(), "eligible_rows": p.eligible_rows,
        "oldest_id": p.oldest_id, "newest_eligible_id": p.newest_eligible_id,
        "purge_enabled": settings.AUDIT_PURGE_ENABLED,
        "note": "The retention period is configuration (AUDIT_RETENTION_YEARS), not a confirmed NRB requirement.",
    }


@router.post("/retention/purge")
async def purge(body: PurgeBody, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    """Delete the oldest audit rows past the retention cutoff and leave a checkpoint."""
    if not settings.AUDIT_PURGE_ENABLED:
        raise HTTPException(status_code=403, detail="Audit purge is disabled (set AUDIT_PURGE_ENABLED=true to allow)")
    today = _today()
    preview = await preview_retention(db, today, settings.AUDIT_RETENTION_YEARS)
    if body.confirm_cutoff_date != preview.cutoff:
        raise HTTPException(status_code=409, detail=f"Cutoff is now {preview.cutoff.isoformat()}; re-run the preview")
    deleted = await purge_expired(db, today, settings.AUDIT_RETENTION_YEARS, user.username)
    return {"deleted": deleted, "cutoff_date": preview.cutoff.isoformat()}
