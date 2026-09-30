# Loan Exposure Sync Scheduler – Phase 8.3 Option B

## Overview

The **Loan Exposure Sync Scheduler** automates periodic ingestion of loan data from bank systems, with built-in policy violation alerts.

**Features:**
- Schedule automatic syncs: daily, weekly, hourly
- Connect to bank APIs, Finacle CBS, or manual uploads
- Alert on policy violations (DSCR, LTV, concentration)
- Full audit trail of all sync operations
- Enable/disable schedules without deletion

---

## Endpoints

### Create Sync Schedule

```http
POST /api/v1/loan-accounts/sync-schedule
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "name": "Daily Bank Loan Export",
  "description": "Nightly sync from bank's core banking system",
  "frequency": "daily",
  "scheduled_time_utc": "02:00",
  "sync_source": "BANK_API",
  "source_config": {
    "webhook_url": "https://bank.com/api/export/loans",
    "auth_method": "api_key",
    "api_key_ref": "bank_loans_api_key"
  },
  "alert_on_dscr_below": 1.2,
  "alert_on_ltv_above": 75,
  "alert_on_concentration_above": 30,
  "alert_email_addresses": "risk@bank.com,admin@bank.com"
}
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Daily Bank Loan Export",
    "description": "Nightly sync from bank's core banking system",
    "frequency": "daily",
    "scheduled_time_utc": "02:00",
    "day_of_week": null,
    "sync_source": "BANK_API",
    "source_config": {...},
    "is_active": "Y",
    "last_sync_at": null,
    "last_sync_status": null,
    "last_sync_record_count": 0,
    "last_sync_error": null,
    "alert_on_dscr_below": 1.2,
    "alert_on_ltv_above": 75,
    "alert_on_concentration_above": 30,
    "alert_email_addresses": "risk@bank.com,admin@bank.com",
    "created_at": "2026-09-30T18:45:00",
    "updated_at": "2026-09-30T18:45:00"
  },
  "meta": {...},
  "audit": {...}
}
```

---

### List Sync Schedules

```http
GET /api/v1/loan-accounts/sync-schedule?is_active=Y&sync_source=BANK_API
Authorization: Bearer <ADMIN_TOKEN>
```

**Response:**

```json
{
  "data": [
    {
      "id": "550e8400-...",
      "name": "Daily Bank Loan Export",
      "frequency": "daily",
      "sync_source": "BANK_API",
      "is_active": "Y",
      "last_sync_at": "2026-09-30T02:05:30",
      "last_sync_status": "success",
      "last_sync_record_count": 245,
      ...
    }
  ],
  "meta": {
    "total_count": 1
  }
}
```

---

### Get Sync Schedule

```http
GET /api/v1/loan-accounts/sync-schedule/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <ADMIN_TOKEN>
```

---

### Update Sync Schedule

```http
PUT /api/v1/loan-accounts/sync-schedule/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <ADMIN_TOKEN>

{
  "name": "Nightly Bank Export (Updated)",
  "frequency": "daily",
  "scheduled_time_utc": "03:00",
  ...
}
```

---

### Toggle Sync Schedule (Enable/Disable)

```http
PATCH /api/v1/loan-accounts/sync-schedule/550e8400-e29b-41d4-a716-446655440000/toggle?is_active=N
Authorization: Bearer <ADMIN_TOKEN>
```

Response: 200 OK with updated schedule (is_active: "N")

---

## Configuration Options

### Frequency

| Value | Behavior |
|-------|----------|
| `daily` | Runs every day at `scheduled_time_utc` |
| `weekly` | Runs on day `day_of_week` at `scheduled_time_utc` |
| `hourly` | Runs every hour |
| `manual` | Must be triggered manually (no automatic scheduling) |

### Sync Source

| Source | Description | Config |
|--------|-------------|--------|
| `BANK_API` | Bank's REST API endpoint | `webhook_url`, `auth_method`, `api_key_ref` |
| `FINACLE_CBS` | Core Banking System (Finacle) | Database connection ref, query |
| `CSV_UPLOAD` | Manual CSV file upload | Polling directory path |

### Alert Thresholds

All alert thresholds are optional. If not set, that alert type is disabled.

| Alert | Description | Example |
|-------|-------------|---------|
| `alert_on_dscr_below` | Trigger if DSCR < value | `1.2` (means DSCR must be ≥1.2) |
| `alert_on_ltv_above` | Trigger if LTV > value (%) | `75` (means LTV must be ≤75%) |
| `alert_on_concentration_above` | Trigger if portfolio concentration to single entity > value (%) | `30` |

---

## How It Works

### Execution Flow

```
1. Scheduler Service loads active schedules
2. Checks if current time matches schedule frequency/time
3. If match:
   a. Calls sync_source (bank API, CBS, etc.)
   b. Passes data to Phase 8.2 CSV Ingestion endpoint
   c. Receives sync result (created, updated, skipped counts)
   d. Checks for policy violations (DSCR, LTV, concentration)
   e. Logs to sync_history with status + alerts
   f. Sends alerts via email (if configured)
4. Updates schedule.last_sync_at, last_sync_status
```

### Alert Example

If schedule has `alert_on_dscr_below: 1.2`, after sync the scheduler:

