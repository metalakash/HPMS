"""Daily alert scan (RFP E.2, E.16): expiry and slippage alerts, automatic risks, email digest."""
import asyncio
import logging
import os
from datetime import datetime, timedelta, date
from typing import Optional

from sqlalchemy import select

from backend.app.services.alert_service import AlertService
from backend.app.services.risk_service import sync_automatic_risks

logger = logging.getLogger(__name__)


def scan_hour_utc() -> int:
    return int(os.getenv("ALERT_SCAN_HOUR_UTC", "2"))


def seconds_until_next_run(now: datetime, hour: Optional[int] = None) -> float:
    """Seconds from ``now`` until the next ``hour``:00 UTC."""
    hour = scan_hour_utc() if hour is None else hour
    target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def format_digest(per_project: list) -> Optional[str]:
    """Plain-text digest of critical alerts; None when there is nothing to report."""
    lines = [
        f"[{code}] {name}: {a['description']} ({a['urgency']}, {a['days_remaining']} days)"
        for code, name, alerts in per_project
        for a in alerts
    ]
    return "\n".join(lines) if lines else None


async def run_daily_scan(session_factory, email_service=None, today: Optional[date] = None) -> dict:
    """Scan every project once. A failure on one project does not stop the scan."""
    from backend.app.models.project import Project
    today = today or datetime.utcnow().date()
    digest_rows, risks_created, scanned = [], 0, 0

    async with session_factory() as db:
        projects = (await db.execute(select(Project))).scalars().all()
        for p in projects:
            try:
                result = await AlertService.get_expiry_alerts(db, str(p.id))
                critical = result["alerts"]["critical"]
                if critical:
                    digest_rows.append((p.project_code, p.name_en, critical))
                risks_created += await sync_automatic_risks(db, p.id, today)
                scanned += 1
            except Exception:
                logger.exception("Daily alert scan failed for project %s", p.id)
        await db.commit()

    digest = format_digest(digest_rows)
    recipients = [r.strip() for r in os.getenv("ALERT_RECIPIENTS", "").split(",") if r.strip()]
    sent = False
    if digest and recipients and email_service is not None:
        from backend.app.services.email_service import EmailMessage
        sent = await email_service.provider.send(EmailMessage(
            to=recipients, subject=f"HPMS daily alert digest {today.isoformat()}", body_text=digest))
    logger.info("Daily alert scan: %d projects, %d new risks, digest sent=%s", scanned, risks_created, sent)
    return {"projects_scanned": scanned, "risks_created": risks_created, "digest_sent": bool(sent)}


async def daily_loop(session_factory, email_service=None):
    """Run the scan every day at the configured hour until cancelled."""
    while True:
        await asyncio.sleep(seconds_until_next_run(datetime.utcnow()))
        try:
            await run_daily_scan(session_factory, email_service)
        except Exception:
            logger.exception("Daily alert scan crashed")
