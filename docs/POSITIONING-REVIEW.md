# HPMS Positioning — Review, Tensions and Schema Consequences

Assessment of the proposed product positioning and feature set against
`RFP_of_Hydropower_Project_Management_Solution.docx` (July 2025), the Master Blueprint,
the Scope Rationalization document, the 1-Month Build Plan, and the Phase 1 instruction
pack.

**Overall:** the positioning is right and I'd adopt it. "Finacle is the system of record
for balances; HPMS is the system of accountability for monitoring evidence" is a cleaner
boundary than anything in the foundation documents, and it resolves an ambiguity the
Blueprint left open. Ten things need resolving before building to it.

---

## A. Tensions with the RFP — resolve these first

### A.1 "Not a loan-origination system" contradicts four Critical Requirements

The positioning says HPMS is **post-sanction**. The RFP explicitly requires pre-sanction
pipeline coverage, and grades most of it CR:

| ID | Grade | Requirement | Stage |
|---|---|---|---|
| FUNC B.5 | **CR** | Classify project by status, incl. *Proposal Under Pipeline* | Pre-sanction |
| FUNC C.7 | **CR** | Pipeline tracking from **proposal stage** to final disbursement — *Under Review*, *Approved*, *Dropped* | Pre-sanction |
| FUNC B.6 | **CR** | Enter **pre-disbursement** and loan projection data manually | Pre-sanction |
| FUNC C.8 | ER | Record project **rejection or dropout** reasons for audit and learning | Pre-sanction |

The RFP's own objectives section is explicit: *"managing all aspects of hydropower projects
financed by the Bank **from proposing the bank**, disbursement of loan to settlement of
loan."*

A strict post-sanction reading drops four requirements, three of them CR, and contradicts
the stated project objective.

**Suggested resolution — narrow the claim rather than the scope.** Distinguish two things
the positioning currently merges:

- **Pipeline visibility** (in scope): a proposal exists, what stage it's at, who owns it,
  why it was dropped. Lightweight — a status, an owner, a reason, a date history. This is
  what B.5 / C.7 / C.8 actually ask for.
- **Credit origination** (out of scope): appraisal, scoring, sanction memos, limit setting,
  sanction approval. Heavy, regulated, and already lives elsewhere.

Reword the product definition to something like: *"HPMS tracks a project from proposal
through settlement. It does not perform credit appraisal or sanctioning — those remain in
the Bank's existing credit process — but it carries the pipeline record and the dropout
rationale so that post-sanction monitoring has a complete history."*

That keeps the discipline of the positioning without forfeiting CR marks or contradicting
the RFP's stated purpose.

### A.2 Modules missing against the RFP

The eleven-module table is well-constructed but omits requirements that are in the July
matrix, several CR-graded:

| Missing | ID | Grade | Note |
|---|---|---|---|
| EIA/ESIA records, mitigation measures, monitoring activities | FUNC E.17 | **CR** | Partially served by documents, but E.17 asks for *records and monitoring activities*, not just file storage |
| Community consultations, grievances, resolutions | FUNC E.18 | ER | No home in the current module list |
| CSR activity tracker (budgets, locations, beneficiaries) | FUNC E.25 | ER | No home |
| CO₂ emission avoidance for ESG reporting | FUNC F.14 | ER | No home |
| PowerBI / Word / Excel / PowerPoint integration with scheduled distribution | FUNC F.11 | **CR** | Significant — this is a CR and it's an integration workstream, not a report format |
| Industry / peer bank comparison with bulk upload | FUNC G.9 | ER | No home |
| Link prior-year data for budget forecasting | FUNC G.8 | ER | No home |

**Suggested resolution:** add a twelfth module — **ESG, Social & Sustainability** — covering
E.17, E.18, E.25 and F.14. These cluster naturally and are genuinely part of hydropower
lending in Nepal, where IEE/EIA and community grievance are live project risks, not
paperwork. Treat F.11 (PowerBI) as a named integration workstream alongside Finacle rather
than a reporting sub-feature; it is CR and it is not free.

### A.3 Modules added beyond the RFP

Two modules in the proposal have no corresponding RFP requirement:

- **Collateral and security** — the RFP has land records (C.11) and insurance (E.11) but
  no collateral or security register.
- **Borrower KYC / CDD / UBO** — the RFP has shareholding and BOD details (E.13) but no
  KYC.

