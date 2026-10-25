# Phase 16: Build Sprints for the Open RFP Items — Plan

**Status:** 🚀 planned 2026-10-16; sprint D1 done 2026-10-17, D2 and D3 done 2026-10-19 except connecting Nepali search (D3.2); nothing committed.
**Driver:** the RFP status report of 2026-10-16 (116 requirements: 52 done, 35 partly done, 6 waiting on the bank, 4 not built, 19 outside the software). This phase takes every partly-done or not-built item that **needs no input from the bank or an outside party** and builds it.
**Runs alongside:** [`PHASE-15-SPRINT-PLAN.md`](PHASE-15-SPRINT-PLAN.md) sprints 2 to 4, which mostly wait on the bank. This is the work that fills that time.

## Goal

When the bank's acceptance testing starts (Phase 15 sprint 4), every RFP item that depends only on development is on screen, tested against a real backend, and in the demo.

## What is in and out

**In (17 RFP items across 16 stories):** A.1, A.2, A.3, A.5, A.6, B.2, B.3, B.6, B.7, C.1, C.3, C.4, C.5 (edit), C.9, C.10, D.9, D.12, F.6, F.9, G.3, G.5, TECH B.2/B.4 (browsers).

**Out, and why:**

| Item | Waiting on |
|---|---|
| Office 365, digital signature, CSR tracker, PowerPoint, XML/HDF import (B.3, E.25, F.11, B.8) | Bank scope decision (B6) |
| Branch/province access, RO/URM overview, hierarchy propagation (A.4, F.3, G.6) | Bank's organisation structure |
| Risk scoring into the register (E.20) | Bank's risk categories |
| Prior-year budget linking, peer comparison (G.8, G.9) | Data only the bank has; proposed for phase 2 |
| Penetration test, production load test, gateway mutual TLS, NRB text check (A.2, C.1, A.5, D.4) | External party, hosting, or the bank |

## Sprints at a glance

| Sprint | Dates (estimate) | Theme | RFP items |
|---|---|---|---|
| D1 | 16–23 Oct | What the bank will see first | C.1, C.3, C.10, G.5, A.2, C.5, B.2/B.4 |
| D2 | 26–30 Oct | Money and configuration | B.2, C.4, F.9, G.3, B.6, A.5, A.3, D.9 |
| D3 | 2–6 Nov | Depth and documentation | A.1, B.7, C.9, B.3, F.6, A.6, D.12 |
| Buffer | 9–10 Nov | Fixes from the D3 review; acceptance rehearsal | — |

Sizes: S = up to half a day, M = one to two days, L = three days or more.

---

## Sprint D1 (16–23 Oct): what the bank will see first

**Sprint goal:** documents can be uploaded, versioned and downloaded on every project; an admin can block a user; milestones can be updated; the app is tested on three browsers.

| ID | Story | RFP | Size |
|---|---|---|---|
| D1.1 | Documents API: list a project's documents, upload a new document, upload a new version, version history, download, archive | C.1, C.3, C.10, G.5 | M |
| D1.2 | Database storage for document files, so uploads survive a redeploy on hosting without a disk (local disk and S3 stay available by setting) | C.1 | S |
| D1.3 | Documents tab on the project page: upload with type and date, versions, download, archive | C.1, C.3, C.10 | M |
| D1.4 | Demo documents in the seed and the demo reset (generated, synthetic: a sanction letter, a PPA, a feasibility study) | — | S |
| D1.5 | User admin: block and unblock a user, change a user's role; blocked users cannot sign in; audited | A.2 | M |
| D1.6 | Milestone edit: status, forecast date, actual date, percent complete; the Gantt reflects it | C.5 | S |
| D1.7 | End-to-end suite on Edge and Firefox as well as Chromium | TECH B.2, B.4 | S |

**Acceptance**

