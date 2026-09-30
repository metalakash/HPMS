# Phase 8.4: Enterprise ETL – Design & Research

## Overview

Upgrade from simple scheduled syncs (APScheduler) to **Airflow DAGs** for production-grade multi-source loan data integration with reconciliation, advanced error handling, and historical tracking.

---

## Current State (Phase 8.3.2)

**What Works:**
- Single-source bank API syncs via APScheduler
- Manual CSV uploads via API
- Finacle CBS integration **not yet implemented** (placeholder)
- Basic error handling + retry on failure
- Email alerts on policy violations

**Limitations:**
- Only one active sync at a time (APScheduler single-threaded)
- No reconciliation between sources (if bank A + bank B both report same loan, no dedup)
- No historical versioning of loan data
- Hard to scale to 100+ concurrent syncs
- Difficult to handle complex dependencies (A → B → C pipeline)

---

## Phase 8.4: Target Architecture

### Why Airflow?

| Feature | APScheduler | Airflow |
|---------|-------------|---------|
| Multi-source syncs | Sequential | Parallel DAGs |
| Reconciliation | Not supported | Task dependencies |
| Error recovery | Basic retry | Advanced retry + SLA |
| Monitoring | Logs | UI dashboard |
| Scaling | Single instance | Multi-worker |
| Data lineage | None | Full tracking |
| Historical audit | Manual | Built-in |

### Three-Tier ETL Pipeline

```
Tier 1: EXTRACT
  ├─ Bank A API → Parse → Validate
  ├─ Bank B API → Parse → Validate
  ├─ Finacle CBS → Query → Transform
  └─ CSV Upload → Parse → Validate

Tier 2: RECONCILE
  ├─ Deduplicate (same loan from multiple sources)
  ├─ Merge (select canonical version)
  ├─ Validate (DSCR, LTV, concentrations)
  └─ Flag conflicts (data quality issues)

Tier 3: LOAD
  ├─ Upsert loan_accounts
  ├─ Log to loan_exposure_sync_history
  ├─ Trigger policy violation alerts
  └─ Update data_provenance (track source)
```

### DAG Structure

```
start_dag
  ↓
fetch_bank_a_loans → parse_bank_a → validate_bank_a
fetch_bank_b_loans → parse_bank_b → validate_bank_b
fetch_finacle_cbs → query_finacle → transform_finacle
fetch_csv_upload → parse_csv → validate_csv
  ↓ (join all)
reconcile_deduplicate → reconcile_merge → reconcile_validate
  ↓
load_to_database → log_history → trigger_alerts
  ↓
end_dag
```

---

## Implementation Plan

### Phase 8.4.1: Airflow Setup
- Install airflow, webserver, scheduler
- Configure PostgreSQL backend for Airflow metadata
- Set up DAG directory structure
- Create base DAG class with logging/error handling

### Phase 8.4.2: Extract Layer
- Bank A API fetcher (HTTP → JSON parse → validate schema)
- Bank B API fetcher (same)
- Finacle CBS querier (SQL query → transform ORM objects)
- CSV upload handler (already exists in 8.2, reuse)

### Phase 8.4.3: Reconcile Layer
- Dedupe logic (group by project_code + facility_type, select latest/canonical)
- Merge logic (consolidate fields from multiple sources)
- Validation (DSCR/LTV/ICR covenant checks)
- Conflict flagging (data quality alerts)

### Phase 8.4.4: Load Layer
- Upsert to loan_accounts (Phase 8.2 service, reuse)
- Log to sync_history (Phase 8.3.1 service, reuse)
- Trigger email alerts (Phase 8.3.2 service, reuse)
- Update data_provenance (track which source each field came from)

### Phase 8.4.5: Monitoring & UI
- Airflow web UI (task logs, DAG runs, SLA monitoring)
- Custom dashboards (reconciliation metrics)
- Alert integration (email on DAG failures)

---

## Key Entities

### LoanSyncDAGRun (new)
Tracks each Airflow DAG execution:
- dag_id, run_id, start_time, end_time
- status (running, success, failed, partial_success)
- total_extracted, total_reconciled, total_loaded
- reconciliation_conflicts (count of data conflicts)
- provenance_log (which source provided each field)

