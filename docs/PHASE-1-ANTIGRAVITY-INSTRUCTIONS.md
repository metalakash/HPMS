# SBL HPMS — Phase 1: Foundation & Database Schema Generation
## Final Integrated Antigravity Instruction Pack

**Source of truth:** This pack reconciles your draft Phase 1 instructions against all seven
foundation documents:

| # | Document | Role in this pack |
|---|---|---|
| 1 | `RFP_of_Hydropower_Project_Management_Solution.docx` (July 2025) | **Authoritative requirement baseline.** Superset of the other two RFPs. |
| 2 | `RFP_of_Hydro_Power_Analysis_Project.docx` (HPMP, June 2025) | Superseded prior revision. Used only for cross-checks. |
| 3 | `RFP_Hydro_Power_Analysis_Project.docx` (narrative draft) | Superseded. Narrative scope only. |
| 4 | `SBL HPMS - Master Foundation Architecture & Antigravity Blueprint.docx` | **Authoritative architecture + canonical schema naming.** |
| 5 | `SBL HPMS - In-House Architecture & Scope Rationalization.docx` | Authoritative scope pruning (what NOT to build). |
| 6 | `SBL HPMS - 1-Month Rapid Build & Deployment Plan.docx` | Authoritative sprint boundaries. Phase 1 = Days 1–3 + Week 1 Day 1–2. |
| 7 | `SBL HPMS - Vertical Slice Prototype Implementation & Verification Guide.docx` | **Already built and verified.** Phase 1 EXTENDS it; it does not re-initialize. |

**Precedence rule when documents conflict:** RFP (July 2025) defines *what*; the Master
Blueprint defines *how*; the Scope Rationalization doc defines *what is out of scope*; the
Build Plan defines *when*.

---

## ⚠️ Read this before pasting anything

Four material corrections were applied to your draft. Each is explained in
`PHASE-1-INTEGRATION-NOTES.md`. In summary:

1. **Do not initialize a new project.** The 48-hour Vertical Slice is already implemented
   and verified (`backend/app/models/entities.py`, `api/endpoints.py`, `services/workflow.py`,
   `integration/finacle.py`, `docker-compose.yml`). Instruction 1 has been rewritten to
   *harden and extend* that workspace.
2. **Entity names were non-canonical.** `ProjectMaster` / `CBSFinancialSync` /
   `ImmutableAuditLog` do not exist in the Blueprint. The canonical tables are `projects`,
   `loan_accounts`, `audit_logs`, etc. Renamed throughout to prevent a schema fork.
3. **"Native encryption at rest" is not achievable as stated.** PostgreSQL community edition
   has no TDE. The Blueprint mandates `pgcrypto` field-level encryption + SAN/filesystem
   encryption. Instruction 1 corrected.
4. **Requirement IDs are ambiguous** — the RFP has *two* matrices (Technical and Functional)
   that both use A.x/B.x/D.x. Every citation below is now prefixed **TECH** or **FUNC**.
   Your three original citations were all correct against the Technical matrix.

Two instructions (5 and 6) were **added**: without them, Week 1 Day 1–2 of the Build Plan
("Consortium, Tranches, Milestones, Approvals") has no schema to build on.

---

## Instruction 1 — Workspace Hardening & Security Baseline

> **Replaces your original Instruction 1.** Scope changed from "initialize" to "extend".

