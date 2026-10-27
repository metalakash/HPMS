# HPMS internal demo script (about 25 minutes)

For presenting HPMS inside the bank, to management and to the credit, risk, compliance, IT and audit teams,
on the hosted demo. Synthetic data throughout: say so first. Pairs with the HPMS Showcase slides and the RFP
status report.

- Web app: https://hpms-web.vercel.app
- API status: https://hpms-api.onrender.com/ready (shows the database schema version)
- Demo accounts (published demo passwords, demo instance only): `admin` / `admin123`, `admin2` / `admin2123`,
  `maker` / `maker123`, `approver` / `approver123`, `auditor` / `auditor123`, `guest` / `guest123`

Story: **our hydropower book, from portfolio to a single quarter's covenant test, with every change made by one
person and approved by another, and every step on a tamper-evident record.**

## Preflight (15 minutes before)

- [ ] Open the API status link: the free hosting tier sleeps, and the first request takes about 30 seconds.
- [ ] Sign in as `admin`. Admin page, **Reset demo data**, confirm. Wait for "50 projects ... documents".
- [ ] Admin page: audit log shows **Intact**.
- [ ] Open four tabs, one per account you will use: `admin`, `maker`, `approver`, `admin2` (private windows,
      or different browsers), so switching user takes a click, not a sign-in.
- [ ] Browser zoom 110%, notifications off.
- [ ] Have the RFP status report and the slides open (share access with attendees before sending either link).

## Who to speak to in the room

Point each part at the team it matters to most, so every department sees its own concern answered.

| Team | Their question | The step that answers it |
|---|---|---|
| Credit and relationship | "Can I see a borrower's whole position in one place?" | One project, Documents, Budget |
| Risk | "Will we see a covenant problem before the quarterly review?" | Covenants, Milestones and risk |
| Compliance | "Will filings and expiries be chased for us?" | Regulatory, alerts on the project tabs |
| Internal audit | "Can anyone change a figure without a trace?" | Maker-checker, Control and security |
| IT and security | "Does it fit our directory, core banking and hosting?" | Who approves what, the close |
| Management | "How much of what we asked for is done, and what is left?" | Frame it, What it needs from us |

## The demo

| Min | Step | Say | Click path |
|---|---|---|---|
| 0:00 | **Frame it** | "Synthetic data, our requirements: this is built against the RFP we issued. Of its 116 requirements, these are done, these wait on input from us, these are outside the software." | RFP status report: the summary band |
| 2:00 | **Portfolio** | "Our hydropower book on one screen: by stage, province and capacity. The demo book has the shape of ours: 44 facilities, 17 in operation, 14 under construction, 10 yet to start drawdown, about NPR 39 billion in limits. The names are made up." | `admin`: Dashboard. Then Projects: filter by province and stage |
| 4:00 | **One project** | "Everything about a plant in one place, instead of asking three departments." | Projects, **Dwari Khola III Hydropower Project**. Tabs: Generation & PPA (contract against actual energy), Hydrology, Land & governance (shareholding, board), ESG (CO₂ avoided) |
| 6:00 | **Documents** | "Sanction letters, PPAs, studies: versioned, encrypted, never deleted." | Documents tab: open the sanction letter, show versions 1 and 2, download v1 |
| 7:00 | **Budget against cost** | "Overspend by cost head, flagged; changes go through approval, including a bulk upload from Excel." | Budget tab: heads over budget. Click **Upload budget** to show the preview only, then Cancel |
| 8:00 | **Milestones and risk** | "Construction schedule against plan; delays feed the risk register." | Milestones tab ("days late"), Risk register tab, Insurance tab (expiring within 90 days) |
| 9:30 | **Covenants on Nepali fiscal quarters** | "DSCR, ICR and LTV every quarter, against each facility's sanction terms; warnings before breaches." | Compliance: the results list; open a project for the eight-quarter trend |
| 11:00 | **Maker-checker, live** | "No figure changes because one person typed it." | `maker` tab: Compliance, open an owned project, **Record quarterly figures**, change operating expenses, source, justification, Submit. `approver` tab: Approvals, Recommend. `admin` tab: Approvals, **Approve and apply**. Back to Compliance: the quarter is re-tested |
| 14:00 | **Who approves what** | "We decide the approval rules ourselves: one check or two, and by whom. Changing a rule needs a second administrator too." | `admin`: Settings: Approval rules; Application settings (alert lead times, default covenant thresholds); Exchange rates |
| 16:00 | **Lending view** | "The quarterly projection, and our energy lending share against the regulator's minimum." | Loan projection; Energy financing |
| 18:00 | **Reports** | "Reports without SQL, in Excel, Word or PDF with Bikram Sambat and AD dates; one consolidated report across lending, covenants and budget." | Reports: source **Consolidated**, pick columns, **Preview**; format Excel, **Download** |
| 20:00 | **Regulatory and stakeholders** | "Filing calendar on the BS fiscal year, reminders, and a history of dealings with each stakeholder." | Regulatory: say the calendar fills from **our** compliance team's list of filings; Stakeholder contacts: History |
| 21:30 | **Control and security** | "Every change is hash-chained; a blocked user is signed out at once; a guest sees screens but not our figures." | `admin`: Admin page: audit **Intact**, user accounts (Block, Role). Optional: sign in as `guest`, open the Dashboard: totals show "—" |
| 23:00 | **What it needs from us** | "Seven inputs from our departments move this from demo to proof of concept." | RFP status report: "What the bank needs to provide" (B1 to B7) and the four-step plan |

