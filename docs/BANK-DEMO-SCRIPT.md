# HPMS bank demo script (about 25 minutes)

For presenting HPMS to the bank on the hosted demo. Synthetic data throughout: say so first.

- Web app: https://hpms-web.vercel.app
- API status: https://hpms-api.onrender.com/ready (shows the database schema version)
- Demo accounts (published demo passwords, demo instance only): `admin` / `admin123`, `admin2` / `admin2123`,
  `maker` / `maker123`, `approver` / `approver123`, `auditor` / `auditor123`, `guest` / `guest123`

Story: **the bank's hydropower book, from portfolio to a single quarter's covenant test, with every change made
by one person and approved by another, and every step on a tamper-evident record.**

## Preflight (15 minutes before)

- [ ] Open the API status link: the free hosting tier sleeps, and the first request takes about 30 seconds.
- [ ] Sign in as `admin`. Admin page, **Reset demo data**, confirm. Wait for "50 projects ... documents".
- [ ] Admin page: audit log shows **Intact**.
- [ ] Open four tabs, one per account you will use: `admin`, `maker`, `approver`, `admin2` (private windows,
      or different browsers), so switching user takes a click, not a sign-in.
- [ ] Browser zoom 110%, notifications off.
- [ ] Have the RFP status report open (send its link to the bank only after you have shared access to it).

## The demo

| Min | Step | Say | Click path |
|---|---|---|---|
| 0:00 | **Frame it** | "Synthetic data, real requirements: this is built against your RFP. Of 116 requirements, these are done, these wait on the bank, these are outside the software." | RFP status report: the summary band |
| 2:00 | **Portfolio** | "The hydropower book on one screen: by stage, province and capacity." | `admin`: Dashboard. Then Projects: filter by province and stage |
| 4:00 | **One project** | "Everything about a plant in one place." | Projects, **Kali Gandaki A**. Tabs: Generation & PPA (contract against actual energy), Hydrology, Land & governance (shareholding, board), ESG (CO₂ avoided) |
| 6:00 | **Documents** | "Sanction letters, PPAs, studies: versioned, encrypted, never deleted." | Documents tab: open the sanction letter, show versions 1 and 2, download v1 |
| 7:00 | **Budget against cost** | "Overspend by cost head, flagged; changes go through approval, including a bulk upload from Excel." | Budget tab: heads over budget. Click **Upload budget** to show the preview only, then Cancel |
| 8:00 | **Milestones and risk** | "Construction schedule against plan; delays feed the risk register." | Milestones tab ("days late"), Risk register tab, Insurance tab (expiring within 90 days) |
| 9:30 | **Covenants on Nepali fiscal quarters** | "DSCR, ICR and LTV every quarter, against each facility's sanction terms; warnings before breaches." | Compliance: the results list; open a project for the eight-quarter trend |
| 11:00 | **Maker-checker, live** | "No figure changes because one person typed it." | `maker` tab: Compliance, open an owned project, **Record quarterly figures**, change operating expenses, source, justification, Submit. `approver` tab: Approvals, Recommend. `admin` tab: Approvals, **Approve and apply**. Back to Compliance: the quarter is re-tested |
| 14:00 | **Who approves what** | "Approval rules are configuration: one check or two, and by whom. Changing a rule needs a second administrator too." | `admin`: Settings: Approval rules; Application settings (alert lead times, default covenant thresholds); Exchange rates |
| 16:00 | **Lending view** | "The quarterly projection, and the energy lending share against the regulator's minimum." | Loan projection; Energy financing |
| 18:00 | **Reports** | "Reports without SQL, in Excel, Word or PDF with Bikram Sambat and AD dates; one consolidated report across lending, covenants and budget." | Reports: source **Consolidated**, pick columns, **Preview**; format Excel, **Download** |
| 20:00 | **Regulatory and stakeholders** | "Filing calendar on the BS fiscal year, reminders, and a history of dealings with each stakeholder." | Regulatory: say the calendar fills from **your** compliance team's list; Stakeholder contacts: History |
| 21:30 | **Control and security** | "Every change is hash-chained; a blocked user is signed out at once; a guest sees screens but not the bank's figures." | `admin`: Admin page: audit **Intact**, user accounts (Block, Role). Optional: sign in as `guest`, open the Dashboard: totals show "—" |
| 23:00 | **What we need from you** | "Seven things move this from demo to proof of concept." | RFP status report: "What the bank needs to provide" (B1 to B7) and the four-sprint plan |

## The honest close (every time)

"What is solid: the portfolio, covenants on fiscal quarters, maker-checker on every critical change, documents,
budgets, reports in both calendars, and the audit chain. What waits on you: your end-of-day loan extract to
switch core banking from sample data to live, a test directory account for sign-in, the filing list for the
regulatory calendar, and where the proof of concept may be hosted. What is not done yet: the independent
penetration test, and a load test on proper hosting."

## Questions you will get

| Question | Answer |
|---|---|
| Is this connected to our Finacle? | Not yet. The connector reads an end-of-day extract or an API, set up with a mapping file per bank. We need a sample extract (10 to 20 accounts, masked is fine) to configure it. |
| Can our staff sign in with their AD accounts? | Yes, by group-to-role mapping. Built and tested, not yet against your directory; we need a test account. |
| Who can see a borrower's figures? | Makers see the projects they own; checkers, auditors and admins see all; a guest sees no confidential figures. Optionally the database enforces the same rule underneath. |
| Can an admin change data directly? | No. Admins propose like anyone else, and someone else approves. Settings and approval rules need a second administrator. |
| What if someone edits the audit log in the database? | It is protected against edits, and every entry is chained to the one before: a change breaks the chain, which the Admin page checks. |
| Has it been penetration tested? | Not yet independently. It is planned once proof-of-concept hosting is decided. |
| Where would our data live? | Your choice for the proof of concept: your premises, your cloud, or ours. The public demo never holds bank data. |
| How many users can it take? | Measured on a laptop so far; we will load test on the proof-of-concept hosting against a target you set. |
| Nepali? | Bikram Sambat dates throughout, Nepali interface language, Nepali names stored. |

## After the meeting

1. Send the RFP status report link (after sharing access) and the list of what we need from the bank.
2. Note who owns each of B1 to B7 on their side, and the date for each.
3. Reset the demo data again if the bank was given the demo link to explore.
