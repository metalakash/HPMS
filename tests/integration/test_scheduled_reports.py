"""Phase 11.2: scheduled report delivery (no database required)."""

import email
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.scheduler import ExportJob, JobStatus
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.services.email_service import (
    EmailMessage, EmailService, MockEmailProvider, build_mime_message,
)
from backend.app.services.export_service import ExportService
from backend.app.services.scheduler_service import SchedulerService, next_run_after

ROWS = [{"project_code": "P1", "dscr": 1.0}, {"project_code": "P2", "dscr": 1.1}]


# ------------------------------------------------------------------ cron

def test_next_run_after_daily_and_weekly():
    after = datetime(2026, 10, 2, 7, 0, tzinfo=timezone.utc)  # a Friday
    assert next_run_after("0 6 * * *", after) == datetime(2026, 10, 3, 6, 0, tzinfo=timezone.utc)
    assert next_run_after("0 6 * * 1", after) == datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc)


@pytest.mark.parametrize("bad", ["", "every day", "61 * * * *", "* * *"])
def test_next_run_after_rejects_invalid_cron(bad):
    with pytest.raises(ValueError):
        next_run_after(bad, datetime.now(timezone.utc))


# ------------------------------------------------------------------ build_file / email

@pytest.mark.parametrize("fmt,magic", [("csv", b"\xef\xbb\xbf"), ("excel", b"PK"), ("word", b"PK"), ("json", b"{")])
def test_build_file_all_formats(fmt, magic):
    mime, content = ExportService.build_file(fmt, "covenant_shortfall", ROWS)
    assert "/" in mime and content.startswith(magic)


def test_build_file_rejects_unknown_format():
    with pytest.raises(ValueError):
        ExportService.build_file("pdf", "x", ROWS)


def test_mime_message_carries_attachment():
    mime, content = ExportService.build_file("excel", "x", ROWS)
    msg = build_mime_message(
        EmailMessage(to=["a@sbl.local"], subject="s", body_text="hello", attachments=[("r.xlsx", mime, content)]),
        "noreply@hpms.local")
    parsed = email.message_from_string(msg.as_string())
    parts = list(parsed.walk())
    attachment = next(p for p in parts if p.get_filename() == "r.xlsx")
    assert attachment.get_payload(decode=True) == content
    assert parsed["To"] == "a@sbl.local" and parsed["From"] == "noreply@hpms.local"


def test_mime_message_without_attachment_is_plain_alternative():
    msg = build_mime_message(EmailMessage(to=["a@sbl.local"], subject="s", body_text="hi"), "x@y.z")
    assert msg.get_content_type() == "multipart/alternative"


class CapturingProvider(MockEmailProvider):
    def __init__(self):
        self.sent = []

    async def send(self, message):
        self.sent.append(message)
        return True


async def test_send_export_notification_renders_templates_and_attaches():
    provider = CapturingProvider()
    ok = await EmailService(provider).send_export_notification(
        ["a@sbl.local"], "covenant_shortfall", "word", None, 2, 2048,
        subject_template="{report}: {records} loans", attachment=("r.docx", "application/x", b"1"))
    msg = provider.sent[0]
    assert ok and msg.subject == "Covenant Shortfall: 2 loans"
    assert msg.attachments[0][0] == "r.docx" and "BS" in msg.body_text


async def test_send_export_notification_survives_bad_template():
    provider = CapturingProvider()
    await EmailService(provider).send_export_notification(
        ["a@sbl.local"], "portfolio", "csv", None, 1, 10, subject_template="{nope}")
    assert provider.sent[0].subject == "{nope}"


async def test_send_export_notification_needs_recipients():
    assert await EmailService(CapturingProvider()).send_export_notification([], "p", "csv", None, 0, 0) is False


# ------------------------------------------------------------------ execute_job

class FakeDB:
    def __init__(self, job):
        self.job, self.added = job, []

    async def execute(self, stmt):
        job = self.job
        return SimpleNamespace(scalar_one_or_none=lambda: job)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass


def _job(**over):
    base = dict(
        id=uuid.uuid4(), name="Weekly shortfall", report_id="covenant_shortfall", export_format="word",
        schedule="0 6 * * 1", recipients=["a@sbl.local"], filters={"province": "Gandaki"}, definition_id=None,
        subject_template=None, body_template=None, retry_backoff_seconds="300", is_enabled=True,
        last_run_at=None, next_run_at=None)
    base.update(over)
    return SimpleNamespace(**base)


def _service(provider, rows, monkeypatch):
    async def fake_rows(db, job):
        if isinstance(rows, Exception):
            raise rows
        return rows

    monkeypatch.setattr(SchedulerService, "_run_job_report", staticmethod(fake_rows))
    return SchedulerService(EmailService(provider))


async def test_execute_job_emails_attachment_and_advances_schedule(monkeypatch):
    provider, job = CapturingProvider(), _job()
    run = await _service(provider, ROWS, monkeypatch).execute_job(FakeDB(job), job.id)
    assert run.status == JobStatus.SUCCESS.value and run.emails_sent == "Y" and run.record_count == "2"
    name, mime, content = provider.sent[0].attachments[0]
    assert name.endswith(".docx") and content[:2] == b"PK"
    assert job.last_run_at is not None and job.next_run_at > job.last_run_at


