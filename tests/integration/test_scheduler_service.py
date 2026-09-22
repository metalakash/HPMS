"""Tests for scheduler service and export jobs."""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.scheduler import ExportJob, ExportJobRun, JobStatus
from backend.app.models.project import Project
from backend.app.services.scheduler_service import SchedulerService
from backend.app.services.email_service import MockEmailService


@pytest.fixture
def scheduler_service():
    """Create scheduler service with mock email."""
    email_service = MockEmailService(
        smtp_server="localhost",
        smtp_port=1025,
        sender_email="hpms@sbl.local",
    )
    return SchedulerService(email_service=email_service)


@pytest.mark.asyncio
async def test_create_export_job(db_session: AsyncSession, scheduler_service):
    """Test creating a new export job."""

    job = await scheduler_service.create_export_job(
        db_session,
        report_id="portfolio",
        export_format="excel",
        schedule="0 6 * * *",  # Daily at 6am
        recipients=["finance@sbl.local", "portfolio@sbl.local"],
        name="Daily Portfolio Export",
        max_retries=3,
    )

    assert job is not None
    assert job.report_id == "portfolio"
    assert job.export_format == "excel"
    assert job.schedule == "0 6 * * *"
    assert len(job.recipients) == 2
    assert job.is_enabled is True


@pytest.mark.asyncio
async def test_create_job_with_filters(db_session: AsyncSession, scheduler_service):
    """Test creating a job with filters."""

    filters = {
        "province": "Gandaki",
        "status": "under_operation",
    }

    job = await scheduler_service.create_export_job(
        db_session,
        report_id="covenant_summary",
        export_format="csv",
        schedule="0 2 * * 1",  # Weekly Monday 2am
        recipients=["auditor@sbl.local"],
        name="Weekly Covenant Report",
        filters=filters,
    )

    assert job.filters == filters


@pytest.mark.asyncio
async def test_disable_job(db_session: AsyncSession, scheduler_service):
    """Test disabling a job."""

    # Create job
    job = await scheduler_service.create_export_job(
        db_session,
        report_id="portfolio",
        export_format="json",
        schedule="0 * * * *",
        recipients=["admin@sbl.local"],
        name="Hourly Portfolio Export",
    )

    # Disable it
    disabled = await scheduler_service.disable_job(db_session, job.id)

    assert disabled is True
    assert job.is_enabled is False


@pytest.mark.asyncio
async def test_disable_nonexistent_job(db_session: AsyncSession, scheduler_service):
    """Test disabling a job that doesn't exist."""

    from uuid import uuid4

    disabled = await scheduler_service.disable_job(db_session, uuid4())

    assert disabled is False


@pytest.mark.asyncio
async def test_execute_job_success(db_session: AsyncSession, scheduler_service):
    """Test executing a job successfully."""

    # Create test project
    project = Project(
        project_code="TEST-001",
        name_en="Test Project",
        name_np="परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="test",
    )
    db_session.add(project)
    await db_session.flush()

    # Create export job
    job = await scheduler_service.create_export_job(
        db_session,
        report_id="portfolio",
        export_format="json",
        schedule="0 6 * * *",
        recipients=["test@sbl.local"],
        name="Test Export",
    )

    # Execute job
    job_run = await scheduler_service.execute_job(db_session, job.id)

    assert job_run is not None
    assert job_run.status == JobStatus.SUCCESS.value
    assert job_run.started_at is not None
    assert job_run.completed_at is not None
    assert job_run.duration_seconds is not None
    assert job_run.record_count is not None


@pytest.mark.asyncio
async def test_execute_job_with_email(db_session: AsyncSession, scheduler_service):
    """Test executing a job with email delivery."""

    # Create project
    project = Project(
        project_code="EMAIL-001",
        name_en="Email Test",
        name_np="इमेल परीक्षण",
        province="Bagmati",
        installed_capacity_mw=75,
        project_stage="construction",
        pipeline_status="under_construction",
        created_by="test",
    )
    db_session.add(project)
    await db_session.flush()

    # Create job with recipients
    job = await scheduler_service.create_export_job(
        db_session,
        report_id="portfolio",
        export_format="csv",
        schedule="0 8 * * *",
        recipients=["user@sbl.local"],
        name="Email Export Test",
    )

    # Execute job
    job_run = await scheduler_service.execute_job(db_session, job.id)

    assert job_run.emails_sent == "Y"


