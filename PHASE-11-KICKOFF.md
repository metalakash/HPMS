# Phase 11: RFP Reporting & Hardening — Kickoff

**Status:** 🚀 11.1 audit done, 11.2 ready to start
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

### 11.2 Report engine (F.1, F.5, F.6, F.10, F.11, G.7)
- Word (.docx) export — add `python-docx`; extend `export_service`
- BS + AD dates in every Excel/PDF/Word report via `i18n/calendar.py`
- Saved report definitions + filter-driven report builder (no query language)
- Shortfall and custom compliance reports with Province/District/Local-level filters
- Scheduled report delivery (reuse `scheduler_service` + `email_service`)
- PowerPoint output (F.11) — confirm necessity before building

### 11.3 Regulatory calendar & alerts (E.7, E.22, E.23, E.2, E.15, E.16)
- `regulatory_requirements` and `filing_calendar` tables (NRB, Ministry, NEA) + migration `012`
- User-defined reminders on milestones/deadlines
- Extend `alert_service` to permits, insurance, and external-stakeholder recipients

### 11.4 Hardening (A.2, A.5, A.7, D.5, E.4, A.1)
- IP whitelist middleware for service and admin consoles
- CSP header, OWASP Top-10 checklist run, dependency scan
- Audit-log retention policy (configurable) with test
- Field-level permission enforcement on sensitive fields
- **Tests for all Phase 10 work:** 7 endpoints, `cbs_sync_real_service`, circuit breaker opening after 5 failures, rate limiter at 1,000/day
- Verify RLS holds on the new `operations` tables

### 11.5 Documentation (D.7, D.12, D.4)
- Data dictionary generated from SQLAlchemy metadata (script, committed output)
- Admin and user manuals
- NRB / Nepal data-privacy compliance mapping

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
