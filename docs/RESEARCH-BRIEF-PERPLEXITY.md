# SBL HPMS — Research Brief for Perplexity
## South Asian / Nepali banking context needed to de-risk the build

Every query below is tied to a **specific open decision** in the HPMS build. Queries are
written to be pasted into Perplexity as-is. Prefer **Perplexity Pro / Deep Research** mode
for Tier 1 — these need sourced documents, not summaries.

**Read §6 first if you're short on time** — it lists the questions Perplexity will answer
badly, so you don't waste cycles on them.

---

## Tier 1 — Blocking. These are decisions we have already had to guess at.

### 1.1 Audit log retention (closes the gap flagged in Instruction 4)

We shipped `AUDIT_RETENTION_YEARS` with a 7-year default and an explicit note that **no
foundation document states an NRB-mandated figure**. This is the single most important
thing to resolve, because it is a compliance assertion in the bid/handover.

```
What record retention periods does Nepal Rastra Bank (NRB) mandate for commercial banks'
electronic audit trails, transaction logs, and system access logs? Cite the specific NRB
Unified Directive number, circular, or IT Guideline section and its year. Also state the
retention period required by Nepal's Banks and Financial Institutions Act (BAFIA) 2073 for
banking records generally. Distinguish between (a) core transaction records, (b) system
and security audit logs, and (c) customer due diligence / AML records under the Asset
(Money) Laundering Prevention Act.
```

```
What do NRB's Information Technology Guidelines require Nepali commercial banks to log and
retain regarding user activity, privileged access, and changes to financial data? Quote the
relevant clauses and give the guideline's official title, version and issue date. Has it
been revised since 2020?
```

### 1.2 Data residency and on-premise obligation

The Blueprint assumes on-premise DC/DR inside Nepal. Confirm this is a *legal requirement*
and not just an SBL preference — it changes what you can ever say about cloud.

```
Does Nepal Rastra Bank require commercial banks to host core banking and customer data
physically within Nepal? Cite the specific directive, circular or IT guideline clause.
What is NRB's current position on cloud hosting and cross-border data transfer for banks,
and has it changed recently? Also summarise the data localisation provisions of Nepal's
Individual Privacy Act 2075 (2018) as they apply to financial institutions.
```

### 1.3 NRB requirements that shape the schema directly

```
What does Nepal Rastra Bank's Unified Directives require regarding (a) single borrower and
single obligor exposure limits, (b) sector-wise exposure limits for energy and hydropower
lending, and (c) any mandatory minimum lending to the energy sector? Give the directive
number, the current percentage thresholds, and the year of the latest revision. Note any
hydropower-specific concession or relaxation NRB has issued.
```

```
How does Nepal Rastra Bank's Unified Directive on loan classification and provisioning
treat project finance loans that are still in their construction or moratorium period?
Specifically: how are Pass / Watchlist / Substandard / Doubtful / Bad categories applied
before commercial operation date, how is interest during construction (IDC) treated, and
what happens to classification when a project's Commercial Operation Date is revised
(RCOD)? Cite directive numbers and current provisioning percentages.
```

*Why it matters:* determines whether `loan_accounts` needs a classification enum and a
provisioning field, and whether `RCOD` revision must trigger a reclassification event in
the audit trail. Neither is in Phase 1 today.

### 1.4 Bikram Sambat conversion — authoritative range

Instruction 2 requires the converter to declare a supported range and raise outside it. We
need the real bounds, not a library's convenience range.

```
What is the authoritative source for Bikram Sambat (Nepali calendar) month lengths used for
official government and Nepal Rastra Bank reporting? Which B.S. year range has officially
published, verified month-length data versus extrapolated data? Identify the Nepali
government body that publishes the official Nepali calendar (panchanga) and whether NRB
mandates a specific conversion reference for regulatory returns.
```

