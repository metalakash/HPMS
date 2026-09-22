"""Email service for export notifications.

Sends export delivery emails with download links via SMTP.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)


class EmailService:
    """Send emails for export notifications."""

    def __init__(
        self,
        smtp_server: str,
        smtp_port: int = 587,
        sender_email: str = "hpms@sbl.local",
        sender_name: str = "HPMS Export Service",
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_tls: bool = True,
    ):
        """Initialize email service.

        Args:
            smtp_server: SMTP server hostname
            smtp_port: SMTP port (default 587 for TLS)
            sender_email: From email address
            sender_name: From display name
            username: SMTP username (optional)
            password: SMTP password (optional)
            use_tls: Use TLS encryption (default True)
        """

        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.sender_email = sender_email
        self.sender_name = sender_name
        self.username = username
        self.password = password
        self.use_tls = use_tls

    async def send_export_notification(
        self,
        recipients: List[str],
        report_id: str,
        export_format: str,
        download_url: str,
        record_count: int,
        file_size_bytes: Optional[int] = None,
        subject_template: Optional[str] = None,
        body_template: Optional[str] = None,
    ) -> bool:
        """Send export notification email.

        Args:
            recipients: List of email addresses
            report_id: Type of report (portfolio, covenant, capex)
            export_format: File format (csv, excel, json)
            download_url: S3 presigned download URL
            record_count: Number of rows in export
            file_size_bytes: Optional file size
            subject_template: Optional custom subject template
            body_template: Optional custom body template

        Returns:
            True if email sent, False otherwise
        """

        try:
            # Build email content
            subject = subject_template or self._default_subject(report_id, export_format)
            body = body_template or self._default_body(
                report_id, export_format, download_url, record_count, file_size_bytes
            )

            # Send to each recipient
            for recipient in recipients:
                success = await self._send_email(
                    recipient=recipient,
                    subject=subject,
                    body=body,
                )

                if not success:
                    logger.warning(f"Failed to send email to {recipient}")
                    return False

            logger.info(f"Export notification sent to {len(recipients)} recipients")
            return True

        except Exception as e:
            logger.error(f"Email service error: {e}")
            return False

    async def _send_email(
        self,
        recipient: str,
        subject: str,
        body: str,
    ) -> bool:
        """Send email via SMTP.

        Args:
            recipient: Email address
            subject: Email subject
            body: Email body (HTML or plain text)

        Returns:
            True if sent, False otherwise
        """

        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.sender_name} <{self.sender_email}>"
            msg["To"] = recipient

            # Add body (try HTML first, fall back to plain text)
            if body.startswith("<"):
                msg.attach(MIMEText(body, "html"))
            else:
                msg.attach(MIMEText(body, "plain"))

            # Send via SMTP
            async with aiosmtplib.SMTP(hostname=self.smtp_server, port=self.smtp_port) as smtp:
                if self.use_tls:
                    await smtp.starttls()

                if self.username and self.password:
                    await smtp.login(self.username, self.password)

                await smtp.send_message(msg)

            logger.info(f"Email sent to {recipient}: {subject}")
            return True

        except Exception as e:
            logger.error(f"SMTP error sending to {recipient}: {e}")
            return False

    @staticmethod
    def _default_subject(report_id: str, export_format: str) -> str:
        """Generate default email subject."""
        report_name = report_id.replace("_", " ").title()
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        return f"[HPMS] {report_name} Export ({export_format.upper()}) - {timestamp}"

    @staticmethod
    def _default_body(
        report_id: str,
        export_format: str,
        download_url: str,
        record_count: int,
        file_size_bytes: Optional[int] = None,
    ) -> str:
        """Generate default email body."""

        report_name = report_id.replace("_", " ").title()
        file_size_str = ""
        if file_size_bytes:
            if file_size_bytes < 1024 * 1024:  # < 1MB
                file_size_str = f"({file_size_bytes / 1024:.1f} KB)"
            else:
                file_size_str = f"({file_size_bytes / (1024 * 1024):.1f} MB)"

        return f"""
<html>
<body style="font-family: Arial, sans-serif; color: #333;">

<h2>SBL HPMS Export Notification</h2>

<p>Your scheduled export is ready for download:</p>

<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
    <tr style="background-color: #f5f5f5;">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Report</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">{report_name}</td>
    </tr>
    <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Format</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">{export_format.upper()}</td>
    </tr>
    <tr style="background-color: #f5f5f5;">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Records</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">{record_count:,}</td>
    </tr>
    <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Exported</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</td>
    </tr>
    {f'<tr style="background-color: #f5f5f5;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>File Size</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{file_size_str}</td></tr>' if file_size_bytes else ''}
</table>

<p>
    <a href="{download_url}" style="display: inline-block; padding: 10px 20px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
        Download File
    </a>
</p>

<p style="color: #666; font-size: 12px;">
    <strong>Note:</strong> Download link expires in 1 hour. After expiry, please request a new export.<br/>
    This is an automated message. Please do not reply to this email.
</p>

<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

<p style="color: #999; font-size: 11px;">
    SBL Hydropower Project Management System<br/>
    © 2026 Sanima Bank Limited
</p>

</body>
</html>
"""


class MockEmailService(EmailService):
    """Mock email service for development (logs instead of sending).

    Useful for testing without a real SMTP server.
    """

    async def _send_email(
        self,
        recipient: str,
        subject: str,
        body: str,
    ) -> bool:
        """Log email instead of sending."""

        logger.info(
            f"[MOCK EMAIL] To: {recipient}\n"
            f"Subject: {subject}\n"
            f"Body preview: {body[:100]}..."
        )

        return True
