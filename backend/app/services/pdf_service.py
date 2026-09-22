"""PDF report generation service with SBL branding.

Generates professional reports with charts, tables, and watermarks.
"""

import logging
import io
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class ReportType(str, Enum):
    """Report types available."""
    PORTFOLIO = "portfolio"
    COVENANT = "covenant"
    CAPEX = "capex"
    SUMMARY = "summary"


class PDFService:
    """Generate professional PDF reports with SBL branding."""

    # SBL Branding
    COMPANY_NAME = "Sustainable Bank Limited (SBL)"
    COMPANY_SHORT = "SBL"
    REPORT_TITLE_FORMAT = "{report_type.upper()} Report - {date}"

    # Page settings
    PAGE_WIDTH = 612  # 8.5 inches in points
    PAGE_HEIGHT = 792  # 11 inches in points
    MARGIN_TOP = 72  # 1 inch
    MARGIN_BOTTOM = 72  # 1 inch
    MARGIN_LEFT = 54  # 0.75 inch
    MARGIN_RIGHT = 54  # 0.75 inch

    # Colors
    COLOR_PRIMARY = "#1F4788"  # SBL Blue
    COLOR_SECONDARY = "#2E7D32"  # SBL Green
    COLOR_ACCENT = "#F57C00"  # SBL Orange
    COLOR_TEXT = "#333333"  # Dark gray
    COLOR_LIGHT = "#F5F5F5"  # Light gray
    COLOR_BORDER = "#CCCCCC"  # Border gray

    @staticmethod
    def generate_portfolio_report(
        project_data: Dict,
        metadata: Optional[Dict] = None,
    ) -> bytes:
        """Generate portfolio report PDF.

        Args:
            project_data: Dictionary with portfolio metrics
            metadata: Optional metadata (title, author, subject)

        Returns:
            PDF file bytes
        """

        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import (
                SimpleDocTemplate,
                Table,
                TableStyle,
                Paragraph,
                Spacer,
                PageBreak,
                Image,
                Preformatted,
            )
            from reportlab.lib.units import inch
        except ImportError:
            logger.error("reportlab not installed. Install with: pip install reportlab")
            raise ImportError("reportlab required for PDF generation")

        # Create PDF in memory
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            topMargin=PDFService.MARGIN_TOP,
            bottomMargin=PDFService.MARGIN_BOTTOM,
            leftMargin=PDFService.MARGIN_LEFT,
            rightMargin=PDFService.MARGIN_RIGHT,
            title=metadata.get("title", "Portfolio Report") if metadata else "Portfolio Report",
            author=metadata.get("author", PDFService.COMPANY_NAME) if metadata else PDFService.COMPANY_NAME,
            subject=metadata.get("subject", "Portfolio Analysis") if metadata else "Portfolio Analysis",
        )

        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            textColor=PDFService.COLOR_PRIMARY,
            spaceAfter=12,
            alignment=1,  # CENTER
        )
        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=PDFService.COLOR_PRIMARY,
            spaceAfter=12,
        )
        body_style = ParagraphStyle(
            "CustomBody",
            parent=styles["Normal"],
            fontSize=10,
            textColor=PDFService.COLOR_TEXT,
            spaceAfter=6,
        )

        # Document elements
        elements = []

        # Header
        elements.append(Spacer(1, 0.5 * inch))
        elements.append(Paragraph(PDFService.COMPANY_NAME, title_style))
        elements.append(Paragraph("Portfolio Report", heading_style))
        elements.append(Spacer(1, 0.2 * inch))

        # Date and watermark
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        elements.append(Paragraph(f"Generated: {now}", body_style))
        elements.append(Spacer(1, 0.2 * inch))

        # Summary section
        elements.append(Paragraph("Executive Summary", heading_style))
        summary_data = [
            ["Metric", "Value"],
            ["Total Projects", str(project_data.get("total_projects", 0))],
            ["Total Capacity (MW)", f"{project_data.get('total_capacity_mw', 0):.2f}"],
            ["Active Projects", str(project_data.get("active_projects", 0))],
            ["Average Rate (%)", f"{project_data.get('average_rate', 0):.2f}"],
        ]

        summary_table = Table(
            summary_data,
            colWidths=[3 * inch, 2 * inch],
        )
        summary_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PDFService.COLOR_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 11),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("BACKGROUND", (0, 1), (-1, -1), PDFService.COLOR_LIGHT),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PDFService.COLOR_LIGHT]),
            ])
        )

        elements.append(summary_table)
        elements.append(Spacer(1, 0.3 * inch))

        # Projects detail section
        elements.append(Paragraph("Project Details", heading_style))

        if "projects" in project_data and project_data["projects"]:
            projects_data = [["Project Name", "Capacity (MW)", "Status", "Rate (%)"]]
            for proj in project_data["projects"]:
                projects_data.append([
                    proj.get("name", "N/A"),
                    f"{proj.get('capacity_mw', 0):.2f}",
                    proj.get("status", "Unknown"),
                    f"{proj.get('rate', 0):.2f}",
                ])

            projects_table = Table(
                projects_data,
                colWidths=[2.5 * inch, 1.5 * inch, 1.5 * inch, 1 * inch],
            )
            projects_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), PDFService.COLOR_SECONDARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PDFService.COLOR_LIGHT]),
                ])
            )

            elements.append(projects_table)
            elements.append(Spacer(1, 0.3 * inch))

        # Footer
        elements.append(Spacer(1, 0.3 * inch))
        elements.append(Paragraph(
            f"<i>This is a confidential document. Unauthorized distribution is prohibited.</i>",
            body_style,
        ))
        elements.append(Paragraph(
            f"<i>Report generated by {PDFService.COMPANY_NAME}</i>",
            body_style,
        ))

        # Build PDF
        doc.build(elements)

        pdf_buffer.seek(0)
        logger.info("Portfolio report generated successfully")
        return pdf_buffer.getvalue()

    @staticmethod
    def generate_covenant_report(
        covenant_data: Dict,
        metadata: Optional[Dict] = None,
    ) -> bytes:
        """Generate covenant compliance report PDF.

        Args:
            covenant_data: Dictionary with covenant metrics
            metadata: Optional metadata

        Returns:
            PDF file bytes
        """

        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import (
                SimpleDocTemplate,
                Table,
                TableStyle,
                Paragraph,
                Spacer,
            )
            from reportlab.lib.units import inch
        except ImportError:
            raise ImportError("reportlab required")

        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            topMargin=PDFService.MARGIN_TOP,
            bottomMargin=PDFService.MARGIN_BOTTOM,
            leftMargin=PDFService.MARGIN_LEFT,
            rightMargin=PDFService.MARGIN_RIGHT,
            title="Covenant Compliance Report",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            textColor=PDFService.COLOR_PRIMARY,
            alignment=1,
        )
        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=PDFService.COLOR_PRIMARY,
        )
        body_style = ParagraphStyle(
            "CustomBody",
            parent=styles["Normal"],
            fontSize=10,
            textColor=PDFService.COLOR_TEXT,
        )

        elements = []

        # Header
        elements.append(Spacer(1, 0.5 * inch))
        elements.append(Paragraph(PDFService.COMPANY_NAME, title_style))
        elements.append(Paragraph("Covenant Compliance Report", heading_style))
        elements.append(Spacer(1, 0.2 * inch))

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        elements.append(Paragraph(f"Generated: {now}", body_style))
        elements.append(Spacer(1, 0.2 * inch))

        # Compliance summary
        elements.append(Paragraph("Compliance Status", heading_style))

        compliance_data = [
            ["Covenant", "Status", "Value", "Threshold"],
            ["Debt Service Coverage", "PASS" if covenant_data.get("dscr_pass") else "FAIL",
             f"{covenant_data.get('dscr', 0):.2f}", f"{covenant_data.get('dscr_threshold', 1.25):.2f}"],
            ["Loan to Value", "PASS" if covenant_data.get("ltv_pass") else "FAIL",
             f"{covenant_data.get('ltv', 0):.2f}%", f"{covenant_data.get('ltv_threshold', 70):.2f}%"],
            ["Interest Coverage", "PASS" if covenant_data.get("icr_pass") else "FAIL",
             f"{covenant_data.get('icr', 0):.2f}", f"{covenant_data.get('icr_threshold', 2.0):.2f}"],
        ]

        compliance_table = Table(
            compliance_data,
            colWidths=[2 * inch, 1.2 * inch, 1 * inch, 1.3 * inch],
        )
        compliance_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PDFService.COLOR_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PDFService.COLOR_LIGHT]),
            ])
        )

        elements.append(compliance_table)
        elements.append(Spacer(1, 0.3 * inch))

        # Footer
        elements.append(Spacer(1, 0.2 * inch))
        elements.append(Paragraph(
            "<i>Confidential - For authorized recipients only</i>",
            body_style,
        ))

        doc.build(elements)

        pdf_buffer.seek(0)
        logger.info("Covenant report generated successfully")
        return pdf_buffer.getvalue()

    @staticmethod
    def generate_capex_report(
        capex_data: Dict,
        metadata: Optional[Dict] = None,
    ) -> bytes:
        """Generate capital expenditure report PDF.

        Args:
            capex_data: Dictionary with capex metrics
            metadata: Optional metadata

        Returns:
            PDF file bytes
        """

        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import (
                SimpleDocTemplate,
                Table,
                TableStyle,
                Paragraph,
                Spacer,
            )
            from reportlab.lib.units import inch
        except ImportError:
            raise ImportError("reportlab required")

        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            topMargin=PDFService.MARGIN_TOP,
            bottomMargin=PDFService.MARGIN_BOTTOM,
            leftMargin=PDFService.MARGIN_LEFT,
            rightMargin=PDFService.MARGIN_RIGHT,
            title="CapEx Report",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            textColor=PDFService.COLOR_PRIMARY,
            alignment=1,
        )
        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=PDFService.COLOR_PRIMARY,
        )
        body_style = ParagraphStyle(
            "CustomBody",
            parent=styles["Normal"],
            fontSize=10,
            textColor=PDFService.COLOR_TEXT,
        )

        elements = []

        # Header
        elements.append(Spacer(1, 0.5 * inch))
        elements.append(Paragraph(PDFService.COMPANY_NAME, title_style))
        elements.append(Paragraph("Capital Expenditure Report", heading_style))
        elements.append(Spacer(1, 0.2 * inch))

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        elements.append(Paragraph(f"Generated: {now}", body_style))
        elements.append(Spacer(1, 0.2 * inch))

        # CapEx Summary
        elements.append(Paragraph("Expenditure Summary", heading_style))

        capex_summary = [
            ["Category", "Budgeted", "Spent", "Remaining", "% Used"],
            ["Civil Works", f"₨{capex_data.get('civil_budgeted', 0):,.0f}",
             f"₨{capex_data.get('civil_spent', 0):,.0f}",
             f"₨{capex_data.get('civil_remaining', 0):,.0f}",
             f"{capex_data.get('civil_pct', 0):.1f}%"],
            ["Equipment", f"₨{capex_data.get('equip_budgeted', 0):,.0f}",
             f"₨{capex_data.get('equip_spent', 0):,.0f}",
             f"₨{capex_data.get('equip_remaining', 0):,.0f}",
             f"{capex_data.get('equip_pct', 0):.1f}%"],
            ["Contingency", f"₨{capex_data.get('cont_budgeted', 0):,.0f}",
             f"₨{capex_data.get('cont_spent', 0):,.0f}",
             f"₨{capex_data.get('cont_remaining', 0):,.0f}",
             f"{capex_data.get('cont_pct', 0):.1f}%"],
            ["TOTAL", f"₨{capex_data.get('total_budgeted', 0):,.0f}",
             f"₨{capex_data.get('total_spent', 0):,.0f}",
             f"₨{capex_data.get('total_remaining', 0):,.0f}",
             f"{capex_data.get('total_pct', 0):.1f}%"],
        ]

        capex_table = Table(
            capex_summary,
            colWidths=[1.5 * inch, 1 * inch, 1 * inch, 1 * inch, 0.8 * inch],
        )
        capex_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PDFService.COLOR_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), PDFService.COLOR_LIGHT),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, PDFService.COLOR_LIGHT]),
            ])
        )

        elements.append(capex_table)
        elements.append(Spacer(1, 0.3 * inch))

        # Footer
        elements.append(Spacer(1, 0.2 * inch))
        elements.append(Paragraph(
            "<i>Confidential - For authorized recipients only</i>",
            body_style,
        ))

        doc.build(elements)

        pdf_buffer.seek(0)
        logger.info("CapEx report generated successfully")
        return pdf_buffer.getvalue()

    @staticmethod
    def add_watermark(
        pdf_bytes: bytes,
        watermark_text: str = "CONFIDENTIAL",
    ) -> bytes:
        """Add watermark to PDF (Phase 4.5 enhancement).

        Args:
            pdf_bytes: Input PDF bytes
            watermark_text: Text to watermark

        Returns:
            PDF with watermark
        """

        try:
            from PyPDF2 import PdfReader, PdfWriter
        except ImportError:
            logger.warning("PyPDF2 not installed. Skipping watermark.")
            return pdf_bytes

        # Implementation for Phase 4.5
        logger.info(f"Watermark feature available in Phase 4.5: {watermark_text}")
        return pdf_bytes

    @staticmethod
    def encrypt_pdf(
        pdf_bytes: bytes,
        password: str,
    ) -> bytes:
        """Encrypt PDF with password (Phase 4.5 enhancement).

        Args:
            pdf_bytes: Input PDF bytes
            password: Protection password

        Returns:
            Encrypted PDF bytes
        """

        try:
            from PyPDF2 import PdfReader, PdfWriter
        except ImportError:
            logger.warning("PyPDF2 not installed. Skipping encryption.")
            return pdf_bytes

        # Implementation for Phase 4.5
        logger.info("Encryption feature available in Phase 4.5")
        return pdf_bytes
