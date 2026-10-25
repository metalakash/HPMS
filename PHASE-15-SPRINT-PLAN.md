# Phase 15: From Demo to Proof of Concept — Sprint Plan

**Status:** 🚀 planned 2026-10-13; sprint 1 stories 1.3, 1.4 and 1.5 done the same day, and a demo data reset for 1.1 on 2026-10-14 (not committed). 1.2 waits on the owner.
**Baseline:** `master` @ `8fefba1`, CI green. Hosted API on the current build and schema revision `026`; hosted database not yet seeded.
**Inputs:** [`PHASE-12-KICKOFF.md`](PHASE-12-KICKOFF.md), [`PHASE-13-KICKOFF.md`](PHASE-13-KICKOFF.md), [`PHASE-14-KICKOFF.md`](PHASE-14-KICKOFF.md), [`docs/RFP-GAP-AUDIT.md`](docs/RFP-GAP-AUDIT.md)

## Goal

A bank user signs in with their own directory account, sees loans refreshed from the bank's
end-of-day extract, enters a quarter's figures through maker-checker, and gets covenant results —
on hosting that has been load-tested, penetration-tested and restored from backup once.

## How to read this plan

- Four one-week sprints. Dates assume one developer plus Claude and are **estimates, not
  commitments**: sprints 2 to 4 depend on things only the bank or an outside party can supply.
- **Owner** is who must act: `Dev` (can be done in the repository), `Owner` (the project owner:
  hosting, credentials, decisions), `Bank`, `External`.
- Sizes: S = up to half a day, M = one to two days, L = three days or more.
- A story is done when its acceptance check passes **against a real backend**, not only in mocked
  tests. Two defects in Phases 13 and 14 passed every mocked test.

## Send to the bank now

These have lead times and gate sprints 2 to 4. Send them on day one of sprint 1.

| # | Ask | Needed for |
|---|---|---|
| B1 | Sample end-of-day loan extract: 10–20 accounts, real layout, masked values acceptable, plus the answers listed in [`docs/CBS-INTEGRATION.md`](docs/CBS-INTEGRATION.md) | 2.1 |
| B2 | A test Active Directory account, the group names for each role, and the network path | 2.4 |
| B3 | The filing requirements the compliance team tracks: regulator, title, frequency, days after period end | 2.6 |
| B4 | Confirmation that covenants are tested on Nepali fiscal quarters, and each facility's thresholds | 2.7 |
| B5 | Target for concurrent users and response time; where the proof of concept may be hosted (bank premises, bank cloud, vendor cloud) | 3.1, 3.2 |
| B6 | Whether Office 365 sign-in, digital signature, CSR tracking, PowerPoint export and XML import are in the proof of concept | 4.4 |
| B7 | Three to five named users for acceptance testing (maker, two checkers, auditor) | 4.2 |

---

## Sprint 1 (14–20 Oct): a complete hosted demo

**Sprint goal:** the hosted site shows the full product on synthetic data, including entering
covenant figures, and has been rehearsed once.

| ID | Story | Owner | Size | Depends on |
|---|---|---|---|---|
| 1.1 | Seed the hosted database with the demo portfolio | Dev | S | deploy with `DEMO_RESET_ENABLED` |
| 1.2 | Point the Render service at `master` and confirm auto-deploy | Owner | S | — |
| 1.3 | Screen to propose a quarter's financial figures for a project | Dev | M | — |
| 1.4 | Screen to propose a project's sanction terms | Dev | S | 1.3 |
| 1.5 | Second admin demo account, so sanction terms can be approved end to end | Dev | S | — |
| 1.6 | Seed insurance, ESIA and community records so no tab is empty | Dev | S | — |
| 1.7 | Refresh the overview deck and demo script for fiscal quarters and the new screens | Dev | S | 1.3–1.6 |
| 1.8 | Rehearse the demo on the hosted site | Owner + Dev | S | 1.1–1.7 |

**Acceptance**

- 1.1: hosted `/api/v1/projects` reports 50 projects; loans, covenant results and plant
  performance are non-empty. No bank data is ever loaded there.
- 1.2: a push to `master` produces a Render deployment of that commit without a manual step.
- 1.3: a maker on an owned project proposes a completed fiscal quarter's figures from the
  Compliance drawer; the request appears in Approvals with the figures and the values they
  replace; after two different checkers approve, the quarter's covenant result appears. Refused
  in the screen with the reason: a quarter that has not ended, a negative amount, no source.
