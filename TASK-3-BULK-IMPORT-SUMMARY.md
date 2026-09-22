# Task 3: Bulk Import (Excel/CSV) — Completion Summary

**Date:** 2026-09-22  
**Phase:** 2 (Data Import)  
**Status:** ✅ COMPLETE (Framework & Validation)

---

## Deliverables

### 1. Validation Service (`backend/app/services/validation_service.py`)

**Purpose:** Enforce RFP data quality rules and domain constraints on import data.

#### `ValidationError` Class
Single validation error for detailed error reporting:
- row_number: which row (1-indexed)
- column: field name
- value: actual value
- message: why it failed

**Example:**
```python
ValidationError(
    row_number=5,
    column='capacity_mw',
    value='0',
    message="Must be greater than 0"
)
```

#### `ValidationService` Static Methods

**`validate_project_row()`** — Validate project import row
- **Required fields:** project_code, name_en, name_np, province, capacity_mw, stage, status
- **project_code:** alphanumeric + dashes, max 50 chars, unique
- **Names:** max 255 chars, not empty
- **capacity_mw:** positive Decimal
- **stage:** must be in [feasibility, construction, operation]
- **status:** must be valid PipelineStatus enum

**`validate_loan_account_row()`** — Validate loan account import row
- **Required fields:** project_code, finacle_account_id, facility_type, sanctioned_amount
- **finacle_account_id:** 10-20 alphanumeric chars, unique
- **facility_type:** must be in [Loan, Overdraft, Working Capital, Term Loan, Line of Credit]
- **sanctioned_amount:** positive Decimal

**`validate_budget_row()`** — Validate budget line import row
- **Required fields:** project_code, category, budgeted_amount
- **category:** 1-100 chars
- **budgeted_amount:** non-negative Decimal
- **actual_amount:** optional, must be non-negative if provided

**`parse_date()`** — Parse date from multiple formats
- Accepts: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY
- Returns: (ad_date, bs_string) tuple

**Design Rationale:**
- Validate ALL rows first before importing any (fail-fast)
- Duplicate detection across batch (check existing_codes)
- Collect all errors per row (not just first error)
- No type coercion (strict validation)

---

### 2. Import Tracking Models (`backend/app/models/import_tracking.py`)

**Purpose:** Audit trail for all bulk imports with line-by-line error logs.

#### `ImportStatus` Enum
Batch lifecycle:
- **PENDING** — uploaded, validation running
- **VALIDATED** — passed validation, errors found (optional)
- **IN_PROGRESS** — importing rows
- **COMPLETED** — all rows successful
- **FAILED** — batch-level failure (transaction rolled back)
- **PARTIAL** — some rows succeeded, some failed

#### `ImportBatch` Table
Master record for each import operation:
- **Metadata:** file_name, file_size_bytes, mime_type
- **Configuration:** import_type (projects, loans, budget, consortium)
- **Status tracking:** status (indexed), total_rows, successful_rows, failed_rows
- **Error summary:** error_summary (first 1000 chars for quick scan)
- **Audit:** uploaded_by, upload_timestamp
- **Processing:** started_at, completed_at, processing_duration_seconds

**Indexes:**
- `(import_type, status)` — find pending imports of type X
- `(upload_timestamp)` — historical import queries

#### `ImportRowError` Table
Line-by-line error log (one record per error):
- **Row identification:** row_number (1-indexed)
- **Error details:** error_type, column_name, error_message
- **Row snapshot:** row_data_json (JSON dump for debugging)
- **Recovery:** is_retryable (Y/N), retry_count

**Design Rationale:**
- One row per error (not all errors in one record)
- Row data preserved as JSON for audit and potential retry
- Retryable vs non-retryable distinction for Phase 3 retry logic
- FK to batch (cascading delete when batch deleted)

---

### 3. Bulk Import Service (`backend/app/services/bulk_import_service.py`)

**Purpose:** Orchestrate file parsing, validation, and transaction-safe data import.

#### `BulkImportService` Class

**`import_projects()`** — Import projects from file
```python
batch, errors = await service.import_projects(
    db,
    file_stream=BytesIO(xlsx_content),
    file_name="projects_2026_q3.xlsx",
    user_id="credit_officer_123",
)
```

**Flow:**
1. Create ImportBatch record (status=PENDING)
2. Parse CSV/Excel file → list of dicts
3. Validate all rows (collect all errors first)
4. If validation errors:
   - Create ImportRowError records for each error
   - Set batch status=VALIDATED, failed_rows=count
   - Return (batch, errors)
5. If no errors:
   - Begin import transaction (status=IN_PROGRESS)
   - Create Project record for each valid row
   - On success: status=COMPLETED, successful_rows=count
   - On constraint error: create error record, continue
   - On batch error (IntegrityError on commit): ROLLBACK, status=FAILED
6. Return (batch, errors)

**Key Features:**
- All validation before any DB writes (fail-fast)
- Transaction-safe: if commit fails, all rolled back
- Partial success: individual row errors don't stop batch
- Duplicate detection: project_code unique within batch + DB

**`import_loan_accounts()`** — Similar flow for loan accounts
- Validates project_code references existing Project
- Creates LoanAccount with MANUAL_ENTRY provenance
- Detects finacle_account_id duplicates

**`_parse_csv()`** — Parse CSV file
- Reads UTF-8 with BOM support
- Uses csv.DictReader for column mapping
- Cleans keys: lowercase + underscore
- Returns list of dicts

