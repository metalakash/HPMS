"""FastAPI application factory and entry point."""
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
import asyncio
import logging
import os
from datetime import datetime

from sqlalchemy import text

from .config import settings
from .database import get_db, engine, close_db
from .middleware.security import IPAllowlistMiddleware, apply_security_headers, parse_networks

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Language detection middleware (Phase 4 Task 5)
from backend.app.i18n.middleware import LanguageDetectionMiddleware

app = FastAPI(
    title="SBL HPMS",
    description="Hydropower Project Management Solution",
    version="0.1.0",
)

# Middleware - Security headers (CSP, nosniff, no-store on API responses, ...)
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    apply_security_headers(response.headers, request.url.path)
    return response


# Middleware - Audit read/export operations
@app.middleware("http")
async def audit_read_operations(request: Request, call_next):
    """Log read/export operations to audit_log_reads table."""
    response = await call_next(request)

    # Capture export/view endpoints for audit logging (Phase 2 implementation)
    if request.method == "GET" and ("export" in request.url.path or "download" in request.url.path):
        user_id = request.headers.get("X-User-ID", "anonymous")
        export_format = request.query_params.get("format", "JSON")
        # TODO: Log to AuditLogRead table with entity_type, entity_id, export_format, record_count

    return response

# Language detection middleware (Phase 4 Task 5)
app.add_middleware(LanguageDetectionMiddleware)

# CORS - Internal intranet only (to be configured per SBL infra)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",  # React old dev server
        "http://localhost:5173",  # Vite dev server (Phase 6 frontend)
        "http://127.0.0.1:5173",
        "http://localhost:8080",  # Alternative dev port
        "https://hpms-web.vercel.app",  # Vercel-hosted frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "localhost",
        "127.0.0.1",
        "hpms.sbl.local",
        "hpms-api.onrender.com",  # Render-hosted backend
        "*.onrender.com",  # TEMP DEMO: Render-hosted backend
        *[h.strip() for h in os.getenv("EXTRA_ALLOWED_HOSTS", "").split(",") if h.strip()],
    ],  # DEV ONLY
)

# IP allow-list for admin / service consoles (no-op while ADMIN_IP_ALLOWLIST is empty).
# Added last so it is the outermost middleware and rejects before anything else runs.
app.add_middleware(
    IPAllowlistMiddleware,
    networks=parse_networks(settings.ADMIN_IP_ALLOWLIST),
    protected_prefixes=[p.strip() for p in settings.ADMIN_PROTECTED_PREFIXES.split(",") if p.strip()],
    trusted_proxy_hops=settings.TRUSTED_PROXY_HOPS,
)

# Rate limiting
app.state.limiter = limiter

# Background tasks (alert scan, scheduled reports, loan sync) started in startup_event
alert_task = None
report_task = None
sync_task = None

# Register API routes
from backend.app.api.routes_auth import router as auth_router
from backend.app.api.routes_projects import router as projects_router
from backend.app.api.routes_loans import router as loans_router
from backend.app.api.routes_reports import router as reports_router
from backend.app.api.routes_mfa import router as mfa_router
from backend.app.api.routes_graphql import router as graphql_router
from backend.app.api.routes_ws import router as ws_router
from backend.app.api.routes_i18n import router as i18n_router
from backend.app.api.routes_compliance import router as compliance_router
from backend.app.api.routes_covenants import router as covenants_router
from backend.app.api.routes_analytics import router as analytics_router
from backend.app.api.routes_admin import router as admin_router
from backend.app.api.routes_risk import router as risk_router
from backend.app.api.routes_cbs_sync import router as cbs_router
from backend.app.api.routes_report_builder import router as report_builder_router
from backend.app.api.routes_report_schedules import router as report_schedules_router
from backend.app.api.routes_regulatory import router as regulatory_router
from backend.app.api.routes_audit_admin import router as audit_admin_router
from backend.app.api.routes_mutations import router as mutations_router

# Auth routes (no auth required)
app.include_router(auth_router)

# Protected routes (require JWT token)
app.include_router(projects_router)
app.include_router(loans_router)
app.include_router(reports_router)
app.include_router(mfa_router)
app.include_router(graphql_router)
app.include_router(ws_router)
app.include_router(i18n_router)
app.include_router(compliance_router)
app.include_router(covenants_router)
app.include_router(analytics_router)
app.include_router(cbs_router)
app.include_router(report_builder_router)
app.include_router(report_schedules_router)
app.include_router(regulatory_router)
app.include_router(audit_admin_router)
app.include_router(mutations_router)

# Admin routes (require ADMIN role)
app.include_router(admin_router)
app.include_router(risk_router)

# Health check
@app.get("/health", tags=["monitoring"])
async def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "debug": settings.DEBUG,
    }

# Ready check (includes DB)
@app.get("/ready", tags=["monitoring"])
async def ready_check(db=Depends(get_db)):
    """Readiness check - confirms DB connectivity."""
    try:
        # Simple check that DB session works
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")

# Startup/shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    logger.info("SBL HPMS Starting up")
    # Schema is owned by Alembic (`alembic upgrade head`); never create_all here,
    # which would bypass migrations and turn views like consortium_exposure_v into tables.
    # A DB outage should not stop the process: /ready reports it and requests fail with 503.
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database reachable")
    except Exception as e:
        logger.error(f"Database not reachable at startup: {e}")

    # Daily alert scan (expiry/slippage alerts, automatic risks, email digest)
    try:
        import asyncio
        from backend.app.database import async_session_maker
        from backend.app.services.alert_daemon import daily_loop
        from backend.app.services.email_service import get_email_service
        global alert_task
        alert_task = asyncio.create_task(daily_loop(async_session_maker, get_email_service()))
        logger.info("Daily alert scan scheduled")

        from backend.app.services.report_daemon import report_loop
        global report_task
        report_task = asyncio.create_task(report_loop(async_session_maker, get_email_service()))
        logger.info("Scheduled report delivery started")
    except Exception as e:
        logger.error(f"Failed to schedule daily alert scan: {e}", exc_info=True)

    # Scheduled loan exposure sync (Phase 8.3.1): asyncio task, no external scheduler
    try:
        from backend.app.database import async_session_maker
        from backend.app.services.background_sync_executor import sync_loop
        from backend.app.services.email_service import get_email_service
        global sync_task
        sync_task = asyncio.create_task(sync_loop(async_session_maker, get_email_service()))
        logger.info("Loan exposure sync scheduler started")
    except Exception as e:
        logger.error(f"Failed to start loan sync scheduler: {e}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("SBL HPMS Shutting down")
    if alert_task:
        alert_task.cancel()
    if report_task:
        report_task.cancel()
    if sync_task:
        sync_task.cancel()

    await close_db()

# API Routes (Phase 2):
# - /api/v1/projects (GET list, GET detail, POST create, PATCH update)
# - /api/v1/projects/{id}/loan-accounts (GET linked accounts)
# - /api/v1/loan-accounts (GET list, GET detail, POST sync trigger)
# - /api/v1/approvals (Phase 2.5)
# - /api/v1/audit-logs (Phase 2.5)
# - /api/v1/documents (Phase 2.5)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
