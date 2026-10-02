# HPMS — RFP Gap Audit (Phase 11.1)

Audit date: 2026-10-01 · Baseline: `master` @ `77578dd` (Phases 1–10 merged)
Source of truth for requirements: [`RFP-TRACEABILITY-MATRIX.md`](RFP-TRACEABILITY-MATRIX.md)

## Method and limits

Static audit only: for each RFP requirement the repo was searched for models, tables, services,
routes and tests. **Nothing was executed** — no migrations run, no tests run, no endpoints called.
"Present" means code exists, not that it is verified working. Items marked ❓ need a runtime check.
Requirements the matrix already assigns to INFRA, BID or PRUNED are out of scope and not re-listed.

Legend: ✅ present · 🟡 partial · ❌ missing · ❓ needs runtime verification

Backend inventory at audit time: 57 tables (incl. `workflow_definitions`, `audit_logs` with SHA-256
chain, `rcod_events`, `land_records`, `water_licenses`, `hydrology_records`, `budget_lines`),
17 route modules, 3 test folders (`integration/`, `security/`, `performance/`).

---

## Summary

Counts are audit rows (some rows group several RFP IDs), not individual requirements.

| Status | Rows |
|---|---|
| ✅ Present | 29 |
| 🟡 Partial | 21 |
| ❌ Missing | 14 |
| ❓ Runtime check only | 1 (many more ❓ flags inline) |

Missing and partial items cluster in four areas, which become the Phase 11 tasks:
**reporting** (11.2), **regulatory/alerting** (11.3), **hardening** (11.4), **documentation** (11.5),
plus a **domain-table gap** (risk, insurance, CSR, stakeholders, grievances, milestones) that is
not in the original Week-4 scope and needs a decision (see kickoff doc, open question 1).

---

## Technical requirements

| ID | Status | Evidence / gap |
|---|---|---|
| A.4 / A.5 / D.5 | 🟡 | Security headers (`X-Frame-Options`, HSTS) in `main.py`; `middleware/rate_limiter.py` token bucket exists. No CSP, no OWASP checklist run. ❓ |
| A.2 | ❌ | No VAPT / code-security review artifact. |
| A.7 | ❌ | No IP whitelist (grep for whitelist/allowed_ips: zero hits). |
| A.5 | 🟡 | TLS/HSTS header present; CBS mTLS not evidenced in `finacle_adapter.py`. |
| A.6 | 🟡 | RLS implemented in app layer (`security/rls_service.py`, `tests/security/test_row_level_security.py`). pgcrypto / DB-level RLS not found in migrations. |
| B.1 / D.10 | ✅ | FastAPI REST + GraphQL + WebSocket. |
| B.2 / B.4 | 🟡 | React frontend exists; no cross-browser or responsive test evidence. |
| B.3 | 🟡 | `security/ldap_provider.py` exists (AD role mapping, `tests/integration/test_ldap_auth.py`). Office 365 / digital signature not found. |
| B.5 | 🟡 | Finacle adapter + CBS sync done (still mock-backed). DWH/HCMS extension points not found. |
| B.6 | ✅ | `i18n/calendar.py` `CalendarConverter` AD↔BS; BS in loans/projects routes; tests in `test_i18n_calendar_tenant.py`. |
| B.7 | 🟡 | `i18n/` module and `language_preference` exist; `name_np` / unaccent collation not found in models. ❓ |
| B.8 / D.11 | 🟡 | CSV bulk import (`bulk_import_service.py`), CSV/Excel/JSON export. **No XML, no HDF.** |
| C.1 | 🟡 | Indexes added in Phase 10 migration; no PgBouncer config. `tests/performance/` exists. ❓ |
| D.4 | 🟡 | Audit log + MFA present; no NRB/data-privacy compliance mapping doc. |
| D.7 | ❌ | No data dictionary generated from models. |
| D.9 | ✅ | `workflow_definitions` table + `services/workflow.py`, `routes/workflow.py`. |
| D.12 | ❌ | Only `RUNBOOK.md`, `TROUBLESHOOTING.md`, deploy guides. No admin/user manuals. |
| E.1 | ✅ | `audit_logs` with `pre_state`/`post_state` and hash chain. |

## Functional requirements