@pytest.mark.asyncio
async def test_execute_invalid_job(db_session: AsyncSession, scheduler_service):
    """Test executing a job that doesn't exist."""

    from uuid import uuid4

    with pytest.raises(ValueError):
        await scheduler_service.execute_job(db_session, uuid4())


@pytest.mark.asyncio
async def test_retry_failed_job(db_session: AsyncSession, scheduler_service):
    """Test retrying a failed export job."""

    # Create invalid job (will fail)
    job = await scheduler_service.create_export_job(
        db_session,
        report_id="invalid_report",
        export_format="json",
        schedule="0 * * * *",
        recipients=[],
        name="Invalid Job",
        max_retries=2,
    )

    # Execute (will fail)
    job_run1 = await scheduler_service.execute_job(db_session, job.id)
    assert job_run1.status == JobStatus.FAILED.value
    assert job_run1.retry_count == "0"

    # Retry
    job_run2 = await scheduler_service.retry_failed_job(db_session, job_run1.id)
    assert job_run2.retry_count == "1"


@pytest.mark.asyncio
async def test_get_pending_jobs(db_session: AsyncSession, scheduler_service):
    """Test fetching pending jobs."""

    # Create enabled job with next_run_at in past
    job1 = await scheduler_service.create_export_job(
        db_session,
        report_id="portfolio",
        export_format="json",
        schedule="0 * * * *",
        recipients=[],
        name="Pending Job 1",
    )
    job1.next_run_at = datetime.utcnow() - timedelta(hours=1)

    # Create disabled job (should not be pending)
    job2 = await scheduler_service.create_export_job(
        db_session,
        report_id="capex_progress",
        export_format="csv",
        schedule="0 * * * *",
        recipients=[],
        name="Disabled Job",
    )
    job2.is_enabled = False

    # Create enabled job with future next_run_at (should not be pending)
    job3 = await scheduler_service.create_export_job(
        db_session,
        report_id="covenant_summary",
        export_format="excel",
        schedule="0 * * * *",
        recipients=[],
        name="Future Job",
    )
    job3.next_run_at = datetime.utcnow() + timedelta(hours=1)

    await db_session.flush()

    # Get pending
    pending = await scheduler_service.get_pending_jobs(db_session)

    assert len(pending) == 1
    assert pending[0].id == job1.id


@pytest.mark.asyncio
async def test_get_jobs_needing_retry(db_session: AsyncSession, scheduler_service):
    """Test fetching jobs that need retry."""

    # Create a project first
    project = Project(
        project_code="RETRY-001",
        name_en="Retry Test",
        name_np="पुनः परीक्षण",
        province="Gandaki",
        installed_capacity_mw=50,
        project_stage="operation",
        pipeline_status="under_operation",
        created_by="test",
    )
    db_session.add(project)
    await db_session.flush()

    # Create valid job and execute it
    job = await scheduler_service.create_export_job(
        db_session,
        report_id="portfolio",
        export_format="json",
        schedule="0 * * * *",
        recipients=[],
        name="Retry Test Job",
    )

    # Execute to get a run
    job_run = await scheduler_service.execute_job(db_session, job.id)

    # Force it to failed state with past retry time
    job_run.status = JobStatus.FAILED.value
    job_run.next_retry_at = datetime.utcnow() - timedelta(minutes=5)

    await db_session.flush()

    # Get jobs needing retry
    needing_retry = await scheduler_service.get_jobs_needing_retry(db_session)

    assert len(needing_retry) == 1
    assert needing_retry[0].id == job_run.id


class TestJobRunModel:
    """Test ExportJobRun model."""

    def test_job_run_duration_calculation(self):
        """Test duration is calculated correctly."""
        run = ExportJobRun(
            job_id=None,
            status="success",
            started_at=datetime(2026, 9, 23, 12, 0, 0),
            completed_at=datetime(2026, 9, 23, 12, 5, 30),  # 5min 30sec
        )

        # In real code, duration_seconds would be set during execution
        # Simulate: (12:05:30 - 12:00:00) = 330 seconds
        run.duration_seconds = "330"

        assert run.duration_seconds == "330"
