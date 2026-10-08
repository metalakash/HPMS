# Phase 13: Remaining RFP Functional Gaps — Kickoff

**Status:** 🚀 started 2026-10-08. 13.1 done; the rest not started.
**Driver:** [`docs/RFP-GAP-AUDIT.md`](docs/RFP-GAP-AUDIT.md), rows still ❌ or 🟡 that do not depend on the bank or on hosting (those are Phase 12)

## Goal

Close the functional RFP items that are either built on the backend with no screen, or not built.

## Tasks

### 13.1 Screens for backends that had none — ✅ done
- [x] **Reports** (`/reports`, F.5 / F.6): choose a source, columns and filters; preview; download as
      Excel, CSV or Word; save a report and share it; reopen or delete saved reports. Admin and auditor
- [x] **Regulatory** (`/regulatory`, E.7 / E.23): filing calendar with status filter and counts;
      record a filing with the regulator's reference; admins add requirements and generate their
      calendar. Admin and auditor see it; admin and maker record filings
- [x] **Reminders** (E.22): on the Regulatory page, for every role
- [x] **Defect found and fixed: nothing saved through these APIs was kept.** The report builder,
      report schedule and regulatory routes flushed but never committed, so every create, update
      and delete answered success and was then discarded. The database tests could not see it
      because they share one session with the handler. Fixed in all 18 handlers;
      `tests/test_routes_commit.py` now fails any write handler that changes the session without
      committing, and `frontend/e2e/7-reports-regulatory.spec.ts` reloads the page before checking
      what it saved
- The Phase 11 closure table marked these items "built"; they were built and tested but had
  never worked outside a test

### 13.2 Screens still missing
- [ ] Scheduled report delivery (F.11): the API works now; no screen
- [ ] Stakeholder contacts for alert routing (C.9)
- [ ] Insurance policies, community grievances, ESIA monitoring (E.11, E.18, E.17): on the API only
- [ ] The filing calendar **ships empty**. Requirement names, frequencies and due dates must come
      from the bank's compliance team; none are invented here

### 13.3 Not built
- [ ] CSR tracker (E.25)
- [ ] Cross-source consolidation in the report builder (F.5 / F.6)
- [ ] PowerPoint export (F.11): decision pending on whether it is required
- [ ] XML / HDF import (B.8)
- [ ] Hierarchy propagation, prior-year budget linking, peer comparison (G.6, G.8, G.9)
- [ ] Field-level read rights (A.1) and database-level row security (A.6)
- [ ] System study and parameterisation document (D.12)

## Notes

- The end-to-end suite assumes the synthetic seed. It cannot be run against a database holding
  other data; `7-reports-regulatory.spec.ts` was verified against the seed before the local
  database was repointed.
- Covenant terms and financial periods are still entered directly (audited), not through maker-checker.
