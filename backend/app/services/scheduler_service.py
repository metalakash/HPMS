"""Scheduler service for automated export jobs.

Manages cron-based export scheduling with retry logic and email delivery.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.models.scheduler import ExportJob, ExportJobRun, JobStatus
from backend.app.services.report_service import ReportService
from backend.app.services.export_service import ExportService
from backend.app.services.email_service import EmailService

logger = logging.getLogger(__name__)

EXPORT_FORMATS = ("csv", "excel", "word", "json")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def next_run_after(schedule: str, after: datetime) -> datetime:
    """Next time ``schedule`` (5-field cron, UTC) fires after ``after``. Raises ValueError if invalid."""
    from croniter import croniter
    if not croniter.is_valid(schedule):
        raise ValueError(f"Invalid cron expression: {schedule!r}")
    return croniter(schedule, after).get_next(datetime)


class SchedulerService:
    """Manage scheduled export jobs."""

    def __init__(self, email_service: Optional[EmailService] = None):
        """Initialize scheduler.

        Args:
            email_service: Email service for notifications (optional)
        """
        self.email_service = email_service

    async def create_export_job(
        self,
        db: AsyncSession,
        report_id: str,
        export_format: str,
        schedule: str,
        recipients: List[str],
        name: str,
        filters: Optional[dict] = None,
        subject_template: Optional[str] = None,
        body_template: Optional[str] = None,
        max_retries: int = 3,
        definition_id: Optional[UUID] = None,
    ) -> ExportJob:
        """Create a new export job.

        Args:
            db: Database session
            report_id: Type of report (portfolio, covenant, capex)
            export_format: File format (csv, excel, json)
            schedule: Cron expression (e.g., "0 6 * * *" for daily 6am)
            recipients: List of email addresses
            name: Human-readable job name
            filters: Optional report filters
            subject_template: Optional email subject template
            body_template: Optional email body template
            max_retries: Number of retries on failure

        Returns:
            Created ExportJob record
        """

        if export_format not in EXPORT_FORMATS:
            raise ValueError(f"export_format must be one of {', '.join(EXPORT_FORMATS)}")
        next_run = next_run_after(schedule, _now())  # validates the cron expression

        job = ExportJob(
            definition_id=definition_id,
            report_id=report_id,
            export_format=export_format,
            schedule=schedule,
            recipients=recipients,
            name=name,
            filters=filters,
            subject_template=subject_template,
            body_template=body_template,
            max_retries=str(max_retries),
            is_enabled=True,
            next_run_at=next_run,
        )

        db.add(job)
        await db.flush()

        logger.info(f"Export job created: {name} (report={report_id}, schedule={schedule})")
        return job

    async def disable_job(
        self,
        db: AsyncSession,
        job_id: UUID,
    ) -> bool:
        """Disable a job (won't run anymore).

        Args:
            db: Database session
            job_id: Job to disable

        Returns:
            True if disabled, False if not found
        """

        query = select(ExportJob).where(ExportJob.id == job_id)
        result = await db.execute(query)
        job = result.scalar_one_or_none()

        if not job:
            return False

        job.is_enabled = False
        await db.flush()

        logger.info(f"Export job disabled: {job.name}")
        return True

    async def execute_job(
        self,
        db: AsyncSession,
        job_id: UUID,
    ) -> ExportJobRun:
        """Execute a scheduled export job.

        Args:
            db: Database session
            job_id: Job to execute

        Returns:
            ExportJobRun record with status
        """

        # Fetch job
        query = select(ExportJob).where(ExportJob.id == job_id)
        result = await db.execute(query)
        job = result.scalar_one_or_none()

        if not job:
            raise ValueError(f"Job not found: {job_id}")

        # Create job run record
        job_run = ExportJobRun(
            job_id=job_id,
            status=JobStatus.RUNNING.value,
            started_at=_now(),
        )
        db.add(job_run)
        await db.flush()

        try:
            logger.info(f"Executing export job: {job.name}")

            rows = await self._run_job_report(db, job)
            count = len(rows)

            attachment = None
            file_size = 0
            if rows:
                mime, file_content = ExportService.build_file(job.export_format, job.report_id, rows, job.filters)
                file_size = len(file_content)
                filename = ExportService.get_export_filename(job.report_id, job.export_format)
                attachment = (filename, mime, file_content)
            file_url = None  # delivery is by attachment; no hosted copy yet

            emails_sent = "N"
            email_error = None

            if job.recipients and self.email_service:
                try:
                    email_sent = await self.email_service.send_export_notification(
                        recipients=job.recipients,
                        report_id=job.report_id,
                        export_format=job.export_format,
                        download_url=file_url,
                        record_count=count,
                        file_size_bytes=file_size,
                        subject_template=job.subject_template,
                        body_template=job.body_template,
                        attachment=attachment,
                    )
                    if email_sent:
                        emails_sent = "Y"
                        job_run.email_send_time = _now()
                    else:
                        email_error = "Email delivery failed"
                except Exception as e:
                    email_error = str(e)
                    logger.error(f"Email delivery failed for job {job.name}: {e}")

            # Update job run with success
            job_run.status = JobStatus.SUCCESS.value
            job_run.completed_at = _now()
            job_run.duration_seconds = str(int((job_run.completed_at - job_run.started_at).total_seconds()))
            job_run.record_count = str(count)
            job_run.file_url = file_url
            job_run.file_size_bytes = str(file_size)
            job_run.emails_sent = emails_sent
            job_run.email_error = email_error

            job.last_run_at = _now()
            job.next_run_at = next_run_after(job.schedule, job.last_run_at)

            await db.flush()

            logger.info(f"Export job completed successfully: {job.name} ({count} records)")
            return job_run

        except Exception as e:
            # Update job run with failure
            job_run.status = JobStatus.FAILED.value
            job_run.completed_at = _now()
            job_run.duration_seconds = str(int((job_run.completed_at - job_run.started_at).total_seconds()))
            job_run.error_message = str(e)
            job_run.retry_count = "0"

            # Schedule retry
            retry_delay = int(job.retry_backoff_seconds or 300)
            job_run.next_retry_at = _now() + timedelta(seconds=retry_delay)
            try:  # a failed run must not leave the job "due" every minute; retries use next_retry_at
                job.next_run_at = next_run_after(job.schedule, _now())
            except ValueError:
                job.is_enabled = False

            await db.flush()

            logger.error(f"Export job failed: {job.name} - {e}")
            return job_run

    @staticmethod
    async def _run_job_report(db: AsyncSession, job: ExportJob):
        """Rows for a job: its saved definition if it has one, else report_id + filters."""
        from backend.app.models.reporting import ReportDefinition
        from backend.app.services.report_builder import run_report

        source, columns, filters, sort_by, sort_desc = job.report_id, None, job.filters, None, False
        if job.definition_id:
            d = (await db.execute(
                select(ReportDefinition).where(ReportDefinition.id == job.definition_id)
            )).scalar_one_or_none()
            if d is None:
                raise ValueError("Saved report definition no longer exists")
            source, columns, filters = d.source, d.columns, d.filters
            sort_by, sort_desc = d.sort_by, bool(d.sort_desc)
        return await run_report(db, source, columns, filters, sort_by, sort_desc, user_id="scheduler")

    async def retry_failed_job(
        self,
        db: AsyncSession,
        job_run_id: UUID,
    ) -> ExportJobRun:
        """Retry a failed export job.

        Args:
            db: Database session
            job_run_id: Job run to retry

        Returns:
            Updated ExportJobRun record
        """

        # Fetch previous run
        query = select(ExportJobRun).where(ExportJobRun.id == job_run_id)
        result = await db.execute(query)
        prev_run = result.scalar_one_or_none()

        if not prev_run:
            raise ValueError(f"Job run not found: {job_run_id}")

        # Increment retry count
        retry_count = int(prev_run.retry_count or 0) + 1
        max_retries = int((await db.execute(
            select(ExportJob).where(ExportJob.id == prev_run.job_id)
        )).scalar_one().max_retries or 3)

        if retry_count > max_retries:
            logger.warning(f"Max retries exceeded for job run {job_run_id}")
            return prev_run

        prev_run.next_retry_at = None  # claimed: otherwise it would be retried again every poll
        # Execute job again
        new_run = await self.execute_job(db, prev_run.job_id)
        new_run.retry_count = str(retry_count)

        await db.flush()

        logger.info(f"Job retry {retry_count}/{max_retries} completed for run {job_run_id}")
        return new_run

    async def get_pending_jobs(
        self,
        db: AsyncSession,
    ) -> List[ExportJob]:
        """Get all enabled jobs that should run soon.

        Args:
            db: Database session

        Returns:
            List of jobs to execute
        """

        query = select(ExportJob).where(
            and_(
                ExportJob.is_enabled == True,
                ExportJob.next_run_at <= _now(),
            )
        )

        result = await db.execute(query)
        return result.scalars().all()

    async def get_jobs_needing_retry(
        self,
        db: AsyncSession,
    ) -> List[ExportJobRun]:
        """Get job runs that failed and need retry.

        Args:
            db: Database session

        Returns:
            List of job runs to retry
        """

        query = select(ExportJobRun).where(
            and_(
                ExportJobRun.status == JobStatus.FAILED.value,
                ExportJobRun.next_retry_at <= _now(),
            )
        )

        result = await db.execute(query)
        return result.scalars().all()