```
You are extending the SBL Hydropower Project Management Solution (HPMS) — an on-premise
enterprise platform for Siddhartha Bank Limited. The 48-hour Vertical Slice prototype is
ALREADY implemented and verified in this workspace. Do NOT re-scaffold it. Extend it.

Work only within the sbl-hpms-workspace/ directory tree.

1. WORKSPACE CONVENTION
   Confirm and preserve the existing structure:
     backend/app/models/entities.py      (SQLAlchemy 2.0 ORM + Pydantic v2 schemas)
     backend/app/api/endpoints.py        (async FastAPI routes)
     backend/app/services/workflow.py    (four-eyes state machine)
     backend/app/integration/finacle.py  (CBS adapter, isolated)
     docker-compose.yml, backend/Dockerfile (multi-stage Python 3.11)
   Refactor entities.py into a package: backend/app/models/{base,project,financial,
   consortium,governance,audit}.py. Domain-Driven Design boundaries; no cross-module
   imports except through backend/app/models/base.py.

2. PERSISTENCE LAYER  [TECH A.6 — CR]
   PostgreSQL 16+. Do NOT claim "native encryption at rest" — PostgreSQL has no TDE.
   Implement the two-layer model the Blueprint mandates:
     a. Field-level: pgcrypto (pgp_sym_encrypt/pgp_sym_decrypt) for sensitive financial
        identifiers — Finacle account numbers, customer IDs, sanctioned amounts.
        Key material is read from environment/secret store, NEVER hardcoded or committed.
        Expose via a SQLAlchemy TypeDecorator named EncryptedString / EncryptedNumeric.
     b. At-rest: document (do not implement) the dependency on SBL SAN/LUKS volume
        encryption in docs/DEPLOYMENT-SECURITY.md.
   Enable Row-Level Security (RLS) on projects, loan_accounts and approval_requests,
   keyed to branch/province/role  [FUNC A.4 — CR].
   Connection pooling via PgBouncer (transaction mode). Alembic for ALL migrations —
   no create_all() outside tests.

3. OWASP + ISG BASELINE  [TECH D.5 — CR, TECH A.5 — CR, TECH A.7 — ER]
   - Rate limiting (slowapi or equivalent) on all mutating endpoints.
   - CORS middleware: explicit allowlist of SBL intranet origins only. No wildcard.
   - Security headers: HSTS, X-Content-Type-Options, X-Frame-Options DENY, CSP.
   - IP whitelisting middleware for administrative routes, driven by config  [TECH A.7].
   - 100% parameterized queries. Fail the build on any raw f-string SQL.
   - Pydantic v2 strict mode on every request/response model.
   - Structured JSON logging with sensitive-field redaction.

4. AUTHENTICATION STUB  [TECH B.3 — CR]
   Create backend/app/auth/ with a provider interface AuthProvider and two
   implementations: LocalDevAuthProvider (dev only) and ActiveDirectoryAuthProvider
   (stub). The AD stub must define the real contract now:
     - LDAP/LDAPS bind against SBL Active Directory over the internal intranet
       (NO external DMZ/WAF hop — per Scope Rationalization).
     - Map AD sAMAccountName -> SBL bank employee ID as the canonical user_id used in
       every audit log entry.
     - Map AD security groups -> HPMS roles (see Instruction 6).
     - Leave Office 365 / digital-signature-certificate integration as a documented
       extension point on the same interface  [TECH B.3].
   The stub must raise NotImplementedError for live bind, not silently allow access.

5. QUALITY GATES  [Blueprint §9]
   Black + Ruff + mypy strict for Python; ESLint for the React layer.
   Minimum 85% unit test branch coverage, enforced in CI configuration.

DO NOT BUILD (explicitly out of scope per Scope Rationalization):
   - Any CMS / content-authoring module  [FUNC A.6 — pruned]
   - Multi-tenant vendor billing, licensing or telemetry  [FUNC A.7, TECH E.6 — pruned]
   - Vendor training portals  [FUNC G.2 — replaced by internal SOPs]
```

---

## Instruction 2 — Core Project Dossier Models

> **Replaces your original Instruction 2.** `ProjectMaster` → canonical `projects`.
> Pipeline enum retained (your union of FUNC B.5 + C.7 was correct) and extended with
> drop-reason capture, which FUNC C.8 requires and your draft omitted.