### A — User management
| ID | Status | Evidence / gap |
|---|---|---|
| A.1 | 🟡 | `roles`, `permissions`, `user_role_assignment` exist; maker/checker in `routes_mutations.py`. **Field-level rights** not evidenced. |
| A.2 | ✅ | `routes_admin.py`, `AdminPage.tsx`, `ApprovalQueuePage.tsx`, `approval_requests`/`approval_steps`. |
| A.3 | ✅ | `workflow_definitions` (JSONB). |
| A.4 | ✅ | `rls_service.py` scopes by project ownership; province/branch scoping ❓. |
| A.8 | 🟡 | `tests/performance/test_load_performance.py` exists; results unknown. ❓ |

### B — Financial
| ID | Status | Evidence / gap |
|---|---|---|
| B.1 | ✅ | `loan_accounts`, `repayments`, `disbursement_tranches`, `cbs_sync_logs`, adapter. |
| B.2 / C.4 / F.9 | ✅ | `budget_lines`, bulk import. Overspend report ❓. |
| B.3 | ✅ | `currency_code` in `financial.py`, `consortium.py`. |
| B.4 | ✅ | `analytics/forecasting.py`. |
| B.5 / C.7 / C.8 | ✅ | `PipelineStatus`, `drop_reason` in `models/project.py`. |
| B.6 | 🟡 | `routes_mutations.py` for edits; dedicated projection-entry UI not evidenced. |
| B.7 / F.12 | ✅ | `ppa_agreements`, `nea_ppa_rates`, `tariff_structures`, `generation_service`. |

### C — Project information
| ID | Status | Evidence / gap |
|---|---|---|
| C.1 / C.3 / C.10 / G.5 | ✅ | `documents`, `document_versions`, `document_service`, `s3_storage`. |
| C.2 / F.13 | ✅ | `project.py` incl. location fields. Province/District/Local-level filter ❓. |
| C.5 | ❌ | No backend milestone model (no "milestone" hits in `backend/`); Gantt exists only in frontend. |
| C.6 | ✅ | `hydrology_records`, `hydrology_detailed`, `hydrology_service`. |
| C.9 | ❌ | No stakeholder directory table. |
| C.11 | ✅ | `land_records`, `land_acquisition_tracking`. |
| C.12 | ✅ | `water_licenses`. |

### E — Compliance & monitoring
| ID | Status | Evidence / gap |
|---|---|---|
| E.1 / E.3 / E.5 | ✅ | `audit_logs`, `audit_log_reads`, `compliance/audit.py`. |
| E.2 / E.15 / E.16 | 🟡 | `alert_service.py` (PPA/licence expiry), `email_service.py`. Permits, insurance and external-stakeholder alerts missing. |
| E.4 | 🟡 | Retention config exists for documents only; no audit-log retention policy. |
| E.7 / E.23 | ❌ | No regulatory requirement / filing calendar (only a mention in `analytics/risk.py`). |
| E.8 / E.10 | ✅ | `compliance/engine.py`, `covenant_history`, `routes_compliance.py`. |
| E.9 / E.19 / E.20 | 🟡 | `analytics/risk.py` computes scores; **no risk register table** (type/severity/mitigation/tracking). |
| E.11 | ❌ | No insurance model. |
| E.12 | ✅ | `rcod_events`. |
| E.13 | ✅ | `board_of_directors`, `shareholding_hierarchy`. |
| E.14 | ✅ | `energy_generation_data`. |
| E.17 | 🟡 | `eia_mitigation_checklist`; no ESIA monitoring records. |
| E.18 | ❌ | No community consultation / grievance model. |
| E.21 | ✅ | `approval_requests` + audit chain. |
| E.22 | ❌ | No user-defined reminders. |
| E.24 | ✅ | `maintenance_*`, `plant_performance`. |
| E.25 | ❌ | No CSR tracker. |

### F — Reporting
| ID | Status | Evidence / gap |
|---|---|---|
| F.1 / G.7 | 🟡 | `export_service` (CSV, Excel via openpyxl, JSON), `pdf_service` (reportlab; portfolio, covenant, capex). **No Word.** BS-date rendering in reports ❓. |
| F.2 / F.3 / F.4 / F.16 | ✅ | `routes/dashboards.py` (12 endpoints), `dashboard_service`, `consortium_exposure_v`. |
| F.5 / F.6 | ❌ | No report builder / saved reports / multi-source consolidation. |
| F.7 / F.8 | ✅ | `DashboardPage`, `AnalyticsPage`; drill-downs from Phase 9.2. |
| F.10 | 🟡 | Compliance reports exist; shortfall report and filter-driven custom reports not evidenced. |
| F.11 | 🟡 | `docs/POWERBI-INTEGRATION.md` + PowerBI references in `report_service`/`report_schema`. No PowerPoint, no scheduled delivery of reports. `scheduler_service` handles CBS sync only. |
| F.14 | ✅ | Carbon metrics in `esg_service`; `installed_capacity_mw` present. |
| F.15 | 🟡 | Gantt/calendar in frontend (Phase 9.6); no backend milestone source (see C.5). |