```
Compare the accuracy and maintenance status of open-source Bikram Sambat to Gregorian date
conversion libraries for Python and JavaScript (e.g. nepali-datetime, nepali_datetime,
NepaliDate, bikram-sambat-js). Which are used in production by Nepali financial
institutions or government systems? Note their supported B.S. year ranges and any known
discrepancies between them.
```

---

## Tier 2 — Shapes the data model. Needed before Week 3 (PPA / domain engine).

### 2.1 NEA Power Purchase Agreement structure — the real one

The Blueprint's "PPA Tariff Engine: seasonal reconciliation of Dry vs Wet" needs actual
contract mechanics or the model will be wrong.

```
Explain the standard Power Purchase Agreement (PPA) structure that Nepal Electricity
Authority (NEA) signs with independent power producers for run-of-river hydropower. Cover:
the dry season and wet season definitions by Nepali month, the current per-unit tariff
rates for each season, the annual escalation rate and how many years it applies, the
take-or-pay versus take-and-pay provisions, contract energy obligations, and penalty
clauses for generation shortfall. Cite NEA's published PPA rates and the year they were set.
```

```
How do Nepal Electricity Authority PPAs handle a delay in Commercial Operation Date (COD)?
What is the process and consequence of obtaining a Revised COD (RCOD), what penalties or
tariff reductions apply, and how long can RCOD be extended? Cite NEA policy documents or
Department of Electricity Development regulations.
```

*Why it matters:* determines whether `ppa_tariffs` needs an escalation schedule table, a
contract-energy column, and a penalty formula — and whether RCOD is a simple date field or
a versioned record with approval history.

### 2.2 Hydropower licensing lifecycle in Nepal

```
Describe the full regulatory licensing lifecycle for a hydropower project in Nepal, from
survey licence to generation licence. For each stage give: the issuing authority
(Department of Electricity Development, Ministry of Energy, etc.), the licence validity
period, renewal terms, and the typical documents produced. Include where Initial
Environmental Examination (IEE) versus Environmental Impact Assessment (EIA) is required
and the MW thresholds that determine which applies.
```

*Why it matters:* validates the `water_licenses` and pipeline-status design, and tells us
whether `project_stage` needs more granularity than FEASIBILITY / CONSTRUCTION / OPERATION.

### 2.3 Consortium and syndication practice

```
How is consortium and syndicated lending structured among commercial banks in Nepal? What
are the Nepal Bankers' Association or Nepal Rastra Bank rules governing consortium
financing — lead bank responsibilities, minimum and maximum participant shares, pro-rata
drawdown obligations, security sharing agreements, and what happens when a participant bank
fails to fund its share? Cite the governing directive or NBA guideline and its date.
```

*Why it matters:* Instruction 5 assumes exactly one lead bank and shares summing to 100%.
Confirm that's the legal structure, and find out whether sub-participation or share
transfer between banks mid-facility is permitted — if so, `consortium_members` needs
effective-dating rather than a single mutable `share_pct`.

### 2.4 Covenant and DSCR conventions

```
What are the standard financial covenants used by Nepali commercial banks in hydropower
project finance? Specifically: how is Debt Service Coverage Ratio (DSCR) defined and
calculated in Nepali project finance practice, what minimum DSCR is typically required,
what debt-to-equity ratio is standard for hydropower in Nepal, and what is the typical
moratorium and repayment tenor structure? Cite industry sources, IPPAN publications or
published loan documentation.
```

### 2.5 CO₂ avoidance factor (FUNC F.14)

```
What is the official grid emission factor for Nepal's electricity grid used in carbon
accounting, expressed in tonnes CO2 per MWh? Which body publishes it, what is the current
value, and what methodology is used — UNFCCC CDM combined margin, IFI default, or national?
How do the Integrated Nepal Power System's hydropower-dominated generation mix and India
electricity imports affect the factor?
```

*Why it matters:* F.14 asks for "estimated CO₂ emission avoidance based on generation
capacity." Using a wrong or invented factor in an ESG report is a reputational risk. This
needs a citable published number, not a plausible one.