- D1.1–D1.3: on the project page a maker uploads a PDF sanction letter; after a reload it is listed with its type, date, size and version 1. Uploading again makes version 2; both versions download with their original content (checked by SHA-256). Files other than jpg, jpeg, png, pdf, doc(x) and xls(x), and files over 10 MB, are refused with the reason. An auditor can list and download but not upload. Every upload, download and archive is in the audit log.
- D1.2: a document uploaded, then the backend restarted with a fresh disk, still downloads.
- D1.4: a fresh seed or demo reset shows documents on the operating projects.
- D1.5: an admin blocks the demo `guest`; that account's sign-in is refused with a clear message; unblocking restores it. An admin cannot block themselves or remove the last active admin. Role changes take effect at the user's next sign-in.
- D1.6: a maker marks a milestone complete with an actual date; after a reload the milestone and the Gantt show it. Delays are flagged when forecast passes plan.
- D1.7: the suite passes on all three browsers, or each failure is fixed or recorded with its cause.
- Every story: a real-backend spec that reloads before checking (`frontend/e2e/11-documents.spec.ts`, `12-user-admin.spec.ts`; milestones added to `8-project-records.spec.ts`).

**Progress (2026-10-17)**

- D1.1–D1.3 ✅ Documents API (`routes_documents.py`) and tab. Files are encrypted at rest (`DOCUMENT_ENCRYPTION`,
  on by default, with a key derived from the MFA key or `SECRET_KEY`), checked by SHA-256 on every download (a
  file altered in storage is refused), and every filing, download and archive is audited. The old service
  marked files "encrypted" without encrypting them; it was rewritten. A version's hash was unique, which
  refused the same file filed twice; fixed.
- D1.2 ✅ `DOCUMENT_STORAGE=database` (default) keeps files in `document_blobs` (migration `028`).
- D1.4 ✅ `seed_demo_documents`: generated PDFs stamped as synthetic, run by the demo reset.
- D1.5 ✅ Block, unblock and role override on the Admin page. A blocked account's open sessions end at once
  (checked on every request); an admin cannot change their own account or remove the last active admin
  (migration `029`). Role changes are direct and audited; making them need a second admin waits on D2.6.
- D1.6 ✅ Milestone update with forecast, actual and percent complete; "days late" shown; a completed
  milestone needs an actual date that is not in the future.
