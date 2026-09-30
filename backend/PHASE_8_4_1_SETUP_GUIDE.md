# Phase 8.4.1: Airflow Setup – Implementation Guide

## Status: Ready to Build in Next Context

You now have all the design documentation and schemas. Here's what needs to be done in Phase 8.4.1:

---

## Step 1: Install Airflow

```bash
pip install apache-airflow==2.6.3
pip install apache-airflow-providers-apache-spark
pip install apache-airflow-providers-postgres
pip install apache-airflow-providers-http
```

Add to requirements.txt:
```
apache-airflow==2.6.3
apache-airflow-providers-postgres>=5.0.0
apache-airflow-providers-http>=4.0.0
```

## Step 2: Initialize Airflow

```bash
export AIRFLOW_HOME=/opt/airflow
airflow db init
airflow webserver --port 8080
airflow scheduler
```

## Step 3: Create Airflow Database

Run the Alembic migration:
```bash
cd backend
alembic upgrade head
```

This creates:
- `airflow_loan_dag_runs` – Track DAG executions
- `loan_reconciliation_log` – Track reconciliation decisions
- `loan_data_provenance` – Track data lineage

## Step 4: Create Directory Structure

```
backend/
├── app/
│   ├── etl/
│   │   ├── __init__.py
│   │   ├── airflow_config.py
│   │   ├── dags/
│   │   │   ├── __init__.py
│   │   │   └── loan_exposure_etl.py
│   │   ├── extractors/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── bank_api_extractor.py
│   │   │   └── finacle_cbs_extractor.py
│   │   ├── reconcilers/
│   │   │   ├── __init__.py
│   │   │   ├── deduplicator.py
│   │   │   ├── merger.py
│   │   │   └── validator.py
│   │   └── loaders/
│   │       ├── __init__.py
│   │       └── database_loader.py
│   ├── models/
│   │   └── etl.py (already created)
│   └── ...
├── dags/
│   ├── __init__.py
│   └── loan_sync_etl.py (Airflow looks for DAGs here)
└── ...
```

## Step 5: Update Models

Add to `backend/app/models/__init__.py`:
```python
from backend.app.models.etl import (
    AirflowLoanDAGRun,
    LoanReconciliationLog,
    LoanDataProvenance,
)
```

Update `backend/app/models/financial.py` LoanAccount class:
```python
# Add relationships
reconciliation_logs = relationship('LoanReconciliationLog', back_populates='loan')
provenance_records = relationship('LoanDataProvenance', back_populates='loan')
dag_runs = relationship('AirflowLoanDAGRun', secondary='association_loan_dag_runs')
```

## Step 6: Create Core Services

### 8.4.2 Extract Layer (~400 LOC)

**backend/app/etl/extractors/base.py:**
```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any

class DataExtractor(ABC):
    @abstractmethod
    async def extract(self) -> List[Dict[str, Any]]:
        pass
    
    @abstractmethod
    def validate_schema(self, data: Dict[str, Any]) -> bool:
        pass
```

**backend/app/etl/extractors/bank_api_extractor.py:**
- BankAPIExtractor class
- Fetch from BANK_A, BANK_B endpoints
- Parse JSON responses
- Validate schema (amount, tenor, dscr, etc.)
- Retry logic

**backend/app/etl/extractors/finacle_cbs_extractor.py:**
- FinacleCBSExtractor class
- Query Finacle database
- Transform ORM objects to loan dicts
- Handle connection pooling

### 8.4.3 Reconcile Layer (~300 LOC)

**backend/app/etl/reconcilers/deduplicator.py:**
- Group loans by (project_code, facility_type)
- Detect duplicates from multiple sources
- Rank by source priority (FINACLE > BANK_A > BANK_B > CSV)
- Return canonical loan + conflicts list

**backend/app/etl/reconcilers/merger.py:**
- Merge fields from multiple sources
- Apply tolerance rules (2% for amount, 0.5% for rates)
- Flag conflicts for manual review
- Log decision to reconciliation_log

