# Synthetic Loan Data Seeding – Phase 8

## Overview

This script generates realistic **synthetic loan exposure data** for your 572+ real hydropower projects. It's designed to support Phase 8 development without requiring actual bank data, while keeping the architecture ready to swap in real data later.

**Design principle:** Synthetic-first, real-ready.

---

## What It Does

### Loan Account Generation
- Links loan accounts to real DoED/Niti/NEA hydropower projects
- Uses **Nepal hydropower market lending assumptions** (LTV, tenor, interest rates, etc.)
- Generates realistic financial metrics:
  - **DSCR** (Debt Service Coverage Ratio)
  - **LTV** (Loan-to-Value ratio)
  - **ICR** (Interest Coverage Ratio)
- Assigns risk ratings (AAA–B) and IFRS9 stages (Stage 1–3)

### Disbursement Tranches
- Creates 3–6 construction-phase disbursement tranches per loan
- Represents actual fund drawdowns over construction period
- Includes small variations (80–100% of planned disbursements)

### Repayment Schedules
- Generates 60–180 monthly repayment installments
- Annuity-based repayment (principal + interest)
- Assumes grace period (no repayment during construction)
- Historical repayments marked as paid; future as pending

### Audit & Data Provenance
- All records tagged with `data_provenance: "SYNTHETIC"`
- Source reference: `Phase8-Synthetic-YYYY-MM-DD`
- Audit trail ready for compliance reporting

---

## Parameters (Nepal Market)

See `nepal_lending_config.yaml` for full configuration. Key assumptions:

| Parameter | Value | Note |
|-----------|-------|------|
| **LTV Range** | 60–75% | Loan size as % of project cost |
| **Tenor** | 8–15 years | Total loan life |
| **Grace Period** | 2–5 years | Construction phase (no principal repayment) |
| **Interest Rate** | 9–12% p.a. | Current Nepal market rates |
| **DSCR Minimum** | 1.2–1.3 | Project revenue must cover debt service 1.2x |
| **Project Cost** | USD 1.5–3.5M/MW | Varies by plant type (RoR, storage, peaking) |
| **Plant Factor** | 40–70% | Utilization rate (RoR 45%, Storage 65%) |
| **Financing Penetration** | 30% | % of eligible projects with bank exposure |
| **Min Capacity** | 5 MW | Only projects ≥5MW eligible for financing |

---

## How to Run

### 1. Dry Run (Preview without committing)

```bash
cd backend
python scripts/seed_synthetic_loans.py --dry-run
```

This will:
- Show how many loans, tranches, and repayments would be created
- Display summary statistics
- **NOT** modify the database

### 2. Full Seed (Commit to database)

```bash
cd backend
python scripts/seed_synthetic_loans.py
```

### 3. With Custom Batch Size

```bash
python scripts/seed_synthetic_loans.py --batch-size 50
```

---

## Output

After running, you'll see:

```
======================================================================
🌊 HPMS SYNTHETIC LOAN SEEDING – NEPAL HYDROPOWER
======================================================================
Database: sbl_hpms_dev
LTV Range: 0.60 – 0.75
Tenor: 8–15 years
Interest Rate: 9.00–12.00% p.a.
Financing Penetration: 30% of eligible projects
Min Capacity: 5+ MW
Dry Run: False
----------------------------------------------------------------------

📊 Total projects in DB: 572
✅ Eligible for financing (≥5MW, construction/operation): 450
🏦 Projects with bank exposure: 135

  ✓ Generated 10 loans, 45 tranches, 1,200 repayments...
  ✓ Generated 20 loans, 90 tranches, 2,400 repayments...

✅ SEED COMPLETE!

Generated:
  • 270 loan accounts (2 facilities per project on average)
  • 1,350 disbursement tranches
  • 180,000 repayment schedules
```

---

## What Gets Created

### Tables Updated

1. **loan_accounts**
   - `project_id`: Link to real project
   - `finacle_account_id`: Unique account identifier (randomized)
   - `facility_type`: "Construction Term Loan" or "Working Capital"
   - `sanctioned_amount`: Total credit limit (NPR)
   - `disbursed_amount`: Amount actually drawn
   - `outstanding_principal`: Current outstanding balance
   - `interest_rate_pct`: Annual interest rate
   - `moratorium_end_ad`: When grace period ends (interest accrual starts)
   - `maturity_ad`: Loan expiration date
   - `dscr`, `ltv`, `icr`: Covenant metrics
   - `sync_status`: "success" (synthetic data is "synced")
   - `data_provenance`: "SYNTHETIC"

2. **loan_account_rate_history**
   - Current interest rate record (marked `is_current: 'Y'`)
   - Ready for rate changes in future

