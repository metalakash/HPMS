# Background Scheduler Setup – Phase 8.3.1

## Overview

The **Background Sync Executor** runs scheduled loan data syncs automatically using APScheduler. It:

1. Checks every minute for due schedules
2. Fetches data from bank APIs, Finacle CBS, or files
3. Posts to Phase 8.2 ingestion endpoint
4. Detects policy violations (DSCR, LTV, concentration)
5. Sends alert emails to stakeholders
6. Logs all operations to sync_history table

---

## Installation

### Step 1: Install APScheduler

```bash
pip install apscheduler httpx
```

Or add to requirements.txt:

```
apscheduler>=3.10.0
httpx>=0.24.0
```

### Step 2: Verify Installation

```bash
python -c "import apscheduler; print(apscheduler.__version__)"
```

---

## How It Works

### Startup Process

When the FastAPI app starts:

```
1. main.py startup_event() triggers
2. Creates BackgroundSyncExecutor instance
3. Initializes async HTTP client
4. Creates APScheduler BackgroundScheduler
5. Adds job: execute_due_syncs() every 1 minute
6. Scheduler starts in background
```

### Execution Flow

Every minute:

```
execute_due_syncs()
  ↓
For each active schedule:
  ↓
Check if due (frequency + time match)
  ↓
If due:
  a. Fetch data from source (bank API, CBS, etc.)
  b. POST to /api/v1/loan-accounts/exposure-sync (Phase 8.2)
  c. Check for policy violations (DSCR, LTV)
  d. Log result to loan_exposure_sync_history
  e. Send alert emails (if violations found)
```

### Shutdown Process

When app shuts down:

```
1. shutdown_event() triggers
2. APScheduler gracefully shuts down (waits for running jobs)
3. HTTP client closed
4. Database connections closed
```

---

## Configuration

### Create a Daily Sync Schedule

Via the Phase 8.3 API:

```bash
curl -X POST http://localhost:8000/api/v1/loan-accounts/sync-schedule \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "name": "Daily Bank Export",
    "frequency": "daily",
    "scheduled_time_utc": "02:00",
    "sync_source": "BANK_API",
    "source_config": {
      "webhook_url": "https://bank.com/api/export/loans"
    },
    "alert_on_dscr_below": 1.2,
    "alert_on_ltv_above": 75,
    "alert_email_addresses": "risk@bank.com"
  }'
```

### Frequency Options

| Frequency | Behavior | Config Required |
|-----------|----------|-----------------|
| `daily` | Every day at scheduled_time_utc | scheduled_time_utc (HH:MM) |
| `weekly` | Specific day at scheduled_time_utc | day_of_week (0-6), scheduled_time_utc |
| `hourly` | Every hour at :00-:01 | None |
| `manual` | Only when triggered manually | None |

### Source Configuration

#### BANK_API

```json
{
  "webhook_url": "https://bank.com/api/v1/export/loans",
  "auth_method": "api_key",
  "api_key_ref": "bank_api_key_secret"
}
```

The scheduler will:
1. GET to webhook_url
2. Parse response (expects JSON array or `{"loan_accounts": [...]}`)
3. Send to Phase 8.2 ingestion

#### FINACLE_CBS

```json
{
  "database_connection": "finacle_production",
  "query": "SELECT * FROM loan_master WHERE status='ACTIVE'"
}
```

(Not yet implemented; Phase 8.4 integration)

#### CSV_UPLOAD

Manual uploads via API (automatic sync not applicable)

---

## Monitoring

### Check Scheduler Status

```bash
curl http://localhost:8000/health
# Returns: {"status": "healthy", "version": "0.1.0", ...}
```

### View Sync History

```sql
SELECT 
  schedule_id,
  status,
  total_records,
  created_count,
  updated_count,
  skipped_count,
  duration_seconds,
  created_at
FROM loan_exposure_sync_history
ORDER BY created_at DESC
LIMIT 50;
```

### Check Last Sync Result

```sql
SELECT 
  name,
  last_sync_at,
  last_sync_status,
  last_sync_record_count,
  last_sync_error
FROM loan_exposure_sync_schedules
WHERE is_active = 'Y'
ORDER BY last_sync_at DESC;
```

### View Alerts Triggered