---

## Tier 3 — Integration and platform. Needed before Week 2 (Finacle adapter).

### 3.1 Finacle integration patterns

```
What integration interfaces does Infosys Finacle Core Banking expose for third-party
applications to query loan account data? Compare Finacle Integrator (FI), Finacle Connect,
the Finacle API gateway / developer portal REST APIs, and direct database views. For each:
the protocol (REST, SOAP, ISO 8583, MQ), typical authentication method, whether it supports
read-only access scoping, and which Finacle versions support it. Note differences between
Finacle 10.x and 11.x.
```

```
What are the common architectural patterns and pitfalls when building a read-only
satellite application that synchronises loan and disbursement data from Infosys Finacle in
a South Asian commercial bank? Cover end-of-day batch extraction versus real-time API
inquiry, reconciliation strategies, handling of Finacle's end-of-day batch window, and how
banks typically avoid impacting core banking performance.
```

*Why it matters:* Instruction 3's `cbs_sync_log` assumes `REALTIME_INQUIRY` and
`EOD_BATCH` / `BOD_BATCH` modes. Confirm those are the real available modes, and find out
whether the EOD window forbids querying during a specific period — that changes scheduler
design.

### 3.2 Digital signature — the Nepal-specific piece

TECH B.3 names "digital signature certificate system" alongside AD and O365. Nepal has its
own PKI regime; this is not a generic e-signature integration.

```
How does digital signature certification work in Nepal? Describe the role of the Office of
the Controller of Certification (OCC), the licensed Certifying Authorities, the legal
standing of digital signatures under Nepal's Electronic Transactions Act 2063, and what
technical integration a banking application needs to verify a Nepali digital signature
certificate. Are Nepali banks currently using digital signatures for internal credit
approval workflows?
```

### 3.3 Active Directory in Nepali banks

```
What are the common identity and access management architectures in Nepali and South Asian
commercial banks? Specifically, how do banks typically integrate internal applications with
Microsoft Active Directory — LDAP bind, Kerberos, SAML via ADFS, or Azure AD / Entra ID —
and what does Nepal Rastra Bank's IT guidance require regarding privileged access
management, password policy and session controls for banking applications?
```

*Why it matters:* Instruction 1 builds an `ActiveDirectoryAuthProvider` stub assuming
LDAP/LDAPS bind. If SBL is on ADFS/SAML or Entra ID, the contract is different and the stub
should be written against that instead.

### 3.4 Nepali Unicode handling

```
What are the correct technical practices for storing, sorting and searching Nepali
(Devanagari) text in PostgreSQL? Cover: ICU collation for the ne-NP locale, Unicode
normalisation (NFC vs NFD) issues with Devanagari conjuncts and matras, full-text search
configuration, and common pitfalls when the same Nepali name can be typed multiple ways.
Include practical examples from production systems.
```

*Why it matters:* Instruction 2 specifies "UTF-8 collation plus an unaccent index" for
`name_np`. `unaccent` is designed for Latin diacritics and may be the wrong tool for
Devanagari — this query is specifically to check whether I gave you the right mechanism.

---

## Tier 4 — Positioning and prior art. Lower urgency, high strategic value.

```
What software systems do banks in Nepal, India, Bhutan and Sri Lanka use to manage
hydropower and renewable energy project finance portfolios? Identify named products,
in-house systems, or vendors. Specifically: what does India's Power Finance Corporation
(PFC), REC Limited, IREDA, or SBI's project finance division use for construction
milestone and covenant monitoring, and are any of these documented publicly?
```

```
Which vendors have implemented project management, loan monitoring or credit workflow
systems for commercial banks in Nepal? Name the banks, the systems, and the implementation
years. Include any publicly reported Nepal Rastra Bank technology mandates that drove those
implementations.
```