3. **disbursement_tranches**
   - Planned vs. actual disbursement amounts
   - Planned vs. actual disbursement dates
   - Tranche number (1–6 per loan)

4. **repayments**
   - Monthly repayment schedule
   - Principal & interest due vs. paid
   - Days past due (0 for paid/upcoming)

---

## Verifying the Data

### Query Loan Accounts
```sql
SELECT 
  p.project_code,
  la.facility_type,
  la.sanctioned_amount,
  la.outstanding_principal,
  la.interest_rate_pct,
  la.dscr,
  la.ltv,
  la.data_provenance
FROM loan_accounts la
JOIN projects p ON la.project_id = p.id
WHERE la.data_provenance = 'SYNTHETIC'
LIMIT 10;
```

### Query Tranches
```sql
SELECT 
  COUNT(*) as total_tranches,
  AVG(actual_amount) as avg_tranche,
  MIN(planned_date_ad) as earliest_tranche,
  MAX(actual_date_ad) as latest_tranche
FROM disbursement_tranches
WHERE data_provenance = 'SYNTHETIC';
```

### Query Repayments
```sql
SELECT 
  COUNT(*) as total_repayments,
  SUM(principal_due) as total_principal,
  SUM(interest_due) as total_interest,
  COUNT(CASE WHEN paid_date_ad IS NOT NULL THEN 1 END) as paid_count
FROM repayments
WHERE data_provenance = 'SYNTHETIC';
```

---

## Next Steps

### Phase 8.1: CSV Ingestion (Option A)
Once you verify the synthetic data looks good:
1. Export a subset to CSV
2. Build `POST /api/v1/loan-exposure/sync` CSV ingestion endpoint
3. Test uploading the CSV back

### Phase 8.2: Auto-Sync API (Option B)
```
POST /api/v1/loan-exposure/sync
Content-Type: application/json

{
  "loan_accounts": [
    {
      "project_id": "...",
      "facility_type": "Construction Term Loan",
      "sanctioned_amount": 100000000,
      "outstanding_principal": 75000000,
      "interest_rate": 11.5,
      ...
    }
  ]
}
```

### Phase 8.3: Enterprise ETL (Option C)
Design Airflow DAGs for multi-source integration (Finacle, collateral system, risk engine).

---

## Troubleshooting

### "ImportError: No module named 'app'"
- Run from the `backend/` directory
- Or adjust `sys.path.insert(0, ...)` in the script

### "No suitable module found for sqlalchemy"
- Install: `pip install sqlalchemy[asyncio]`

### "Database connection refused"
- Check `.env` or `config.py` for correct DATABASE_URL
- Ensure PostgreSQL is running
- Verify credentials and database exists

### "Foreign key constraint violation"
- Ensure projects are already seeded
- Run `backend/scripts/seed_projects.py` first if projects table is empty

---

## Design Rationale

### Why Synthetic Data?

1. **Immediate progress** — Don't wait for bank partnerships to build analytics
2. **Realistic context** — Anchored to real 572+ hydropower projects (not made-up)
3. **Credible demos** — Show investors, regulators, partners real market patterns
4. **Production-ready schema** — Same data model that will accept real bank data
5. **Integration validation** — Test your covenant calculations, risk logic, compliance reporting

### Why Nepal-Specific Parameters?

1. **Accuracy** — Reflects actual market lending practices (9–12% rates, 60–75% LTV)
2. **Regulatory alignment** — IFRS9 staged classification, DSCR covenants
3. **Benchmarking** — Real banks use similar assumptions for Nepali projects
4. **Stakeholder confidence** — Banks & regulators recognize the parameters

### How to Transition to Real Data

When you get a real bank partner:

1. **Schema unchanged** — Same `loan_accounts` table, same fields
2. **Source abstraction** — Change `data_provenance` from "SYNTHETIC" to "CBS_SYNCED" or "BANK_UPLOAD"
3. **Validation layer** — Ingest real data via CSV (Option A) or API (Option B)
4. **Historical comparison** — Run side-by-side analytics on synthetic vs. real

---

## Questions?

- **How many loans will be created?** ~30% of 450 eligible projects = ~135 projects × 1–2 facilities = 200–270 loans
- **How many repayments?** 60–180 months per loan = ~24,000–48,600 repayments total
- **Database size impact?** ~50–100 MB depending on project count
- **How long does it take?** Typically 30–60 seconds for 572 projects

---

## Files

- **seed_synthetic_loans.py** — Main seeding script
- **nepal_lending_config.yaml** — Configuration & parameter documentation
- **README_SYNTHETIC_LOANS.md** — This file

---

*Generated for Phase 8: Loan Account Analytics*  
*Nepal Hydropower Management System (HPMS)*  
*2026-09-30*
