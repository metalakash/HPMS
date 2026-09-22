"""Report export endpoints for PowerBI integration."""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.schemas.common import ApiResponse, AuditMetadata
from backend.app.schemas.report_schema import (
    ReportExportRequest,
    ReportExportResponse,
    ExportFilter,
)
from backend.app.services.report_service import ReportService
from backend.app.services.export_service import ExportService

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

        # Generate file if format is CSV or Excel
        download_url = None
        if request.format in ["csv", "excel"]:
            try:
                if request.format == "csv":
                    file_content = ExportService.generate_csv(request.report_id, rows)
                    content_type = "text/csv"
                else:  # excel
                    file_content = ExportService.generate_excel(request.report_id, rows)
                    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

                # Upload to S3 and get presigned URL
                if settings.STORAGE_BACKEND == "s3":
                    from backend.app.storage.s3_storage import S3StorageBackend
                    s3 = S3StorageBackend(
                        bucket_name=settings.S3_BUCKET_NAME,
                        region=settings.S3_REGION,
                        aws_access_key_id=settings.S3_ACCESS_KEY_ID or None,
                        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY or None,
                    )

                    filename = ExportService.get_export_filename(request.report_id, request.format)
                    await s3.upload_file(
                        file_content,
                        f"reports/{filename}",
                        content_type=content_type,
                        metadata={"report": request.report_id, "user": user_id},
                    )

                    download_url = await s3.get_presigned_url(
                        f"reports/{filename}",
                        expiration_seconds=settings.PRESIGNED_URL_EXPIRY_SECONDS,
                    )

                    logger.info(f"File uploaded and presigned URL created: {filename}")

            except Exception as e:
                logger.error(f"File export failed: {e}")
                # Continue without file download

        response_data = ReportExportResponse(
            report_id=request.report_id,
            format=request.format,
            record_count=count,
            export_timestamp=datetime.utcnow().isoformat() + "Z",
            filters_applied=filters_dict,
            data=rows if request.format == "json" else [],  # Don't return data if downloading file
            download_url=download_url,
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