Both are good product thinking. Both are unscored build cost, and both risk duplicating
data that already exists in Finacle or SBL's credit system. See §B.3 for the KYC problem
specifically, which is more than a cost question.

**Suggested resolution:** confirm with SBL Credit Admin where collateral is held today
before building a second register. If Finacle holds it, HPMS should reference it, not copy
it. If it genuinely lives in Excel, building it here is defensible — but flag it as a
deliberate scope addition rather than letting it arrive unnoticed.

---

## B. Architectural consequences — these change the build

### B.1 Who enters construction progress? This is the largest open question.

The proposed workflow (§7) reads:

> 1. Credit officer requests or uploads a document.
> 2. **Borrower or project team submits it.**
> 3. Relationship manager reviews completeness.

Step 2 implies external users outside SBL. That collides with two decisions already made:

- **Instruction 1** builds AD-only authentication against SBL Active Directory, mapped to
  bank employee IDs. A borrower has no employee ID.
- The **Scope Rationalization document** explicitly prunes vendor and external portals
  (FUNC A.7) and routes everything over the internal intranet with no DMZ hop.

An external borrower portal is a different security architecture: DMZ, external identity,
different threat model, almost certainly a separate NRB/InfoSec review. It is not a feature
increment.

**Three viable options, in order of my preference:**

1. **Bank-entered, evidence-backed (recommended for the 4-week build).** Borrowers submit
   progress by email or hard copy as they do today. A credit officer enters it in HPMS and
   attaches the evidence document. HPMS's value is that the entry is now structured,
   maker-checker controlled, audited and alertable — rather than sitting in an inbox. No
   external access, no architecture change, and it matches how these relationships actually
   run in Nepali project finance today.
2. **Independent engineer as the verifier.** In hydropower lending the lender's independent
   engineer certifies physical progress before drawdown. Model `milestone_verifications`
   around IE certification, with the IE's report as the evidence artefact — still entered
   by bank staff, but the authority for the number is the IE, not the borrower's claim.
   This is more faithful to the real control and costs little extra.
3. **External borrower portal.** Defer. Legitimate Phase 2+ ambition, but it reopens the
   security architecture and contradicts the current scope decision.

Option 1 plus option 2's verification model is what I'd build. **This needs an explicit
decision before Instruction 6's workflow definitions are finalised**, because it determines
whether `workflow_definitions` needs an external-actor concept at all.

### B.2 Effective-dating is correct — and it reworks the Phase 1 schema

> *"Do not store only a current value for important fields. Use effective-dated history for
> ownership, sponsors, capacity, COD, risk rating, and facility terms."*

Agreed, and this is the most consequential technical statement in the document. The Phase 1
pack currently uses mutable current-value columns in several places it shouldn't:

| Phase 1 field | Problem | Fix |
|---|---|---|
| `consortium_members.share_pct` | Share transfers and participant substitution are real; a mutable percentage destroys the history of who was exposed when | Effective-dated rows: `valid_from`, `valid_to` |
| `loan_accounts.interest_rate_pct` | Rate resets and restructuring | Effective-dated rate schedule |
| COD (single field in Instruction 2) | The proposal's §5 COD/RCOD design is materially better than mine | Adopt `original_cod` / `current_approved_cod` / `forecast_cod` / `actual_cod` + `rcod_requests` table |
| `projects.installed_capacity_mw` | Capacity gets revised during design | Effective-dated |
| Risk rating | Not yet in Phase 1 | Add as effective-dated from the start |

The audit trail records *that* a value changed; effective-dating records *what was true
when*. For covenant testing and provisioning support you need the second — testing a Q3
covenant against today's facility terms gives the wrong answer.

**Cost:** roughly a day of additional schema work in Phase 1, and it's much cheaper now
than retrofitting after data exists. Recommend adopting it, with a standard
`valid_from` / `valid_to` / `is_current` pattern and a partial unique index enforcing one
current row per key.

### B.3 KYC/CDD in HPMS creates a regulated data copy

Storing KYC documents, CDD records and ultimate beneficial ownership in HPMS means HPMS
becomes an AML-regulated data store, with its own retention obligations under the Asset
(Money) Laundering Prevention Act, its own access-control audit, and its own exposure in
any AML inspection. It also creates a second copy that can drift from the CBS record — and
in an AML finding, a stale duplicate is worse than no duplicate.