```
Generate SQLAlchemy 2.0 models for the Project Information Management module in
backend/app/models/project.py. Use the canonical table names from the Master Blueprint.

TABLE: projects  [FUNC C.2 — CR]
  - id: UUID primary key
  - project_code: unique, human-readable (e.g. SBL-HPP-0001)
  - name_en: String, required
  - name_np: String, Nepali Unicode. Column collation must be UTF-8; add a functional
    index using unaccent for search  [TECH B.7 — ER]
  - province, district, local_level: FK to a geo reference table, NOT free text —
    required for regional exposure filtering  [FUNC F.13 — CR]
  - installed_capacity_mw: Numeric(12,4)
  - project_stage: Enum(FEASIBILITY, CONSTRUCTION, OPERATION)  [FUNC C.2]
  - pipeline_status: Enum PipelineStatus (below)
  - drop_reason: Text, nullable — MANDATORY (enforce at service layer) whenever
    pipeline_status transitions to DROPPED  [FUNC C.8 — ER]

ENUM: PipelineStatus  [FUNC B.5 — CR + FUNC C.7 — CR]
  PROPOSAL_UNDER_PIPELINE, UNDER_REVIEW, APPROVED, DROPPED,
  YET_TO_START_DRAWDOWN, UNDER_CONSTRUCTION, UNDER_OPERATION, SETTLED

  CRITICAL: PipelineStatus is the *business lifecycle* of a project. It is a SEPARATE
  and INDEPENDENT state machine from the Maker-Checker ApprovalState defined in
  Instruction 6. Do not merge, alias, or cross-reference the two enums.

TABLE: project_technical_specs
  - project_id FK -> projects (1:1)
  - design_head_m, design_discharge_cumecs, plant_type, turbine_type, transmission_km

TABLE: hydrology_records  [FUNC C.6 — CR]
  - project_id FK, river_name, river_basin, sub_basin
  - measurement_date, flow_cumecs, q40_design_flow, catchment_area_sqkm
  - source (DHM / consultant), is_verified

TABLE: water_licenses  [FUNC C.12 — ER]
  - project_id FK, license_number, issuing_authority, river_basin
  - validity_from_ad, validity_to_ad, terms Text, status

TABLE: land_records  [FUNC C.11 — ER]
  - project_id FK, plot_id, ownership_status, acquisition_progress_pct
  - compensation_amount Numeric(20,4), compensation_status

DUAL-CALENDAR PATTERN  [TECH B.6 — CR, FUNC F.1 — CR]
  Every business date follows ONE pattern — do NOT store two independent user-editable
  fields, which will drift:
    <field>_ad : DATE      <- single source of truth, always written
    <field>_bs : String(10) <- 'YYYY-MM-DD' B.S., DERIVED, never hand-edited
  Implement backend/app/utils/nepali_calendar.py with bidirectional AD<->BS conversion
  backed by a verified year/month-length lookup table. State the supported range
  explicitly (min/max B.S. year) and raise on out-of-range input rather than
  silently approximating. Populate <field>_bs in a SQLAlchemy before_insert/before_update
  event listener so it can never diverge from <field>_ad.

All monetary columns: Numeric(20,4). Never Float.
All tables: created_at, updated_at (timezone-aware UTC), created_by, updated_by.
Produce the Alembic migration alongside the models.
```

---

## Instruction 3 — Financial Ledger & Finacle Sync Models

> **Replaces your original Instruction 3.** `CBSFinancialSync` was a single flat entity;
> the Blueprint requires three: `loan_accounts`, `disbursement_tranches`, `repayments`,
> plus a sync/audit log. Your JSONB raw-payload idea is retained but must be encrypted.

