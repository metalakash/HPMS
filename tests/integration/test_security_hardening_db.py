"""Security hardening: startup guard, sign-in lockout and throttling, real logout, MFA enforcement, upload
signatures, PDF encryption, error handling and headers.

Database tests need the migrated test database from conftest (skipped without one).
"""

import io
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.main import app
from backend.app.models.auth import LoginAttempt, User
from backend.app.security import startup_checks


@pytest.fixture
async def api(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


async def login(api, username, password=None):
    return await api.post("/api/v1/auth/login", json={"username": username, "password": password or f"{username}123"})


def bearer(response) -> dict:
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# ---------------------------------------------------------------- startup guard

def _settings(**overrides):
    base = dict(DEBUG=False, SECRET_KEY="k" * 48, JWT_SECRET_KEY="j" * 48, MFA_ENCRYPTION_KEY="")
    base.update(overrides)
    return SimpleNamespace(**base)


def test_production_refuses_default_short_or_shared_signing_keys():
    assert startup_checks.problems(_settings()) == []
    assert "default value" in startup_checks.problems(_settings(JWT_SECRET_KEY="dev-jwt-secret-key-change-in-production"))[0]
    assert "shorter than 32" in startup_checks.problems(_settings(SECRET_KEY="short"))[0]
    assert any("must differ" in p for p in startup_checks.problems(_settings(SECRET_KEY="s" * 40, JWT_SECRET_KEY="s" * 40)))
    with pytest.raises(startup_checks.UnsafeConfiguration):
        startup_checks.enforce(_settings(SECRET_KEY="dev-secret-key-change-in-production"))


def test_development_is_not_held_to_production_keys():
    assert startup_checks.problems(_settings(DEBUG=True, SECRET_KEY="dev-secret-key-change-in-production")) == []


# ---------------------------------------------------------------- sign-in lockout and throttling

async def test_five_failures_lock_the_username_even_for_the_right_password(api, db_session):
    for _ in range(settings.LOGIN_MAX_FAILURES):
        assert (await login(api, "maker", "wrong-password")).status_code == 401
    locked = await login(api, "maker")
    assert locked.status_code == 429 and "Try again in" in locked.json()["detail"]
    assert locked.headers["retry-after"] == str(settings.LOGIN_LOCKOUT_MINUTES * 60)
    # Another username from the same place is not locked by it
    assert (await login(api, "approver")).status_code == 200
    outcomes = (await db_session.execute(select(LoginAttempt.outcome).where(LoginAttempt.username == "maker")
                                         .order_by(LoginAttempt.id))).scalars().all()
    assert outcomes == ["bad_credentials"] * settings.LOGIN_MAX_FAILURES + ["locked"]


async def test_the_lock_lifts_when_the_window_passes(api, db_session):
    old = datetime.now(timezone.utc) - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES + 1)
    for _ in range(settings.LOGIN_MAX_FAILURES):
        db_session.add(LoginAttempt(username="maker", source_ip="10.0.0.9", outcome="bad_credentials", attempted_at=old))
    await db_session.flush()
    assert (await login(api, "maker")).status_code == 200


async def test_a_success_clears_earlier_failures(api):
    for _ in range(settings.LOGIN_MAX_FAILURES - 1):
        await login(api, "maker", "wrong-password")
    assert (await login(api, "maker")).status_code == 200
    for _ in range(settings.LOGIN_MAX_FAILURES - 1):
        await login(api, "maker", "wrong-password")
    assert (await login(api, "maker")).status_code == 200  # only failures since the last success count