- D1.7 ✅ `E2E_ALL_BROWSERS=1`: 78 tests pass on Firefox and Edge, with no download (Firefox was already
  installed, Edge is the system's). Found and fixed: no favicon, so Edge logged a 404 on every page.
- Specs: `11-documents.spec.ts`, `12-user-admin.spec.ts`, milestone update in `8-project-records.spec.ts`.
  Chromium suite 49 passed, 2 skipped by design.
- Migrations `028` and `029` follow `027`, which belongs to the uncommitted origination work, so they cannot
  be committed before it.

---

## Sprint D2 (26–30 Oct): money and configuration

**Sprint goal:** budgets and actuals are visible with overspend flagged and can be bulk-loaded; projection figures and application settings change through maker-checker; approval steps are configurable.

| ID | Story | RFP | Size |
|---|---|---|---|
| D2.1 | Budget and cost tab: budget against actual by category, variance and overspend flagged; portfolio overspend report in the report builder | B.2, C.4, F.9 | M |
| D2.2 | Budget and expense lines changed through maker-checker (new change type `BUDGET_LINE`) | B.2 | S |
| D2.3 | Bulk upload of budget and expense lines from Excel or CSV: preview, row errors, then one change request for the batch | G.3 | M |
| D2.4 | Projection figures entered through maker-checker on the Projection page (`LOAN_PROJECTION`) | B.6 | S |
| D2.5 | Settings screen: admin-managed parameters (alert lead days, default covenant thresholds and warning margin, report defaults) kept in the database; changes need a second admin | A.5 | M |
| D2.6 | Configurable approval steps: per change type, one or two approvals and which roles may give each; changes need a second admin; the current two-step rule stays the default | A.3, D.9 | M |

**Acceptance**

- D2.1: a project whose actuals exceed budget in a category shows it flagged on the tab and in the overspend report; figures match the stored lines exactly.
- D2.2–D2.3: an upload with one bad row shows that row's error and accepts the rest only after correction or removal; nothing changes until the change request is approved by two checkers; the approved batch appears on the tab after a reload.
- D2.4: a projection change appears on the Projection page only after approval, and the energy-lending share recalculates.
- D2.5: changing the insurance alert lead time from 90 to 60 days takes effect for the next alert run only after a second admin approves; the old and new values are in the audit log.
- D2.6: setting "change of sanction terms" to need an approval from an approver and then an admin is enforced on the next request; requests already in the queue keep the rule they were raised under.
- Specs: `13-budget.spec.ts`, `14-settings.spec.ts`, projection added to `6-portfolio-views.spec.ts`.

**Dependency (resolved):** the plan expected D2 to edit `field_policy.py` and `endpoints.ts`, which hold
uncommitted origination work. It did not: new change types plug into the maker-checker service through
`services/change_kinds.py`, and the screens use their own service file (`services/changeRequests.ts`).

**Progress (2026-10-19)**

- D2.1 ✅ Budget tab: budget, actual and variance per cost head, totals, heads over budget flagged.
  `GET /api/v1/projects/{id}/budget`. Variance is calculated, never entered.
- D2.2 ✅ `BUDGET_LINE` change type: add, change and remove lines in one request; duplicate categories,
  negative amounts and a missing source are refused when proposed.
- D2.3 ✅ Upload from Excel or CSV: `POST .../budget/preview` reports each unusable row and matches categories
  already on the budget; the usable lines become one change request.
- D2.4 ✅ `LOAN_PROJECTION` change type and a "Change plan" form on the Loan projection page. Outstanding is
  carried down the whole plan (on screen as figures are typed, and again on approval); the opening quarter
  cannot be changed; a plan whose repayments exceed the balance is refused.
- D2.5 ✅ Settings page: expiry alert lead times and default covenant thresholds, kept in `app_parameters`
  (migration `030`) and read by the alert run and the covenant engine. Changing the covenant defaults re-tests
  every facility that uses them. Proposed by an admin; final approval by another admin.
- D2.6 ✅ Approval rules per change type (one or two checks; which roles give each), kept as versioned workflow
  definitions. A request follows the rule in force when it was raised. Sanction terms, settings and rules
  need an administrator's final approval by default: the summary of Phase 14 said sanction terms already did,
  but nothing enforced it until now.
- The Approvals page shows lists (budget lines, quarters) as tables, and labels the decision "Approve and
  apply" whenever the next approval is the last one, including under a one-check rule.
- The demo reset adds synthetic budgets and puts settings and approval rules back to their defaults.
- Tests: `tests/integration/test_sprint_d2_db.py` (15), `frontend/e2e/13-plans-and-settings.spec.ts` (5, serial).
  `3-approvals.spec.ts` compared a request count across other suites' writes; it now accepts the counts the
  queue had before and after the page loaded.
- Portfolio overspend report: the report builder's "Capex budget vs actual" source now has variance and
  an "overspent" column (filterable by province, district, local level and stage).

---

## Sprint D3 (2–6 Nov): depth and documentation

**Sprint goal:** sensitive fields are hidden from roles that should not read them, the database itself enforces project access, and the system study document exists.

| ID | Story | RFP | Size |
|---|---|---|---|
| D3.1 | Field-level read rights: a read policy beside the write policy; financial terms hidden from guests, for example; applied in the API so no screen or export can leak them | A.1 | M |
| D3.2 | Nepali search: project search matches Nepali names, with Unicode normalisation so differently composed characters still match | TECH B.7 | S |
| D3.3 | Stakeholder performance history: dated notes and a rating per contact, shown in the contacts directory | C.9 | S |
| D3.4 | Currencies: exchange rates entered through maker-checker; NPR equivalents in loan screens and reports | B.3 | M |
| D3.5 | Consolidated reports: the report builder combines projects, loans and covenant results in one report, joined by project | F.6 | M |
| D3.6 | Database-level row security: PostgreSQL row policies on project-scoped tables as a second barrier behind the application's checks; on by setting, on in tests | TECH A.6 | L |
| D3.7 | System study and parameterisation document: every setting and parameter, what it controls, its default and who may change it | TECH D.12 | M |

**Acceptance**

- D3.1: signed in as guest, the API responses, screens and every export omit the restricted fields; admin and auditor see them. A test fails if a new endpoint returns a restricted field to a role without read rights.
- D3.2: searching a project's Nepali name finds it, typed in either Unicode composition.
- D3.4: a USD facility shows its NPR equivalent at the rate in force on the report date; changing a rate needs approval.
- D3.5: one report lists each project with its outstanding balance and latest DSCR; the totals match the separate reports.
- D3.6: with the setting on, a database session scoped to a maker reads only that maker's projects even through a query that bypasses the application's filter; the full backend suite passes with it on.
- D3.7: reviewed against the running system's settings; nothing listed that the code does not read.

**Risks:** D3.6 touches every project-scoped query and is the most likely to slip. It ships behind a setting, so it can be left off for the proof of concept without blocking anything. If D3 runs over, D3.6 moves to the buffer and D3.7 still ships.

**Progress (2026-10-19)**

- D3.1 ✅ Field-level read rights (`security/read_policy.py`): confidential fields (limits, balances, rates,
  covenant ratios and inputs, projection, budget) are `null` for roles without the right in every JSON
  response, REST and GraphQL, with `X-Fields-Withheld` naming them. Applied to responses centrally, so a new
  endpoint cannot leak a field. A test calls every GET endpoint a guest can reach over a seeded portfolio and
  fails on any confidential value. Found on the way: a language helper crashed every endpoint that used it
  (`request.state.get`), and the filter first blanked the guest's screen labels (translation keys share field
  names); both fixed.
