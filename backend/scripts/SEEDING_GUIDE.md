# Phase 11 test data

Three scripts, run from the repository root with the project virtualenv. They use `DATABASE_URL`.

```bash
python -m backend.scripts.seed_realistic_data
python -m backend.scripts.validate_data_integrity
```

## `seed_realistic_data.py`

**Deletes every project and everything attached to one** (loans, schedules, rate history, milestones,
risks, licences, reported financials, covenant terms and history, operations records, ownership) **and all maker-checker requests**,
then creates the test portfolio. It fails rather than deleting more if another table still references
a project. Run `seed_test_workflows` afterwards to recreate the change requests.

- **Real identity, synthetic lending.** The 50 projects are taken from
  `backend/data/merged_hydropower_master.csv` (Niti Foundation / DoED licence list): name, capacity,
  river, province, district and municipality are real, and the licence type sets the stage
  (17 operating, 17 under construction, 16 in feasibility). Everything about the bank's exposure is
  generated: loans, COD dates, covenants, milestones, risks, operations, governance and ESG figures.
  The source has no Madhesh projects and no Nepali names.
- Deterministic, including project ids, so re-running gives the same portfolio.
- Feasibility projects have a survey licence only. The other 34 have:
  - one loan with 3-5 tranches adding up to the disbursed amount, a semi-annual schedule
    (interest-only grace, then equal principal, interest on the reducing balance) and a rate history;
    instalments already due are paid, and about one loan in ten has missed its latest one
  - six construction milestones tied to the COD dates (a slipped COD shows delayed milestones)
  - two or three risk register entries
  - eleven quarters of reported figures (`project_financial_periods`): a yearly valuation of the
    security, and for operating projects income, costs, royalty and depreciation. Revenue is the
    generation revenue of the quarter's months. A few projects' costs climb until coverage fails.
  - covenant history that is **calculated, not seeded**: the seed ends by running the covenant
    engine over those figures. Operating projects get DSCR, ICR and LTV; projects under
    construction have no income, so only LTV is tested.
  - a handful of projects carry their own sanction terms (`covenant_terms`) instead of the bank defaults
  - a DoED licence; three are close to expiry or lapsed
- The 17 operating projects also have a PPA with NEA wet/dry rates, twelve months of generation and
  plant performance, maintenance schedules and logs, hydrology, land acquisition, directors,
  shareholders, ESG metrics and EIA measures.
- Dates carry their Bikram Sambat equivalents.
- Covenant metrics on the loan itself (DSCR/LTV/ICR) are the engine's latest result for its project.

## `validate_data_integrity.py`

Reports errors and exits 1 if any of these do not hold:

- project stage and pipeline status are known values that fit together; capacity is positive
- disbursed <= sanctioned; tranches add up to disbursed
- outstanding principal = disbursed - principal repaid; the schedule repays exactly what was drawn
- each instalment's interest matches the balance at the start of the period
- instalments are semi-annual; nothing is paid beyond what was due or on a future date
- days past due matches the due date for unpaid instalments and is zero otherwise
- the audit log hash chain verifies (`audit_chain.verify_stored_chain`)

## `seed_test_workflows.py`

Creates maker-checker change requests in the submitted, recommended, approved and rejected states by
calling `MutationService`, so approval steps and audit entries are the application's own; the
approved one really moves its project's forecast COD. It also makes the built-in demo `maker`
account the owner of four financed projects, so the flow can be exercised by signing in as `maker`,
`approver` and `admin`. It does nothing if its requests already exist (audit entries are
append-only). Run `seed_realistic_data` first.

## Tests

`tests/integration/test_phase11_seed_data.py` covers the generators, the validator, both seed
scripts and the API over seeded data; `test_maker_checker_db.py` covers the workflow end to end. The database-backed tests need a throwaway Postgres database
(see `tests/conftest.py`): either let the role create one, or create it once and reuse it:

```bash
TEST_DATABASE_URL=postgresql://user:pass@host:5432/hpms_test TEST_DATABASE_REUSE=1 pytest tests
```