### G — Others
| ID | Status | Evidence / gap |
|---|---|---|
| G.3 | ✅ | `bulk_import_service`, `import_batches`, `import_row_errors`. |
| G.4 | ❓ | Derived columns not verified. |
| G.6 / G.8 | ❌ | No hierarchy propagation or prior-year budget linking. |
| G.9 | ❌ | No peer/industry comparison. |

---

## Cross-cutting findings (not RFP IDs but block sign-off)

1. **Test coverage vs Phase 10.** `tests/` has no test touching `operations.py` models, the new
   services, the 7 Phase 10 endpoints, or `cbs_sync_real_service`. The PR checklist is unchecked.
2. **Finacle is still mock-backed.** Real bind needs SBL network access; adapter resilience
   (circuit breaker, rate limiter) is untested per the previous point.
3. **Frontend vs backend drift.** Phase 9 UI was built on mock data; Phase 10 wired endpoints but
   frontend API calls were not re-verified against them. ❓
4. **Test suite health unknown.** Nothing was run in this audit. First action of 11.2 should be a
   baseline `pytest` run so later regressions are attributable.
5. **Untracked work.** `.claude/plans/phase10_pr_body.md` is uncommitted.

## Recommended runtime checks (next step of 11.1)

```bash
pytest tests -x -q --ignore=tests/performance
alembic upgrade head   # against a scratch DB; confirms 001→011 chain
```

Results should be appended here as a "Baseline" section before 11.2 starts.

---

## Baseline (run 2026-10-01, Python 3.14.3, Windows)

Command: `pytest tests --ignore=tests/performance -q -W ignore --continue-on-collection-errors`

| Run | Result |
|---|---|
| As found (no `pytest-asyncio` installed locally) | 21 failed, 380 passed, 33 skipped, 1 error |
| After `pip install pytest-asyncio` (declared in `pyproject.toml` dev deps) | **1 failed, 400 passed, 33 skipped, 1 error** |

The 20 extra failures were environmental: async tests need `pytest-asyncio` (`asyncio_mode = "auto"` is set in `pyproject.toml`).
`tests/performance` was not run.

### Real failures (2)

1. **`backend/app/models/etl.py:9`** imports `Base` from `backend.app.database`, which does not export it
   (`Base` lives in `backend/app/models/base.py`). Fails `tests/test_phase6_backend_defects.py::TestAppLoads::test_every_backend_module_imports`.
   Any code path that imports `models.etl` will raise `ImportError`.
2. **`tests/integration/test_scheduler_service.py`** fails at collection:
   `cannot import name 'MockEmailService' from backend.app.services.email_service`. The test expects a class the Phase 8.3.2 email service does not define.

### Not verified

- **`alembic upgrade head` (001→011):** not run. Migrations are PostgreSQL-specific (`postgresql.UUID`), there is no local Postgres, and Docker Desktop's engine returned HTTP 500 / hung when a scratch container was started. The alembic head resolves to `011_phase_10_operations` (single head). The scratch container was removed. Retry once Docker is healthy.
- 33 skipped tests: skip reasons not captured.
- `tests/performance`.

### Consequences for Phase 11

- Fix both real failures first (small, in 11.4 or as 11.2 prerequisite).
- Add `pytest-asyncio` to local setup notes (README / RUNBOOK) so new contributors do not hit the 20 false failures.
- Migration verification remains an open Definition-of-Done item.

### Baseline fixes (2026-10-01)

Both real failures fixed. `models/etl.py` now imports `Base` from `.base`, and its one-sided
`back_populates` on `LoanAccount` were made one-way (the import fix exposed them as mapper errors).
`test_scheduler_service.py` now builds `EmailService(MockEmailProvider())`.
Result: **402 passed, 43 skipped, 0 failed** (`tests/performance` still not run).

---

## Phase 11 closure (2026-10-02)