```sql
SELECT 
  history_id,
  alerts_triggered,
  created_at
FROM loan_exposure_sync_history
WHERE alerts_triggered IS NOT NULL
  AND alerts_triggered != '[]'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Logging

### Application Logs

The scheduler logs to stdout/file:

```
[INFO] Background loan sync scheduler started
[INFO] ⏱️  Due schedule: Daily Bank Export (550e8400-...)
[INFO] 🔄 Starting sync: Daily Bank Export (source=BANK_API)
[INFO] 📥 Fetched 245 records from BANK_API
[INFO] 📤 Posting to Phase 8.2 endpoint: 245 records
[INFO] ✅ Ingestion complete: created=100, updated=120, skipped=25
[INFO] 🚨 Detected 5 policy violations
[INFO] 📧 Would send alert email to risk@bank.com (5 violations)
[INFO] ✅ Sync complete: Daily Bank Export (created=100, duration=45s)
```

### Log Levels

```python
logger.debug(...)   # Minute-by-minute schedule checks
logger.info(...)    # Sync start/completion, record counts
logger.warning(...) # Non-critical errors, missing config
logger.error(...)   # Sync failures, bank API errors
```

### View Logs

```bash
# Docker
docker logs hpms-backend

# Systemd
journalctl -u hpms-backend -f

# File-based (if configured)
tail -f logs/hpms.log
```

---

## Troubleshooting

### Scheduler Not Running

**Check 1: APScheduler installed?**

```bash
python -c "import apscheduler; print('APScheduler OK')"
```

If missing:

```bash
pip install apscheduler
```

**Check 2: Startup logs**

Look for:

```
✅ Background loan sync scheduler started
```

If you see:

```
APScheduler not installed; loan sync scheduler disabled
```

→ Install APScheduler

**Check 3: Database reachable?**

```bash
curl http://localhost:8000/ready
# Should return: {"status": "ready"}
```

If DB is down, scheduler will still run but syncs will fail.

### Sync Not Triggering at Scheduled Time

**Issue 1: Schedule is inactive**

```bash
# Check is_active flag
SELECT * FROM loan_exposure_sync_schedules WHERE name = 'Daily Bank Export';
```

If `is_active = 'N'`, enable it:

```bash
curl -X PATCH "http://localhost:8000/api/v1/loan-accounts/sync-schedule/{id}/toggle?is_active=Y"
```

**Issue 2: Time mismatch**

The scheduler checks every minute. A schedule with `scheduled_time_utc: "02:00"` will run:

```
02:00:00 - 02:01:59 UTC (2-minute window)
```

**Issue 3: Frequency config missing**

```bash
# For daily, must have scheduled_time_utc
# For weekly, must have day_of_week AND scheduled_time_utc
# For hourly, runs at :00-:01 of every hour
```

### Bank API Call Failing

**Check response format**

Endpoint should return:

```json
[{loan object}, {loan object}, ...]
```

or

```json
{"loan_accounts": [{loan object}, ...]}
```

**Check authorization**

If bank API requires auth:

```json
{
  "webhook_url": "https://bank.com/api/loans",
  "auth_method": "api_key"
}
```

(Auth headers handled via source_config in future phases)

**Check firewall/network**

```bash
curl -v https://bank.com/api/export/loans
# Should return data without timeout/connection errors
```

### Alerts Not Sending

**Check alert thresholds**

```bash
# Schedule must have thresholds set
SELECT alert_on_dscr_below, alert_on_ltv_above 
FROM loan_exposure_sync_schedules 
WHERE id = '550e8400-...';
```

If NULL, alerts won't trigger.

**Check email configuration**

Email backend is controlled via `EMAIL_BACKEND` environment variable:

```bash
# Development (logs emails, doesn't send)
export EMAIL_BACKEND=mock

# Production (sends via SMTP)
export EMAIL_BACKEND=smtp
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=your-app-password
export SMTP_TLS=true
export EMAIL_FROM=hpms-alerts@yourorg.com
```

**Verify email sending**

Check logs for:
- `✅ Email sent to ...` (success)
- `❌ Failed to send email: ...` (error)
- `📧 [MOCK] Email to ...` (mock mode)

---

## Advanced Configuration

### Adjust Sync Check Interval

Default: Every 1 minute

To change in main.py:

```python
scheduler.add_job(
    sync_executor.execute_due_syncs,
    "interval",
    minutes=5,  # Changed from 1 to 5
    ...
)
```

**Tradeoff:**
- Longer interval = lower CPU, higher latency to detect due syncs
- Shorter interval = more responsive, higher CPU

### Adjust Schedule Time Window

Default: 2-minute window (e.g., "02:00" → 02:00-02:01)

To change in background_sync_executor.py:

```python
def _should_run(self, schedule):
    ...
    # Allow 5-min window instead of 2-min
    and current_time.minute < scheduled.minute + 5
    ...
