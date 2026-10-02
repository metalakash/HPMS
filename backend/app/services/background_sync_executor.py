"""Scheduled loan exposure sync (Phase 8.3.1), run as an asyncio task inside the API process.

Every minute ``sync_loop`` looks for schedules that have an occurrence since their last run, claims each one
(row lock + a "running" marker, so several workers never run the same schedule twice), fetches the data from the
configured source, ingests it in-process and records history, policy-violation alerts and emails.

This replaces an APScheduler design that could never have run: it imported a ``SessionLocal`` that does not
exist, scheduled a coroutine function on a thread pool, called a synchronous service with an async session and
posted to its own API with a placeholder token.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional, Tuple
from urllib.parse import urlparse

import httpx
from sqlalchemy import select

from backend.app.models.financial import LoanExposureSyncSchedule
from backend.app.services.loan_exposure_ingest import coerce_items, ingest_loan_exposures
from backend.app.services.loan_sync_scheduler_service import LoanSyncSchedulerService

logger = logging.getLogger(__name__)

POLL_SECONDS = 60
FETCH_TIMEOUT_SECONDS = 30.0


def _naive_utc(value: Any) -> Optional[datetime]:
    """Naive-UTC datetime from a datetime (aware or naive) or an ISO string; None if not parseable."""
    if value is None or value == "":
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _parse_hhmm(value: Optional[str]) -> Optional[Tuple[int, int]]:
    try:
        hour, minute = (int(p) for p in (value or "").split(":"))
    except ValueError:
        return None
    return (hour, minute) if 0 <= hour < 24 and 0 <= minute < 60 else None


def latest_occurrence(frequency: str, scheduled_time_utc: Optional[str], day_of_week: Optional[int],
                      now: datetime) -> Optional[datetime]:
    """The most recent moment (<= now, naive UTC) at which a schedule should have fired; None for manual or
    misconfigured schedules."""
    if frequency == "hourly":
        return now.replace(minute=0, second=0, microsecond=0)

    at = _parse_hhmm(scheduled_time_utc)
    if frequency == "daily" and at:
        occ = now.replace(hour=at[0], minute=at[1], second=0, microsecond=0)
        return occ - timedelta(days=1) if occ > now else occ

    if frequency == "weekly" and at and day_of_week is not None and 0 <= day_of_week <= 6:
        occ = now.replace(hour=at[0], minute=at[1], second=0, microsecond=0)
        occ -= timedelta(days=(now.weekday() - day_of_week) % 7)
        return occ - timedelta(days=7) if occ > now else occ
    return None


def is_due(schedule: LoanExposureSyncSchedule, now: datetime) -> bool:
    """True when an occurrence has passed since the later of the last run and the schedule's creation.

    A new schedule therefore waits for its next occurrence rather than firing immediately, and a missed
    occurrence (process down at 02:00) is run once when the process is back instead of being skipped.
    """
    if schedule.is_active != "Y":
        return False
    occ = latest_occurrence(schedule.frequency, schedule.scheduled_time_utc, schedule.day_of_week, now)
    if occ is None:
        return False
    baseline = max(
        (t for t in (_naive_utc(schedule.last_sync_at), _naive_utc(schedule.created_at)) if t is not None),
        default=None,
    )
    return baseline is None or occ > baseline


class SourceError(Exception):
    """The configured source could not be read; the message is stored in the sync history."""


class BackgroundSyncExecutor:
    """Runs due schedules. ``fetchers`` can be replaced in tests."""

    def __init__(self, session_factory, email_service=None):
        self.session_factory = session_factory
        self.email_service = email_service

    # ------------------------------------------------------------------ sources

    async def fetch(self, schedule: LoanExposureSyncSchedule) -> List[Any]:
        if schedule.sync_source == "BANK_API":
            return await self._fetch_bank_api(schedule)
        if schedule.sync_source == "FINACLE_CBS":
            raise SourceError("FINACLE_CBS source is not implemented yet (the CBS adapter is mock-backed)")
        if schedule.sync_source == "CSV_UPLOAD":
            raise SourceError("CSV_UPLOAD schedules have nothing to fetch; upload through /loans/exposure-sync")
        raise SourceError(f"Unknown sync_source: {schedule.sync_source}")

    @staticmethod
    async def _fetch_bank_api(schedule: LoanExposureSyncSchedule) -> List[Any]:
        url = (schedule.source_config or {}).get("webhook_url")
        if not url:
            raise SourceError("source_config.webhook_url is not set")
        if urlparse(url).scheme not in ("http", "https"):
            raise SourceError("webhook_url must be an http(s) URL")
        try:
            async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as e:
            raise SourceError(f"Bank API call failed: {type(e).__name__}: {str(e)[:200]}")
        if isinstance(data, dict) and isinstance(data.get("loan_accounts"), list):
            return data["loan_accounts"]
        if isinstance(data, list):
            return data
        raise SourceError("Unexpected response format from bank API")

    # ------------------------------------------------------------------ running

    async def run_due(self, now: Optional[datetime] = None) -> int:
        """Run every due schedule once. Returns how many were started."""
        now = now or datetime.utcnow()
        async with self.session_factory() as db:
            schedules = (await db.execute(
                select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.is_active == "Y"))).scalars().all()
            due_ids = [s.id for s in schedules if is_due(s, now)]

        started = 0
        for schedule_id in due_ids:
            try:
                async with self.session_factory() as db:
                    # Claim: lock the row, re-check, stamp it as running and commit, so a second worker (or the
                    # next poll) sees it as already handled while this run is still going.
                    schedule = (await db.execute(
                        select(LoanExposureSyncSchedule).where(LoanExposureSyncSchedule.id == schedule_id)
                        .with_for_update(skip_locked=True))).scalar_one_or_none()
                    if schedule is None or not is_due(schedule, now):
                        continue
                    schedule.last_sync_at = now.isoformat()
                    schedule.last_sync_status = "running"
                    await db.commit()
                    started += 1
                    await self.run_schedule(db, schedule, now)
            except Exception:
                logger.exception("Loan sync schedule %s crashed", schedule_id)
        return started

    async def run_schedule(self, db, schedule: LoanExposureSyncSchedule, started: Optional[datetime] = None) -> str:
        """Fetch, ingest, check policies, record history, send alerts. Returns the final status."""
        started = started or datetime.utcnow()
        sid = str(schedule.id)

        def elapsed() -> int:
            return int((datetime.utcnow() - started).total_seconds())

        async def record(status, total=0, created=0, updated=0, skipped=0, error=None, alerts=None) -> None:
            await LoanSyncSchedulerService.log_sync_result(
                db, sid, status, total, created, updated, skipped, error_message=error, alerts=alerts,
                duration_seconds=elapsed(), started_at=started.isoformat())

        try:
            raw = await self.fetch(schedule)
        except SourceError as e:
            logger.warning("Sync %s: %s", schedule.name, e)
            await record("failed", error=str(e))
            return "failed"
        except Exception as e:
            logger.exception("Sync %s: fetch crashed", schedule.name)
            await record("failed", error=f"Unexpected error while fetching: {type(e).__name__}")
            return "failed"

        if not raw:
            await record("failed", error="The source returned no loan accounts")
            return "failed"

        try:
            items, invalid = coerce_items(raw)
            outcome = await ingest_loan_exposures(
                db, items, schedule.sync_source, f"{schedule.name}@{started.isoformat()}", actor="scheduler",
                actor_role="system", extra_errors=invalid, total_submitted=len(raw))
            alerts = await LoanSyncSchedulerService.check_policy_violations(db, sid)
        except Exception as e:
            logger.exception("Sync %s: ingest crashed", schedule.name)
            await db.rollback()
            await record("failed", total=len(raw), skipped=len(raw), error=f"Ingest failed: {type(e).__name__}")
            return "failed"

        errors = outcome["errors"]
        status = "success" if outcome["skipped_count"] == 0 else (
            "failed" if outcome["created_count"] + outcome["updated_count"] == 0 else "partial_success")
        await record(status, outcome["total_records"], outcome["created_count"], outcome["updated_count"],
                     outcome["skipped_count"], error="; ".join(errors)[:1000] or None, alerts=alerts)

        if alerts and schedule.alert_email_addresses:
            await self._send_alert_emails(schedule.alert_email_addresses, schedule.name, alerts)
        logger.info("Sync %s: %s (created=%d updated=%d skipped=%d)", schedule.name, status,
                    outcome["created_count"], outcome["updated_count"], outcome["skipped_count"])
        return status

    async def _send_alert_emails(self, addresses: str, schedule_name: str, alerts) -> None:
        recipients = [a.strip() for a in addresses.split(",") if a.strip()]
        try:
            service = self.email_service
            if service is None:
                from backend.app.services.email_service import get_email_service
                service = get_email_service()
            await service.send_loan_sync_alerts(schedule_name=schedule_name, alerts=alerts, recipients=recipients)
        except Exception:
            logger.exception("Failed to send loan sync alert emails for %s", schedule_name)


async def sync_loop(session_factory, email_service=None, interval: Optional[int] = None):
    """Poll for due loan sync schedules until cancelled."""
    executor = BackgroundSyncExecutor(session_factory, email_service)
    while True:
        try:
            await executor.run_due()
        except Exception:
            logger.exception("Loan sync pass crashed")
        await asyncio.sleep(interval or POLL_SECONDS)