```
Generate SQLAlchemy 2.0 models for the Financial Data Integration module in
backend/app/models/financial.py.

TABLE: loan_accounts  [FUNC B.1 — CR]
  - id UUID PK
  - project_id: FK -> projects, NOT NULL  (mandatory relationship)
  - finacle_account_id: EncryptedString, unique  [TECH A.6 — pgcrypto]
  - facility_type, sanctioned_amount, disbursed_amount, outstanding_principal,
    outstanding_interest, overdue_principal, overdue_interest: all Numeric(20,4)
  - currency_code: CHAR(3) ISO 4217 (NPR, USD, ...)  [FUNC B.3 — ER]
  - fx_rate_to_npr: Numeric(18,8) + fx_rate_asof_ad DATE
    (store the rate snapshot so NPR-equivalent portfolio reporting is reproducible;
     never recompute historical exposure at today's rate)
  - interest_rate_pct, moratorium_end_ad/_bs, maturity_ad/_bs
  - last_synced_at, sync_status

TABLE: disbursement_tranches
  - loan_account_id FK, tranche_no, planned_amount, actual_amount
  - planned_date_ad/_bs, actual_date_ad/_bs, pro_rata_share_pct

TABLE: repayments
  - loan_account_id FK, due_date_ad/_bs, principal_due, interest_due,
    principal_paid, interest_paid, paid_date_ad/_bs, days_past_due

TABLE: cbs_sync_log   <- this is the correct home for your raw-payload idea
  - id UUID PK, loan_account_id FK (nullable for batch-level records)
  - sync_type: Enum(REALTIME_INQUIRY, EOD_BATCH, BOD_BATCH)
  - request_ref, response_code, started_at, completed_at, record_count
  - raw_payload: JSONB  [FUNC E.5 — CR, concurrent/post-facto audit]
    IMPORTANT: the raw Finacle payload contains account numbers and balances. Store it
    encrypted (pgcrypto) OR write a redaction function that masks account identifiers
    before persisting. Do not persist it in clear text — that would defeat TECH A.6.
  - error_detail, retry_count, dlq_flag

TABLE: budget_lines  [FUNC B.2 — CR, FUNC G.3 — CR]
  - project_id FK, category, budgeted_amount, actual_amount
  - variance_amount / variance_pct as GENERATED columns or hybrid_property
  - upload_batch_id (supports bulk Excel/CSV ingestion)

CONSTRAINTS
  - CHECK (disbursed_amount <= sanctioned_amount)
  - CHECK (all monetary amounts >= 0)
  - Index on (project_id, currency_code) and (sync_status, last_synced_at)

The models layer must contain NO Finacle network calls. All CBS traffic routes through
backend/app/integration/finacle.py only — zero direct CBS access from API or ORM layers
(Blueprint §9, network isolation).
```

---

## Instruction 4 — Tamper-Evident Audit Trail

> **Replaces your original Instruction 4.** "Append-only" alone is not enforceable;
> the Blueprint mandates **SHA-256 state hashing for every entry**, which your draft
> omitted. Hash *chaining* is added so deletion is detectable, not just insertion.

```
Generate the audit subsystem in backend/app/models/audit.py and
backend/app/services/audit.py.

TABLE: audit_logs  [FUNC E.1 — CR, FUNC E.3 — CR]
  - id: BIGSERIAL PK (monotonic — do not use random UUID for ordering)
  - user_id: String — the SBL bank employee ID resolved from Active Directory
  - user_role, source_ip, session_id
  - timestamp: TIMESTAMPTZ, server-side default now(), NOT client-supplied
  - entity_type, entity_id
  - action_performed: Enum(CREATE, UPDATE, SUBMIT, RECOMMEND, APPROVE, REJECT,
                            SEND_BACK, DISBURSE, SYNC, EXPORT, LOGIN, LOGOUT)
  - reason_for_action: Text, NOT NULL  [FUNC E.3 — CR; mandatory, per RFP wording]
  - pre_state: JSONB, post_state: JSONB
  - state_hash: CHAR(64)
  - prev_hash: CHAR(64)   <- chain link

HASH CONSTRUCTION  (Blueprint §9 / Vertical Slice §5 — keep byte-identical to the
verified prototype so existing logs remain checkable):
  state_hash = SHA256( user_id | action_performed | entity_id |
                       canonical_json(post_state) | utc_timestamp_iso8601 | prev_hash )
  Use a canonical JSON serializer (sorted keys, no whitespace, fixed float format).
  prev_hash = state_hash of the immediately preceding row; genesis row uses 64 zeros.

APPEND-ONLY ENFORCEMENT  [FUNC E.5 — CR]
  Enforce at BOTH layers — application-level guards alone are not sufficient for audit:
    a. Database: REVOKE UPDATE, DELETE ON audit_logs FROM the application role, and add
       a BEFORE UPDATE OR DELETE trigger that RAISEs an exception.
    b. Application: a SQLAlchemy before_flush listener that rejects any dirty or deleted
       audit_logs instance.
  Provide a verification routine verify_chain(from_id, to_id) that recomputes the chain
  and reports the first divergent row — this is what an NRB inspector or internal audit
  will run.

INTERCEPTOR
  A SQLAlchemy event listener on after_insert/after_update/after_delete for every
  governed entity, writing one audit row per change. reason_for_action must be supplied
  through a request-scoped context (contextvar); a write with no reason must FAIL, not
  default to an empty string.

RETENTION  [FUNC E.4 — ER]
  Expose AUDIT_RETENTION_YEARS as configuration.
  NOTE FOR SBL: the RFP requires the retention period to be *defined* in compliance with
  regulatory and organizational policy, but neither the RFP nor the foundation documents
  state a specific NRB-mandated figure. Ship the default as 7 years — consistent with the
  RFP's 7-year AMC and 7-year end-of-support horizon — and flag it for written
  confirmation by SBL Compliance before Go-Live. Do not hardcode; do not claim NRB
  mandates a number the documents do not state.
  Retention expiry must ARCHIVE to cold storage, never DELETE in place.
```

