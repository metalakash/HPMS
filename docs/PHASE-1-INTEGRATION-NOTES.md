# Phase 1 — Integration Notes, Conflicts & Corrections

What changed between your draft Phase 1 instructions and the final pack, and why.
Every item cites the foundation document that forced the change.

---

## 1. The RFP has two requirement matrices that share ID prefixes

This is the single biggest trap in the RFP and it affects your draft directly.
`RFP_of_Hydropower_Project_Management_Solution.docx` contains a **Technical Requirement**
matrix and, separately, a **Functional Requirement** matrix. Both number their sections
A, B, C, D, E. So "A.6" and "B.3" and "D.5" each mean two different things.

| ID | Technical matrix | Functional matrix |
|---|---|---|
| **A.6** | RDBMS with access security and **encryption** — *CR* | Rich creative design / **content management** — *ER* |
| **A.7** | **IP whitelisting** — *ER* | Admin manages **user portal** — *ER* |
| **B.3** | Integration with **Active Directory / Office 365** / digital signature — *CR* | Support for **multiple currencies** — *ER* |
| **D.5** | Adherence to **OWASP** and ISG guidelines — *CR* | **Support portal / issue tracker** — *ER* |
| **E.6** | *(no E.6 — Technical E ends at E.3)* | Bank's right to **audit the vendor's system** — *CR* |

**Your three citations were all correct against the Technical matrix.** No error on your
part. But the collision is dangerous in two specific ways:

- **Functional A.6 (CMS) is explicitly pruned** by the Scope Rationalization document
  ("Removal of generic, non-technical Content Management Systems (A.6)"). An agent that
  resolves a bare "A.6" to the Functional matrix would build a CMS that SBL decided not to
  buy. The final pack prefixes every citation **TECH** or **FUNC** to close this off.
- **Functional B.3 (multi-currency) is a real requirement** your Instruction 3 satisfied
  in substance ("support multiple currencies") without citing it. It is now cited, so it
  appears in the traceability matrix for the bid response.

---

## 2. Phase 1 is not a greenfield start

Your Instruction 1 said *"Initialize a Python FastAPI project."* But the
**Vertical Slice Prototype Implementation & Verification Guide** records that this work is
already done and signed off:

> Domain models, the Maker-Checker four-eyes state machine, the Finacle CBS read-only
> adapter and SHA-256 cryptographic audit trails have all been implemented and verified
> end-to-end in the Antigravity workspace.

with a concrete file manifest (`backend/app/models/entities.py`,
`backend/app/api/endpoints.py`, `backend/app/services/workflow.py`,
`backend/app/integration/finacle.py`, `docker-compose.yml`, `backend/Dockerfile`).

Re-initializing would discard verified code — including the exact `403 Separation of
Duties violation` behaviour the prototype's tests assert on, and the SHA-256 hash format
under which any existing audit rows were written. Instruction 1 is now scoped to
**harden and extend**, and Instruction 4 explicitly says to keep the hash construction
byte-identical to the verified prototype.

**Action required from you:** confirm whether the prototype workspace is present on this
machine. `C:\Users\ACER\HPMS` is currently empty apart from these documents. If the
verified slice lives elsewhere, point Antigravity at it; if it was never committed,
Instruction 1 should be run in "initialize" mode and the prototype rebuilt from its
manifest first.

---

## 3. "Native data encryption at rest" is not available as specified

Your Instruction 1 asked for *"native data encryption at rest and field-level encryption."*
PostgreSQL community edition has **no transparent data encryption**. There is no native
at-rest feature to switch on.

The Master Blueprint already specifies the achievable design:

> PostgreSQL 16+ utilizing **pgcrypto** for field-level encryption of sensitive financial
> identifiers.

So the corrected instruction implements a two-layer model:

| Layer | Mechanism | Owner |
|---|---|---|
| Field-level | `pgcrypto` (`pgp_sym_encrypt`) behind a SQLAlchemy `TypeDecorator` | HPMS application |
| At-rest (volume) | SBL SAN / LUKS volume encryption | SBL infrastructure team |

