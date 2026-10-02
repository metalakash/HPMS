# Phase 11: RFP Reporting & Hardening — Kickoff

**Status:** 🚀 11.1 done, 11.2 done except PowerPoint (decision-gated), 11.4 Phase 10 tests done; 11.3 backend done (no seed data), 11.4 hardening done except VAPT/DB-level RLS; 11.5 docs done pending Compliance review
**Driver:** `docs/RFP-TRACEABILITY-MATRIX.md` (116 requirements) — the matrix's "Week 4 / P4" scope
**Audit:** [`docs/RFP-GAP-AUDIT.md`](docs/RFP-GAP-AUDIT.md)

## Goal

Close the RFP gaps that remain after Phases 1–10: report output formats and builder, the
regulatory calendar, security hardening, and the documentation the RFP requires. Establish a
verified test baseline first, because Phase 10 shipped without integration tests.

## Starting point

Phases 1–10 are merged to `master`. The audit found 29 present, 21 partial and 14 missing
audit rows (see the audit doc; counts are rows, not individual requirements). It was static only —
nothing was executed — so the first task is to establish a baseline.

## Tasks

### 11.1 Gap audit — ✅ done (static)
- [x] Map RFP IDs to code → `docs/RFP-GAP-AUDIT.md`
- [x] Baseline run — 400 pass, 2 real failures (`models/etl.py` Base import, `MockEmailService` missing); migration check blocked by Docker, see audit doc

### 11.2 Report engine (F.1, F.5, F.6, F.10, F.11, G.7) — ✅ done except PowerPoint
- [x] Word (.docx) export — `python-docx`; `ExportService.generate_word`, `build_file`; `POST /reports/export/download`
- [x] BS + AD dates in every Excel/PDF/Word report (`services/report_dates.py`, "Report info" sheet, PDF/Word stamp)
- [x] Saved report definitions + filter-driven builder (`report_definitions`, migration `013`, `/reports/definitions`, `/reports/builder/run`, `/reports/sources`)
- [x] Covenant shortfall source + Province/District/Local-level filters on every source
- [x] Scheduled delivery with attachment (`/reports/schedules`, cron via croniter, `report_daemon` started in `main.py`)
- [ ] PowerPoint output (F.11) — still waiting on the "is it required?" decision
- Unverified: DB-backed tests (`test_report_builder_db.py`) are skipped here — the `hpms` Postgres role lacks CREATEDB

### 11.3 Regulatory calendar & alerts (E.7, E.22, E.23, E.2, E.15, E.16) — ✅ backend done
- [x] `regulatory_requirements`, `filing_calendar`, `user_reminders`, `stakeholder_contacts` — migration `014`
- [x] BS fiscal periods (FY starts Shrawan; quarters end Ashwin/Poush/Chaitra/Ashadh) — `services/filing_calendar.py`
- [x] Generate/track/mark-filed API (`/regulatory/*`, `/projects/{id}/filings`); overdue flip in the daily scan
- [x] User reminders (`/reminders`) emailed by the daily scan; permits/insurance alerts were already in (70880f2)
- [x] Stakeholder contacts route alerts by project, type and urgency (`/stakeholders`, C.9 seed)
- [ ] **No requirement data is shipped.** NRB / Ministry / NEA filing names, frequencies and lags must come from the compliance team (research item) and be entered via `POST /regulatory/requirements`
- [ ] Frontend (calendar view, reminders, contacts) not built
- Unverified: `test_regulatory_calendar_db.py` skipped (Postgres role lacks CREATEDB)

### 11.4 Hardening (A.2, A.5, A.7, D.5, E.4, A.1) — ✅ done except items needing outside input
- [x] IP allow-list for admin/service consoles (A.7); CSP + hardening headers on API and SPA (A.5, D.5)
- [x] OWASP Top-10 self-assessment and dependency scan → [`docs/SECURITY-HARDENING.md`](docs/SECURITY-HARDENING.md)
- [x] Audit log: one hash-chained writer, append-only trigger, verification, retention preview/purge (E.1, E.4)
- [x] Field-level write rights + maker-checker dual control (A.1); `/mutations` router was unmounted — now mounted
- [x] Tests for all Phase 10 work; RLS added to compliance + CBS endpoints
- [ ] **A.2 VAPT** — needs an independent tester; this phase is a self-assessment only
- [ ] **E.4 retention period** — default 7 years is unconfirmed (research brief §1.1)
- [ ] **A.6 DB-level RLS / pgcrypto** — not built
- Unverified: migrations `013`–`015` and the DB-backed tests have never run (Postgres role lacks CREATEDB)

### 11.5 Documentation (D.7, D.12, D.4) — ✅ drafted
- [x] Data dictionary generated from the models → [`docs/DATA-DICTIONARY.md`](docs/DATA-DICTIONARY.md); stale-file and model-without-migration tests
- [x] Administrator manual → [`docs/ADMIN-MANUAL.md`](docs/ADMIN-MANUAL.md); user manual → [`docs/USER-MANUAL.md`](docs/USER-MANUAL.md)
- [x] NRB / data-privacy mapping → [`docs/NRB-PRIVACY-COMPLIANCE-MAPPING.md`](docs/NRB-PRIVACY-COMPLIANCE-MAPPING.md) (**requirement texts unverified; needs Compliance/Legal**)
- Found while documenting: migration `016` (loan sync tables had none), project edits now audited, report schedules admin-only

### Decision-gated (not scheduled until answered)
Domain tables absent from the backend: **risk register** (E.9/E.19/E.20), **insurance** (E.11),
**CSR** (E.25), **stakeholder directory** (C.9), **community grievances** (E.18),
**milestones** (C.5/F.15), **peer benchmarks** (G.9), **XML/HDF import** (B.8).

## Open questions

1. Are the domain tables above in scope for Phase 11, or a separate Phase 12? Milestones (C.5)
   probably must come first because the Gantt UI has no backend source.
2. Is PowerPoint output required, or are Excel/Word/PDF plus PowerBI enough for F.11?
3. XML/HDF (B.8): required formats, or is CSV/Excel/JSON acceptable?
4. Is the Finacle sandbox reachable yet? Until it is, CBS items stay mock-backed.

## Definition of done

- Baseline test run recorded; no regressions across the phase
- Every ❌ and 🟡 row in the audit is closed or explicitly deferred with a reason
- Phase 10 endpoints covered by integration tests
- Migration chain `001→012+` applies cleanly on an empty database
- Audit doc updated with final status per row

## Suggested order

11.1 baseline → 11.4 Phase 10 tests (cheapest risk reduction) → 11.2 → 11.3 → 11.5.

## Follow-up after Phase 11 (2026-10-02)

- [x] Demo accounts refused unless `DEBUG=true` or `ALLOW_DEV_AUTH=true` (the hosted Render demo stops accepting them on the next deploy)
- [x] TOTP seeds encrypted at rest, backup codes keyed-hashed, columns widened — migration `017`
- [x] Loan-sync scheduler rewritten as an asyncio loop (the APScheduler design could never have run); schedule API, in-process ingestion and `POST /exposure-sync` repaired
- [ ] **MFA is still not enforced at login** — needs a login challenge step (API + web page)
- [ ] Finacle (`FINACLE_CBS`) source for the loan sync is not implemented
