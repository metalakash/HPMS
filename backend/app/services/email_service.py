"""Email service for sending notifications (Phase 8.3.2)."""

import logging
import os
from typing import List, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from backend.app.schemas.loan import LoanExposureSyncAlertResponse

logger = logging.getLogger(__name__)


@dataclass
class EmailMessage:
    """Email message to send."""
    
    to: List[str]
    subject: str
    body_text: str
    body_html: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None


class EmailProvider(ABC):
    """Abstract email provider interface."""
    
    @abstractmethod
    async def send(self, message: EmailMessage) -> bool:
        """Send email. Return True on success, False on failure."""
        pass


class SMTPEmailProvider(EmailProvider):
    """SMTP-based email provider (Gmail, Office365, custom SMTP servers)."""
    
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int = 587,
        smtp_user: Optional[str] = None,
        smtp_password: Optional[str] = None,
        use_tls: bool = True,
        from_address: str = "noreply@hpms.local",
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.use_tls = use_tls
        self.from_address = from_address

    async def send(self, message: EmailMessage) -> bool:
        """Send email via SMTP."""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = message.subject
            msg["From"] = self.from_address
            msg["To"] = ", ".join(message.to)
            
            if message.cc:
                msg["Cc"] = ", ".join(message.cc)
            
            msg.attach(MIMEText(message.body_text, "plain"))
            
            if message.body_html:
                msg.attach(MIMEText(message.body_html, "html"))
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                
                recipients = message.to.copy()
                if message.cc:
                    recipients.extend(message.cc)
                if message.bcc:
                    recipients.extend(message.bcc)
                
                server.sendmail(self.from_address, recipients, msg.as_string())
            
            logger.info(f"✅ Email sent to {'"'"'{'"'"', '"'"'{'"'"'.join(message.to)}: {message.subject}")
            return True
        
        except Exception as e:
            logger.error(f"❌ Failed to send email: {e}", exc_info=True)
            return False


class MockEmailProvider(EmailProvider):
    """Mock email provider for testing (logs without sending)."""
    
    async def send(self, message: EmailMessage) -> bool:
        """Log email without sending."""
        logger.info(
            f"📧 [MOCK] Email to {'"'"'{'"'"', '"'"'{'"'"'.join(message.to)}\n"
            f"   Subject: {message.subject}\n"
            f"   Body ({len(message.body_text)} chars)"
        )
        return True


class EmailService:
    """Service for sending emails."""
    
    def __init__(self, provider: Optional[EmailProvider] = None):
        """Initialize with email provider."""
        self.provider = provider or self._get_default_provider()
    
    @staticmethod
    def _get_default_provider() -> EmailProvider:
        """Get email provider from environment or use mock."""
        email_backend = os.getenv("EMAIL_BACKEND", "mock").lower()
        
        if email_backend == "smtp":
            return SMTPEmailProvider(
                smtp_host=os.getenv("SMTP_HOST", "localhost"),
                smtp_port=int(os.getenv("SMTP_PORT", "587")),
                smtp_user=os.getenv("SMTP_USER"),
                smtp_password=os.getenv("SMTP_PASSWORD"),
                use_tls=os.getenv("SMTP_TLS", "true").lower() == "true",
                from_address=os.getenv("EMAIL_FROM", "noreply@hpms.local"),
            )
        else:
            return MockEmailProvider()
    
    async def send_loan_sync_alerts(
        self,
        schedule_name: str,
        alerts: List[LoanExposureSyncAlertResponse],
        recipients: List[str],
    ) -> bool:
        """Send loan sync alert emails."""
        if not recipients:
            logger.warning("No recipients configured for loan sync alerts")
            return False
        
        if not alerts:
            logger.info("No alerts to send")
            return True
        
        critical_count = sum(1 for a in alerts if a.severity == "critical")
        high_count = sum(1 for a in alerts if a.severity == "high")
        medium_count = sum(1 for a in alerts if a.severity == "medium")
        low_count = sum(1 for a in alerts if a.severity == "low")
        
        body_text = self._build_text_email(
            schedule_name, alerts, critical_count, high_count, medium_count, low_count
        )
        
        body_html = self._build_html_email(
            schedule_name, alerts, critical_count, high_count, medium_count, low_count
        )
        
        message = EmailMessage(
            to=recipients,
            subject=f"⚠️  Loan Exposure Alert: {schedule_name}",
            body_text=body_text,
            body_html=body_html,
        )
        
        return await self.provider.send(message)
    
    @staticmethod
    def _build_text_email(
        schedule_name: str,
        alerts: List[LoanExposureSyncAlertResponse],
        critical_count: int,
        high_count: int,
        medium_count: int,
        low_count: int,
    ) -> str:
        """Build plain text email."""
        lines = [
            "Loan Exposure Sync Alert",
            "=" * 50,
            "",
            f"Schedule: {schedule_name}",
            f"Timestamp: {datetime.utcnow().isoformat()}",
            "",
            f"Summary:",
            f"  • Critical: {critical_count}",
            f"  • High: {high_count}",
            f"  • Medium: {medium_count}",
            f"  • Low: {low_count}",
            f"  • Total: {len(alerts)}",
            "",
            "Violations Detected:",
            "-" * 50,
        ]
        
        for alert in sorted(alerts, key=lambda a: ("critical", "high", "medium", "low").index(a.severity)):
            lines.extend([
                "",
                f"[{alert.severity.upper()}] {alert.project_code}",
                f"  Type: {alert.alert_type}",
                f"  Current: {alert.current_value}",
                f"  Threshold: {alert.threshold_value}",
                f"  Message: {alert.message}",
            ])
        
        lines.extend([
            "",
            "=" * 50,
            "Please review these accounts and take corrective action.",
            "",
            "HPMS Loan Exposure Monitoring",
        ])
        
        return "\n".join(lines)
    
    @staticmethod
    def _build_html_email(
        schedule_name: str,
        alerts: List[LoanExposureSyncAlertResponse],
        critical_count: int,
        high_count: int,
        medium_count: int,
        low_count: int,
    ) -> str:
        """Build HTML email."""
        alert_rows = []
        
        for alert in sorted(alerts, key=lambda a: ("critical", "high", "medium", "low").index(a.severity)):
            severity_color = {
                "critical": "#dc3545",
                "high": "#fd7e14",
                "medium": "#ffc107",
                "low": "#17a2b8",
            }.get(alert.severity, "#6c757d")
            
            alert_rows.append(f"<tr style=""border-bottom: 1px solid #ddd;""><td style=""padding: 12px; color: {severity_color}; font-weight: bold;"">{alert.severity.upper()}</td><td style=""padding: 12px; font-weight: bold;"">{alert.project_code}</td><td style=""padding: 12px;"">{alert.alert_type}</td><td style=""padding: 12px;"">{alert.current_value} / {alert.threshold_value}</td><td style=""padding: 12px;"">{alert.message}</td></tr>")
        
        alert_rows_html = "".join(alert_rows)
        
        return f"""<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; color: #333; }}
        .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; }}
        .summary {{ margin: 20px 0; }}
        .summary-item {{ display: inline-block; margin-right: 20px; }}
        .summary-badge {{ display: inline-block; padding: 8px 12px; border-radius: 20px; font-weight: bold; }}
        .critical {{ background-color: #f8d7da; color: #721c24; }}
        .high {{ background-color: #fff3cd; color: #856404; }}
        .medium {{ background-color: #d1ecf1; color: #0c5460; }}
        .low {{ background-color: #d1ecf1; color: #0c5460; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        table th {{ background-color: #f8f9fa; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #dee2e6; }}
        .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h2>⚠️  Loan Exposure Sync Alert</h2>
        <p><strong>Schedule:</strong> {schedule_name}</p>
        <p><strong>Time:</strong> {datetime.utcnow().isoformat()}</p>
    </div>
    <div class="summary">
        <div class="summary-item"><span class="summary-badge critical">CRITICAL: {critical_count}</span></div>
        <div class="summary-item"><span class="summary-badge high">HIGH: {high_count}</span></div>
        <div class="summary-item"><span class="summary-badge medium">MEDIUM: {medium_count}</span></div>
        <div class="summary-item"><span class="summary-badge low">LOW: {low_count}</span></div>
    </div>
    <h3>Policy Violations ({len(alerts)} total)</h3>
    <table>
        <thead>
            <tr>
                <th>Severity</th>
                <th>Project</th>
                <th>Alert Type</th>
                <th>Value / Threshold</th>
                <th>Message</th>
            </tr>
        </thead>
        <tbody>
            {alert_rows_html}
        </tbody>
    </table>
    <div class="footer">
        <p>Please review these accounts and take corrective action.</p>
        <p>Nepal Hydropower Management System (HPMS) • Loan Exposure Monitoring</p>
    </div>
</body>
</html>"""


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create global email service instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


def set_email_service(service: EmailService):
    """Set global email service instance (for testing)."""
    global _email_service
    _email_service = service