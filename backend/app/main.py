"""FastAPI application factory and entry point."""
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging
from datetime import datetime

from .config import settings
from .database import get_db, init_db, close_db

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="SBL HPMS",
    description="Hydropower Project Management Solution",
    version="0.1.0",
)

# Middleware - Security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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

# CORS - Internal intranet only (to be configured per SBL infra)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:3000", "http://localhost:8080"],  # DEV ONLY
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "hpms.sbl.local"],  # DEV ONLY
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(HTTPException, lambda r, e: HTTPException(status_code=e.status_code, detail=e.detail))

# Register API routes
from backend.app.api.routes_auth import router as auth_router
from backend.app.api.routes_projects import router as projects_router
from backend.app.api.routes_loans import router as loans_router
from backend.app.api.routes_reports import router as reports_router

# Auth routes (no auth required)
app.include_router(auth_router)

# Protected routes (require JWT token)
app.include_router(projects_router)
app.include_router(loans_router)
app.include_router(reports_router)

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
        await db.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")

# Startup/shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    logger.info("SBL HPMS Starting up")
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("SBL HPMS Shutting down")
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
