# PowerBI Integration Guide

**Version:** 1.0  
**Phase:** 2 (Foundation), Phase 3+ (Production)  
**Last Updated:** 2026-09-22

---

## Overview

HPMS exports data via REST API endpoints for direct ingestion into PowerBI. This document describes:
1. Available reports and filters
2. API authentication and rate limits
3. Data refresh strategies
4. Schedule-based reporting

**Phase 2 Status:** Foundation layer complete (JSON export only)  
**Phase 3 Roadmap:** Excel/CSV download links, scheduled exports, file storage

---

## Architecture

```
HPMS Database
    ↓ (Async queries)
Report Service
    ↓ (Portfolio, Covenant, Capex)
REST API (/api/v1/reports/export)
    ↓ (JSON payload)
PowerBI Desktop
    ↓
Refresh Schedule (daily/weekly)
    ↓
PowerBI Online
    ↓
SBL Stakeholder Dashboard
```

### Integration Points

| Component | Technology | Phase |
|-----------|-----------|-------|
| **HPMS Backend** | FastAPI + SQLAlchemy | 2 |
| **Export Endpoint** | `/api/v1/reports/export` | 2 |
| **Data Format** | JSON (CSV/Excel Phase 3) | 2 |
| **Auth** | X-User-ID header (dev) + AD LDAP (prod) | 2 |
| **Rate Limit** | 10 req/min per user (configurable) | 2 |
| **File Storage** | JSON in response (S3 presigned URL Phase 3) | 2 |
| **Scheduling** | Manual (PowerBI Gateways Phase 3) | 2 |

---

## Available Reports

### 1. Portfolio Report

**Endpoint:** `POST /api/v1/reports/export`

**Request:**
```json
{
  "report_id": "portfolio",
  "format": "json",
  "filters": {
    "province": "Gandaki",
    "status": "under_operation",
    "date_range_start": "2026-01-01",
    "date_range_end": "2026-09-22"
  }
}
```

**Response Fields:**
- `project_code` (string) — Unique project ID
- `project_name_en` / `project_name_np` (string) — Name in English/Nepali
- `province` (string) — Geographic location
- `district` (string) — District within province
- `capacity_mw` (decimal) — Installed capacity in MW
- `project_stage` (string) — feasibility, construction, operation
- `pipeline_status` (string) — Current RFP status
- `lead_bank` (string) — Lead financial institution
- `consortium_members_count` (int) — Number of co-lenders
- `total_sanctioned_amount` (decimal) — Sum of all loan facilities
- `currency` (string) — NPR
- `loan_accounts_count` (int) — Number of active loans
- `created_date_ad` (date) — Creation date (AD)
- `created_date_bs` (date) — Creation date (BS, Phase 3)
- `updated_date_ad` (date) — Last modification date (AD)
- `updated_date_bs` (date) — Last modification date (BS, Phase 3)

**Use Cases:**
- Portfolio overview dashboard
- Project status heatmap by province
- Capacity summary by stage
- Timeline tracking (feasibility → construction → operation)

---

### 2. Covenant Summary Report

**Endpoint:** `POST /api/v1/reports/export`

**Request:**
```json
{
  "report_id": "covenant_summary",
  "format": "json",
  "filters": {
    "province": "Gandaki",
    "facility_type": "Term Loan"
  }
}
```

**Response Fields:**
- `project_code` (string) — Associated project
- `project_name_en` (string) — Project name
- `province` (string) — Location
- `loan_account_id` (UUID) — HPMS account ID
- `finacle_account_id` (string) — CBS account ID (read-only from Finacle)
- `facility_type` (string) — Loan, Overdraft, Working Capital, Term Loan, Line of Credit
- `sanctioned_amount` (decimal) — Total facility limit
- `current_rate_percent` (decimal) — Current interest rate (%)
- `rate_effective_date_ad` (date) — When rate becomes active (AD)
- `rate_effective_date_bs` (date) — When rate becomes active (BS, Phase 3)
- `rate_expiry_date_ad` (date) — When rate expires (AD)
- `rate_expiry_date_bs` (date) — When rate expires (BS, Phase 3)
- `last_sync_date` (date) — Last CBS synchronization
- `sync_status` (string) — synced, pending, failed

**Use Cases:**
- Rate dashboard (current vs. historical)
- Covenant monitoring (rates approaching expiry)
- CBS sync status tracking
- Facility-level performance analysis

---

### 3. Capex Progress Report

**Endpoint:** `POST /api/v1/reports/export`

