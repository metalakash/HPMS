# HPMS — NRB and Nepal Data-Privacy Compliance Mapping (RFP D.4)

Date: 2026-10-02 · Status: **working draft for SBL Compliance / Legal review**

## Read this first

- This maps what HPMS **does** against the **themes** that NRB directives and Nepali law are expected to
  impose on a bank's information system. It is not legal advice and not a compliance certificate.
- **The requirement texts have not been verified.** The instruments below are the ones named in the project's
  own research brief ([RESEARCH-BRIEF-PERPLEXITY.md](RESEARCH-BRIEF-PERPLEXITY.md)): NRB Unified Directives,
  NRB Information Technology Guidelines, the Banks and Financial Institutions Act 2073 (BAFIA), the Individual
  Privacy Act 2075 (2018), and the Electronic Transactions Act 2063. No clause numbers, retention periods or
  thresholds are quoted here because none has been confirmed against the primary text (the brief's own advice:
  read the directive PDFs on nrb.org.np rather than trusting summaries). Column "Requirement to confirm" says
  where each answer must come from.
- Sign-off on compliance belongs to SBL Compliance and Legal, not to the development team.

Legend: ✅ implemented · 🟡 partial · ❌ not implemented · ❓ requirement unconfirmed

## 1. Control mapping

| # | Theme | HPMS implementation | Status | Gap / action | Requirement to confirm |
|---|---|---|---|---|---|
| 1 | Audit trail of user activity and changes to financial data | Maker-checker actions and project create / update write a hash-chained `audit_logs` row (who, role, source IP, entity, action, mandatory reason, before/after state). A database trigger forbids update, delete and truncate. `GET /admin/audit/verify` checks the chain. Report exports are written to `audit_log_reads` | 🟡 | General read access is not audited (middleware is a stub). Other write paths (loan exposure ingest, report definitions, regulatory filings, reminders, contacts, schedules) do not write to `audit_logs`; they only record `created_by` / `updated_by`. Legacy rows have blank hashes | IT Guidelines: what must be logged (brief §1.1) |
| 2 | Audit-log retention period | `AUDIT_RETENTION_YEARS` (default 7), preview and manual purge that keeps the chain verifiable | ❓ | The 7 years is an unconfirmed placeholder. Do not state it to a regulator until confirmed | Unified Directives / IT Guidelines / BAFIA (brief §1.1) |
| 3 | Segregation of duties (maker-checker) | Makers propose, approvers recommend and approve; nobody approves their own work; two steps need two people; mandatory justification | ✅ (service) | Approval does not yet apply the change; the approval-queue page is not linked in the UI; approvals are not tied to a configurable workflow | Internal credit policy |
| 4 | Role-based and least-privilege access | Five roles mapped from AD groups; project-level row security (invisible = 404); field-level write policy; IP allow-list for admin and service endpoints | 🟡 | Row security is in application code only (no database policies); auditors can create saved report definitions (private config); IP allow-list is off until configured | IT Guidelines access control |
| 5 | Strong authentication | AD/LDAP integration; JWT sessions (8 h); TOTP, SMS, backup codes, trusted devices | 🟡 | Hosted demo uses built-in accounts with published passwords (`USE_LDAP=false`). TOTP secrets and backup codes are stored unhashed/unencrypted in `user_mfa` / `backup_code`. No UI for MFA enrolment. Login lockout not verified | IT Guidelines authentication |
| 6 | Protection of data in transit | HTTPS assumed at the host; HSTS, CSP, nosniff, frame-deny, no-store headers | ✅ | CBS mTLS not evidenced | IT Guidelines |
| 7 | Protection of data at rest | Storage encryption is an infrastructure responsibility | ❌ (app layer) | `finacle_account_id` and MFA secrets are plain text columns although comments describe encryption; no pgcrypto; backups not covered here | IT Guidelines |
| 8 | Data residency / localisation | Currently hosted on Render (backend) and Vercel (frontend), i.e. **outside SBL's premises and probably outside Nepal** | ❓ ⚠️ | **Do not load real customer or loan data into the hosted environment until residency is confirmed.** The on-premise DC/DR in the RFP is an infrastructure workstream | Unified Directives / IT Guidelines / Individual Privacy Act (brief §1.2) |
| 9 | Business continuity, backup, DR | Runbook and health checks; DC/DR is infrastructure | ❌ (app layer) | RFP G.1 DC/DR in different seismic zones: not in this repository | IT Guidelines |
| 10 | Vulnerability and change management | Dependency scan and OWASP self-assessment ([SECURITY-HARDENING.md](SECURITY-HARDENING.md)); test suite; migrations under version control | 🟡 | No independent VAPT (RFP A.2); dependencies not pinned | IT Guidelines; SBL ISG |
| 11 | Regulatory filing deadlines | Filing calendar on the Nepali fiscal year with due dates in AD/BS, reminders, overdue tracking and alerts, stakeholder routing | 🟡 | Ships empty: the list of NRB / Ministry / NEA filings, frequencies and lags must be entered by Compliance. HPMS tracks deadlines; it does not generate the returns in NRB formats | NRB reporting calendar; Ministry; NEA |
| 12 | Credit-risk limits and classification | Covenant monitoring (DSCR, LTV, ICR), alerts, covenant history | ❌ for limits | No single-obligor / sector exposure limits, loan classification (pass … bad), provisioning, or RCOD-triggered reclassification (brief §1.3) | Unified Directives |
| 13 | Calendar and date handling | AD and BS stored and printed side by side using the official month-length tables (BS 1975–2100) | ✅ | Reports for NRB must use the conversion NRB specifies, to be confirmed | Brief §1.4 |
| 14 | Digital signatures | Not implemented | ❌ | RFP B.3 names a digital-signature certificate system (Nepal PKI under the Electronic Transactions Act) | Electronic Transactions Act 2063; OCC |
| 15 | Incident response | Runbook severity levels and procedures | 🟡 | Breach-notification duties (privacy law / NRB) are not yet written into it | Individual Privacy Act; NRB |