### LoanReconciliationLog (new)
Tracks reconciliation decisions:
- loan_account_id
- source_a, source_b (which sources conflicted)
- conflict_type (DSCR mismatch, LTV mismatch, amount mismatch, etc.)
- resolution (keep_source_a, keep_source_b, manual_review)
- resolved_by (system rule or user)
- resolved_at

### LoanDataProvenance (new)
Track source of each field:
- loan_account_id
- field_name (principal_amount, interest_rate, dscr, etc.)
- source (BANK_A, BANK_B, FINACLE_CBS, CSV_UPLOAD)
- last_updated_at
- last_updated_by_dag_run_id

---

## Reconciliation Logic

### Deduplication
Group loans by:
1. project_code + facility_type (unique identifier in Nepal hydropower)
2. Principal amount (within 2% tolerance)
3. Tenor (must match)

If multiple sources report same loan:
- **Finacle CBS wins** (source of truth)
- Bank APIs are second-hand data
- CSV uploads are manual entry (lowest trust)

```python
def get_canonical_loan(loan_sources):
    # Rank by source trust
    priority = {
        "FINACLE_CBS": 1,
        "BANK_A": 2,
        "BANK_B": 3,
        "CSV_UPLOAD": 4,
    }
    return max(loan_sources, key=lambda l: priority[l.source])
```

### Merge Strategy
For conflicting fields:
- **DSCR/LTV/ICR:** Use canonical source
- **Principal:** Use if within 2% of canonical (else flag conflict)
- **Interest rate:** Average if within 0.5% (else flag conflict)
- **Tenor:** Must match exactly (else flag as error)
- **Repayment schedule:** Use canonical source

### Validation
After merge:
- DSCR, LTV, ICR within reasonable bounds (Phase 8.1 caps)
- No negative amounts
- Tenor > 0
- Grace period <= tenor
- Concentration checks (single project ≤ 5% portfolio, single bank ≤ 30%)

---

## Error Handling & Retries

**Task-level retries:**
```python
task = BashOperator(
    task_id="fetch_bank_a",
    bash_command="curl https://bank-a.api/loans",
    retries=3,
    retry_delay=timedelta(minutes=5),
    execution_timeout=timedelta(minutes=30),
)
```

**DAG-level error handling:**
```python
default_args = {
    "owner": "hpms-etl",
    "depends_on_past": False,
    "email": ["alerts@bank.com"],
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(hours=1),
}
```

**SLA monitoring:**
```python
sla = timedelta(hours=2)  # DAG must complete within 2 hours
```

---

## Database Changes

New tables:

```sql
-- Track DAG runs
CREATE TABLE airflow_loan_dag_runs (
    id UUID PRIMARY KEY,
    dag_id VARCHAR NOT NULL,
    run_id VARCHAR NOT NULL,
    status VARCHAR,  -- running, success, failed, partial_success
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INT,
    total_extracted INT,
    total_reconciled INT,
    total_loaded INT,
    reconciliation_conflicts INT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track reconciliation decisions
CREATE TABLE loan_reconciliation_log (
    id UUID PRIMARY KEY,
    loan_account_id UUID REFERENCES loan_accounts(id),
    dag_run_id UUID REFERENCES airflow_loan_dag_runs(id),
    source_a VARCHAR,
    source_b VARCHAR,
    conflict_type VARCHAR,  -- DSCR_MISMATCH, LTV_MISMATCH, etc.
    resolution VARCHAR,
    resolved_by VARCHAR,  -- SYSTEM_RULE, MANUAL_REVIEW
    conflict_details JSONB,  -- {source_a: {...}, source_b: {...}}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track data provenance
CREATE TABLE loan_data_provenance (
    id UUID PRIMARY KEY,
    loan_account_id UUID REFERENCES loan_accounts(id),
    field_name VARCHAR,
    source VARCHAR,
    last_updated_at TIMESTAMP,
    last_updated_by_dag_run_id UUID REFERENCES airflow_loan_dag_runs(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Configuration

### Environment Variables

```bash
# Airflow
AIRFLOW_HOME=/opt/airflow
AIRFLOW__CORE__DAGS_FOLDER=/opt/airflow/dags
AIRFLOW__CORE__PLUGINS_FOLDER=/opt/airflow/plugins
AIRFLOW__CORE__EXECUTOR=LocalExecutor  # or CeleryExecutor for distributed
AIRFLOW__CORE__SQL_ALCHEMY_CONN=postgresql://user:pass@db:5432/airflow