## The honest close (every time)

"What is solid: the portfolio, covenants on fiscal quarters, maker-checker on every critical change, documents,
budgets, reports in both calendars, and the audit chain. What waits on us: a sample end-of-day loan extract to
switch core banking from sample data to live, a test directory account for sign-in, our compliance team's list
of filings, our covenant conventions, and a decision on where the proof of concept is hosted. What is not done
yet: the independent penetration test, and a load test on proper hosting."

Then the ask: **an owner and a date for each of the seven inputs.**

## Questions colleagues will ask

| Question | Answer |
|---|---|
| Is this connected to our Finacle? | Not yet. The connector reads an end-of-day extract or an API, configured with a mapping file for our layout. Core banking operations need to provide a sample extract (10 to 20 accounts, masked is fine). |
| Can staff sign in with their AD accounts? | Yes. Our own AD groups map to the roles, and anyone in none of them is refused. Built and tested, not yet against our directory; IT security needs to provide a test account and the group names. |
| Who can see a borrower's figures? | Makers see the projects they own; checkers, auditors and admins see all; a guest sees no confidential figures. Optionally the database enforces the same rule underneath. |
| Can an admin change data directly? | No. Admins propose like anyone else, and someone else approves. Settings and approval rules need a second administrator. |
| What if someone edits the audit log in the database? | It is protected against edits, and every entry is chained to the one before: a change breaks the chain, which the Admin page checks. |
| Do the covenant formulas match ours? | They are written for the last four quarters on Nepali fiscal quarters. Credit risk should confirm our definitions and thresholds; adjusting them is a small, tested change, and thresholds are set on screen. |
| Has it been penetration tested? | Not yet independently. It is planned once proof-of-concept hosting is decided. |
| Where would our data live? | Our decision: on our premises, in our cloud, or with a provider we approve. The public demo never holds our data. |
| How many users can it take? | Measured on a laptop so far; it will be load tested on the proof-of-concept hosting against a target we set. |
| Nepali? | Bikram Sambat dates throughout, Nepali interface language, Nepali names stored. |
| What would it take to start? | The seven inputs, then four steps: agree the rules, connect, harden, accept. Each is about a week once its inputs arrive. |

## After the meeting

1. Share the RFP status report and the slides with attendees (share access first), with the list of the seven inputs.
2. Record an owner and a date for each input, by department.
3. Book the first workshops: credit risk (covenant definitions, thresholds, approval rules), compliance (filings,
   alert lead times, retention), IT security (directory, hosting, MFA).
4. Reset the demo data if attendees were given the demo link to explore.