async def test_execute_job_with_no_rows_still_notifies_without_attachment(monkeypatch):
    provider, job = CapturingProvider(), _job()
    run = await _service(provider, [], monkeypatch).execute_job(FakeDB(job), job.id)
    assert run.status == JobStatus.SUCCESS.value and run.record_count == "0"
    assert provider.sent[0].attachments is None


async def test_execute_job_failure_records_error_retry_and_advances_schedule(monkeypatch):
    provider, job = CapturingProvider(), _job()
    run = await _service(provider, RuntimeError("db down"), monkeypatch).execute_job(FakeDB(job), job.id)
    assert run.status == JobStatus.FAILED.value and "db down" in run.error_message
    assert run.next_retry_at is not None and not provider.sent
    assert job.next_run_at is not None  # not left due: would re-run every poll


async def test_execute_job_email_failure_does_not_fail_the_run(monkeypatch):
    class Down(CapturingProvider):
        async def send(self, message):
            return False

    job = _job()
    run = await _service(Down(), ROWS, monkeypatch).execute_job(FakeDB(job), job.id)
    assert run.status == JobStatus.SUCCESS.value and run.emails_sent == "N" and run.email_error


async def test_create_export_job_validates_cron_and_format():
    svc = SchedulerService()
    db = FakeDB(None)
    with pytest.raises(ValueError, match="cron"):
        await svc.create_export_job(db, "portfolio", "excel", "nonsense", ["a@sbl.local"], "x")
    with pytest.raises(ValueError, match="export_format"):
        await svc.create_export_job(db, "portfolio", "pdf", "0 6 * * *", ["a@sbl.local"], "x")
    job = await svc.create_export_job(db, "portfolio", "word", "0 6 * * *", ["a@sbl.local"], "x")
    assert isinstance(job, ExportJob) and job.next_run_at > datetime.now(timezone.utc)


# ------------------------------------------------------------------ routes

@pytest.fixture
async def api():
    async def fake_db():
        yield SimpleNamespace()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser({
        "sub": str(uuid.uuid4()), "username": "tester", "roles": ["admin"], "is_authenticated": True})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.clear()


GOOD = {"name": "Weekly", "schedule": "0 6 * * 1", "export_format": "word",
        "recipients": ["a@sbl.local"], "report_id": "covenant_shortfall"}


@pytest.mark.parametrize("patch,status", [
    ({"schedule": "never"}, 422),
    ({"recipients": ["not-an-email"]}, 422),
    ({"recipients": []}, 422),
    ({"export_format": "pdf"}, 422),
    ({"report_id": "payroll"}, 422),
    ({"report_id": None}, 422),
])
async def test_create_schedule_validation(api, patch, status):
    r = await api.post("/api/v1/reports/schedules", json={**GOOD, **patch})
    assert r.status_code == status, r.text


async def test_schedule_routes_require_portfolio_role(api):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser({
        "sub": str(uuid.uuid4()), "username": "m", "roles": ["maker"], "is_authenticated": True})
    assert (await api.get("/api/v1/reports/schedules")).status_code == 403
    assert (await api.post("/api/v1/reports/schedules", json=GOOD)).status_code == 403


async def test_schedule_unknown_id_is_404(api):
    assert (await api.delete("/api/v1/reports/schedules/not-a-uuid")).status_code == 404


# ------------------------------------------------------------------ daemon wiring

def test_daemon_and_routes_are_wired():
    from backend.app.services import report_daemon
    assert callable(report_daemon.report_loop) and callable(report_daemon.run_due_jobs)
    paths = app.openapi()["paths"]
    assert {"get", "post"} <= set(paths["/api/v1/reports/schedules"])
    assert "post" in paths["/api/v1/reports/schedules/{job_id}/run"]


async def test_auditor_can_read_schedules_but_not_change_them(api):
    """Scheduling mails reports to arbitrary recipients, so it is an admin action; auditors stay read-only."""
    app.dependency_overrides[get_current_user] = lambda: CurrentUser({
        "sub": str(uuid.uuid4()), "username": "aud", "roles": ["auditor"], "is_authenticated": True})
    # list needs the DB: a fake that returns no jobs
    api_db = SimpleNamespace(execute=None)

    class Empty:
        async def execute(self, stmt):
            return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))

    async def fake_db():
        yield Empty()

    app.dependency_overrides[get_db] = fake_db
    assert (await api.get("/api/v1/reports/schedules")).status_code == 200
    assert (await api.post("/api/v1/reports/schedules", json=GOOD)).status_code == 403
    jid = uuid.uuid4()
    assert (await api.patch(f"/api/v1/reports/schedules/{jid}", json={"is_enabled": False})).status_code == 403
    assert (await api.delete(f"/api/v1/reports/schedules/{jid}")).status_code == 403
    assert (await api.post(f"/api/v1/reports/schedules/{jid}/run")).status_code == 403
