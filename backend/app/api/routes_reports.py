"""Report export endpoints for PowerBI integration."""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.schemas.common import ApiResponse, AuditMetadata
from backend.app.schemas.report_schema import (
    ReportExportRequest,
    ReportExportResponse,
    ExportFilter,
)
from backend.app.services.report_service import ReportService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/export", response_model=ApiResponse[ReportExportResponse])
async def export_report(
    request: ReportExportRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Query("SYSTEM", description="User ID (from X-User-ID header)"),
) -> ApiResponse[ReportExportResponse]:
    """Export report data for PowerBI integration.

    Supports three report types:
    - **portfolio**: Project overview with capacity, status, financial summary
    - **covenant_summary**: Loan account rates and sync status
    - **capex_progress**: Budget tracking and spending by category

    Query parameters:
    - **format**: json (default), csv, or excel
    - **filters**: date_range_start, date_range_end, province, status, facility_type

    **Returns:** Report rows in requested format + download URL (Phase 3)

    **Audit:** Export logged in AuditLogRead table with user_id, timestamp, record_count
    """

    try:
        # Generate report based on type
        if request.report_id == "portfolio":
            rows, count = await ReportService.export_portfolio_report(
                db, request.filters, user_id
            )
        elif request.report_id == "covenant_summary":
            rows, count = await ReportService.export_covenant_report(
                db, request.filters, user_id
            )
        elif request.report_id == "capex_progress":
            rows, count = await ReportService.export_capex_report(
                db, request.filters, user_id
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown report_id: {request.report_id}"
            )

        # Build response
        filters_dict = {}
        if request.filters:
            if request.filters.date_range_start:
                filters_dict["date_range_start"] = request.filters.date_range_start.isoformat()
            if request.filters.date_range_end:
                filters_dict["date_range_end"] = request.filters.date_range_end.isoformat()
            if request.filters.province:
                filters_dict["province"] = request.filters.province
            if request.filters.status:
                filters_dict["status"] = request.filters.status
            if request.filters.facility_type:
                filters_dict["facility_type"] = request.filters.facility_type

        response_data = ReportExportResponse(
            report_id=request.report_id,
            format=request.format,
            record_count=count,
            export_timestamp=datetime.utcnow().isoformat() + "Z",
            filters_applied=filters_dict,
            data=rows,
            download_url=None,  # Phase 3: add presigned S3 URL
        )

        return ApiResponse(
            data=response_data,
            meta={
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "version": "1.0",
            },
            audit=AuditMetadata(
                user_id=user_id,
                action="export",
                timestamp=datetime.utcnow().isoformat() + "Z",
            )
        )

    except ValueError as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error generating report: {e}")
        raise HTTPException(status_code=500, detail="Report generation failed")