This still fully satisfies **TECH A.6 (CR)** — the requirement asks for "relational
database with its access security and encryption", not for TDE specifically. But the bid
response and the deployment document must state the split honestly, because the at-rest
half is an SBL infrastructure dependency, not something the application delivers.

---

## 4. Entity names in your draft would fork the schema

The Master Blueprint fixes canonical table names in its Database Schema section. Your
draft introduced three names that do not appear in any foundation document:

| Your draft | Canonical (Blueprint §5) | Note |
|---|---|---|
| `ProjectMaster` | `projects`, `project_technical_specs` | Blueprint splits core metadata from technical parameters |
| `CBSFinancialSync` | `loan_accounts`, `disbursement_tranches`, `repayments` (+ `cbs_sync_log`) | One flat entity cannot hold a tranche schedule or a repayment schedule |
| `ImmutableAuditLog` | `audit_logs` | — |

`cbs_sync_log` is the one genuinely new table, and it is where your JSONB raw-payload idea
belongs — see item 6.

---

## 5. Two state machines were at risk of being merged

Your Instruction 2 describes a single enum mixing pipeline states. That enum is correct
and complete — it is the union of **FUNC B.5** (Under Construction, Under Operation, Yet
to Start Drawdown, Settled, Proposal Under Pipeline) and **FUNC C.7** (Under Review,
Approved, Dropped). Good catch on your part; neither RFP clause lists all eight.

The risk is that the Blueprint *also* defines an approval state machine
(`DRAFT → SUBMITTED → UNDER_RECOMMENDATION → RECOMMENDED → APPROVED/DISBURSED`, with
`REJECTED`/`SENT_BACK`), and both contain a state called "Approved". These are orthogonal:
a project sitting in `UNDER_CONSTRUCTION` can have a budget-revision request sitting in
`UNDER_RECOMMENDATION`. The final pack states the separation explicitly in both
Instruction 2 and Instruction 6 so the agent cannot collapse them.

**Also added:** `drop_reason`. **FUNC C.8 (ER)** requires recording "project rejection or
dropout reasons for audit and learning" — your draft had the `Dropped` state but nowhere
to record why.

---

## 6. The raw Finacle payload must not be stored in clear text

Your Instruction 3 point 4 — a JSONB column for the raw Finacle response — is a good idea
and directly supports **FUNC E.5 (CR)**, concurrent and post-facto audit of all processes.

But a raw Finacle loan-inquiry payload contains exactly the fields **TECH A.6** requires
you to encrypt: account numbers, balances, customer identifiers. Persisting it in clear
text next to an encrypted `finacle_account_id` column would defeat the field-level
encryption entirely — an auditor reading the JSONB gets everything the encryption was
protecting.

The final Instruction 3 requires either pgcrypto encryption of the payload or a redaction
function that masks account identifiers before persisting.

---

## 7. Your draft covered 3 of 6 Week-1 entity groups

The **1-Month Rapid Build Plan**, Week 1 Day 1–2, lists the Data Foundation deliverable as:

> PostgreSQL Relational Schema, SQLAlchemy models, and Alembic migrations for
> **Projects, Consortium, Tranches, Milestones, Approvals, and Audit Logs.**

Your four instructions produced Projects, a partial financial entity, and Audit Logs.
Missing: Consortium, Tranches, Milestones, Approvals — and Alembic was not mentioned at
all, though the Build Plan names it explicitly.

Tranches were folded into Instruction 3. Consortium became **Instruction 5** and
Approvals became **Instruction 6**. Alembic is now mandated in Instruction 1.

**Milestones remain deferred** — `milestone_records` and `milestone_verifications` sit in
Week 3 Day 16–17 of the Build Plan (Gantt tracking, RCOD/COD slippage alerts) and depend
on the frontend layer. Flagging it explicitly so the omission is a decision rather than an
oversight: if you want the milestone tables in Phase 1 for schema completeness, they are a
short Instruction 7 covering **FUNC C.5**, **FUNC E.12**, **FUNC F.15**.

---

## 8. Consortium is the highest-value capability your draft omitted

Worth calling out separately. The Scope Rationalization document lists
"Consortium / Syndication Loan Management (Lead vs. Participant exposure, pro-rata
drawdowns)" as a **retained core** capability, and the Master Blueprint makes it the first
named strategic focus area. It is also the hardest thing in the system to retrofit,
because pro-rata allocation touches every monetary column in the financial module.