**Request:**
```json
{
  "report_id": "capex_progress",
  "format": "json",
  "filters": {
    "province": "Gandaki",
    "status": "construction"
  }
}
```

**Response Fields:**
- `project_code` (string) — Associated project
- `project_name_en` (string) — Project name
- `province` (string) — Location
- `capacity_mw` (decimal) — Project capacity
- `project_stage` (string) — Current construction stage
- `budget_category` (string) — Cost component (Civil Works, Equipment, etc.)
- `budgeted_amount` (decimal) — Planned spend
- `actual_amount` (decimal) — Actual spend to date
- `spent_percent` (decimal) — Actual / Budgeted %
- `currency` (string) — NPR

**Use Cases:**
- Construction progress tracking
- Budget vs. actual variance analysis
- Cost category breakdown
- Project profitability by stage

---

## Authentication

### Development (Phase 2)

Header-based user identification:
```http
POST /api/v1/reports/export
X-User-ID: user@sbl.local
Content-Type: application/json

{
  "report_id": "portfolio",
  "format": "json"
}
```

### Production (Phase 3+)

LDAP/Active Directory integration:
- Request must include valid AD token (via oauth2 flow)
- Token validated against SBL domain
- User roles (admin, maker, approver, auditor) checked per endpoint
- Audit log captures user_id, timestamp, report_id, record_count

---

## Data Refresh Strategies

### Strategy 1: Manual Refresh (Phase 2)

User clicks "Refresh" in PowerBI:
1. PowerBI calls `/api/v1/reports/export`
2. HPMS queries current database state
3. JSON data returned to PowerBI
4. PowerBI transforms to table/pivot

**Pros:**
- No scheduled background jobs
- Always current data
- Developer-friendly

**Cons:**
- User-initiated only
- No automatic updates
- Stale data between refreshes

**Implementation:**
```
PowerBI Desktop → Web.Contents() → API Endpoint → JSON Transform
```

### Strategy 2: Scheduled Refresh (Phase 3)

PowerBI Online with Gateway:
1. PowerBI scheduler triggers every 6 hours
2. On-premise Gateway forwards to HPMS API
3. Response cached in PowerBI dataset
4. Dashboard updated automatically

**Pros:**
- Automatic updates
- Consistent data timeliness
- Mobile/online support

**Cons:**
- Requires PowerBI Online + Gateway
- More infrastructure
- Network access controls

**Implementation:**
```
PowerBI Online Refresh Schedule
    ↓ (6-hour intervals)
PowerBI Gateway (on-premise)
    ↓ (trusted network)
HPMS API (/api/v1/reports/export)
    ↓
PowerBI Dataset
```

### Strategy 3: File Export (Phase 3+)

Scheduled CSV/Excel export to file server:
1. HPMS scheduled task (cron or Windows Task)
2. Generates CSV/Excel for each report
3. Uploads to S3 / shared network drive
4. PowerBI reads file as data source

**Pros:**
- Decoupled from live API
- Flexible scheduling
- Archive capability
- Faster initial load

**Cons:**
- Requires storage infrastructure
- File versioning overhead
- More operational complexity

---

## PowerBI M Query Examples

### Portfolio Report (JSON Source)

```m
let
    Source = Json.Document(Web.Contents("https://hpms.sbl.local/api/v1/reports/export", 
        [
            Headers=[
                #"Content-Type"="application/json",
                #"X-User-ID"="user@sbl.local"
            ],
            Content=Text.ToBinary(Json.FromValue({
                report_id = "portfolio",
                format = "json",
                filters = {
                    status = "under_operation"
                }
            }))
        ]
    )),
    DataArray = Source[data],
    Table = Table.FromList(DataArray, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    ExpandedColumns = Table.ExpandRecordColumn(Table, "Column1", 
        {"project_code", "project_name_en", "province", "capacity_mw", "pipeline_status", "total_sanctioned_amount"},
        {"Project Code", "Project Name", "Province", "Capacity (MW)", "Status", "Sanctioned Amount"}
    )
in
    ExpandedColumns
```

### Rate History (Covenant Report)

```m
let
    Source = Json.Document(Web.Contents("https://hpms.sbl.local/api/v1/reports/export",
        [
            Headers=[
                #"X-User-ID"="user@sbl.local"
            ],
            Content=Text.ToBinary(Json.FromValue({
                report_id = "covenant_summary",
                format = "json"
            }))
        ]
    )),
    DataArray = Source[data],
    Table = Table.FromList(DataArray, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(Table, "Column1",
        {"project_code", "finacle_account_id", "facility_type", "current_rate_percent", "rate_effective_date_ad", "sync_status"},
        {"Project", "CBS Account", "Facility", "Rate %", "Effective Date", "Sync Status"}
    )
in
    Expanded
```