```

### Handle Multiple Syncs

If multiple schedules are due simultaneously:

```
minute 02:00:
  Schedule A (daily 02:00) → runs
  Schedule B (daily 02:00) → runs (in parallel)
  Schedule C (weekly Mon 02:00) → runs
  
All execute concurrently in asyncio event loop
```

---

## Performance Tuning

### Check Scheduler Load

```python
# In monitor endpoint
jobs = scheduler.get_jobs()
print(f"Scheduled jobs: {len(jobs)}")
print(f"Next run time: {scheduler.get_job('loan_sync_executor').next_run_time}")
```

### Parallel Sync Limits

Currently executes all due syncs in a single async loop. To limit concurrency:

```python
# Add semaphore to background_sync_executor.py
self.semaphore = asyncio.Semaphore(3)  # Max 3 concurrent syncs

async def _execute_sync(self, ...):
    async with self.semaphore:
        # ... actual sync logic
```

---

## Testing

### Unit Test: Sync Scheduling

```python
def test_should_run_daily():
    schedule = LoanExposureSyncSchedule(
        frequency="daily",
        scheduled_time_utc="02:00"
    )
    
    executor = BackgroundSyncExecutor(None)
    
    # Mock time to 02:00:30 UTC
    with freeze_time("2026-09-30 02:00:30"):
        assert executor._should_run(schedule) == True
    
    # Mock time to 03:00 UTC
    with freeze_time("2026-09-30 03:00:00"):
        assert executor._should_run(schedule) == False
```

### Integration Test: Full Sync

```bash
# 1. Create schedule
curl -X POST /api/v1/loan-accounts/sync-schedule ... -d '{...frequency: "manual"...}'

# 2. Manually trigger (Phase 8.4 feature) or wait for schedule

# 3. Check history
SELECT * FROM loan_exposure_sync_history WHERE schedule_id = '...' ORDER BY created_at DESC LIMIT 1;

# 4. Verify loan_accounts were created/updated
SELECT COUNT(*) FROM loan_accounts WHERE data_provenance = 'BANK_API' AND created_at > NOW() - INTERVAL 5 MINUTE;
```

---

## Production Deployment

### Systemd Service File

```ini
# /etc/systemd/system/hpms-backend.service

[Unit]
Description=HPMS Backend with Loan Sync Scheduler
After=network.target

[Service]
Type=simple
User=hpms
WorkingDirectory=/opt/hpms
ExecStart=/usr/bin/python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

# Scheduler cleanup on stop
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
systemctl start hpms-backend
systemctl enable hpms-backend
```

### Docker Entrypoint

```bash
#!/bin/bash
cd /app
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

(Scheduler starts automatically on app startup)

---

## Email Service Integration (Phase 8.3.2)

Email alerts for policy violations are now fully integrated via `backend/app/services/email_service.py`.

### Features

- **EmailProvider abstraction** for pluggable backends
- **SMTPEmailProvider** for real SMTP sending (Gmail, Office365, custom)
- **MockEmailProvider** for testing/development
- **HTML + plain-text emails** with alert summaries
- **Environment-based configuration** (no code changes needed)

### Usage

Background executor automatically sends emails when violations detected:

```python
# In background_sync_executor.py
await self._send_alert_emails(
    email_addresses=schedule.alert_email_addresses,
    schedule_name=schedule.name,
    alerts=alerts,
)
```

Which calls:

```python
from backend.app.services.email_service import get_email_service

email_service = get_email_service()
await email_service.send_loan_sync_alerts(
    schedule_name="Daily Bank Export",
    alerts=[...],  # LoanExposureSyncAlertResponse list
    recipients=["risk@bank.com"],
)
```

### Phase 8.4: Enterprise ETL

Upgrade from simple scheduled syncs to:
- Airflow DAGs
- Multi-source reconciliation
- Advanced retry/retry policies
- Data quality checks

---

**Status:** ✅ Phase 8.3.1 Complete  
**Ready for:** Production deployment  
**Monitoring:** Check logs, check sync_history table  
**Contact:** alert_email_addresses on schedule

---

*Phase 8.3.1: Background Scheduler*  
*Enables automated nightly loan data refresh with policy violation alerts*  
*2026-09-30*
