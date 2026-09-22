"""Export service for generating CSV/Excel files from report data.

Handles file generation, S3 upload, and presigned URL creation.
"""

import logging
import io
import csv
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ExportService:
    """Generate and export report data to files."""

    @staticmethod
    def generate_csv(
        report_id: str,
        rows: List[Dict[str, Any]],
    ) -> bytes:
        """Generate CSV file from report rows.

        Args:
            report_id: Type of report (for naming)
            rows: List of report row dicts

        Returns:
            CSV file content as bytes
        """

        if not rows:
            logger.warning(f"No data to export for report: {report_id}")
            return b""

        # Get column headers from first row
        fieldnames = list(rows[0].keys())

        # Generate CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

        # Convert to bytes with UTF-8 BOM for Excel compatibility
        csv_content = output.getvalue()
        bom = '﻿'  # UTF-8 BOM
        return (bom + csv_content).encode('utf-8')

    @staticmethod
    def generate_excel(
        report_id: str,
        rows: List[Dict[str, Any]],
    ) -> bytes:
        """Generate Excel file from report rows.

        Args:
            report_id: Type of report (for naming)
            rows: List of report row dicts

        Returns:
            Excel file content as bytes
        """

        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment
        except ImportError:
            logger.error("openpyxl not installed. Install with: pip install openpyxl")
            return b""

        if not rows:
            logger.warning(f"No data to export for report: {report_id}")
            return b""

        # Create workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = report_id[:31]  # Sheet name max 31 chars

        # Write headers
        fieldnames = list(rows[0].keys())
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")

        for col_idx, fieldname in enumerate(fieldnames, start=1):
            cell = ws.cell(row=1, column=col_idx)
            cell.value = fieldname
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Write data rows
        for row_idx, row_data in enumerate(rows, start=2):
            for col_idx, fieldname in enumerate(fieldnames, start=1):
                value = row_data.get(fieldname)
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.value = value
                cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)

        # Auto-size columns
        for col_idx, fieldname in enumerate(fieldnames, start=1):
            max_length = max(
                len(str(row.get(fieldname, ""))) for row in rows
            )
            max_length = min(max_length + 2, 50)  # Cap at 50
            ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = max_length

        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        return output.getvalue()

    @staticmethod
    def generate_json(
        report_id: str,
        rows: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate JSON file from report rows.

        Args:
            report_id: Type of report
            rows: List of report row dicts
            metadata: Optional metadata to include

        Returns:
            JSON string
        """

        output = {
            "report_id": report_id,
            "export_timestamp": datetime.utcnow().isoformat() + "Z",
            "record_count": len(rows),
            "metadata": metadata or {},
            "data": rows,
        }

        return json.dumps(output, indent=2, default=str)

    @staticmethod
    def get_export_filename(
        report_id: str,
        format: str,
    ) -> str:
        """Generate export filename.

        Args:
            report_id: Type of report
            format: File format (csv, excel, json)

        Returns:
            Filename with timestamp
        """

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        extensions = {
            "csv": "csv",
            "excel": "xlsx",
            "json": "json",
        }
        ext = extensions.get(format, "txt")

        return f"{report_id}_export_{timestamp}.{ext}"

    @staticmethod
    async def create_export_record(
        db: AsyncSession,
        report_id: str,
        format: str,
        file_size_bytes: int,
        file_url: Optional[str],
        user_id: str,
    ) -> dict:
        """Create audit record for export.

        Args:
            db: Database session
            report_id: Type of report
            format: File format
            file_size_bytes: File size
            file_url: S3 URL (or None if in-memory)
            user_id: Who exported

        Returns:
            Export record dict
        """

        from backend.app.models.audit import AuditLog

        export_record = {
            "report_id": report_id,
            "format": format,
            "file_size_bytes": file_size_bytes,
            "file_url": file_url,
            "exported_by": user_id,
            "exported_at": datetime.utcnow().isoformat() + "Z",
        }

        # Log to audit trail
        audit_log = AuditLog(
            user_id=user_id,
            entity_type="report",
            entity_id=report_id,
            action="export",
            details=f"Exported {format} file ({file_size_bytes} bytes)",
        )
        db.add(audit_log)
        await db.flush()

        logger.info(
            f"Export created: report_id={report_id}, format={format}, "
            f"size={file_size_bytes}, user={user_id}"
        )

        return export_record
