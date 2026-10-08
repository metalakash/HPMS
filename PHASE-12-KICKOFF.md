# Phase 12: Integration & Deployment — Kickoff

**Status:** 🚀 started 2026-10-08. The parts that need neither the bank nor hosting access are done; the rest is waiting on the items under "Needed from others".
**Driver:** [`docs/RFP-GAP-AUDIT.md`](docs/RFP-GAP-AUDIT.md), "Still open" and the 2026-10-03 re-audit findings
**Baseline:** `master` @ `16d661a`, CI green (979 backend, 174 frontend); 983 backend tests with this phase's work

## Goal

Take HPMS from a laptop demo to something the bank can run a proof of concept on: deployed
safely, connected to the bank's core banking data and directory, and load- and security-tested.

## Tasks

### 12.1 Deployment safety — ✅ done, not yet deployed
- [x] A failed migration now fails the deploy (`backend/Dockerfile`: `&&` instead of `;`), so the
      platform keeps the previous version instead of starting the app on a half-migrated schema
- [x] `GET /ready` reports `schema_revision` and `expected_revision`, and answers `schema_behind`
      when they differ, so a deployment's migration state can be checked from outside
- [ ] Redeploy the hosted API and confirm `/ready` shows `021_covenant_inputs` — **blocked: needs Render access**
- [ ] Hosted database: migrations `012`–`021` have never run there (audit finding 2)
- [ ] Separate demo instance with synthetic data. The current hosted API accepts the published
      demo passwords, which is acceptable only while it holds no real data

### 12.2 Core banking (RFP TECH B.5) — 🟡 ready for the bank's file
- [x] File-extract and HTTP adapters driven by a mapping file ([`docs/CBS-INTEGRATION.md`](docs/CBS-INTEGRATION.md))
- [x] Extract checker: `python -m backend.scripts.check_cbs_extract <file> --mapping <json> [--compare]`
      reads a sample exactly as the adapter would, lists rejected rows and missing fields, and
      lines accounts up with held loans. Writes nothing
- [x] Nightly run: a sync schedule with source `FINACLE_CBS` now reads the configured adapter
      (it used to answer "not implemented"); refused while the adapter is the mock
- [ ] Write the bank's mapping file from its real extract — **blocked: needs a sample extract**
- [ ] Fetching the file over SFTP (HPMS reads a local directory today)
- [ ] Mutual TLS to the bank's gateway is supported by the HTTP adapter but untested (TECH A.5)

### 12.3 Directory sign-in (RFP TECH B.3) — ⏳ not started
- [ ] Test `security/ldap_provider.py` against the bank's Active Directory — **blocked: needs a test account and network path**
- [ ] Role mapping from the bank's AD groups to admin / maker / approver / auditor
- [ ] Office 365 and digital signature: absent; needs a decision on whether they are in the POC

### 12.4 Load test (RFP FUNC A.8, TECH C.1) — 🟡 first run recorded
- [x] `python -m backend.scripts.load_test --users N --seconds S` drives the read endpoints the
      web app uses and reports median, p95 and failures per endpoint
- [x] First run, 2026-10-08, **on a development laptop** (one process with auto-reload and SQL
      statement logging on, local Postgres, seeded 50-project portfolio):

  | Concurrent users | Requests/second | Median | p95 | Failed |
  |---|---|---|---|---|
  | 25 | 112 | 144 ms | 691 ms | 0 of 3,385 |
  | 100 | 45 | 1,201 ms | 8,329 ms | 0 of 1,378 |

  At 100 users throughput falls and waits grow: one process saturates. This says nothing about
  production capacity. It does say what to change before the next run.
- [ ] Re-run against a production-like setup: several workers, statement logging off
      (`DEBUG=false`), a sized connection pool or PgBouncer, realistic data volume
- [ ] Agree a target with the bank (users, response time); the RFP gives no number

### 12.5 Security review (RFP TECH A.2) — ⏳ external
- [ ] Independent penetration test. Only the self-assessment in
      [`docs/SECURITY-HARDENING.md`](docs/SECURITY-HARDENING.md) exists
- [ ] Backup and restore drill on the hosted database

## Needed from others

**From the bank**
1. A sample end-of-day loan extract (10–20 accounts, real layout, masked values are fine) and the
   answers in "What to ask the bank for" in the CBS document
2. A test Active Directory account, the group names that should map to each role, and the network path
3. A target for concurrent users and response time
4. Whether Office 365 sign-in and digital signature are in scope for the proof of concept
5. Whether covenants are tested on calendar or Nepali fiscal quarters

**From the project owner**
1. Trigger the Render deploy (or provide a deploy hook) and confirm auto-deploy is on
2. Decide where the demo instance lives and whether the 572-project load on the hosted database is kept
3. Commission the penetration test

## Open findings carried into this phase

- The hosted frontend (Vercel) deploys on every push and is ahead of the hosted API, so the
  hosted Compliance, Analytics, Maintenance and Admin pages fail until the API is redeployed.
- `tests/test_phase6_backend_defects.py::TestLogin` uses the application's own database
  connection rather than the test session; CI points both at the test database.
- Financial periods and covenant terms are entered directly (audited), not through maker-checker.

## Definition of done

The bank's sample extract passes the checker and a nightly schedule updates held loans from it;
a bank user signs in with directory credentials and lands in the right role; the hosted API's
`/ready` shows the current schema revision; a load test on production-like hosting meets the
agreed target; the penetration test's high and critical findings are closed.