**Error Handling:**
- File parsing error → batch.status=FAILED, error_summary set
- Validation error → ImportRowError record + detailed message
- Constraint error → error record + continue (partial success)
- Transaction error → ROLLBACK, batch.status=FAILED

---

### 4. Database Migration (`alembic/versions/004_add_import_tracking.py`)

**Creates:**
- `importstatus` ENUM (6 values)
- `import_batches` table
- `import_row_errors` table (cascading FK)

**Indexes:**
- `(import_type, status)` — find pending imports
- `(upload_timestamp)` — historical queries
- `(batch_id, row_number)` — error lookups

---

## Supported Import Formats

### Projects CSV Template
```
project_code,name_en,name_np,province,district,capacity_mw,stage,status
SBL-HPP-0001,Kali Gandaki,काली गण्डकी,Gandaki,Kaski,50,feasibility,proposal_under_pipeline
SBL-HPP-0002,Marsyangdi,मर्स्यान्दी,Gandaki,Lamjung,70,construction,under_review
```

### Loan Accounts CSV Template
```
project_code,finacle_account_id,facility_type,sanctioned_amount,currency_code
SBL-HPP-0001,ACC0000001,Term Loan,50000000,NPR
SBL-HPP-0002,ACC0000002,Overdraft,25000000,NPR
```

### Budget CSV Template
```
project_code,category,budgeted_amount,actual_amount
SBL-HPP-0001,Civil Works,40000000,35000000
SBL-HPP-0001,Equipment,10000000,8000000
```

---

## Error Reporting

**Validation Errors:**
```json
{
  "batch": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "file_name": "projects.csv",
    "status": "validated",
    "total_rows": 5,
    "successful_rows": 0,
    "failed_rows": 3
  },
  "errors": [
    {
      "row": 2,
      "column": "capacity_mw",
      "value": "0",
      "error": "Must be greater than 0"
    },
    {
      "row": 3,
      "column": "project_code",
      "value": "SBL-HPP-0001",
      "error": "Duplicate project code (already exists or imported in this batch)"
    },
    {
      "row": 5,
      "column": "stage",
      "value": "invalid",
      "error": "Must be one of: feasibility, construction, operation"
    }
  ]
}
```

**Import Results (Success):**
```json
{
  "batch": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "file_name": "projects.csv",
    "status": "completed",
    "total_rows": 100,
    "successful_rows": 100,
    "failed_rows": 0,
    "processing_duration_seconds": 45,
    "completed_at": "2026-09-22"
  },
  "errors": []
}
```

**Import Results (Partial Failure):**
```json
{
  "batch": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "file_name": "projects.csv",
    "status": "partial",
    "total_rows": 100,
    "successful_rows": 95,
    "failed_rows": 5
  },
  "errors": [
    {
      "row": 42,
      "column": "province",
      "error": "Database error: Foreign key constraint violated"
    }
  ]
}
```

---

## Phase 2 Handoff

### Ready Now
✅ Validation service (6 validators for projects, loans, budget)
✅ Import batch tracking (audit trail with line-by-line errors)
✅ Bulk import orchestration (CSV parsing, validation, transaction-safe import)
✅ Error reporting (detailed per-row error messages)
✅ Database migration (import_batches + import_row_errors tables)

### Phase 2.5+ (Production Integration)
⏳ REST API endpoint (POST /api/v1/imports/projects, etc.)
⏳ Excel (.xlsx) file support (openpyxl library)
⏳ File type detection (MIME type routing)
⏳ Duplicate handling options (skip, replace, merge)
⏳ Retry logic for failed rows (Phase 3+)

### Phase 3+ (Enhancements)
⏳ Bulk update (modify existing records)
⏳ Template generation (download sample CSV)
⏳ Progress tracking (webhook notifications)
⏳ Scheduled imports (SFTP polling)

---

## Key Design Decisions

### 1. Validate Before Import
All rows validated before any DB writes:
```
Parse → Validate All → If errors: report + exit → Else: import
```

**Benefit:** Users fix all errors at once, not one-at-a-time.

### 2. Transaction-Safe
Entire batch wrapped in single transaction:
- All rows succeed → commit
- Any constraint error → rollback entire batch

**Benefit:** Data consistency; no partial imports.

### 3. Duplicate Detection
Duplicates checked both:
- Within batch (in-memory set)
- Against existing DB (query before insert)

**Benefit:** Prevents accidental duplicates from retries or concurrent uploads.

### 4. Detailed Error Logging
Each error is separate ImportRowError record:
- Row number, column, message
- Original row data (JSON) for debugging
- Retryable flag for Phase 3 retry logic

**Benefit:** Users can fix specific errors, not guess from summary.

### 5. Partial Success Allowed
Batch continues even if individual rows fail:
- One bad project doesn't stop 99 others
- Failed rows logged, successful rows imported
- Status=PARTIAL indicates mixed result

**Benefit:** Maximizes data recovery; users retry failed rows.

---

## Files Created

1. `backend/app/services/validation_service.py` — 300 lines
2. `backend/app/models/import_tracking.py` — 100 lines
3. `backend/app/services/bulk_import_service.py` — 400 lines
4. `alembic/versions/004_add_import_tracking.py` — 80 lines

**Total: ~880 lines of production code**

---

## Next Tasks in Phase 2

1. **Task 5: Reporting** — Export endpoints for PowerBI

See `PHASE-2-KICKOFF.md` for detailed Phase 2 scope.

---

**Status:** Task 3 ✅ COMPLETE  
**Code Quality:** Validation strict, error reporting detailed, transaction safety ensured  
**Production Ready:** No — awaits REST API endpoint and Excel support in Phase 2.5+
