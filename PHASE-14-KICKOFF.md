# Phase 14: Sprint Scope, Commit Hygiene and Demo Readiness — Kickoff

**Status:** 📋 planned 2026-10-10. Nothing started yet.
**Baseline:** `master` @ `fdd0c9f`, CI green at `50b40ab` (979 backend, 174 frontend). The working tree holds uncommitted Phase 11–13 work and migration `026_fiscal_quarter_covenants.py`; see 14.1.
**Drivers:** [`PHASE-12-KICKOFF.md`](PHASE-12-KICKOFF.md), [`PHASE-13-KICKOFF.md`](PHASE-13-KICKOFF.md), [`docs/RFP-GAP-AUDIT.md`](docs/RFP-GAP-AUDIT.md) (static snapshot from 2026-10-01; rows marked ❌ there may already be partly covered)

## Goal

Leave the tree clean and committed, close the audit gap on covenant inputs, and put the remaining
screens and models that do not depend on the bank in front of a demo audience. Items that need the
bank or hosting access stay in Phase 12.

## Working rules for this phase

- The local dev database holds real bank data. Do not run `seed_realistic_data` or
  `seed_test_workflows` against it, and do not run the Playwright suite against it. Use the
  throwaway test database for any suite that writes.
- Commit in split commits by feature, straight to `master`, when asked. Run the backend and
  frontend suites before each commit.
- Every write endpoint must commit. `tests/test_routes_commit.py` enforces this and must stay green.

## Tasks

### 14.1 Commit hygiene — ✅ done 2026-10-10 (not pushed)
- [x] Uncommitted work committed in five splits: `dbc0ccc` covenant fiscal quarters (with migration
      026), `4cf3941` compliance page, `f154c57` portfolio and shared status list, `3be7c92`
      projection page, `30aaf37` RFP gap audit and this kickoff
- [x] Migration 026 committed with the covenant changes. It deletes calendar-keyed covenant rows,
      so it must not be run against the bank-data database without a decision
- [ ] `docs/DEMO-SCRIPT.md` is still untracked: not yet reviewed for commit
- [ ] `docs/GO-TO-MARKET-PLAN.md` and `docs/OUTREACH-EMAIL-DRAFTS.md` are untracked and **kept out
      of git**: they hold named individuals' personal email addresses and a named lead. Decide
      whether they live outside the repo
- [x] `test_data_dictionary` passes now; the bank-import files it complained about are committed
- [x] Local verification before commit: backend 1033 passed, 0 failed, 0 skipped (DB tests run
      against a private PostgreSQL 18 test cluster, UTF8); frontend typecheck clean, 182 passed,
      2 expected failures. CI not yet re-run on the new head

### 14.2 Maker-checker for covenant inputs — ✅ done locally 2026-10-10 (not committed)
- [x] Financial periods change through change requests: entity `FINANCIAL_PERIOD`, keyed by project,
      quarter named in `quarter_ad`. Approval saves through `CovenantService` and re-tests the project
- [x] Sanction terms change through change requests: entity `COVENANT_TERMS`, admin-only in the field
      policy (`backend/app/security/field_policy.py`)
- [x] The approver cannot approve their own request (existing rule, now tested for covenant inputs)
- [x] Direct `PUT .../financials/{quarter}` and `PUT .../terms` answer 409 and name the change request
      to use instead (same approach as project PATCH)
- [x] Tests: `tests/integration/test_covenant_engine.py` (44 pass) covers direct writes closed, two
      checkers required, rejection leaves no trace, validation at proposal time, pre-state recorded,
      admin-only terms with a second admin as final check
- [x] Backend suite on the private test cluster: 1043 passed, 0 failed
- Note: the demo logins include one admin only. A sanction-terms change needs two different admins
  (the submitter cannot give the final approval), so the demo needs a second admin account
- Note: the web app has no screen to propose financial figures, so nothing in the UI can enter them
  today; the seed script still writes them directly (it is seeding, not a user write)

### 14.3 Screens for existing backends — ✅ done locally 2026-10-11 (not committed)
- [x] Scheduled report delivery (F.11): Reports page section. Admins add, pause/resume, run now and
      delete; everyone who can see reports sees the schedules and their run history
- [x] Stakeholder contacts (C.9): Regulatory page section. Admins add, edit and remove; alert types
      and urgency are set per contact (the alert routing itself was already in the backend)
- [x] Insurance policies (E.11): new Insurance tab on project detail. Add, set status; policies that
      expire within 90 days are flagged
- [x] Community engagement and grievances (E.18): new tab. Record a consultation or grievance, mark
      a grievance resolved with how it was resolved
- [x] ESIA monitoring (E.17): new tab. Record a monitoring result and its compliance status
- [x] Filing calendar still ships empty; nothing was invented for it
- Correction: the earlier note said insurance, grievances and ESIA were "on the API only". The
  generic endpoints existed under each project, but no screen did, and nothing called them.
