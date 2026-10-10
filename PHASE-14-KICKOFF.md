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

### 14.1 Commit hygiene — not started
- [ ] Commit the uncommitted Phase 11–13 changes in logical splits (covenant engine, CBS adapters
      and checker, portfolio pages reading real data, Reports and Regulatory screens, load test,
      deploy safety, docs)
- [ ] Commit `alembic/versions/026_fiscal_quarter_covenants.py` with the covenant changes it depends on
- [ ] Commit or deliberately discard `docs/DEMO-SCRIPT.md`, `docs/GO-TO-MARKET-PLAN.md` and
      `docs/OUTREACH-EMAIL-DRAFTS.md`
- [ ] Confirm `test_data_dictionary` passes after the import-related files are reviewed (it failed
      locally while the bank-import files were uncommitted)
- [ ] Re-run backend, frontend and CI on the resulting head

### 14.2 Maker-checker for covenant inputs — not started
- [ ] Route creation and changes of `project_financial_periods` through the change-request flow
      (today they are written directly by admin and owning maker, audited)
- [ ] Route changes to `covenant_terms` through the same flow
- [ ] Approver cannot approve their own request (existing maker-checker rule applies)
- [ ] Tests: direct write refused for maker and admin; approved change reaches the table; rejected
      change does not

### 14.3 Screens for existing backends — not started
- [ ] Scheduled report delivery (F.11): screen on the Reports page for the existing schedule API
- [ ] Stakeholder contacts (C.9) and their use in alert routing: list, add, edit
- [ ] Insurance policies (E.11): list and add, with expiry alerts through the existing alert service
- [ ] Community grievances (E.18): record, status, and close with a resolution note
- [ ] ESIA monitoring records (E.17): list and add against the existing `eia_mitigation_checklist`
- [ ] Filing calendar still ships empty; requirement names and due dates come from the bank's
      compliance team, not from this phase

### 14.4 Backend models that are missing — not started
- [ ] Milestones (C.5): model, migration, CRUD routes; feed the existing Gantt view from the backend
- [ ] Risk register (E.9, E.19, E.20): table for type, severity, mitigation and tracking status;
      connect to the existing `analytics/risk.py` scores
- [ ] CSR tracker (E.25): decide with the project owner whether it is in the proof of concept
      before building it

### 14.5 Defects and cleanup — not started
- [ ] `AlertRemediationDrawer` still uses hard-coded data and is linked from no page. Delete it, or
      wire it to the renewals endpoint if a page needs it
- [ ] `ProjectsPage` rapid double-filter race (`test.fixme` in `frontend/e2e`): fix and un-fixme
- [ ] `consortium_exposure_v` is mapped in the models but never created; create the view in a
      migration or remove the mapping
- [ ] Admin page lists three `e2e.*` accounts; confirm they are only used by `seed_test_workflows`
      and document that

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
