"""Compliance report generation (Phase 5 Task 1)."""

import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime

logger = logging.getLogger(__name__)


class ComplianceReporter:
    """Generate compliance reports in various formats."""

    def __init__(self):
        """Initialize compliance reporter."""
        self.templates = {}

    def generate_summary_report(
        self,
        project_id: UUID,
        compliance_status: Dict,
        audit_trail: List,
    ) -> str:
        """Generate compliance summary report.

        Args:
            project_id: Project ID
            compliance_status: Compliance status dictionary
            audit_trail: Audit log entries

        Returns:
            Report as formatted string
        """
        try:
            report = f"""
COMPLIANCE SUMMARY REPORT
Generated: {datetime.utcnow().isoformat()}
Project: {project_id}

OVERALL METRICS
===============
Total Covenants: {compliance_status.get('total_covenants', 0)}
Total Checks: {compliance_status.get('total_checks', 0)}
Compliant: {compliance_status.get('compliant_checks', 0)}
Breaches: {compliance_status.get('breach_checks', 0)}
Compliance Rate: {compliance_status.get('compliance_rate', 0):.1f}%

ALERTS SUMMARY
==============
Total Alerts: {compliance_status.get('total_alerts', 0)}
Unacknowledged: {compliance_status.get('unacknowledged_alerts', 0)}

Critical: {compliance_status.get('alerts_by_severity', {}).get('critical', 0)}
High: {compliance_status.get('alerts_by_severity', {}).get('high', 0)}
Medium: {compliance_status.get('alerts_by_severity', {}).get('medium', 0)}
Low: {compliance_status.get('alerts_by_severity', {}).get('low', 0)}
Info: {compliance_status.get('alerts_by_severity', {}).get('info', 0)}

RECENT ACTIVITY
===============
"""
            # Add recent audit trail
            for entry in audit_trail[:10]:
                report += f"- {entry.timestamp}: {entry.action} by {entry.actor_name}\n"

            return report

        except Exception as e:
            logger.error(f"Error generating summary report: {e}")
            return ""

    def generate_csv_report(
        self,
        compliance_checks: List[Dict],
    ) -> str:
        """Generate compliance data as CSV.

        Args:
            compliance_checks: List of compliance check records

        Returns:
            CSV formatted string
        """
        try:
            lines = [
                "timestamp,covenant_id,project_id,metric_value,threshold,compliant,notes"
            ]

            for check in compliance_checks:
                line = (
                    f"{check.get('timestamp', '')},{check.get('covenant_id', '')},"
                    f"{check.get('project_id', '')},{check.get('metric_value', '')},"
                    f"{check.get('threshold', '')},{check.get('is_compliant', '')},"
                    f"\"{check.get('notes', '')}\""
                )
                lines.append(line)

            return "\n".join(lines)

        except Exception as e:
            logger.error(f"Error generating CSV report: {e}")
            return ""

    def generate_pdf_report(
        self,
        project_id: UUID,
        compliance_status: Dict,
    ) -> bytes:
        """Generate compliance report as PDF.

        Args:
            project_id: Project ID
            compliance_status: Compliance status

        Returns:
            PDF bytes or empty bytes if generation fails
        """
        try:
            # Try to import ReportLab
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.pdfgen import canvas
                from io import BytesIO
            except ImportError:
                logger.warning("ReportLab not available, returning empty PDF")
                return b""

            buffer = BytesIO()
            c = canvas.Canvas(buffer, pagesize=letter)
            width, height = letter

            # Title
            c.setFont("Helvetica-Bold", 16)
            c.drawString(50, height - 50, "COMPLIANCE REPORT")

            # Date
            c.setFont("Helvetica", 10)
            c.drawString(50, height - 70, f"Generated: {datetime.utcnow().isoformat()}")
            c.drawString(50, height - 90, f"Project: {project_id}")

            # Metrics section
            c.setFont("Helvetica-Bold", 12)
            c.drawString(50, height - 130, "Compliance Metrics")

            c.setFont("Helvetica", 10)
            y = height - 150
            metrics = [
                f"Total Covenants: {compliance_status.get('total_covenants', 0)}",
                f"Compliance Rate: {compliance_status.get('compliance_rate', 0):.1f}%",
                f"Compliant Checks: {compliance_status.get('compliant_checks', 0)}",
                f"Breaches: {compliance_status.get('breach_checks', 0)}",
                f"Unacknowledged Alerts: {compliance_status.get('unacknowledged_alerts', 0)}",
            ]

            for metric in metrics:
                c.drawString(50, y, metric)
                y -= 20

            # Save PDF
            c.save()
            buffer.seek(0)
            return buffer.getvalue()

        except Exception as e:
            logger.error(f"Error generating PDF report: {e}")
            return b""