- Not built: insurance expiry alerts through the alert service (the flag on the tab is the only
  warning for now). Edit of the other fields of a record (only status and resolution are editable)
- Not checked in a browser: the screens are covered by unit tests with mocked endpoints. The real
  backend responses were checked by reading the routes, not by running them together
- Frontend: typecheck clean, 188 tests pass, 2 expected failures. ESLint on the changed files is
  clean; 12 lint errors remain in files this phase did not touch

### 14.4 Missing models and the risk register — 🟡 partly done 2026-10-11 (not committed)
The kickoff said these were missing. They were not: migration `012_phase_11_risk_domain` created
the tables, `routes_risk.py` has their CRUD and the auto-scan, and the Gantt already reads milestones
from the backend. What was actually missing was screens and one connection.
- [x] Milestones (C.5): backend existed; added a Milestones tab (list, add). The Gantt was already fed
      from `/projects/{id}/milestones`
- [x] Risk register (E.9, E.19, E.20): added a Risk register tab (list, add with likelihood and impact,
      severity shown from the server, update mitigation status, scan for risks). Auto-scan results are
      shown after each scan
- [ ] Connecting the register to `analytics/risk.py` (`RiskScorer`): **not done, needs a decision.**
      `RiskScorer` has no caller outside its own tests. Its categories (compliance, operational,
      financial, equipment, environmental) do not match the register's (financial, technical, legal,
      environmental, social, climate), so wiring them together needs a mapping the bank has not given
- [ ] Milestone edit (status, forecast date, percent complete) on the screen: only add exists. The
      Gantt is read-only
- [x] Frontend: typecheck clean, 190 tests pass, 2 expected failures; ESLint clean on changed files
- Not checked in a browser; the screens are covered by mocked unit tests, as in 14.3

### 14.5 Defects and cleanup — 🟡 mostly done 2026-10-11 (not committed)
- [x] `AlertRemediationDrawer`: deleted (no page rendered it; only its own re-exports referenced it)
- [x] `ProjectsPage` filter race: fixed. The page built each filter change from the params of its last
      render, so a second change in the same render cycle overwrote the first. It now tracks the latest
      params itself. Un-fixmed the Playwright test (`frontend/e2e/1-projects-workflow.spec.ts`) and added
      `frontend/src/pages/projectsFilters.test.tsx`, which fails on the old code with the same assertion
      and passes on the fix. **The Playwright test itself has not been run**
- [x] `consortium_exposure_v`: nothing queried it and no migration created it. The model mapping was
      removed, and the data dictionary regenerated. The gap audit row that cited it is now 🟡.
      Consortium exposure reporting is not built; if the bank needs it, it must be designed first
- [ ] Admin page `e2e.*` accounts: **not verifiable from the repo.** No script or test in the repo
      creates them; `seed_test_workflows.py` does not. They probably came from earlier local runs. Not
      checked against the dev database, which holds bank data. Confirm there, then delete them or
      document their source
- Verification: backend 1043 passed, 0 failed, 0 skipped (private test cluster). Frontend 191 passed,
  2 expected failures. ESLint on the touched files: clean, except one pre-existing warning in
  `CovenantDetailDrawer.tsx`

### 14.6 Load test on production-like settings — not started
- [ ] Run `backend/scripts/load_test.py` with `DEBUG=false`, several workers and a sized connection
      pool (or PgBouncer), on the test database with the synthetic seed
- [ ] Record results beside the Phase 12 table, same columns, same user counts (25 and 100)
- [ ] Note the hardware; the Phase 12 numbers came from a development laptop

## Needed from others

**From the project owner**
1. Decide whether CSR tracking (E.25) is in the proof of concept (14.4)
2. Confirm the demo audience and the date, so 14.3 and 14.5 can be ordered by what the demo shows
3. Trigger the Render deploy (carried over from Phase 12) so the hosted API matches the frontend

**From the bank** (carried over from Phase 12; nothing in this phase blocks on them)
- Filing calendar requirements for the Regulatory page
- Confirmation of calendar versus Nepali fiscal quarters for covenants

## Notes

- The Phase 13 item "scheduled report delivery" was listed under both 13.2 and 13.3 there; it is
  tracked only here, under 14.3.
- Maker-checker for covenant inputs changes what admins can do directly. Tell the bank's
  stakeholders before the demo, since the demo script may show direct entry.

## Definition of done

The working tree is clean and `master` is green in CI; covenant inputs go through maker-checker
with tests; the screens in 14.3 and the models in 14.4 (except any CSR item the owner defers) are
reachable from the app and covered by tests; the defects in 14.5 are closed; the 14.6 load test is
recorded beside the Phase 12 results.
