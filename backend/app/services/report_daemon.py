"""Background runner for scheduled report delivery (RFP F.11).

Wakes every minute, runs export jobs whose ``next_run_at`` has passed, and retries failed runs.
Each job is claimed with ``FOR UPDATE SKIP LOCKED`` and committed on its own, so several
workers can run this loop without delivering the same report twice.
"""
import asyncio
import logging
from typing import Optional

from sqlalchemy import select

from backend.app.models.scheduler import ExportJob
from backend.app.services.scheduler_service import SchedulerService, _now

logger = logging.getLogger(__name__)

POLL_SECONDS = 60


async def run_due_jobs(session_factory, email_service=None) -> dict:
    """One pass: execute due jobs, then retry failed runs. A failing job never stops the pass."""
    service = SchedulerService(email_service=email_service)
    ran = retried = 0

    async with session_factory() as db:
        due_ids = [j.id for j in await service.get_pending_jobs(db)]
        retry_ids = [r.id for r in await service.get_jobs_needing_retry(db)]

    for job_id in due_ids:
        try:
            async with session_factory() as db:
                job = (await db.execute(
                    select(ExportJob)
                    .where(ExportJob.id == job_id, ExportJob.is_enabled.is_(True), ExportJob.next_run_at <= _now())
                    .with_for_update(skip_locked=True)
                )).scalar_one_or_none()
                if job is None:  # another worker has it, or it was disabled meanwhile
                    continue
                await service.execute_job(db, job.id)
                await db.commit()
                ran += 1
        except Exception:
            logger.exception("Scheduled export job %s crashed", job_id)

    for run_id in retry_ids:
        try:
            async with session_factory() as db:
                await service.retry_failed_job(db, run_id)
                await db.commit()
                retried += 1
        except Exception:
            logger.exception("Retry of export run %s crashed", run_id)

    if ran or retried:
        logger.info("Scheduled reports: %d run, %d retried", ran, retried)
    return {"ran": ran, "retried": retried}


async def report_loop(session_factory, email_service=None, interval: Optional[int] = None):
    """Poll for due report jobs until cancelled."""
    interval = interval or POLL_SECONDS
    while True:
        try:
            await run_due_jobs(session_factory, email_service)
        except Exception:
            logger.exception("Scheduled report pass crashed")
        await asyncio.sleep(interval)
