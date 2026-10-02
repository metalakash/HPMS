# HPMS User Manual

Audience: SBL credit, project-finance, compliance and audit staff.
RFP: D.12. Companion: [Administrator Manual](ADMIN-MANUAL.md).

> **What this manual covers.** HPMS has a web application and a REST API. The web application currently
> offers the screens described in §3–§5. Several features (reports, saved reports, scheduled delivery,
> regulatory calendar, reminders, approvals) work through the API only; §6–§9 explain how to use them from the
> interactive API page at `/docs` on the HPMS server. Screens for them are planned. Where a screen shows
> **sample data** this manual says so; do not rely on those figures.

## 1. Signing in

1. Open the HPMS address given by your administrator and enter your bank (Active Directory) username and password.
2. If multi-factor authentication is enabled for you, enter the code from your authenticator app. Backup codes
   work once each.
3. **Sign out** with the icon at the top right. Sessions end automatically after 8 hours.

Your **role** decides what you see:

| Role | What you can see and do |
|---|---|
| Maker | Projects you own; propose changes; record regulatory filings |
| Approver | Projects you own or have approvals pending on; recommend, approve or reject proposed changes |
| Auditor | Every project, read-only; portfolio reports |
| Admin | Everything, plus administration |
| Guest | Nothing beyond signing in |

A project you are not allowed to see behaves as if it does not exist ("not found"). That is intentional.

## 2. Finding your way around

- **Left menu**: Dashboard, Projects, Loan accounts, Compliance, Analytics, Maintenance, and Admin (admins only).
- **Top right**: notification bell (live events while connected), the **language** switch (English / नेपाली),
  the **theme** switch (light / dark / system), and sign out.
- **Dates**: dates are stored in both calendars. Hover a commercial-operation date in the project list
  to see its Bikram Sambat (BS) value; reports and exports print both AD and BS.
- **Filters** in the project and loan lists are kept in the page address, so you can bookmark or share a
  filtered view.

## 3. Dashboard

Shows the number of projects and loan accounts, how many projects are in each stage, the most recently added
projects, and a **Live activity** panel. The panel says "Connected" when live updates are on; project, loan and
rate changes appear there as they happen.

## 4. Projects

- **List**: filter by **Stage**, **Pipeline status** and **Province**; click a row to open the project.
- **Project page**: details (capacity, stage, location including local level, document and loan counts),
  **Commercial operation date history**, **Project timeline & milestones**, **Risk register**,
  **Loan accounts** and **Disbursement tranches**.
- The timeline and risk register show what has been entered for the project (milestones with planned,
  forecast and actual dates; risks with likelihood, impact, severity and mitigation status).

## 5. Loan accounts, Compliance, Analytics, Maintenance

- **Loan accounts**: facilities synced from the core banking system; filter by **CBS sync status**
  (pending, success, failed). Account numbers are masked on screen. Until the Finacle connection is live, balances
  come from data loaded by administrators, not directly from Finacle.
- **Compliance**: covenant monitoring (DSCR, LTV, ICR) and alerts; click a project for its eight-quarter trend
  and a covenant's remediation drawer. **This page currently shows sample data.**
- **Analytics**: generation forecasts, anomalies and risk scores. **Sample data.**
- **Maintenance**: schedules and work orders. **Sample data.**

## 6. Proposing and approving changes (maker-checker)

Available through the API (`/docs` → *mutations*).

**Makers**

1. `POST /api/v1/mutations/submit-with-justification` with the entity type (`PROJECT`, `LOAN`, …), its id, the
   action, the proposed `changes`, and a justification of at least 20 characters.
2. You cannot propose changes to fields owned by other systems (for example loan balances from the core banking
   system, calculated DSCR/LTV/ICR); the request is refused with the list of fields. Interest rate, sanctioned and
   disbursed amounts can be proposed by makers and admins only.
3. `GET /mutations/approval-queue` lists your requests and their state.

**Approvers**

1. `GET /mutations/approval-queue` lists requests awaiting you.
2. `POST /mutations/approve` moves a request from *submitted* to *recommended*, then to *approved*. The two steps
   must be done by two different people, and nobody can approve their own request.
3. `POST /mutations/reject` needs remarks of at least 10 characters.

Every step is written to the tamper-evident audit trail. At present an approval records the decision; it does
not automatically change the record itself.

## 7. Reports (API)

Available to Auditors and Admins (`/docs` → *reports*, *report-builder*).

- **Ready-made exports**: `POST /api/v1/reports/export/download` with `report_id` (`portfolio`,
  `covenant_summary`, `capex_progress`), a `format` (`csv`, `excel` or `word`), and optional filters (province,
  district, local level, status, facility type, date range). The file downloads directly. PDF versions of the
  portfolio, covenant and capex reports are at `/api/v1/reports/pdf/portfolio`, `/pdf/covenant`, `/pdf/capex`.
- **Covenant shortfall report**: `report_id = covenant_shortfall` lists loans below the DSCR (1.25) or ICR (2.0)
  floors or above the LTV (70%) ceiling, with the size of each gap. The thresholds are fixed in the system today.
- **Build your own**: `GET /api/v1/reports/sources` lists every source with its columns and filters. Choose
  columns, filters and a sort, preview with `POST /reports/builder/run`, then save with
  `POST /reports/definitions` (private, or shared with colleagues). Run a saved report with
  `POST /reports/definitions/{id}/run?format=word`.
- Every Excel, Word and PDF report prints the date in both AD and BS; the Excel workbook has a "Report info"
  sheet. For PowerBI see [POWERBI-INTEGRATION.md](POWERBI-INTEGRATION.md).
- **Scheduled delivery** is set up by an administrator (see the Administrator Manual §8). Auditors can see the
  schedules and their run history.

## 8. Regulatory calendar and reminders (API)

- **Calendar** (Auditors, Admins): `GET /api/v1/regulatory/calendar` lists due filings. Filter by dates,
  authority (NRB, MOEWRI, NEA, DOED, ERC), status (pending, filed, overdue, waived) or project. Periods follow
  the Nepali fiscal year; each row shows the period end and due date in AD and BS. Project-specific filings are
  also at `/api/v1/projects/{project_id}/filings`.
- **Record a filing** (Makers, Admins): `PATCH /api/v1/regulatory/calendar/{id}` with `status: "filed"`, the
  regulator's `reference_no`, and optionally the filing date (not in the future). Set `status: "pending"` to
  reopen.
- **Your own reminders** (everyone): `POST /api/v1/reminders` with a title, a date (AD; the BS date is filled in),
  and optionally a project and the item it is about (milestone, filing, permit, insurance). You receive an email on
  that date. `GET /reminders` lists yours; nobody else sees them. Changing the date of a reminder that has
  already fired re-arms it.
- The calendar is empty until your compliance team has entered the regulatory requirements (Administrator
  Manual §9).

## 9. Alerts

The system scans every night (02:00 UTC by default) and raises alerts for: PPA, water-licence, permit and
insurance expiry (critical within 30 days, warning within 90), milestone slippage, and regulatory filings that
are due within 30 days or overdue. Critical alerts are emailed as a digest, and individual stakeholders receive
the alerts they were subscribed to. Open alerts for a project are at
`GET /api/v1/compliance/alerts/{project_id}/remediations`.

## 10. Getting help

- Something looks wrong or you cannot see a project you expect: contact your HPMS administrator (it is usually
  project ownership or your AD group).
- "Sample data" notices in §5 are known; they are not a fault.
- Report problems with the exact page, time, and what you clicked; administrators can find the matching log entry.