1. Queries loan_accounts where DSCR < 1.2
2. For each violation, creates alert:
   ```json
   {
     "alert_type": "dscr_violation",
     "severity": "high",
     "project_id": "550e8400-...",
     "project_code": "HPM-KTM-0001",
     "current_value": 1.05,
     "threshold_value": 1.2,
     "message": "Project HPM-KTM-0001: DSCR 1.05 below threshold 1.2",
     "timestamp": "2026-09-30T02:05:30"
   }
   ```
3. Stores alerts in sync_history.alerts_triggered
4. Sends email to alert_email_addresses with all violations

---

## Integration: Triggering Sync from Bank API

### Option 1: Webhook Callback

Bank system calls your webhook when data is ready:

```bash
curl -X POST http://hpms.example.com/api/v1/loan-accounts/exposure-sync \
  -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_source": "BANK_API",
    "source_reference": "finacle_export_2026-09-30T02:00:00Z",
    "loan_accounts": [...]
  }'
```

### Option 2: Polling via Scheduler

HPMS scheduler checks bank API endpoint at scheduled time:

```python
# Pseudo-code for scheduler job
schedule = get_schedule(schedule_id)

if should_run(schedule):
    # Call bank API
    response = requests.get(
        schedule.source_config["webhook_url"],
        headers={"Authorization": f"Bearer {bank_token}"}
    )
    
    loan_data = response.json()
    
    # Convert to CSV format and POST to Phase 8.2
    sync_result = post_to_exposure_sync_endpoint(loan_data)
    
    # Log result
    log_sync_result(schedule_id, sync_result)
    
    # Check alerts
    alerts = check_policy_violations(schedule_id)
    if alerts:
        send_alert_emails(schedule.alert_email_addresses, alerts)
```

---

## Sync History & Audit

Each sync operation is logged to `loan_exposure_sync_history` table:

```sql
SELECT 
  schedule_id,
  status,
  total_records,
  created_count,
  updated_count,
  skipped_count,
  error_message,
  alerts_triggered,
  duration_seconds,
  created_at
FROM loan_exposure_sync_history
WHERE schedule_id = '550e8400-...'
ORDER BY created_at DESC
LIMIT 30;
```

---

## Example: Setting Up Daily Bank Sync

### Step 1: Create Schedule

```bash
curl -X POST http://localhost:8000/api/v1/loan-accounts/sync-schedule \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Finacle Export",
    "frequency": "daily",
    "scheduled_time_utc": "02:00",
    "sync_source": "BANK_API",
    "source_config": {
      "webhook_url": "https://finacle.bank.com/api/v1/export/loans",
      "auth_method": "oauth2",
      "client_id": "hpms_service_account"
    },
    "alert_on_dscr_below": 1.2,
    "alert_on_ltv_above": 75,
    "alert_email_addresses": "risk@bank.com,compliance@bank.com"
  }'
```

### Step 2: Verify Schedule Created

```bash
curl -X GET "http://localhost:8000/api/v1/loan-accounts/sync-schedule?is_active=Y" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Step 3: Monitor Sync History

```bash
# Check recent syncs
SELECT * FROM loan_exposure_sync_history 
WHERE schedule_id = '550e8400-...'
ORDER BY created_at DESC LIMIT 10;
```

### Step 4: If Sync Fails

1. Check `last_sync_error` on the schedule
2. Check `loan_exposure_sync_history.error_message`
3. Verify bank API is accessible
4. Check source_config credentials

### Step 5: Temporarily Disable

```bash
curl -X PATCH "http://localhost:8000/api/v1/loan-accounts/sync-schedule/550e8400-.../toggle?is_active=N" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Troubleshooting

### Sync Never Runs

- Verify `is_active: "Y"`
- Check `scheduled_time_utc` format (HH:MM UTC)
- Ensure scheduler background job is running
- Check logs for scheduler errors

### Sync Succeeds but Alerts Not Sent

- Verify `alert_email_addresses` is set
- Check email service configuration
- Verify alert thresholds are actually breached
- Check `loan_exposure_sync_history.alerts_triggered` to see if alerts were detected

### API Returns 401 Unauthorized

- Verify Bearer token is valid and admin role
- Check token expiration

### API Returns 400 Bad Request

- Validate `frequency` value (daily, weekly, hourly, manual)
- If weekly: ensure `day_of_week` (0-6) is provided
- Validate `scheduled_time_utc` format (HH:MM)
- Validate email addresses format

---

## Next Steps

### Phase 8.3.1: Scheduler Background Job

Wire up APScheduler or Celery to actually run the syncs on schedule:

```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

def execute_loan_syncs():
    """Background job that runs every minute to check for due schedules."""
    with SessionLocal() as db:
        schedules = db.query(LoanExposureSyncSchedule)\
            .filter_by(is_active='Y')\
            .all()
        
        for schedule in schedules:
            if should_run(schedule):
                trigger_sync(schedule)

scheduler.add_job(execute_loan_syncs, 'interval', minutes=1)
scheduler.start()
```

### Phase 8.4: Enterprise ETL

Expand to multi-source Airflow DAGs with reconciliation and retry logic.

---

## Related APIs

- **Phase 8.2:** CSV Ingestion – `POST /api/v1/loan-accounts/exposure-sync`
- **Phase 8.1:** Synthetic Seeding – `python scripts/seed_synthetic_loans.py`

---

**Status:** ✅ Phase 8.3 Option B Complete  
**Date:** 2026-09-30  
**Ready for:** Testing, Scheduler Integration, Production Deployment