Note the rounding rule in Instruction 5 — allocating the remainder to the lead bank. This
is a real correctness requirement, not a detail: naive per-member rounding on a
three-way split of an odd amount will silently create or destroy a few paisa of exposure
on every drawdown, which will not reconcile against Finacle.

---

## 9. Audit retention — an honest gap

Your Instruction 4 asks for a retention period "in compliance with Nepal Rastra Bank
regulatory requirements." **No number appears in any of the seven documents.** The RFP
(**FUNC E.4 — ER**) only requires that the solution let SBL *define* the period:

> Solution should define the retention period for audit logs in compliance with regulatory
> requirements and organizational policies.

The final pack ships `AUDIT_RETENTION_YEARS` as configuration with a 7-year default —
chosen for consistency with the RFP's 7-year AMC schedule and 7-year end-of-support
requirement, not because NRB is documented as mandating 7 years. It is flagged for written
confirmation by SBL Compliance before Go-Live. Do not let the bid response assert an
NRB-mandated figure the documents do not support.

---

## 10. Append-only needs database enforcement

Your Instruction 4 said "ensure this table is append-only." An ORM-level guard is not
sufficient for a table whose purpose is to withstand audit — anyone with a psql session
bypasses it.

The final pack enforces at both layers (`REVOKE UPDATE, DELETE` plus a raising trigger,
*and* a `before_flush` listener), and adds **hash chaining** (`prev_hash`). Your draft and
the Vertical Slice both hash each row's own state, which detects modification of a row but
not *deletion* of one. Chaining closes that gap and gives internal audit a single
`verify_chain()` call to run.

---

## 11. Documents 2 and 3 are superseded — use document 1 only

| Document | Title | Date | Requirement IDs |
|---|---|---|---|
| `RFP_of_Hydropower_Project_Management_Solution.docx` | HPMS | **July 2025** | Functional A.1–A.8, B.1–B.7, C.1–C.12, D.1–D.5, E.1–E.25, F.1–F.16, G.1–G.9 |
| `RFP_of_Hydro_Power_Analysis_Project.docx` | HPMP | June 2025 | Functional A.1–A.9, B.1–B.6, C.1–C.6, D.1–D.5, E.1–E.15, F.1–F.14, G.1–G.9 |
| `RFP_Hydro_Power_Analysis_Project.docx` | HPMP narrative draft | June 24 2025 | none (prose only) |

The July HPMS document is a strict expansion: Compliance & Portfolio Monitoring grew from
15 to 25 clauses, Project Information Management from 6 to 12, Reporting from 14 to 16.
The June HPMP version also carried two eligibility clauses the July version **dropped** —
a mandatory prior HPMP deployment in a Nepali BFI, and a 2-year in-production requirement.
July softens both to a preference ("shall be prioritized"). Nothing in the June documents
survives that is not in the July one, so build against July only.

---

## Summary of changes

| # | Change | Severity | Driver |
|---|---|---|---|
| 1 | Prefix all requirement IDs TECH/FUNC | High | RFP ID collision |
| 2 | Extend the verified slice, don't re-initialize | High | Vertical Slice Guide |
| 3 | pgcrypto + SAN, not "native TDE" | High | PostgreSQL reality + Blueprint |
| 4 | Canonical table names | High | Blueprint §5 |
| 5 | Keep PipelineStatus and ApprovalState separate | High | Blueprint §6 |
| 6 | Encrypt/redact the raw CBS payload | High | TECH A.6 vs FUNC E.5 |
| 7 | Add Instructions 5 & 6, add Alembic | High | Build Plan Week 1 |
| 8 | Pro-rata rounding to lead bank | Medium | Consortium correctness |
| 9 | Retention configurable, default flagged | Medium | FUNC E.4 wording |
| 10 | DB-level append-only + hash chaining | Medium | Blueprint §9 |
| 11 | Add `drop_reason` | Low | FUNC C.8 |
| 12 | Geo as FK, not free text | Low | FUNC F.13 |
| 13 | FX rate snapshot on loan accounts | Low | FUNC B.3 + F.3 |