- 1.4: an admin proposes thresholds with the sanction letter reference; a different admin gives
  the final approval; the history is re-tested against the new thresholds.
- 1.3 / 1.4: covered by an end-to-end spec that reloads before checking, on the synthetic stack.
- 1.5: the second admin exists only where the demo accounts are enabled.
- 1.6: Insurance, ESIA monitoring and Community tabs show records on a fresh seed; one policy
  expires within 90 days.
- 1.8: every step of the demo script works on the hosted site; anything that does not is fixed
  or removed from the script.

**Progress (2026-10-13)**

- 1.3 ✅ `ProposeFiguresModal`: from the Compliance drawer and the project page. Offers the last
  eight completed fiscal quarters (`reportable_quarters` on the financials endpoint); a quarter on
  file opens with its figures for correction. Blank means not reported and is not sent as zero.
- 1.4 ✅ `ProposeTermsModal`: admins only; the proposer cannot give the final approval.
- 1.5 ✅ demo account `admin2`, available only where the demo accounts are enabled.
- Verified on the synthetic stack by `frontend/e2e/9-covenant-inputs.spec.ts` (3 tests, repeatable):
  figures re-test the covenants only after the second approval; terms need a different admin; an
  auditor is offered neither form. Full suites: backend 1057 passed, frontend 207 passed with
  2 expected failures, end-to-end 44 passed.
- 1.6 not started: `seed_realistic_data.py` has uncommitted changes from other work in progress,
  so it was left alone.
- The synthetic stack's database now lives in `.e2e-pg/` (ignored by git) instead of a temp folder.

**Progress (2026-10-14)**

- 1.1: Admin > "Reset demo data" (`POST /api/v1/admin/demo-reset`) replaces all project data with the
  seed, including records the seed scripts do not clear themselves (insurance, contacts, documents),
  so no one needs the hosted database URL. It is audited and keeps users and the audit log. Off
  unless `DEMO_RESET_ENABLED=true` and the demo accounts are allowed; refuses a database holding
  bank-loaded rows. Set in `render.yaml`. 1.8 a few minutes before each demo: press it.
  Verified by `frontend/e2e/10-demo-reset.spec.ts` (run alone) and `tests/integration/test_demo_reset.py`.

**Risks:** anyone with the published demo admin password can reset the hosted data; acceptable while
it holds only synthetic data. The free hosting tier sleeps when idle: open the site a few
minutes before presenting.

---

## Sprint 2 (21–27 Oct): connect to the bank

**Sprint goal:** loans refresh from the bank's extract every night, and a bank user can sign in.

| ID | Story | Owner | Size | Depends on |
|---|---|---|---|---|
| 2.1 | Write the bank's mapping file from its sample extract; pass the extract checker | Dev | M | B1 |
| 2.2 | Dry-run sync against held loans; review every difference with the bank | Dev + Bank | S | 2.1 |
| 2.3 | Fetch the extract over SFTP (HPMS reads a local directory today) | Dev | M | B1 (delivery details) |
| 2.4 | Sign in against the bank's Active Directory; map groups to roles from configuration | Dev | M | B2 |
| 2.5 | Nightly schedule live in the proof-of-concept environment, with failure alerts | Dev | S | 2.1, 2.3 |
| 2.6 | Bulk load of filing requirements from the compliance team's list | Dev | S | B3 |
| 2.7 | Covenant conventions confirmed and thresholds loaded per facility | Dev + Bank | S | B4 |

**Acceptance**

- 2.1: `check_cbs_extract --compare` reports zero rejected rows on the sample and matches every
  loan held in HPMS; the mapping file is reviewed by someone at the bank who knows the extract.
- 2.2: the dry-run diff is signed off before any write. Sign convention and date format are
  confirmed, not assumed.
- 2.3: a file dropped on the bank's SFTP is picked up, a stale or missing file raises an alert
  and leaves balances untouched.
- 2.4: a user in each mapped group lands in the right role; a user in none is refused; the demo
  accounts are off in that environment.
- 2.5: a scheduled run updates balances, writes audit entries and re-tests covenants; a failed
  run is visible in the sync history and emailed.
