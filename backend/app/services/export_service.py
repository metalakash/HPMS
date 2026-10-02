"""Export service for generating CSV/Excel files from report data.

Handles file generation, S3 upload, and presigned URL creation.
"""

import logging
import io
import csv
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.services.report_dates import dual_stamp

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

        info = wb.create_sheet("Report info")
        info.append(["Report", report_id])
        info.append(["Generated (AD / BS)", dual_stamp()])
        info.append(["Records", len(rows)])
        info.column_dimensions["A"].width = 24
        info.column_dimensions["B"].width = 36

        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        return output.getvalue()

    @staticmethod
    def generate_word(
        report_id: str,
        rows: List[Dict[str, Any]],
        title: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """Generate a Word (.docx) report: title, AD/BS stamp, applied filters, data table.

        Returns b"" when there are no rows (same contract as CSV/Excel).
        """
        if not rows:
            logger.warning(f"No data to export for report: {report_id}")
            return b""

        from docx import Document
        from docx.enum.section import WD_ORIENT
        from docx.shared import Pt

        doc = Document()
        section = doc.sections[0]
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width, section.page_height = section.page_height, section.page_width

        doc.add_heading(title or report_id.replace("_", " ").title(), level=1)
        doc.add_paragraph(f"Generated: {dual_stamp()}")
        if filters:
            doc.add_paragraph("Filters: " + ", ".join(f"{k}={v}" for k, v in filters.items()))
        doc.add_paragraph(f"Records: {len(rows)}")

        fieldnames = list(rows[0].keys())
        table = doc.add_table(rows=1, cols=len(fieldnames))
        table.style = "Light Grid Accent 1"
        for cell, name in zip(table.rows[0].cells, fieldnames):
            cell.text = name
        for row in rows:
            cells = table.add_row().cells
            for cell, name in zip(cells, fieldnames):
                value = row.get(name)
                cell.text = "" if value is None else str(value)
        for r in table.rows:
            for cell in r.cells:
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.font.size = Pt(8)

        output = io.BytesIO()
        doc.save(output)
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

    FILE_MIME = {
        "csv": "text/csv",
        "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "json": "application/json",
    }

    @staticmethod
    def build_file(
        fmt: str,
        report_id: str,
        rows: List[Dict[str, Any]],
        filters: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, bytes]:
        """(mime type, content) for csv / excel / word / json. Raises ValueError for other formats."""
        if fmt == "csv":
            content = ExportService.generate_csv(report_id, rows)
        elif fmt == "excel":
            content = ExportService.generate_excel(report_id, rows)
        elif fmt == "word":
            content = ExportService.generate_word(report_id, rows, filters=filters)
        elif fmt == "json":
            content = ExportService.generate_json(report_id, rows, metadata={"filters": filters or {}}).encode("utf-8")
        else:
            raise ValueError(f"Unsupported export format: {fmt}")
        return ExportService.FILE_MIME[fmt], content

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
            "word": "docx",
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

        from backend.app.models.audit import AuditLogRead

        export_record = {
            "report_id": report_id,
            "format": format,
            "file_size_bytes": file_size_bytes,
            "file_url": file_url,
            "exported_by": user_id,
            "exported_at": datetime.utcnow().isoformat() + "Z",
        }

        # Exports are read access: they belong in the read-audit table. (AuditLog is the
        # hash-chained write log and needs state_hash/prev_hash, which nothing computes here.)
        audit_log = AuditLogRead(
            user_id=user_id,
            entity_type="report",
            entity_id=report_id,
            export_format=format,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )
        db.add(audit_log)
        await db.flush()

        logger.info(
            f"Export created: report_id={report_id}, format={format}, "
            f"size={file_size_bytes}, user={user_id}"
        )

        return export_record