**Suggested resolution:** HPMS stores the **CBS customer ID** and displays KYC status by
reference. It does not hold KYC documents. Sponsor and shareholding structure (FUNC E.13)
is different — that's project-governance data with no CBS home, and belongs in HPMS.

### B.4 CBS-sourced vs manually-entered should be a column, not a convention

> *"The application should distinguish CBS-sourced facts from manually entered monitoring
> data."*

Strongly agree, and it should be explicit in the schema rather than implied by which table
a field sits in. Suggest adding to every financial and progress field group:

```
data_provenance : Enum(CBS_SYNCED, MANUAL_ENTRY, CALCULATED, DOCUMENT_VERIFIED)
source_reference : String     -- Finacle batch ID, document ID, or user ID
as_of            : TIMESTAMPTZ
```

This does three jobs at once: it makes the reconciliation exception logic trivial (never
overwrite a `MANUAL_ENTRY` field from a batch), it makes every dashboard number defensible
to an auditor, and it makes the "which number is authoritative" question answerable in the
UI rather than in a meeting.

### B.5 If HPMS is the system of accountability, the audit trail must capture reads

The proposal's §11 says it plainly:

> *"The audit design should capture who viewed, created, changed, approved, rejected,
> exported, synchronised, or deleted an item — not only who changed a database row."*

**This is a real gap in the current Phase 1 pack.** Instruction 4's action enum includes
`EXPORT` and `LOGIN`, but the interceptor is specified on `after_insert` / `after_update` /
`after_delete` only. Views and exports never fire it.

Needs an API-layer audit decorator in addition to the ORM listener. Worth doing — for a
concentrated-exposure portfolio, "who pulled the watchlist before that board meeting" is a
question internal audit will eventually ask. Note the volume consequence: read auditing on
a portfolio dashboard generates far more rows than write auditing, so log reads at
*entity-access* granularity, not per-row-returned.

---

## C. Scope and sequencing realities

### C.1 The proposed MVP is roughly two to three times the 4-week plan

The twelve-item MVP list maps onto the 1-Month Build Plan like this:

| MVP item | Build Plan location |
|---|---|
| 1. Registry · 2. Facility register · 10. Maker-checker · 11. Audit trail | Week 1 ✓ |
| 3. Finacle sync · 7. Document management | Week 2 ✓ |
| 4. Milestones · 5. COD/RCOD · 6. PPA master | Week 3 ✓ |
| 9. Risk/exception dashboard · 12. Reporting + Excel import | Week 4 ✓ |
| **8. Covenant engine (DSCR, D/E, cost overrun)** | **Not in the Build Plan at all** |

The covenant engine is the genuine addition — and §B.6 below explains why it's larger than
it looks. Everything else fits the four weeks *only if* nothing slips, and the Build Plan
already carries external dependencies (CBS API access, InfoSec checkpoints, UAT users) that
are not yet confirmed.

**Suggested resolution:** keep the twelve-item list as the **1-month target**, not the
Phase 1 MVP. Phase 1 as instructed remains schema and governance. If the four-week deadline
is real and externally committed, the covenant engine is the first thing to cut to a
reduced form — see §C.2.

### C.2 DSCR is a field; LLCR and CFADS are a financial model

The proposal lists DSCR, LLCR, interest coverage and CFADS together. They are not
comparable in cost.

- **Backward-looking DSCR** for an operating project = actual cash flow ÷ actual debt
  service. Both are known. Straightforward.
- **LLCR** = NPV of CFADS over the remaining loan life ÷ outstanding debt. That requires a
  **projected** cash flow to maturity: generation forecast × seasonal tariff × escalation,
  less O&M, less tax, less working capital movement, discounted at a chosen rate.

That is a project finance model, not a database column. It needs forecast generation curves,
the full PPA escalation schedule, an opex assumption set, a tax treatment, and a discount
rate convention — none of which exist in the data model today, and several of which are
still open research items.

**Suggested resolution — a three-stage ladder:**

1. **Phase 1–2: store reported ratios.** The borrower's submitted DSCR/LLCR, who verified
   it, against which financial statements, with the document attached. This satisfies FUNC
   E.8 (define and track KPIs) and gives immediate covenant-tracking value with no model.
2. **Phase 3: compute backward-looking ratios** from verified actuals for operating
   projects.