**backend/app/etl/reconcilers/validator.py:**
- Validate DSCR/LTV/ICR within bounds
- Check concentration limits (5% per project)
- Validate required fields present
- Return validation report

### 8.4.4 Load Layer (~200 LOC)

**backend/app/etl/loaders/database_loader.py:**
- Reuse LoanExposureService.validate_and_ingest() from Phase 8.2
- Upsert to loan_accounts
- Log to loan_exposure_sync_history
- Track provenance (which source each field came from)
- Trigger email alerts

## Step 7: Create DAG Definition

**backend/dags/loan_sync_etl.py:**
```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

with DAG(
    dag_id='loan_exposure_etl',
    schedule_interval='0 2 * * *',
    start_date=datetime(2026, 10, 1),
    catchup=False,
) as dag:
    # Task 1: Extract
    extract_bank_a = PythonOperator(task_id='extract_bank_a', python_callable=...)
    extract_bank_b = PythonOperator(task_id='extract_bank_b', python_callable=...)
    extract_finacle = PythonOperator(task_id='extract_finacle', python_callable=...)
    
    # Task 2: Reconcile
    reconcile = PythonOperator(
        task_id='reconcile',
        python_callable=...,
        trigger_rule='all_done',  # Run even if some extracts fail
    )
    
    # Task 3: Load
    load = PythonOperator(task_id='load', python_callable=...)
    
    # Dependencies
    [extract_bank_a, extract_bank_b, extract_finacle] >> reconcile >> load
```

## Step 8: Testing

```bash
# Test DAG syntax
airflow dags test loan_exposure_etl 2026-10-01

# Check Airflow UI
open http://localhost:8080

# Monitor DAG run
airflow dags list-runs --dag-id loan_exposure_etl

# Check task logs
airflow tasks logs loan_exposure_etl extract_bank_a 2026-10-01
```

---

## Checklist for Phase 8.4.1

- [ ] Airflow installed and initialized
- [ ] Alembic migration run (`alembic upgrade head`)
- [ ] Directory structure created
- [ ] Models imported in __init__.py
- [ ] LoanAccount model relationships updated
- [ ] Base extractor class created
- [ ] BankAPIExtractor implemented
- [ ] FinacleCBSExtractor implemented
- [ ] Deduplicator logic implemented
- [ ] Merger logic implemented
- [ ] Validator logic implemented
- [ ] DatabaseLoader implemented
- [ ] loan_sync_etl.py DAG defined
- [ ] DAG tested successfully
- [ ] Airflow UI shows DAG (http://localhost:8080)

---

## Files Created So Far

✅ **PHASE_8_4_DESIGN.md** – Architecture & design
✅ **alembic/versions/010_phase_8_4_etl.py** – Database schema migration
✅ **backend/app/models/etl.py** – SQLAlchemy models (AirflowLoanDAGRun, etc.)

## Files to Create in Phase 8.4.1

**Extractors:**
- backend/app/etl/extractors/__init__.py
- backend/app/etl/extractors/base.py
- backend/app/etl/extractors/bank_api_extractor.py
- backend/app/etl/extractors/finacle_cbs_extractor.py

**Reconcilers:**
- backend/app/etl/reconcilers/__init__.py
- backend/app/etl/reconcilers/deduplicator.py
- backend/app/etl/reconcilers/merger.py
- backend/app/etl/reconcilers/validator.py

**Loaders:**
- backend/app/etl/loaders/__init__.py
- backend/app/etl/loaders/database_loader.py

**DAGs:**
- backend/dags/__init__.py
- backend/dags/loan_sync_etl.py

**Configuration:**
- backend/app/etl/__init__.py
- backend/app/etl/airflow_config.py

---

## Next Context Work

Since you're working on this in another context, you have:
1. ✅ Complete design document (PHASE_8_4_DESIGN.md)
2. ✅ Database schema ready (migration + models)
3. 📋 Clear implementation checklist above
4. 📋 File structure documented
5. 📋 Code templates provided

**Estimated time:** 3-4 hours for Phase 8.4.1 setup + initial testing

---

**Status:** Phase 8.4 design complete; Phase 8.4.1 ready to build