async def test_many_failures_from_one_address_throttle_it(api, monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_IP_MAX_FAILURES", 3)
    for name in ("alpha", "beta", "gamma"):
        assert (await login(api, name, "guess")).status_code == 401
    assert (await login(api, "admin")).status_code == 429


# ---------------------------------------------------------------- logout

async def test_signing_out_revokes_the_token_at_once(api):
    headers = bearer(await login(api, "admin"))
    assert (await api.get("/api/v1/auth/me", headers=headers)).status_code == 200
    assert (await api.post("/api/v1/auth/logout", headers=headers)).status_code == 200
    after = await api.get("/api/v1/projects", headers=headers)
    assert after.status_code == 401 and "Signed out" in after.json()["detail"]
    # A fresh sign-in works
    assert (await api.get("/api/v1/projects", headers=bearer(await login(api, "admin")))).status_code == 200


async def test_logout_without_a_token_still_answers(api):
    assert (await api.post("/api/v1/auth/logout")).status_code == 200


# ---------------------------------------------------------------- MFA enforcement

async def test_a_required_role_without_mfa_can_only_set_it_up(api, db_session, monkeypatch):
    from backend.app.models.mfa import UserMFA

    monkeypatch.setattr(settings, "MFA_REQUIRED_ROLES", "maker")
    response = await login(api, "maker")
    assert response.json()["mfa_enrollment_required"] is True
    headers = bearer(response)
    refused = await api.get("/api/v1/projects", headers=headers)
    assert refused.status_code == 403 and "two-step sign-in" in refused.json()["detail"]
    assert (await api.get("/api/v1/mfa/status", headers=headers)).status_code == 200

    # Enrolment done: the same session works, no second sign-in needed
    maker = (await db_session.execute(select(User).where(User.username == "maker"))).scalar_one()
    db_session.add(UserMFA(user_id=maker.id, is_mfa_enabled=True, totp_enabled=True, primary_method="totp"))
    await db_session.flush()
    assert (await api.get("/api/v1/projects", headers=headers)).status_code == 200


async def test_roles_outside_the_requirement_are_not_affected(api, monkeypatch):
    monkeypatch.setattr(settings, "MFA_REQUIRED_ROLES", "admin")
    assert (await api.get("/api/v1/projects", headers=bearer(await login(api, "auditor")))).status_code == 200


# ---------------------------------------------------------------- uploads, PDFs, errors, headers

def test_a_file_whose_content_does_not_match_its_name_is_refused():
    from backend.app.services.document_service import DocumentRejected, DocumentService, FileContent

    service = DocumentService()
    with pytest.raises(DocumentRejected, match="not a PDF"):
        service.check_file(FileContent("letter.pdf", b"MZ\x90\x00 an executable renamed"))
    with pytest.raises(DocumentRejected, match="not a XLSX"):
        service.check_file(FileContent("budget.xlsx", b"<script>alert(1)</script>"))
    assert service.check_file(FileContent("photo.png", b"\x89PNG\r\n\x1a\n...")) == "image/png"


def test_encrypted_pdfs_use_aes_256():
    from pypdf import PdfReader
    from reportlab.pdfgen import canvas
    from backend.app.services.pdf_service import PDFService

    buffer = io.BytesIO()
    page = canvas.Canvas(buffer)
    page.drawString(50, 50, "confidential")
    page.save()
    reader = PdfReader(io.BytesIO(PDFService.encrypt_pdf(buffer.getvalue(), "user-pass", "owner-pass")))
    assert reader.is_encrypted and reader.trailer["/Encrypt"]["/V"] == 5  # 5 = AES-256
    assert reader.decrypt("user-pass")


async def test_an_unexpected_error_tells_the_caller_only_a_reference():
    from starlette.requests import Request
    from backend.app.main import unexpected_error

    request = Request({"type": "http", "method": "GET", "path": "/x", "headers": [], "query_string": b""})
    response = await unexpected_error(request, RuntimeError("password=hunter2 at db.internal:5432"))
    body = response.body.decode()
    assert response.status_code == 500 and "reference" in body
    assert "hunter2" not in body and "db.internal" not in body


async def test_responses_carry_isolation_headers(api):
    r = await api.get("/health")
    assert r.headers["cross-origin-opener-policy"] == "same-origin"
    assert r.headers["cross-origin-resource-policy"] == "same-origin"
    assert r.headers["x-content-type-options"] == "nosniff"


async def test_on_a_public_site_strangers_cannot_lock_an_account(api, db_session, monkeypatch):
    for _ in range(settings.LOGIN_MAX_FAILURES):
        db_session.add(LoginAttempt(username="admin", source_ip="203.0.113.7", outcome="bad_credentials"))
    await db_session.flush()
    monkeypatch.setattr(settings, "LOGIN_LOCKOUT_SCOPE", "user")
    assert (await login(api, "admin")).status_code == 429  # inside the bank the username itself is locked
    monkeypatch.setattr(settings, "LOGIN_LOCKOUT_SCOPE", "user_ip")
    assert (await login(api, "admin")).status_code == 200  # on a public site: the failures came from elsewhere