3. **Phase 4+: forward-looking LLCR** once the cash flow model and its assumptions have been
   signed off by Credit Risk — because the assumptions, not the code, are the hard part and
   they need an owner.

Committing to computed LLCR in a four-week build would produce a number nobody will defend
in a credit committee.

### C.3 Single-obligor aggregation cannot be done from hydropower data alone

The exposure views include *"single-obligor and connected-party aggregation"* and
*"exposure against bank capital and internal limits."*

A single obligor's exposure spans every sector they borrow in, not just hydropower. A
sponsor group with a hydropower SPV may also hold cement, trading and real-estate
facilities at SBL. HPMS sees only the hydropower slice.

So HPMS can present **hydropower-sector concentration** (genuinely valuable, and the World
Bank sector assessment supports why it matters for a Nepali bank), but it **cannot** be the
system that certifies single-obligor limit compliance unless it ingests bank-wide exposure
from Finacle — a significant scope expansion.

**Suggested resolution:** state the limitation explicitly in the product definition and in
the UI. Label the dashboard "Hydropower portfolio exposure," not "Group exposure." If SBL
wants true single-obligor aggregation, that is a Finacle/DWH report, and HPMS should link
to it rather than reimplement it. Getting this wrong is a compliance-reporting risk, not
just a feature gap.

### C.4 HPMS records disbursement; it must not instruct it

*"Drawdown allocation"* in the consortium module could be read as HPMS instructing
disbursement. The Blueprint is unambiguous that the Finacle adapter is **read-only**, and
that is the right call — a write path to core banking makes HPMS a transactional system
with an entirely different control, testing and audit burden.

**State the boundary explicitly:** HPMS computes and records the *intended* pro-rata
allocation as monitoring data and evidence for the credit file. The disbursement
instruction itself is executed in the Bank's existing process. HPMS then reconciles what
Finacle reports against what was intended, and raises an exception on divergence — which
is more valuable as a control than instructing would be.

---

## D. Aspects not yet covered by either document

### D.1 Portfolio size changes what "good architecture" means

A Nepali commercial bank's hydropower book is plausibly tens to low hundreds of projects,
with maybe a few thousand milestones and tens of thousands of transactions a year. That is
small.

The consequence: TECH C.1–C.4 (scalability, CR-graded) must still be answered in the bid
response, but honestly — the design is *comfortably* within single-node PostgreSQL, and
the real engineering risks here are **data quality and user adoption**, not throughput.
Effort spent on sharding or caching is effort not spent on making data entry fast enough
that the Credit department stops using Excel. Worth saying out loud so the team optimises
for the right thing.

### D.2 Adoption is the top project risk and nothing in the feature list addresses it

The RFP's own background states the current process is *"manual data entry (in Excel),
disparate systems, and time-consuming report generation."* The most likely failure mode for
HPMS is not a technical one — it is that Credit staff keep their Excel files and treat HPMS
as a reporting chore, at which point the data is stale and the dashboards are wrong.

Features that specifically defend against this, none currently in the list:

- **Excel round-trip, not just import.** Let officers export a project's monitoring sheet,
  edit offline, and re-upload with validation and a diff preview. Fighting Excel loses;
  absorbing it wins. Partially supported by FUNC G.3 and B.2 already.
- **Data completeness score per project**, visible on the officer's dashboard and rolled up
  to their supervisor. Makes the gap visible without a meeting.
- **A single "what do I owe this week" queue** — the officer dashboard in §10 is close to
  this; make it the landing page rather than a dashboard among several.
- **Interview the Week-4 UAT pilot users in Week 1.** They are already named as a
  dependency in the Build Plan. Meeting them at UAT is too late to change anything.

### D.3 Site connectivity and mobile capture

Hydropower sites are remote and often have poor connectivity. TECH B.2 (ER) already
requires responsive mobile support. If site visits are a real evidence source, consider
whether a site-visit report with photo capture needs to work offline and sync later. This
is a genuine design input in Nepal that a generic feature list would miss — but confirm
whether SBL officers actually do site visits before building for it.

### D.4 Bilingual UI vs Nepali data — decide explicitly

The proposal's §11 lists *"Nepali and English language support."* The RFP requires
considerably less: **TECH B.7 (ER)** asks that the solution *handle Nepali Unicode text
effectively for processing and reporting*, and **FUNC F.1 (CR)** requires reports in both
calendars. Neither requires a translated user interface.