---

## Instruction 5 — Consortium & Syndication Models  *(ADDED)*

> Not in your draft. This is a **retained core mission-critical capability** in the Scope
> Rationalization doc and Build Plan Week 1 Day 1–2. Without it Phase 1 is incomplete.

```
Generate SQLAlchemy 2.0 models for Consortium Credit Facilities in
backend/app/models/consortium.py.

TABLE: consortium_facilities
  - id UUID PK, project_id FK -> projects NOT NULL
  - facility_name, total_facility_limit Numeric(20,4), currency_code CHAR(3)
  - sbl_role: Enum(LEAD_BANK, PARTICIPANT)
  - lead_bank_name, facility_agreement_date_ad/_bs
  - security_type, charge_ranking

TABLE: consortium_members
  - consortium_facility_id FK
  - institution_name, institution_type
  - is_lead: Boolean
  - committed_amount Numeric(20,4)
  - share_pct Numeric(9,6)
  - disbursed_to_date Numeric(20,4)
  - CHECK: exactly one member per facility has is_lead = true
  - CONSTRAINT: SUM(share_pct) per facility = 100.000000 (validate in service layer;
    add a deferred constraint trigger)

PRO-RATA RULE
  Implement calculate_pro_rata(facility_id, drawdown_amount) in
  backend/app/services/consortium.py returning each member's share.
  Use Decimal throughout. Allocate the rounding remainder to the LEAD bank so the
  allocated total reconciles exactly to the drawdown amount — never let rounding
  create or destroy exposure.

EXPOSURE VIEW
  A read model exposing SBL's own committed vs disbursed vs outstanding exposure per
  project and per province, for FUNC F.4 (actual vs projected exposure) and
  FUNC F.13 (location filtering).
```

---

## Instruction 6 — Governance State Machine & RBAC Models  *(ADDED)*

> Your draft referenced Maker/Checker as a *future* question. The Build Plan places it in
> Week 1 Day 4–5, and the Vertical Slice already implements a two-state version — so the
> schema must be generated in Phase 1 for the existing code to extend cleanly.

### Design Decision: Progress Entry Workflow (Locked for Phase 1)

**Mechanism: Bank-Entered, Evidence-Backed (Internal-Only)**

Construction progress is entered by Credit Officers, not by external borrowers:

1. Borrower submits progress report and supporting evidence (email, hard copy)
2. Credit Officer enters structured data in HPMS and attaches the evidence document
3. Risk Manager reviews and recommends (Maker-Checker approval)
4. Approving Authority finalizes

All actors are SBL staff authenticated via Active Directory. No external portal. No DMZ.
This aligns with current Nepali project finance practice and fits the 4-week timeline.

**Future Extension (Phase 2+): Independent Engineer Verification**