Final status of every row that was ❌ or 🟡 in the audit above. "Built" means code and tests exist; nothing
below was verified against a real database (the `hpms` role cannot create one), and "✅" never means
independently tested or penetration-tested.

Test baseline: **661 passed, 55 skipped** (the skips are database-backed tests). Start of phase: 400 passed.

| ID | Was | Now | What changed / what remains |
|---|---|---|---|
| A.2 | ❌ | ❌ | Internal self-assessment only ([SECURITY-HARDENING.md](SECURITY-HARDENING.md)); independent VAPT still required |
| A.4 / A.5 / D.5 | 🟡 | 🟡 | CSP and hardening headers, OWASP checklist, dependency scan done; CBS mTLS and VAPT open |
| A.6 | 🟡 | 🟡 | Unchanged: application-layer RLS only; RLS gaps on compliance and CBS routes fixed |
| A.7 | ❌ | ✅ | IP allow-list built; **off until `ADMIN_IP_ALLOWLIST` is set** |
| A.1 | 🟡 | 🟡 | Field-level *write* rights and dual-control enforced; no field-level *read* rights |
| B.3 | 🟡 | 🟡 | Unchanged (Office 365 and digital signature absent) |
| B.5 | 🟡 | 🟡 | Unchanged: Finacle adapter mock-backed until the sandbox is reachable |
| B.8 / D.11 | 🟡 | 🟡 | Word added; XML and HDF import still absent |
| D.4 | 🟡 | 🟡 | [Mapping drafted](NRB-PRIVACY-COMPLIANCE-MAPPING.md); requirement texts unverified |
| D.7 | ❌ | ✅ | Generated [data dictionary](DATA-DICTIONARY.md) with freshness test |
| D.12 | ❌ | 🟡 | [Administrator](ADMIN-MANUAL.md) and [user](USER-MANUAL.md) manuals drafted; system study and parameterisation document not written |
| E.4 | 🟡 | 🟡 | Retention preview/purge and chain checkpoint built; **period unconfirmed** |
| C.5 / F.15 | ❌ / 🟡 | ✅ | Milestones table, API and project timeline (commits `70880f2`, `f253607`) |
| C.9 | ❌ | 🟡 | `stakeholder_contacts` for alert routing; no performance history |
| E.2 / E.15 / E.16 | 🟡 | ✅ | Permit and insurance alerts, filing alerts, external stakeholder recipients |
| E.7 / E.23 | ❌ | 🟡 | Filing calendar mechanism on the BS fiscal year; **ships empty**, no UI |
| E.9 / E.19 / E.20 | 🟡 | ✅ | Risk register with severity and mitigation tracking |
| E.11 | ❌ | ✅ | Insurance policies with expiry alerts |
| E.17 | 🟡 | ✅ | ESIA monitoring records |
| E.18 | ❌ | ✅ | Community engagement / grievance log |
| E.22 | ❌ | ✅ | User reminders with email delivery (API only) |
| E.25 | ❌ | ❌ | CSR tracker not built |
| F.1 / G.7 | 🟡 | ✅ | Word export; BS and AD dates in Excel, Word and PDF |
| F.5 / F.6 | ❌ | 🟡 | Report builder and saved definitions over four sources; no cross-source consolidation; no UI |
| F.10 | 🟡 | ✅ | Covenant shortfall report; Province / District / Local-level filters |
| F.11 | 🟡 | 🟡 | Scheduled email delivery with attachments built; PowerPoint not built (decision pending) |
| G.6 / G.8 / G.9 | ❌ | ❌ | Not started |

### Corrections to earlier "present" rows

- **D.9 (workflow routes)** was ✅; `backend/app/routes/workflow.py` is not mounted and imports modules that do
  not exist, so the workflow API is not available. The maker-checker API (`/mutations`) was also unmounted until
  Phase 11.4.
- **E.1 (audit log)** was ✅; only maker-checker actions wrote to it, approve/reject wrote blank hashes, and the
  table was not protected from edits. Now chained, trigger-protected, and project create/update are audited.
- **B.1 (loan sync schedules)** — the schedule tables had no migration (added as `016`).

### Still open at the close of Phase 11

Migration chain `001`→`016` has been generated as SQL offline but never applied to a database; database-backed
tests are skipped; items above marked ❌/🟡; the open findings in the security record (demo accounts on the hosted
deployment, unprotected MFA secrets, the loan-sync scheduler not starting).
