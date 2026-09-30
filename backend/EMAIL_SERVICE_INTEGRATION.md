# Email Service Integration Guide – Phase 8.3.2

## Quick Start

### 1. Default Setup (Mock Mode – Development)

No configuration needed. Emails are logged but not sent.

```bash
# App starts with EMAIL_BACKEND=mock by default
python -m uvicorn backend.app.main:app
```

Check logs for emails:
```
📧 [MOCK] Email to risk@bank.com
   Subject: ⚠️  Loan Exposure Alert: Daily Bank Export
   Body (3245 chars)
```

### 2. Production Setup (SMTP)

Set environment variables:

```bash
export EMAIL_BACKEND=smtp
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=your-app-password
export EMAIL_FROM=hpms-alerts@yourorg.com
```

Check logs for sent emails:
```
✅ Email sent to risk@bank.com: ⚠️  Loan Exposure Alert: Daily Bank Export
```

---

## How It Works

### Setup (Automatic)

Email service is initialized once on first use:

```python
from backend.app.services.email_service import get_email_service

email_service = get_email_service()  # Reads EMAIL_BACKEND env var
# Returns SMTPEmailProvider or MockEmailProvider
```

### Sending Alerts

Background executor automatically sends when violations detected:

```python
# In background_sync_executor.py
await self._send_alert_emails(
    email_addresses=schedule.alert_email_addresses,
    schedule_name=schedule.name,
    alerts=alerts,  # List[LoanExposureSyncAlertResponse]
)
```

This calls:

```python
email_service = get_email_service()
await email_service.send_loan_sync_alerts(
    schedule_name="Daily Bank Export",
    alerts=[alert1, alert2, ...],
    recipients=["risk@bank.com", "compliance@bank.com"],
)
```

### Email Content

**Automatically generated from alerts:**
- Severity badges (critical/high/medium/low)
- Alert summary (count by severity)
- Table with: Severity | Project | Alert Type | Value/Threshold | Message
- Action instructions
- HPMS footer

**Plain text + HTML versions** sent together for client compatibility.

---

## Configuration Options

### EMAIL_BACKEND

```bash
# Development: logs emails without sending
export EMAIL_BACKEND=mock

# Production: sends via SMTP
export EMAIL_BACKEND=smtp
```

### SMTP Settings

| Variable | Example | Notes |
|----------|---------|-------|
| SMTP_HOST | smtp.gmail.com | Email server hostname |
| SMTP_PORT | 587 | Port (usually 587 or 465) |
| SMTP_USER | your-email@gmail.com | Username for login |
| SMTP_PASSWORD | abc123xyz789 | Password or app-specific password |
| SMTP_TLS | true | Use TLS/STARTTLS (recommended) |
| EMAIL_FROM | hpms-alerts@bank.com | Sender address |

### Gmail Setup

1. Enable 2-factor authentication
2. Generate app-specific password: https://myaccount.google.com/apppasswords
3. Use that password in SMTP_PASSWORD

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # 16-char app password
export SMTP_TLS=true
```

### Office365 Setup

```bash
export SMTP_HOST=smtp.office365.com
export SMTP_PORT=587
export SMTP_USER=your-email@company.com
export SMTP_PASSWORD=your-password
export SMTP_TLS=true
```

### Custom SMTP Server

```bash
export SMTP_HOST=mail.yourcompany.com
export SMTP_PORT=587  # or 465 for SSL
export SMTP_USER=your-username
export SMTP_PASSWORD=your-password
export SMTP_TLS=true  # or false if SSL on port 465
```

---

## Testing

### Test 1: Mock Mode (No SMTP needed)

```bash
# Set mock backend
export EMAIL_BACKEND=mock

# Start app
python -m uvicorn backend.app.main:app

# Create sync schedule with alerts
curl -X POST /api/v1/loan-accounts/sync-schedule \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Schedule",
    "frequency": "hourly",
    "sync_source": "BANK_API",
    "source_config": {"webhook_url": "https://bank.com/api/loans"},
    "alert_on_dscr_below": 1.2,
    "alert_email_addresses": "test@example.com"
  }'

# Wait for next hour, check logs
docker logs hpms-backend | grep "📧 \[MOCK\]"
```

### Test 2: SMTP with Gmail

```bash
# Configure Gmail SMTP
export EMAIL_BACKEND=smtp
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
export SMTP_TLS=true

# Start app
python -m uvicorn backend.app.main:app

