"""Report export endpoints for PowerBI integration and PDF generation."""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.financial import LoanAccount
from backend.app.config import settings
from backend.app.schemas.common import ApiResponse, AuditMetadata
from backend.app.schemas.report_schema import (
    ReportExportRequest,
    ReportExportResponse,
    ExportFilter,
)
from backend.app.services.report_service import ReportService
from backend.app.services.export_service import ExportService
from backend.app.services.pdf_service import PDFService, ReportType
from backend.app.security.auth_middleware import CurrentUser, get_current_user, require_role
from backend.app.security.ldap_provider import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

# Reports cover the whole portfolio, so only roles that may see every project
# (see RLSService) can generate them.
require_portfolio_access = require_role(UserRole.ADMIN, UserRole.AUDITOR)

ACTIVE_PIPELINE_STATUSES = {"under_construction", "under_operation"}


def _capex_bucket(category: Optional[str]) -> str:
    """Map a free-text budget category onto the capex PDF's civil / equipment / contingency rows."""
    name = (category or "").lower()
    if "civil" in name:
        return "civil"
    if "equip" in name or "electro" in name or "mechanical" in name:
        return "equip"
    return "cont"


@router.post("/export", response_model=ApiResponse[ReportExportResponse])
async def export_report(
    request: ReportExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_portfolio_access),
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

    user_id = current_user.username

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

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error generating report: {e}")
        raise HTTPException(status_code=500, detail="Report generation failed")


@router.post("/pdf/portfolio")
async def export_portfolio_pdf(
    current_user: CurrentUser = Depends(require_portfolio_access),
    db: AsyncSession = Depends(get_db),
):
    """Export portfolio report as PDF with SBL branding.

    Includes:
    - Executive summary with project metrics
    - Project details table
    - Capacity distribution
    - Financial overview

    Returns: PDF file with Content-Disposition attachment header
    """

    try:
        # Get portfolio data
        rows, count = await ReportService.export_portfolio_report(
            db, None, current_user.username
        )

        # Transform to PDF-friendly format
        avg_rate = (await db.execute(select(func.avg(LoanAccount.interest_rate_pct)))).scalar()
        portfolio_data = {
            "total_projects": count,
            "total_capacity_mw": sum(r["capacity_mw"] for r in rows),
            "active_projects": sum(1 for r in rows if r["pipeline_status"] in ACTIVE_PIPELINE_STATUSES),
            "average_rate": float(avg_rate) if avg_rate is not None else None,
            "projects": [
                {
                    "name": r["project_name_en"],
                    "capacity_mw": r["capacity_mw"],
                    "status": r["pipeline_status"],
                    "rate": None,  # rates live on loan accounts, not projects
                }
                for r in rows[:10]
            ],
        }

        # Generate PDF
        pdf_bytes = PDFService.generate_portfolio_report(
            portfolio_data,
            metadata={
                "title": "Portfolio Report",
                "author": "SBL HPMS",
                "subject": "Portfolio Analysis",
            }
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=portfolio-report.pdf"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Portfolio PDF generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate portfolio report"
        )


@router.post("/pdf/covenant")
async def export_covenant_pdf(
    current_user: CurrentUser = Depends(require_portfolio_access),
    db: AsyncSession = Depends(get_db),
):
    """Export covenant compliance report as PDF.

    Includes:
    - Covenant status summary
    - DSCR, LTV, ICR metrics
    - Compliance status indicators

    Returns: PDF file with Content-Disposition attachment header
    """

    try:
        # DSCR/LTV/ICR are not stored anywhere yet (the compliance engine is in-memory only).
        # Rendering zeros would print FAIL for every covenant, so refuse instead.
        raise HTTPException(
            status_code=501,
            detail="Covenant metrics (DSCR, LTV, ICR) are not persisted yet; covenant PDF is unavailable",
        )

        # Generate PDF
        pdf_bytes = PDFService.generate_covenant_report(
            covenant_data,
            metadata={
                "title": "Covenant Compliance Report",
                "author": "SBL HPMS",
                "subject": "Covenant Analysis",
            }
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=covenant-report.pdf"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Covenant PDF generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate covenant report"
        )


@router.post("/pdf/capex")
async def export_capex_pdf(
    current_user: CurrentUser = Depends(require_portfolio_access),
    db: AsyncSession = Depends(get_db),
):
    """Export capital expenditure report as PDF.

    Includes:
    - Expenditure summary by category
    - Budget vs. actual spending
    - Remaining budget and % utilization

    Returns: PDF file with Content-Disposition attachment header
    """

    try:
        # Get CapEx data
        rows, count = await ReportService.export_capex_report(
            db, None, current_user.username
        )

        # Transform to PDF-friendly format: one row per budget line, summed by category
        capex_data = {}
        for key in ("civil", "equip", "cont", "total"):
            capex_data[f"{key}_budgeted"] = 0.0
            capex_data[f"{key}_spent"] = 0.0
            capex_data[f"{key}_pct"] = 0.0
        for r in rows:
            budgeted = r["budgeted_amount"] or 0.0
            spent = r["actual_amount"] or 0.0
            for key in (_capex_bucket(r["budget_category"]), "total"):
                capex_data[f"{key}_budgeted"] += budgeted
                capex_data[f"{key}_spent"] += spent
        for key in ("civil", "equip", "cont", "total"):
            capex_data[f"{key}_remaining"] = capex_data[f"{key}_budgeted"] - capex_data[f"{key}_spent"]

        # Calculate percentages
        for key in ["civil", "equip", "cont"]:
            budgeted = capex_data.get(f"{key}_budgeted", 0)
            spent = capex_data.get(f"{key}_spent", 0)
            if budgeted > 0:
                capex_data[f"{key}_pct"] = (spent / budgeted) * 100

        # Calculate total percentage
        if capex_data["total_budgeted"] > 0:
            capex_data["total_pct"] = (capex_data["total_spent"] / capex_data["total_budgeted"]) * 100

        # Generate PDF
        pdf_bytes = PDFService.generate_capex_report(
            capex_data,
            metadata={
                "title": "Capital Expenditure Report",
                "author": "SBL HPMS",
                "subject": "CapEx Analysis",
            }
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=capex-report.pdf"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CapEx PDF generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate capex report"
        )
