# Loan Exposure Sync API – Phase 8.2

## Overview

The `/api/v1/loan-accounts/exposure-sync` endpoint enables bulk ingestion of loan exposure data from CSV/JSON payloads. It's designed to support manual uploads (Option A) and will later scale to auto-sync (Option B) and enterprise ETL (Option C).

**Design:**
- Validates referential integrity (project_id must exist)
- Upserts loan accounts and rate history
- Logs all operations to compliance audit trail
- Returns summary: created, updated, skipped counts

---

## Endpoint

```
POST /api/v1/loan-accounts/exposure-sync
Content-Type: application/json
Authorization: Bearer <admin-token>
```

**Status Code:** `202 Accepted` (async operation)

---

## Request Payload

### Structure

```json
{
  "sync_source": "CSV",
  "source_reference": "bank_exposure_2026-09-30.csv",
  "loan_accounts": [
    {
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "facility_type": "Construction Term Loan",
      "sanctioned_amount": 50000000,
      "disbursed_amount": 40000000,
      "outstanding_principal": 35000000,
      "outstanding_interest": 0,
      "interest_rate_pct": 11.5,
      "tenor_years": 15,
      "grace_years": 3,
      "sanction_date": "2023-01-15",
      "disbursement_date": "2023-02-01",
      "maturity_date": "2038-02-01",
      "risk_rating": "AA",
      "ifrs9_stage": "Stage 1",
      "dscr": 2.5,
      "ltv": 50.0,
      "icr": 3.2
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sync_source` | String | Yes | Source type: "CSV", "JSON", "MANUAL_UPLOAD", "BANK_API", etc. |
| `source_reference` | String | No | File name, bank ID, or reference identifier |
| `loan_accounts` | Array | Yes | List of loan exposure records |
| `project_id` | String (UUID) | Yes | Must exist in `projects` table |
| `facility_type` | String | Yes | "Construction Term Loan", "Working Capital", "Bridge", etc. |
| `sanctioned_amount` | Decimal | Yes | Total credit limit (NPR) |
| `disbursed_amount` | Decimal | No | Amount drawn; defaults to sanctioned_amount |
| `outstanding_principal` | Decimal | Yes | Current outstanding balance |
| `outstanding_interest` | Decimal | No | Accrued interest; defaults to 0 |
| `interest_rate_pct` | Decimal | Yes | Annual interest rate (%) |
| `tenor_years` | Integer | Yes | Total loan tenor (years) |
| `grace_years` | Integer | Yes | Grace period (years, no principal repayment) |
| `sanction_date` | Date | Yes | Format: YYYY-MM-DD |
| `disbursement_date` | Date | Yes | Format: YYYY-MM-DD |
| `maturity_date` | Date | Yes | Format: YYYY-MM-DD |
| `risk_rating` | String | No | "AAA", "AA", "A", "BBB", "BB", "B" |
| `ifrs9_stage` | String | No | "Stage 1" (performing), "Stage 2" (watch), "Stage 3" (NPL) |
| `dscr` | Decimal | No | Debt Service Coverage Ratio |
| `ltv` | Decimal | No | Loan-to-Value ratio (%) |
| `icr` | Decimal | No | Interest Coverage Ratio |

---

## Response

### Success (202 Accepted)

```json
{
  "data": {
    "sync_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "total_records": 3,
    "created_count": 2,
    "updated_count": 1,
    "skipped_count": 0,
    "errors": [],
    "warnings": [],
    "audit_log_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-09-30T18:30:00.123456"
  },
  "meta": {
    "timestamp": "2026-09-30T18:30:00.123456",
    "version": "0.1.0"
  },
  "audit": {
    "user_id": "admin@example.com",
    "action": "loan_exposure_sync",
    "timestamp": "2026-09-30T18:30:00.123456"
  }
}
```

### Partial Success (202 + errors)

If some records fail validation:

```json
{
  "data": {
    "sync_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "total_records": 3,
    "created_count": 2,
    "updated_count": 0,
    "skipped_count": 1,
    "errors": [
      "Record 2: Project 550e8400-e29b-41d4-a716-446655440099 not found"
    ],
    "warnings": [],
    "audit_log_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-09-30T18:30:00.123456"
  },
  "meta": {...},
  "audit": {...}
}
```

### Failure (400, 500)

```json
{
  "detail": "Sync failed: <error message>"
}
```

---

## Usage Examples

### 1. Curl

```bash
curl -X POST https://hpms.example.com/api/v1/loan-accounts/exposure-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d @payload.json
```

### 2. Python

```python
import requests
import json

url = "http://localhost:8000/api/v1/loan-accounts/exposure-sync"
headers = {
    "Authorization": "Bearer YOUR_ADMIN_TOKEN",
    "Content-Type": "application/json"
}

payload = {
    "sync_source": "CSV",
    "source_reference": "bank_exposure_2026-09-30.csv",
    "loan_accounts": [
        {
            "project_id": "550e8400-e29b-41d4-a716-446655440000",
            "facility_type": "Construction Term Loan",
            "sanctioned_amount": 50000000,
            "outstanding_principal": 35000000,
            "interest_rate_pct": 11.5,
            "tenor_years": 15,
            "grace_years": 3,
            "sanction_date": "2023-01-15",
            "disbursement_date": "2023-02-01",
            "maturity_date": "2038-02-01"
        }
    ]
}

response = requests.post(url, headers=headers, json=payload)
result = response.json()

print(f"Sync ID: {result['data']['sync_id']}")
print(f"Created: {result['data']['created_count']}")
print(f"Updated: {result['data']['updated_count']}")
print(f"Skipped: {result['data']['skipped_count']}")

if result['data']['errors']:
    print(f"Errors: {result['data']['errors']}")
```

### 3. CSV Upload Flow