## 2. Personal data inventory

HPMS is a corporate project-finance system, so most records describe companies and projects. The tables below
hold information about identifiable individuals ([data dictionary](DATA-DICTIONARY.md)).

| Data subject | Table (columns) | Source | Who can read | Notes |
|---|---|---|---|---|
| Bank staff (users) | `user` (username, email, full name, AD distinguished name, last login, role, language) | Active Directory | admin; the user themselves via `/auth/me` | |
| Bank staff, authentication | `user_mfa` (TOTP secret, phone, lock state), `backup_code`, `sms_verification` (phone, code), `trusted_device` (device fingerprint, browser, OS, last IP) | user enrolment | application only | **Secrets stored unprotected** (control 5) |
| Bank staff, activity | `audit_logs` (user id, role, source IP, session id), `audit_log_reads`, `approval_steps` | system | admin, auditor | Retention per control 2 |
| Alert recipients | `stakeholder_contacts` (name, organisation, role, email, phone) | entered by admins | admin, auditor | Includes external parties |
| Staff reminders | `user_reminders` (owner, text, date) | the user | the owner only | Free text may contain anything |
| Company officers and shareholders | `board_of_directors` (director name, title, appointment dates), `shareholding_hierarchy` | project sponsors / registrars | users who can see the project | Names of natural persons |
| Land owners and communities | `land_records` (plot, ownership status, compensation), `community_engagements` (stakeholder group, summary, resolution), `land_acquisition_tracking` | field and legal teams | users who can see the project | No personal identifiers are modelled; free-text fields may contain names |
| Report recipients | `export_job.recipients` (email addresses) | admins | admin, auditor | |

Not present: customer KYC, citizenship numbers, tax IDs, biometric data.

## 3. Privacy-law readiness (Individual Privacy Act 2075 — themes to confirm)

| Theme | Status | Notes |
|---|---|---|
| Lawful purpose and minimisation | 🟡 | Only business-necessary personal data is modelled (§2); free-text fields are an exception |
| Access limitation | ✅ | Role and project-level access (control 4); personal data is not exposed outside it |
| Accuracy and correction | ❌ | No self-service or workflow to correct a person's data; admins would edit through the database or API |
| Retention and deletion | ❌ | Retention exists for the audit log only. No deletion or anonymisation process for users who leave, contacts removed, or expired reminders |
| Data-subject requests (access, objection) | ❌ | No process or tooling |
| Consent records | ❌ | None; to be decided whether consent or another legal basis applies to staff and contact data |
| Cross-border transfer | ❓ ⚠️ | Hosted outside SBL premises (control 8) |
| Breach notification | ❌ | No procedure written (control 15) |
| Security safeguards | 🟡 | Controls 1, 4–7, 10 |

## 4. Actions for SBL Compliance / Legal

1. Obtain the primary texts and fill the "Requirement to confirm" column; confirm the **audit-log retention
   period** and set `AUDIT_RETENTION_YEARS`.
2. Decide whether production data may be hosted outside Nepal; until then keep the hosted environment on
   synthetic or public data only.
3. Supply the NRB / Ministry / NEA filing list (code, authority, frequency, days after period end) so the calendar
   can be seeded.
4. Decide the personal-data retention, correction and breach-notification procedures (§3), and whether
   individuals' data in free-text fields needs handling rules.
5. Commission the independent VAPT (RFP A.2) and decide on database-level encryption and row security.

## 5. Actions for the HPMS team

1. Disable the built-in accounts outside development; hash or encrypt MFA secrets and backup codes; encrypt or
   tokenise `finacle_account_id`.
2. Chain the remaining write paths (loan ingest, regulatory filings, schedules, contacts) into the audit log and implement read-audit middleware.
3. Build the retention / anonymisation job for personal data once the policy exists.
4. Add single-obligor / sector limits, classification and provisioning after the directive texts are confirmed.