# Follow Test 1 above, check for:
docker logs hpms-backend | grep "✅ Email sent"
```

### Test 3: Python Unit Test

```python
import pytest
from backend.app.services.email_service import EmailService, MockEmailProvider
from backend.app.schemas.loan import LoanExposureSyncAlertResponse

@pytest.mark.asyncio
async def test_mock_email_alerts():
    service = EmailService(MockEmailProvider())
    
    alerts = [
        LoanExposureSyncAlertResponse(
            project_code="HYD-001",
            severity="critical",
            alert_type="DSCR_BELOW_THRESHOLD",
            current_value="0.95",
            threshold_value="1.20",
            message="DSCR below minimum covenant"
        )
    ]
    
    result = await service.send_loan_sync_alerts(
        schedule_name="Test Schedule",
        alerts=alerts,
        recipients=["test@example.com"]
    )
    
    assert result == True
```

---

## Troubleshooting

### Email Not Sending

**Check 1: EMAIL_BACKEND is set**
```bash
echo $EMAIL_BACKEND  # Should print "smtp" for production
```

**Check 2: SMTP credentials are correct**
```bash
# Test SMTP connection
python3 << EOF
import smtplib
try:
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login('your-email@gmail.com', 'your-app-password')
    print("✅ SMTP connection OK")
    server.quit()
except Exception as e:
    print(f"❌ SMTP error: {e}")
EOF
```

**Check 3: Schedule has alert_email_addresses set**
```sql
SELECT alert_email_addresses FROM loan_exposure_sync_schedules WHERE id = '...';
```

If NULL or empty, alerts won't be sent.

**Check 4: Check logs for errors**
```bash
docker logs hpms-backend | grep "❌ Failed to send"
```

### SMTP Connection Timeout

**Issue:** "Connection timeout"

**Fix:** Check firewall rules, ensure SMTP_PORT (587 or 465) is open

```bash
# Test port connectivity
nc -zv smtp.gmail.com 587
```

### SMTP Authentication Failed

**Issue:** "Login credentials invalid"

**Fixes:**
- Gmail: Use 16-character app password, not regular password
- Office365: Ensure 2FA not required (use app password)
- Custom SMTP: Verify username/password with admin

### Email Format Issues

**If HTML not rendering:**
- Client might not support multipart/alternative
- Check email client settings
- Plain text version is always sent as fallback

---

## Email Customization

### Change Email Template

Edit `EmailService._build_html_email()` in `services/email_service.py`:

```python
@staticmethod
def _build_html_email(...) -> str:
    # Customize HTML template here
    return f"""
    <html>
        <body>
            <!-- Your custom HTML -->
        </body>
    </html>
    """
```

### Change Sender Address

Set EMAIL_FROM:
```bash
export EMAIL_FROM=alerts@yourorg.com
```

Or in code:
```python
from backend.app.services.email_service import SMTPEmailProvider
provider = SMTPEmailProvider(
    smtp_host="...",
    ...,
    from_address="custom-sender@yourorg.com"
)
```

### Custom Email Provider

Implement EmailProvider interface:

```python
from backend.app.services.email_service import EmailProvider, EmailMessage

class SendGridEmailProvider(EmailProvider):
    async def send(self, message: EmailMessage) -> bool:
        # Use SendGrid API
        pass
```

Use it:
```python
from backend.app.services.email_service import EmailService

service = EmailService(SendGridEmailProvider(...))
```

---

## Production Checklist

- [ ] Set EMAIL_BACKEND=smtp
- [ ] Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD
- [ ] Test SMTP connection before deploying
- [ ] Set EMAIL_FROM to legitimate address
- [ ] Store credentials in secure secret manager (not .env)
- [ ] Configure alert_email_addresses in schedules
- [ ] Monitor email logs for failures
- [ ] Set up email bounce handling (future)
- [ ] Test end-to-end with sample schedule

---

## Architecture

```
App Startup
  ↓
get_email_service() called
  ↓
Read EMAIL_BACKEND env var
  ↓
Initialize Provider:
  - "smtp" → SMTPEmailProvider (SMTP_HOST, SMTP_USER, etc.)
  - "mock" → MockEmailProvider (logs only)
  ↓
Store in global _email_service singleton
  ↓
Ready to send
```

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Email send | 1-5 sec | SMTP roundtrip |
| Service init | <100ms | One-time on startup |
| Provider detection | <1ms | Reading env vars |

---

**Phase 8.3.2 – Email Service Integration**  
**Status:** ✅ Complete and production-ready  
**Support:** Check PHASE_8_3_2_SUMMARY.md for full details