---

## Rate Limits

Per-user quotas to prevent abuse:
- **Standard User:** 10 requests/minute
- **Premium User:** 50 requests/minute
- **Admin:** Unlimited

Configuration (backend/config.py):
```python
REPORT_EXPORT_RATE_LIMIT = "10/minute"  # Per user
REPORT_MAX_RECORD_EXPORT = 100000  # Rows per export
REPORT_EXPORT_TIMEOUT = 30  # Seconds
```

**Handling Rate Limit Exceeded:**
```http
HTTP 429 Too Many Requests
Retry-After: 60

{
  "detail": "Rate limit exceeded: 10 requests per minute"
}
```

---

## Audit Trail

Every export logged in `audit_log_reads` table:
```sql
INSERT INTO audit_log_reads (
    user_id, 
    entity_type,      -- 'report'
    entity_id,        -- 'portfolio' / 'covenant_summary' / 'capex_progress'
    action,           -- 'export'
    timestamp,
    details           -- '{report_id: portfolio, record_count: 42, format: json}'
) VALUES (...)
```

**Query export history:**
```sql
SELECT user_id, entity_id, COUNT(*) as exports, MAX(timestamp) as last_export
FROM audit_log_reads
WHERE entity_type = 'report' AND action = 'export'
GROUP BY user_id, entity_id
ORDER BY last_export DESC;
```

---

## Error Handling

### Missing Filters

```http
POST /api/v1/reports/export
{ "report_id": "portfolio", "format": "json" }

HTTP 200 OK
{ "data": [...], "record_count": 147 }  # Returns all projects
```

### Invalid Format

```http
POST /api/v1/reports/export
{ "report_id": "portfolio", "format": "pdf" }

HTTP 400 Bad Request
{ "detail": "Unsupported format: pdf (supported: json, csv, excel)" }
```

### Database Connection Error

```http
HTTP 503 Service Unavailable
{ "detail": "Database unavailable, cannot generate report" }
```

---

## Performance Characteristics

| Report | Typical Records | Query Time | Notes |
|--------|-----------------|-----------|-------|
| Portfolio | 50-200 | 100-500ms | Joins with consortium, loan accounts |
| Covenant | 100-1000 | 200-800ms | Joins with rate history, filters by current rate |
| Capex | 200-2000 | 300-1000ms | Joins with budget lines, calculates spend % |

**Optimization (Phase 3+):**
- Materialized views for common filters
- Query result caching (5-minute TTL)
- Background materialization of top 10 reports

---

## Phase 3+ Enhancements

- ✅ CSV/Excel file download (presigned URLs)
- ✅ Scheduled exports (cron-based)
- ✅ Dashboard parameterization (dynamic filters)
- ✅ Export templates (downloadable schema)
- ✅ Multi-language support (English/Nepali)
- ✅ PDF reports with branding
- ✅ Mobile app data endpoints
- ✅ Real-time WebSocket updates

---

## Troubleshooting

### "Connection timeout" in PowerBI

**Cause:** HPMS API unreachable or slow  
**Solution:**
1. Check `/ready` endpoint: `curl http://hpms.sbl.local:8000/ready`
2. Verify database connectivity: `psql -h db.sbl.local -d hpms`
3. Check firewall rules for port 8000
4. Increase timeout in PowerBI query settings (Network Timeout → 60s)

### "Invalid date format" error

**Cause:** PowerBI expects ISO 8601 (YYYY-MM-DD), HPMS may return different format  
**Solution:**
1. Verify API response: `POST /api/v1/reports/export` and check date fields
2. Add transformation in PowerBI: `Date.From(Text.From([created_date_ad]))`

### Partial data in dashboard

**Cause:** User lacks authorization for some projects (row-level security Phase 3)  
**Solution:**
1. Check user role in Active Directory
2. Verify audit log for access denials
3. Contact SBL admin for permission grant

---

## Support

**Phase 2 Questions:** Contact Dev Team (dev@sbl.local)  
**Phase 3+ Production Issues:** Contact SBL IT Operations

---

**Last Review:** 2026-09-22  
**Next Review:** Phase 3 kickoff (2026-10-20)