**Step 1:** Prepare CSV (see `loan_exposure_import_template.csv`)

**Step 2:** Convert to JSON:

```python
import csv
import json

def csv_to_json(csv_file):
    records = []
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            record = {
                "project_id": row["project_id"],
                "facility_type": row["facility_type"],
                "sanctioned_amount": float(row["sanctioned_amount"]),
                "disbursed_amount": float(row["disbursed_amount"]) if row["disbursed_amount"] else None,
                "outstanding_principal": float(row["outstanding_principal"]),
                "outstanding_interest": float(row["outstanding_interest"]) if row["outstanding_interest"] else None,
                "interest_rate_pct": float(row["interest_rate_pct"]),
                "tenor_years": int(row["tenor_years"]),
                "grace_years": int(row["grace_years"]),
                "sanction_date": row["sanction_date"],
                "disbursement_date": row["disbursement_date"],
                "maturity_date": row["maturity_date"],
                "risk_rating": row.get("risk_rating") or None,
                "ifrs9_stage": row.get("ifrs9_stage") or None,
                "dscr": float(row["dscr"]) if row.get("dscr") else None,
                "ltv": float(row["ltv"]) if row.get("ltv") else None,
                "icr": float(row["icr"]) if row.get("icr") else None,
            }
            records.append(record)
    
    payload = {
        "sync_source": "CSV",
        "source_reference": csv_file,
        "loan_accounts": records
    }
    
    return json.dumps(payload, indent=2)

# Usage
json_payload = csv_to_json("loan_exposure_2026-09-30.csv")
print(json_payload)
```

**Step 3:** POST to endpoint

---

## Behavior

### On Success

- ✅ New loan accounts created with auto-generated `finacle_account_id`
- ✅ Existing accounts updated (by project_id + facility_type match)
- ✅ Rate history entries created/maintained
- ✅ `data_provenance` set to `sync_source` ("CSV", "JSON", "API", etc.)
- ✅ `sync_status` set to "success"
- ✅ Entry logged to compliance audit trail
- ✅ All changes committed to database

### On Validation Error

- ⚠️ Record skipped, counted in `skipped_count`
- ⚠️ Error message appended to `errors` array
- ⚠️ Remaining records processed normally
- ⚠️ Partial results committed (created + updated records persist)
- ⚠️ Audit log records the full outcome

### Upsert Logic

**Project ID + Facility Type = Unique Key**

```sql
-- Check if loan exists
SELECT * FROM loan_accounts
WHERE project_id = ? AND facility_type = ?

-- If found: UPDATE
-- If not found: CREATE
```

---

## Audit Trail

Every sync operation is logged to the compliance audit trail:

```json
{
  "entity_type": "loan_account",
  "entity_id": "<sync_id>",
  "action": "LOAN_EXPOSURE_SYNC",
  "action_by": "<user_id>",
  "status": "success | partial_success | failure",
  "details": {
    "sync_source": "CSV",
    "source_reference": "bank_exposure_2026-09-30.csv",
    "total_records": 3,
    "created_count": 2,
    "updated_count": 1,
    "skipped_count": 0,
    "error_count": 0
  },
  "timestamp": "2026-09-30T18:30:00"
}
```

---

## Validation Rules

1. **Project must exist:** `project_id` must reference a row in `projects` table
2. **UUID format:** `project_id` must be valid UUID
3. **Amounts >= 0:** `sanctioned_amount`, `outstanding_principal`, etc.
4. **Dates valid:** `sanction_date`, `disbursement_date`, `maturity_date` must be valid dates
5. **Tenor > Grace:** `tenor_years > grace_years`
6. **Facility type:** Must match expected values (configurable)

---

## Next Steps

### Phase 8.2 Extended: UI for CSV Upload

```html
<form action="/api/v1/loan-accounts/exposure-sync" method="POST" enctype="multipart/form-data">
  <input type="file" name="csv_file" accept=".csv" required />
  <input type="text" name="source_reference" placeholder="File description" />
  <button type="submit">Upload & Sync</button>
</form>
```

### Phase 8.3: Auto-Sync API (Option B)

```
POST /api/v1/loan-accounts/sync-schedule
{
  "frequency": "daily",
  "time": "02:00 UTC",
  "source": "BANK_API",
  "webhook_url": "https://bank.com/export/loans"
}
```

### Phase 8.4: Enterprise ETL (Option C)

Airflow DAG for multi-source integration:

```python
from airflow import DAG
from airflow.operators.http_operator import HttpOperator

dag = DAG("loan_exposure_sync", schedule_interval="@daily")

fetch_task = HttpOperator(
    task_id="fetch_from_finacle",
    http_conn_id="finacle_cbs",
    endpoint="export/loan_accounts",
)

sync_task = HttpOperator(
    task_id="sync_to_hpms",
    http_conn_id="hpms_api",
    endpoint="/api/v1/loan-accounts/exposure-sync",
    method="POST",
)

fetch_task >> sync_task
```

---

## Troubleshooting

### 401 Unauthorized

- Check your Bearer token (must be admin user)
- Ensure token is not expired

### 400 Bad Request

- Validate JSON schema
- Check all required fields are present
- Ensure project_id is valid UUID format

### 202 with skipped records

- Check `errors` array for validation messages
- Verify project_id values exist in database
- Check date formats (YYYY-MM-DD)

### Partial commits

- If sync fails mid-operation, created records will persist
- Check audit log for failed records
- Re-run with corrected data

---

## Template Files

- `loan_exposure_import_template.csv` — Example CSV format
- `API_LOAN_EXPOSURE_SYNC.md` — This documentation

---

*Phase 8.2: Loan Exposure Sync – Option A (Manual CSV)*  
*Nepal Hydropower Management System (HPMS)*  
*2026-09-30*