# Data sources
BANK_A_API_URL=https://bank-a.com/api/loans
BANK_A_API_KEY=xxx
BANK_B_API_URL=https://bank-b.com/api/loans
BANK_B_API_KEY=xxx
FINACLE_HOST=finacle.db.internal
FINACLE_USER=etl_user
FINACLE_PASSWORD=xxx

# Reconciliation
RECONCILIATION_DSCR_TOLERANCE=0.05  # 5%
RECONCILIATION_LTV_TOLERANCE=2  # 2 percentage points
RECONCILIATION_AMOUNT_TOLERANCE=0.02  # 2%

# Alerts
ETL_ALERT_EMAIL=alerts@bank.com
ETL_SLA_HOURS=2
```

---

## Deliverables

### Phase 8.4.1: Airflow Setup
- ✅ Airflow installation & configuration
- ✅ PostgreSQL metadata backend
- ✅ DAG directory structure
- ✅ Base DAG class with logging

### Phase 8.4.2: Extract Layer (~400 LOC)
- ✅ BankAFetcher class
- ✅ BankBFetcher class
- ✅ FinacleCBSFetcher class
- ✅ CSVUploadHandler (reuse 8.2)
- ✅ Schema validation for each source

### Phase 8.4.3: Reconcile Layer (~300 LOC)
- ✅ LoanDeduplicator class
- ✅ LoanMerger class
- ✅ LoanValidator class
- ✅ ConflictLogger class

### Phase 8.4.4: Load Layer (~200 LOC)
- ✅ LoanUpsertService (reuse 8.2)
- ✅ SyncHistoryLogger (reuse 8.3.1)
- ✅ Provenance tracker
- ✅ Alert trigger (reuse 8.3.2)

### Phase 8.4.5: DAG Definition (~200 LOC)
- ✅ LoanSyncDAG class
- ✅ Task definitions & dependencies
- ✅ Error handling & retry logic
- ✅ SLA monitoring

### Documentation
- ✅ PHASE_8_4_SUMMARY.md
- ✅ ETL_ARCHITECTURE.md
- ✅ RECONCILIATION_RULES.md
- ✅ FINACLE_CBS_INTEGRATION.md
- ✅ Airflow setup guide

---

## Timeline

| Phase | Task | Hours | Status |
|-------|------|-------|--------|
| 8.4.1 | Airflow setup | 1 | Next |
| 8.4.2 | Extract layer | 2 | After 8.4.1 |
| 8.4.3 | Reconcile layer | 2 | After 8.4.2 |
| 8.4.4 | Load layer | 1 | After 8.4.3 |
| 8.4.5 | DAG definition | 1.5 | After 8.4.4 |
| | **Total** | **7.5 hours** | |

---

## Success Criteria

✅ Airflow DAG executes successfully (all tasks complete)
✅ Multi-source fetch works (Bank A, B, Finacle, CSV)
✅ Reconciliation deduplicates 100% of duplicates
✅ Data provenance tracked per field
✅ Conflict log captures all mismatches
✅ Loans upserted to database
✅ Policy violation alerts trigger
✅ DAG completes within 2-hour SLA
✅ Error emails sent on failure
✅ Airflow UI shows clean DAG visualization

---

## Dependencies

```
airflow>=2.6.0
airflow-providers-apache-spark>=3.0.0
airflow-providers-sftp>=4.0.0
sqlalchemy>=2.0.0
pandas>=1.5.0
psycopg2-binary>=2.9.0
```

---

## Next Steps

**Phase 8.4.1:** Start with Airflow setup + database schema changes

Ready to begin? 🚀