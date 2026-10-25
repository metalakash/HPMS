# HPMS System Study and Parameterisation

RFP TECH D.12. How the Hydropower Project Management Solution is put together, how it is configured, and
who may change what. Every configurable value, its default and who may change it is listed in
[`PARAMETER-REFERENCE.md`](PARAMETER-REFERENCE.md), which is generated from the code and checked by a test, so
it cannot drift from what the system actually reads. The data model is in
[`DATA-DICTIONARY.md`](DATA-DICTIONARY.md), generated the same way.

Status of this document: written 2026-10-19 against the development build. Where something depends on the
bank (directory, core banking extract, hosting), it says so.

## 1. Purpose and scope

HPMS supports the bank's hydropower lending from sanction to repayment: the project register and its
technical, operational, environmental and legal records; the loans, their drawdown and repayment; covenant
testing on Nepali fiscal quarters; budgets against cost; regulatory filings; documents; and the reports and
dashboards built on them. Every change to critical data passes through maker-checker and is written to a
tamper-evident audit log.

Out of scope of the software, by design: infrastructure the bank provides (servers, replication, backup
storage, DR site), bid-response documents, and vendor support obligations (see the RFP status report).

## 2. Users and roles

| Role | Typical user | Can |
|---|---|---|
| Admin | Credit administration lead | Everything below, plus users, settings, approval rules, demo reset (demo only) |
| Maker | Relationship officer | Propose changes on the projects they own; file documents; record stakeholder interactions |
| Approver | Credit or risk checker | Recommend and approve change requests (as the approval rule allows) |
| Auditor | Internal audit | Read everything, including the audit log and its integrity check; change nothing |
| Guest | Observer | See the screens that are open to them, with confidential figures withheld |

Roles come from the bank's directory at sign-in: `AD_GROUP_ROLE_MAP` names which of the bank's groups gives
which role (`USE_LDAP=true`). An admin can set a
role in HPMS that overrides the directory's until cleared (Admin page; audited). An admin can block an
account: its open sessions end at once. Users in the roles named in `MFA_REQUIRED_ROLES` are told at sign-in
that they must enrol in MFA; blocking them until they do is planned (Phase 15, sprint 3).

## 3. Functional modules

| Module | Screens | Main records |
|---|---|---|
| Projects | Projects, project page with tabs | Project, technical specs, licences, milestones, land, hydrology, generation and PPA, ESG, insurance, ESIA, community, risk register, documents, budget |
| Lending | Loan accounts, Loan projection, Energy financing | Loan accounts, tranches, repayments, rate history, quarterly projection, energy-financing share |
| Compliance | Compliance, Regulatory | Covenant terms, quarterly financial periods, covenant history, filing calendar, reminders, stakeholder contacts and their history |
| Control | Approvals, Admin, Settings, Security | Change requests and steps, users, settings, approval rules, exchange rates, MFA |
| Reporting | Dashboard, Analytics, Maintenance, Reports | Report definitions and schedules; sources: portfolio, loans, capex budget against actual, covenant shortfall, consolidated |

## 4. Key workflows

### 4.1 Maker-checker

1. A maker (or admin) proposes a change with a justification of at least 20 characters. The request records
   the values it would replace. Nothing changes yet.
2. Checkers decide under the request's **approval rule**: one approval, or a recommendation then a final
   approval by someone else. The rule names which roles may give each check. A request keeps the rule that
   was in force when it was raised.
3. On final approval the change is applied in the same transaction, and both the decision and the change are
   written to the audit log.

Change types and who proposes them: project details, loan terms, quarterly covenant figures, sanction terms,
budget and cost lines, loan projection, application settings, approval rules, exchange rates. Field-level
write rules decide which fields each role may name (for example, balances owned by the core banking system
may never be proposed). See sections 2 to 4 of the parameter reference.

### 4.2 Covenant testing

Each facility is tested on Nepali fiscal quarters (`2082-83-Q4`) against its sanction terms, or against the
default thresholds (an admin setting) when it has none. DSCR, ICR and LTV are calculated from the quarter's
reported figures and the loan's own schedule; a ratio within the warning margin of its threshold is a
warning. Approving new figures or new terms re-tests the project; changing the default thresholds re-tests
every facility that uses them.

### 4.3 Budget and cost, projection

Budget lines (cost head, budget, actual) change by change request, by hand or from an uploaded Excel or CSV
sheet whose rows are checked first. Variance is calculated, never entered. The loan projection's planned
disbursement and repayment change by quarter; outstanding is carried down the whole plan.