- D3.2 🟡 Nepali text matching (`i18n/search_text.py`): NFC, zero-width joiners removed, in Python and in
  PostgreSQL; tested both ways a word can be typed. **Not yet connected to project search**, which lives in the
  uncommitted origination work (`routes_projects.py`, `ProjectsPage.tsx`); a two-line change once it is committed.
- D3.3 ✅ Stakeholder history: dated interactions with an optional 1-5 rating; the contacts list shows the count,
  average and latest date (migration `031`).
- D3.4 ✅ Exchange rates by change request (`EXCHANGE_RATE`, migration `032`): NPR equivalents at the rate in
  force on the date on the Loans page and in the loan report; no rate on file gives no equivalent rather than a
  guess. Not done: covenant ratios for a foreign-currency facility are not converted (documented limit).
- D3.5 ✅ Consolidated report source: a row per project with lending (NPR), latest covenant result and budget;
  a test checks its totals and ratios against the separate sources.
- D3.6 ✅ Row policies on the project table and the 36 tables that belong to a project (migration `033`), off
  unless `DB_ROW_SECURITY=true`. Tested as an ordinary database role (PostgreSQL never applies row security to a
  superuser, which the test cluster's account is): a maker reads and writes only owned projects, admins,
  auditors and approvers all, guests none. The energy-financing total is computed through a named exemption.
  The application must connect as a non-superuser for this to bite.
- D3.7 ✅ `docs/SYSTEM-STUDY.md` (written) and `docs/PARAMETER-REFERENCE.md` (generated from the code, with a
  freshness test). Found on the way: 40 settings in `config.py` are read by nothing (rate limits, PDF styling,
  cache, WebSocket), so setting them has no effect; listed as such. `JWT_EXPIRY_MINUTES` was one of them; the
  token lifetime now follows it.
- Also fixed: the Approvals page showed only the newest 50 requests with no way to reach older ones; it pages now.
- Tests: `tests/integration/test_sprint_d3_db.py` (17), `tests/test_parameter_reference.py` (2),
  `frontend/e2e/14-sprint-d3.spec.ts` (4).
