# Phase 11 test data

Three scripts, run from the repository root with the project virtualenv. They use `DATABASE_URL`.

```bash
python -m backend.scripts.seed_realistic_data
python -m backend.scripts.validate_data_integrity
```

## `seed_realistic_data.py`

**Deletes every project, loan, tranche, repayment and project-ownership row, and the generation,
hydrology, land, governance and ESG records of projects**, then creates 50 synthetic projects. It fails (rather than deleting more) if other tables still reference a project.

- Names are illustrative; all figures are synthetic. Output is deterministic, including project
  ids, so re-running gives the same data.
- Provinces, stages and pipeline statuses use the application's own values, and every status is
  one that fits its stage.
- Projects in feasibility (16) have no loan. The other 34 have one loan each with 3-5 tranches
  that add up to the disbursed amount and a semi-annual schedule: interest-only during a 1-3 year
  grace period, then equal principal instalments, interest on the reducing balance.
- Instalments due on or before today are paid; later ones are not. About one loan in ten has
  missed its most recent instalment.
- Covenant metrics (DSCR/LTV/ICR) are left empty for the application to calculate.
- The 17 operating projects also get a PPA, six months of generation, hydrology, land acquisition,
  directors, shareholders, ESG metrics and EIA measures, so the project tabs have data.

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