- 2.6: the filing calendar is generated for the current fiscal year from real requirements.

**Risks:** everything except 2.3's code depends on the bank. If B1 or B2 slips, pull sprint 3
stories forward; they do not depend on the bank. The extract may omit fields HPMS syncs: the
checker lists them, and the sync keeps local values for those.

---

## Sprint 3 (28 Oct – 3 Nov): harden

**Sprint goal:** known capacity, a tested restore, and a penetration test under way.

| ID | Story | Owner | Size | Depends on |
|---|---|---|---|---|
| 3.1 | Decide and provision proof-of-concept hosting (not the free tier) | Owner + Bank | M | B5 |
| 3.2 | Production settings: several workers, statement logging off, sized connection pool | Dev | S | 3.1 |
| 3.3 | Load test on that hosting at 25 and 100 users; fix what it finds | Dev | M | 3.2, B5 |
| 3.4 | Backup schedule and one full restore drill, timed and written up | Dev + Owner | M | 3.1 |
| 3.5 | Commission the independent penetration test | Owner + External | L (elapsed) | 3.1 |
| 3.6 | Error monitoring and uptime alerting | Dev | S | 3.1 |
| 3.7 | Enforce MFA for the roles that require it (flagged today, not blocked) | Dev | S | — |
| 3.8 | End-to-end suite in CI on a seeded database | Dev | M | — |

**Acceptance**

- 3.3: results recorded beside the Phase 12 laptop numbers, same columns, with the hardware and
  the agreed target; p95 within target at the agreed user count, or the gap and its cause stated.
- 3.4: a database restored from backup passes `validate_data_integrity` and the audit chain
  verifies; time to restore is recorded.
- 3.5: scope and dates agreed in writing; test account and environment handed over.
- 3.7: a user in a required role without MFA cannot reach anything but enrolment.
- 3.8: a push that breaks a screen against the real backend fails CI.

**Risks:** the penetration test's elapsed time is outside the team's control; start it as early
in the sprint as hosting allows. Findings land in sprint 4.

---

## Sprint 4 (4–10 Nov): acceptance and go-live of the proof of concept

**Sprint goal:** bank users have run their own cases and the open findings are closed.

| ID | Story | Owner | Size | Depends on |
|---|---|---|---|---|
| 4.1 | Load the bank's portfolio into the proof-of-concept environment | Dev + Bank | M | 3.1, bank approval of where its data may live |
| 4.2 | Acceptance testing with the bank's named users, from a written script | Bank + Dev | L | B7, 2.4, 4.1 |
| 4.3 | Close high and critical penetration-test findings | Dev | M–L | 3.5 |
| 4.4 | Build only the RFP items the bank confirmed are in scope | Dev | per item | B6 |
| 4.5 | System study and parameterisation document (RFP D.12); update manuals | Dev | M | — |
| 4.6 | Sign-off: gap audit re-run, open items listed with owners | Owner + Bank | S | all |

**Acceptance**

- 4.1: only into an environment the bank has approved for its data; never the public demo.
- 4.2: each scripted case passes or has a logged defect with an owner; the bank signs the result.
- 4.3: no open high or critical finding; mediums have a dated plan.
- 4.6: [`docs/RFP-GAP-AUDIT.md`](docs/RFP-GAP-AUDIT.md) re-audited against the running system, not the code.

---

## Standing rules

- The local development database holds real bank data. Seeds and the end-to-end suite run only on
  the synthetic stack (`frontend/e2e/README.md`). Nothing derived from the bank's data goes into
  git, tests, fixtures, documents or the public demo.
- Every write endpoint commits (`tests/test_routes_commit.py`). Every new screen gets a
  real-backend spec that reloads before checking.
- Split commits by feature to `master`, on request, with backend and frontend suites green first.
- The public demo keeps the published demo passwords on and therefore synthetic data only.

## Not in this plan

CSR tracker, PowerPoint export, XML/HDF import, cross-source report consolidation, field-level
read rights, database-level row security, hierarchy propagation, prior-year budget linking and
peer comparison. Each waits on B6; anything confirmed in scope is sized and added to sprint 4.

## Definition of done for the phase

The sprint 4 sign-off (4.6) is complete: bank users have passed acceptance on an approved
environment fed by the nightly extract, the load and restore results are recorded, and the
penetration test has no open high or critical finding.
