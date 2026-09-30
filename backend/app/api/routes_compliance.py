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


@router.get("/covenants/{project_id}/history", response_model=ApiResponse[list[dict]])
async def get_covenant_history(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[list[dict]]:
    """Get 8-quarter covenant history for a project.

    Returns DSCR, LTV, and ICR trends with status (compliant/warning/breached).
    Required for drill-down views in compliance module.

    TODO: Implement actual query from loan_accounts + covenant_metrics tables
    For now returns mock data.
    """
    # Mock data structure: 8 quarters of covenant trends
    mock_trends = [
        {
            "covenant_type": "DSCR",
            "periods": [
                {"period": "Q1 2025", "value": 1.45, "threshold": 1.20, "status": "compliant"},
                {"period": "Q2 2025", "value": 1.38, "threshold": 1.20, "status": "compliant"},
                {"period": "Q3 2025", "value": 1.28, "threshold": 1.20, "status": "warning"},
                {"period": "Q4 2025", "value": 1.22, "threshold": 1.20, "status": "warning"},
                {"period": "Q1 2026", "value": 1.18, "threshold": 1.20, "status": "warning"},
                {"period": "Q2 2026", "value": 1.15, "threshold": 1.20, "status": "warning"},
                {"period": "Q3 2026", "value": 1.12, "threshold": 1.20, "status": "breached"},
                {"period": "Q4 2026", "value": 1.25, "threshold": 1.20, "status": "compliant"},
            ]
        }
    ]

    return ApiResponse(
        data=mock_trends,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="view_covenant_history"),
    )


@router.get("/alerts/{project_id}/remediations", response_model=ApiResponse[list[dict]])
async def get_alert_remediations(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[list[dict]]:
    """Get pre-expiry compliance alerts for license, PPA, and insurance.

    Returns upcoming expirations with days until expiry and required actions.
    Used for alert remediation drawer in compliance module.

    TODO: Implement actual query from water_licenses + ppa_agreements + documents tables
    For now returns mock data.
    """
    # Mock data structure: License, PPA, and Insurance expirations
    mock_alerts = [
        {
            "id": "lic-001",
            "type": "license",
            "name": "DoED Generation License",
            "expiryDate": "2026-12-15",
            "daysUntilExpiry": 76,
            "status": "warning",
            "description": "Nepal Ministry of Energy generation license",
        },
        {
            "id": "ppa-001",
            "type": "ppa",
            "name": "NEA Power Purchase Agreement",
            "expiryDate": "2054-06-30",
            "daysUntilExpiry": 10325,
            "status": "ok",
            "description": "30-year PPA starting from Commercial Operation Date",
        },
        {
            "id": "ins-001",
            "type": "insurance",
            "name": "Plant All-Risk Insurance",
            "expiryDate": "2027-03-31",
            "daysUntilExpiry": 183,
            "status": "warning",
            "description": "Comprehensive all-risk insurance covering plant and equipment",
        },
        {
            "id": "ins-002",
            "type": "insurance",
            "name": "Third-Party Liability Insurance",
            "expiryDate": "2026-11-30",
            "daysUntilExpiry": 61,
            "status": "critical",
            "description": "Professional liability and third-party coverage",
        },
    ]

    return ApiResponse(
        data=mock_alerts,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="view_alerts"),
    )


@router.post("/alert-actions/initiate", response_model=ApiResponse[dict])
async def initiate_alert_action(
    alert_id: str,
    alert_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[dict]:
    """Initiate remediation action for an alert (license renewal, PPA review, etc).

    Creates a workflow task for the compliance officer/legal team.
    Logs the action in the audit trail.

    TODO: Implement actual creation of workflow task and ApprovalRequest
    For now returns mock response.
    """
    # Mock response: workflow task created
    workflow_response = {
        "approval_request_id": f"apr-{alert_id}-{datetime.utcnow().timestamp()}",
        "alert_id": alert_id,
        "alert_type": alert_type,
        "status": "submitted",
        "created_at": datetime.utcnow().isoformat(),
        "assigned_to": "legal@bank.com",
        "message": f"Renewal workflow initiated for {alert_type}",
    }

    return ApiResponse(
        data=workflow_response,
        meta=_get_response_meta(),
        audit=_get_audit_metadata(user_id=current_user.username, action="initiate_alert_action"),
    )
