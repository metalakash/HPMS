"""FastAPI routes for compliance and audit endpoints.

Implements:
- GET /api/v1/compliance/audit-log — read-only audit log (paginated, admin/auditor only)
- POST /api/v1/compliance/export — immutable audit export (JSON, admin/auditor only)
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.app.database import get_db
from backend.app.models.audit import AuditLogRead
from backend.app.security.auth_middleware import CurrentUser, get_current_user
from backend.app.schemas.common import ApiResponse, ResponseMeta, AuditMetadata
from backend.app.schemas.compliance import (
    AuditLogReadResponse,
    ComplianceExportRequest,
    ComplianceExportResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


def _get_audit_metadata(user_id: str = "anonymous", action: str = "read") -> AuditMetadata:
    """Create audit metadata for response."""
    return AuditMetadata(
        user_id=user_id,
        action=action,
        timestamp=datetime.utcnow().isoformat(),
    )


def _get_response_meta(
    page: Optional[int] = None, page_size: Optional[int] = None, total_count: Optional[int] = None
) -> ResponseMeta:
    """Create response metadata."""
    return ResponseMeta(
        timestamp=datetime.utcnow().isoformat(),
        version="0.1.0",
        page=page,
        page_size=page_size,
        total_count=total_count,
    )


@router.get("/audit-log", response_model=ApiResponse[list[AuditLogReadResponse]])
async def list_audit_log(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (project, loan, report)"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    date_from: Optional[str] = Query(None, description="Filter from date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter to date (ISO format)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ApiResponse[list[AuditLogReadResponse]]:
    """Get paginated read audit log (compliance read access tracking).

    Only admins and auditors can view audit logs.
    Makers and guests see empty results (no 403 to avoid info leakage).
    """

    # RLS: only admins and auditors can access audit logs
    if not current_user.roles or current_user.roles[0].value not in ("admin", "auditor"):
        return ApiResponse(
            data=[],
            meta=_get_response_meta(page=page, page_size=page_size, total_count=0),
            audit=_get_audit_metadata(user_id=current_user.username, action="read_compliance_log"),
        )

    # Build base query
    query = select(AuditLogRead)

    # Apply filters
    if entity_type:
        query = query.where(AuditLogRead.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLogRead.entity_id == entity_id)
    if date_from:
        query = query.where(AuditLogRead.timestamp >= date_from)
    if date_to:
        query = query.where(AuditLogRead.timestamp <= date_to)

    # Get total count
    count_query = select(func.count()).select_from(AuditLogRead)
    if entity_type:
        count_query = count_query.where(AuditLogRead.entity_type == entity_type)
    if entity_id:
        count_query = count_query.where(AuditLogRead.entity_id == entity_id)
    if date_from:
        count_query = count_query.where(AuditLogRead.timestamp >= date_from)
    if date_to:
        count_query = count_query.where(AuditLogRead.timestamp <= date_to)

    total_count = await db.execute(count_query)
    total_count = total_count.scalar() or 0

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(AuditLogRead.timestamp.desc())

    # Execute
    result = await db.execute(query)
    records = result.scalars().all()

    # Convert to response
    items = [
        AuditLogReadResponse(
            id=str(r.id),
            user_id=r.user_id,
            timestamp=r.timestamp,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            export_format=r.export_format,
            record_count=r.record_count,
        )
        for r in records
    ]

    return ApiResponse(
        data=items,
        meta=_get_response_meta(page=page, page_size=page_size, total_count=total_count),
        audit=_get_audit_metadata(user_id=current_user.username, action="read_compliance_log"),
    )


@router.post("/export", response_model=ApiResponse[ComplianceExportResponse])
async def export_compliance(
    request: ComplianceExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ComplianceExportResponse]:
    """Export audit log for compliance (auditors and admins only).

    Returns immutable audit trail with export timestamp and generator info.
    Requires admin or auditor role.
    """

    # Only admins and auditors can export
    if not current_user.roles or current_user.roles[0].value not in ("admin", "auditor"):
        raise HTTPException(status_code=403, detail="Only auditors and admins can export compliance data")

    # Build query
    query = select(AuditLogRead)

    if request.entity_type:
        query = query.where(AuditLogRead.entity_type == request.entity_type)
    if request.entity_id:
        query = query.where(AuditLogRead.entity_id == request.entity_id)
    if request.date_from:
        query = query.where(AuditLogRead.timestamp >= request.date_from)
    if request.date_to:
        query = query.where(AuditLogRead.timestamp <= request.date_to)

    # Order by timestamp (for audit trail integrity)
    query = query.order_by(AuditLogRead.timestamp.asc())

    # Execute
    result = await db.execute(query)
    records = result.scalars().all()

    # Convert to response
    items = [
        AuditLogReadResponse(
            id=str(r.id),
            user_id=r.user_id,
            timestamp=r.timestamp,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            export_format=r.export_format,
            record_count=r.record_count,
        )
        for r in records
    ]

    export = ComplianceExportResponse(
        record_count=len(items),
        export_timestamp=datetime.utcnow().isoformat() + "Z",
        generated_by=current_user.username,
        records=items,
    )

    return ApiResponse(
        data=export,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="export_compliance"),
    )