A fully bilingual UI is a substantial ongoing cost — every string, every validation message,
every report template, maintained in two languages forever. Storing and rendering Nepali
data correctly is much cheaper and is what the RFP actually asks for.

**Recommendation:** Nepali **data** support in Phase 1 (names, addresses, documents, dual
calendar). Bilingual **UI** only if SBL explicitly asks and accepts the cost. Confirm with
the pilot users — my expectation is that Credit officers work in English and want Nepali
for names, printed reports and regulatory output, but ask rather than assume.

### D.5 MFA belongs to Active Directory, not to HPMS

The security list includes MFA, session timeout, and device restrictions. Implement these
by **delegating to SBL's identity platform**, not by building them in HPMS. An application
that maintains its own second factor is a liability — it fragments the bank's access-control
story and gives InfoSec a separate thing to audit. This also depends on the answer
to research item §3.3 (whether SBL is on on-prem AD, ADFS, or Entra ID).

### D.6 Legal hold is a good addition — adopt it

Not in the RFP, and worth having. The retention/archive logic in Instruction 4 already
exists; a `legal_hold` flag that suppresses archival for a project under dispute or
investigation is nearly free to add now and awkward to retrofit later.

---

## E. On the research basis

The sources cited (a commercial covenant-monitoring product, a project-finance analytics
product, the World Bank sector assessment) are a reasonable **feature benchmark**, and the
World Bank citation genuinely supports the portfolio-concentration argument.

But note what they are not: three of the four are vendor marketing pages. They establish
what monitoring products generally do; they carry no authority on Nepali regulatory
practice.

**The Tier 1 regulatory questions from the research brief still appear unresolved** —
nothing in this positioning document resolves NRB audit-log retention, data residency, loan
classification during moratorium and on RCOD revision, the authoritative Bikram Sambat
range, or actual NEA PPA tariff mechanics. Those remain the items where the build is
currently running on assumption, and §A/§B above add one more: the RCOD-triggered
reclassification question in §1.3 of the brief is now *more* important, because this
positioning makes COD/RCOD a central feature rather than a date field.

---

## F. Summary — what I'd change, in priority order

| # | Change | Why | Cost |
|---|---|---|---|
| 1 | Reword positioning to keep pipeline visibility, exclude credit origination | 3 CRs + stated RFP objective | None — wording |
| 2 | Decide who enters progress (recommend: bank-entered, IE-verified) | Blocks Instruction 6; external portal contradicts current architecture | Decision only |
| 3 | Adopt effective-dating for shares, rates, COD, capacity, risk rating | Covenant testing needs point-in-time truth | ~1 day, now |
| 4 | Adopt the proposed COD/RCOD model over the Phase 1 single field | Materially better; RCOD is a central risk | ~half day |
| 5 | Add `data_provenance` to financial and progress fields | Reconciliation safety + auditability | ~half day |
| 6 | Extend audit to reads and exports at API layer | Required by the accountability positioning | ~1 day |
| 7 | Reference KYC by CBS customer ID; do not copy it | Avoids an AML-regulated duplicate | None — avoids work |
| 8 | Ladder the covenant engine: reported → computed → forecast | LLCR/CFADS need a cash flow model | Avoids overcommitment |
| 9 | Add ESG & Social module (E.17, E.18, E.25, F.14) | Missing CR + 3 ERs | ~1 day schema |
| 10 | Treat PowerBI (F.11) as a named workstream | CR, currently invisible | Planning |
| 11 | Label exposure views "hydropower portfolio," not group exposure | Compliance-reporting risk | None — wording |
| 12 | State the read-only Finacle boundary in the product definition | Prevents scope drift into transactional | None — wording |
| 13 | Confirm collateral's current home before building a register | Possible duplication | Investigation |
| 14 | Decide bilingual UI explicitly (recommend: Nepali data only) | Large ongoing cost, not required by RFP | Decision only |
| 15 | Add `legal_hold`; delegate MFA to AD | Cheap now, awkward later | ~1 hour |

Items 1, 2, 11, 12 and 14 are decisions and cost nothing but a conversation. Items 3, 4, 5
and 6 are the schema changes worth making **before** Phase 1 generates tables, because all
four are significantly more expensive once data exists.