When ready, bolt on IE certification without rearchitecting:
- Borrower → Independent Engineer (IE certifies progress, signs off)
- Credit Officer enters IE-verified data (backed by IE's certificate)
- Add fields: `ie_certificate_id`, `ie_verified_at`, `ie_certifying_engineer` to milestone
  records
- Workflow remains internal-only; IE engagement is upstream

```
Generate the governance models in backend/app/models/governance.py, extending the
Maker-Checker logic already verified in backend/app/services/workflow.py.

ENUM: ApprovalState   (Blueprint §6 — distinct from PipelineStatus in Instruction 2)
  DRAFT -> SUBMITTED -> UNDER_RECOMMENDATION -> RECOMMENDED -> APPROVED -> DISBURSED
  with REJECTED and SENT_BACK reachable from SUBMITTED, UNDER_RECOMMENDATION
  and RECOMMENDED.
  Encode legal transitions as an explicit dict; reject anything not in it.

TABLE: roles / permissions / role_permissions  [FUNC A.1 — CR, FUNC A.2 — CR]
  Seed roles: SUPER_ADMIN, ADMIN, PROJECT_OFFICER (Maker),
              RISK_MANAGER (Recommender), APPROVING_AUTHORITY (Approver),
              SYSTEM_AUDITOR (read-only, including audit_logs).
  Permissions must be FIELD-LEVEL, not just entity-level — FUNC A.1 explicitly requires
  control of access rights at field level. Model as
  (role_id, entity_type, field_name, access: NONE|READ|WRITE).

TABLE: approval_requests
  - id UUID PK, entity_type, entity_id, workflow_definition_id
  - current_state: ApprovalState
  - maker_id, recommender_id, approver_id (all AD employee IDs — internal staff only)
  - submitted_at, completed_at

TABLE: approval_steps
  - approval_request_id FK, step_no, actor_id, actor_role
  - from_state, to_state, acted_at
  - remarks: Text — NOT NULL when to_state IN (REJECTED, SENT_BACK)

TABLE: workflow_definitions  [FUNC A.3 — CR]
  Configurable per use case: the Bank must be able to define steps and route to single
  or multiple recommenders/approvers without a code change. Store the step graph as
  JSONB with a validating Pydantic schema.
  
  NOTE: Phase 1 scope is internal routing only (SBL staff). External actors (borrowers,
  engineers) are handled upstream of the approval workflow, not within HPMS routing.

SEPARATION OF DUTIES (four-eyes) — preserve the verified prototype behaviour:
  The maker of a request may never act as its recommender or approver. Violation returns
  HTTP 403 with the exact message "Separation of Duties violation" (the Vertical Slice
  test suite asserts on this string).
  Every state transition writes an audit_logs row via Instruction 4's interceptor.
```

---

## Phase 1 exit criteria

Phase 1 is complete when all of the following hold:

- [ ] `alembic upgrade head` builds the full schema from empty on PostgreSQL 16.
- [ ] `docker compose up --build` brings the stack up; `GET /health` returns 200.
- [ ] pgcrypto round-trips `finacle_account_id` — ciphertext confirmed in raw table dump.
- [ ] RLS blocks a cross-province read in an integration test.
- [ ] `verify_chain()` passes over a seeded 100-row audit trail, and fails as expected
      after a manual `UPDATE` attempted as superuser.
- [ ] `DELETE FROM audit_logs` raises, as the application role.
- [ ] A Maker attempting to approve their own request gets HTTP 403
      "Separation of Duties violation".
- [ ] Pro-rata allocation of an odd drawdown across 3 members reconciles to the cent.
- [ ] AD↔BS conversion passes a round-trip test across the full supported year range,
      and raises out of range.
- [ ] Ruff, Black, mypy clean; coverage ≥ 85% branch.

## What comes next

Phase 2 candidates, in the order the Build Plan implies:

1. **Finacle CBS Integration Adapter** (Week 2, Day 6–9) — REST/SOAP contract, circuit
   breaker, dead-letter queue, EOD/BOD batch reconciliation. *Recommended next:* it is the
   longest external dependency and the Build Plan lists CBS team API access as a
   prerequisite that must be requested now.
2. **Workflow Engine runtime** (Week 1, Day 4–5) — the schema from Instruction 6 made
   executable, with the configurable multi-tier routing.

Both are unblocked by this Phase 1 pack. The CBS adapter has an external dependency;
the workflow engine does not.