```
What are the documented failure modes and lessons learned from core-banking-adjacent
satellite system implementations in South Asian banks? Focus on data reconciliation drift
between the satellite system and the core, user adoption failure where staff continued
using Excel, and audit findings against such systems.
```

*Why it matters:* the RFP's own Project Background says SBL's current process is "manual
data entry in Excel." The third query is the honest one — the main risk to HPMS is not
technical, it's that the Credit department keeps using Excel. Prior art on that is worth
more than another architecture diagram.

---

## Tier 5 — Sharpening queries for better Perplexity results

A few things that materially improve output quality on this subject matter:

- **Always ask for the document name, number and year.** NRB directives get renumbered in
  the annual Unified Directives consolidation. "Cite the directive number and its latest
  revision year" turns a vague answer into a checkable one.
- **Ask for the Nepali-language source too.** Many NRB circulars exist only in Nepali.
  Append: *"If the primary source is in Nepali, give the Nepali title and a direct link
  to the NRB website PDF."*
- **Force a currency and date on every number.** Append: *"State all amounts in NPR and
  give the effective date of each figure."* Tariff and threshold figures go stale fast.
- **Ask it to flag uncertainty explicitly.** Append: *"Where you cannot find a primary
  source, say so explicitly rather than inferring from secondary commentary."* This matters
  a great deal here — a confident wrong answer about NRB retention periods is worse than
  no answer.
- **Run the Tier 1 queries twice, worded differently.** If the two runs disagree on a
  number, treat it as unresolved and escalate to §6.

---

## §6 — What Perplexity will *not* answer well

Be realistic about this. Do not burn Tier 1 time on these — route them to a human instead.

| Question | Why Perplexity fails | Who actually has the answer |
|---|---|---|
| SBL's specific Finacle version, modules and available APIs | Not public | **SBL CBS team** — the Build Plan already lists this as a Week-2 prerequisite. Ask now. |
| Whether SBL AD is on-prem AD, ADFS or Entra ID | Not public | SBL InfoSec / infrastructure team |
| SBL's internal audit log retention *policy* (as distinct from the NRB floor) | Internal document | SBL Compliance — this is the sign-off flagged in Instruction 4 |
| Exact NRB Unified Directive text | Often Nepali-only PDFs, poorly indexed, and Perplexity will paraphrase secondary blog commentary as if it were the directive | Download the current **NRB Unified Directives** PDF directly from nrb.org.np and read the clause. Treat Perplexity output here as a pointer to *which* directive, never as the text of it. |
| Current NEA PPA tariff rates | Published but frequently restated by news sites with stale figures | NEA's own published PPA rate schedule, or IPPAN |
| Which SBL staff use Excel today and how | Internal | Pilot users from Hydro Credit — the Build Plan Week 4 UAT group. Interview them in Week 1, not Week 4. |

**The single highest-value non-Perplexity action:** the Build Plan names *CBS team API
access* as a prerequisite and Week 4 UAT users as a stakeholder dependency. Both requests
should go out this week regardless of what the research returns.

---

## Suggested order of execution

1. **Today** — fire the two §1.1 retention queries and §1.2 data residency. These close the
   one gap where the current pack ships an assumption.
2. **Today, in parallel, non-Perplexity** — email SBL CBS team for Finacle version and API
   access; email InfoSec for AD architecture. Longest lead times.
3. **This week** — Tier 1 remainder (§1.3, §1.4) and §3.1 Finacle patterns.
4. **Before Week 2** — §3.2, §3.3, §3.4.
5. **Before Week 3** — all of Tier 2. The PPA queries in §2.1 are the ones most likely to
   change the schema, so don't leave them to Week 3 itself.
6. **Opportunistic** — Tier 4.

Anything Tier 1 returns that contradicts the current pack should be logged as an amendment
in `PHASE-1-INTEGRATION-NOTES.md` rather than silently patched into the instructions, so
the reasoning stays traceable for audit.