### 4.4 Documents

Filed against a project with a type and date; every upload is a new version and earlier versions stay
downloadable. Files are encrypted at rest and checked against their SHA-256 on every download; a file
altered in storage is refused. Archiving hides a document but never deletes it.

### 4.5 Alerts and reminders

A daily scan raises alerts for permits, licences, PPAs and insurance approaching expiry (lead times are admin
settings), slipped milestones and open filings, and emails internal staff and the stakeholder contacts who
asked for that type and urgency.

## 5. Integrations

| System | How | Status |
|---|---|---|
| Core banking (Finacle) | End-of-day extract read from a directory, or an HTTP inquiry API; field positions in a per-bank mapping file; extract checker script; nightly schedule | Built; waiting for the bank's sample extract |
| Active Directory | LDAP bind, group-to-role mapping | Built and unit tested; not yet tested against the bank's directory |
| Email | SMTP for alerts, reminders and scheduled reports | Built |
| Power BI | Report data as CSV/Excel; integration guide | Guide only |

## 6. Security

- **Sign-in:** directory credentials, TOTP MFA (prompted by role, not yet enforced), 8-hour tokens
  (`JWT_EXPIRY_MINUTES`). Blocked
  accounts lose open sessions at once.
- **Network:** IP allow-list for admin and configuration routes (`ADMIN_IP_ALLOWLIST`; off until set).
- **Access to projects:** checked by the application on every request (makers see projects they own; admins
  and auditors all). With `DB_ROW_SECURITY=true`, PostgreSQL row policies enforce the same rule underneath,
  so a query that skips the application's checks still cannot reach another borrower's rows. This needs the
  application to connect as a non-superuser.
- **Field-level read rights:** confidential figures (limits, balances, rates, covenant ratios, the borrower's
  financials, budgets) are withheld from roles without the right in every JSON response.
- **Audit:** every change and decision is in a hash-chained log that cannot be edited (database trigger);
  its integrity is verified from the Admin page. Retention is a setting (`AUDIT_RETENTION_YEARS`); purging is
  off unless enabled.
- **Encryption at rest:** MFA secrets and document files, with keys derived from `MFA_ENCRYPTION_KEY`
  (falling back to `SECRET_KEY`). Database and disk encryption are the bank's infrastructure.

Independent penetration testing is not yet done (RFP TECH A.2).

## 7. Deployment and operations

- **Components:** FastAPI application (one or more processes behind a load balancer), PostgreSQL, an optional
  Redis for live notifications, and the React web application served as static files.
- **Background jobs in the application process:** daily alert scan, scheduled report delivery, and the loan
  exposure sync schedule.
- **Schema:** Alembic migrations run before the application starts; a failed migration stops the deploy.
  `GET /ready` reports the database's schema revision against the one the code expects.
- **Demo:** the public demo (Render and Vercel) runs on synthetic data with published demo passwords
  (`ALLOW_DEV_AUTH`); an admin can reset it to the demo portfolio (`DEMO_RESET_ENABLED`). Neither setting
  may be on where bank data is held, and the reset refuses a database that holds bank data.
- **Load:** first measured on a development laptop (25 users: 144 ms median, 691 ms p95). The production-like
  test waits for the proof-of-concept hosting and a target from the bank.

## 8. Parameterisation

Values the bank sets fall into four places, each listed in full in the parameter reference:

1. **In the application, by administrators, through maker-checker:** alert lead times, default covenant
   thresholds and warning margin, approval rules per change type, exchange rates. Per-facility sanction
   terms are in the same category.
2. **Per bank, in files:** the core banking mapping file (field positions in the bank's extract).
3. **On the server:** database, keys, directory, core banking connection, document storage, network
   allow-list, MFA roles, retention, demo switches.
4. **In code, reviewed with the bank:** field-level write and read rights, covenant formulas.

The reference also lists settings that are defined but read by nothing (section 6), so that nobody sets a
value expecting an effect it does not have; they should be removed or wired up.

## 9. Known limits

- Covenant ratios assume the facility's figures are in NPR; a facility in another currency shows its NPR
  equivalent on screen and in reports, but its covenants are not converted yet.
- Project search does not yet use the Nepali text matching built for it (`i18n/search_text.py`); it is
  connected once the project-origination work in progress is committed.
- The items waiting on the bank are listed in the RFP status report and the Phase 15 plan.
