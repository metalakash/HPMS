# HPMS Administrator Manual

Audience: system administrators and IT operations at Siddhartha Bank Limited (SBL).
RFP: D.12 (admin and user manuals). Companion documents: [User Manual](USER-MANUAL.md),
[Data Dictionary](DATA-DICTIONARY.md), [Security Hardening Record](SECURITY-HARDENING.md),
[Runbook](RUNBOOK.md), [Troubleshooting](TROUBLESHOOTING.md), [API Reference](API_REFERENCE.md).

> **Read this first — current limitations.** Several things an administrator would expect are not in
> the product yet. They are listed in [§12](#12-known-limitations) so nobody discovers them in production.
> The most important: the loan-exposure Finacle source is not implemented (§7), and the web Admin, Compliance,
> Analytics and Maintenance pages show sample data.

## 1. Architecture

| Part | Technology | Notes |
|---|---|---|
| API | FastAPI (Python 3.11 container) | `backend/app/main.py`; REST under `/api/v1`, GraphQL at `/graphql`, WebSocket for live notifications |
| Database | PostgreSQL | Schema owned by Alembic (`alembic/versions`, currently `001` → `018`). The app never calls `create_all` at startup |
| Cache / pub-sub | Redis (optional) | `REDIS_ENABLED=false` by default |
| Files | S3 / MinIO / local | `STORAGE_BACKEND`; report downloads work without S3 (`/reports/export/download`) |
| Web UI | React + TypeScript (Vite) | `frontend/`; hosted on Vercel, which proxies `/api` and `/graphql` to the API |
| Mobile | React Native | `mobile/`, see `docs/DEPLOY_MOBILE.md` |
| Identity | Active Directory (LDAP) | or built-in demo accounts when `USE_LDAP=false` |
| Core banking | Finacle (read-only) | adapter with circuit breaker and rate limit; **mock-backed until the SBL sandbox is reachable** |

Current hosted layout: backend on Render (`render.yaml`, Docker, health check `/docs`), frontend on Vercel
(`vercel.json`). The on-premise DC/DR layout in the RFP is an infrastructure workstream and is not described here.

## 2. Deployment and upgrades

1. **Build**: `backend/Dockerfile` (Python 3.11). Run `python -m pytest tests` first; the suite should be green.
2. **Migrate**: the container command runs `alembic upgrade head` before starting uvicorn. To run it by hand:
   ```bash
   alembic upgrade head
   alembic current          # should print 018_mfa_totp_replay_guard
   ```
   Migrations `012`–`018` (risk domain, report definitions, regulatory calendar, audit immutability trigger, loan sync
   tables, MFA secret protection, TOTP replay guard) have been applied to a real PostgreSQL (011 → 018) and their tests
   run against it; still apply them to a staging copy of production data first.
   **Run `017` with the production `MFA_ENCRYPTION_KEY`/`SECRET_KEY` in the environment**: it encrypts existing TOTP seeds
   with that key, and a different key later makes them unreadable (users would have to re-enrol).
3. **Frontend**: `cd frontend && npm run build`; Vercel runs this from `vercel.json`. Security headers and the CSP
   are defined in `vercel.json`. If you edit the inline theme script in `frontend/index.html`, regenerate its
   hash in the CSP (a test fails otherwise).
4. **Verify**: `GET /health` (liveness), `GET /ready` (database reachable, returns 503 otherwise), `GET /docs`.
5. **Roll back**: redeploy the previous image; `alembic downgrade <revision>` is provided for `013`–`018`.
   Downgrading `015` removes the audit append-only trigger.

## 3. Configuration reference

Variables the code actually reads (some older documents list names that the code ignores, for example
`JWT_EXPIRATION_HOURS`, `CORS_ORIGINS`, `SMTP_SERVER`; use the names below).

| Group | Variable | Default | Notes |
|---|---|---|---|
| Core | `DATABASE_URL` | local dev URL | `postgresql://…`; the app derives the asyncpg URL |
| | `SECRET_KEY`, `JWT_SECRET_KEY` | **dev placeholders** | Must be set to long random values. `render.yaml` generates them |
| | `JWT_EXPIRY_MINUTES` | `480` | Session length |
| | `DEBUG` | `true` | Set `false` in production |
| | `LOG_LEVEL` | `INFO` | |
| | `EXTRA_ALLOWED_HOSTS` | empty | Extra hostnames for the trusted-host check |
| Identity | `USE_LDAP` | `false` | `true` enables Active Directory; see §4 |
| | `ALLOW_DEV_AUTH` | unset | Built-in demo accounts: unset = only while `DEBUG=true`; `true` = allowed (logged as a warning when `DEBUG` is off); `false` = never. With neither AD nor demo accounts, login answers 503 |
| | `MFA_REQUIRED_ROLES` | empty | Comma-separated roles (for example `admin,approver`) that should use MFA. Users in them without it still sign in, but the login response carries `mfa_enrollment_required` and the web app shows a banner until they enrol. **It does not block sign-in** |
| | `MFA_ENCRYPTION_KEY`, `MFA_ENCRYPTION_KEY_OLD` | empty | Key encrypting TOTP seeds (falls back to `SECRET_KEY`). To rotate: put the new key in `MFA_ENCRYPTION_KEY` and the previous one in `MFA_ENCRYPTION_KEY_OLD`; remove the old key only after all seeds have been rewritten |
| | `AD_SERVER`, `AD_DOMAIN`, `AD_BASE_DN` | `ldap.sbl.local`, `sbl.local`, `dc=sbl,dc=local` | |
| | `AD_SERVICE_ACCOUNT_USERNAME/PASSWORD` | empty | Account used to read group membership |
| Network | `ADMIN_IP_ALLOWLIST` | empty (off) | Comma-separated IPs/CIDRs; see §6 |
| | `ADMIN_PROTECTED_PREFIXES` | admin, cbs, report schedules, regulatory requirements, stakeholders | |
| | `TRUSTED_PROXY_HOPS` | `0` | Number of reverse proxies in front of the API |
| Audit | `AUDIT_RETENTION_YEARS` | `7` | **Not a confirmed NRB figure**; set from SBL's records policy |
| | `AUDIT_PURGE_ENABLED` | `false` | Allows the manual purge endpoint |
| Email | `EMAIL_BACKEND` | `mock` | `mock` only logs; `smtp` sends |
| | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`, `EMAIL_FROM` | `localhost`, `587`, unset, unset, `true`, `noreply@hpms.local` | |
| Alerts | `ALERT_SCAN_HOUR_UTC` | `2` | Hour (UTC) of the daily alert scan |
| | `ALERT_RECIPIENTS` | empty | Comma-separated addresses for the daily critical-alert digest |
| Storage | `STORAGE_BACKEND` | `s3` | `s3`, `minio` or `local` |
| | `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT_URL` | | |
| | `PRESIGNED_URL_EXPIRY_SECONDS`, `EXPORT_FILE_EXPIRY_HOURS`, `MAX_EXPORT_RECORDS` | `3600`, `24`, `100000` | |
| Limits | `RATE_LIMIT_ENABLED`, `RATE_LIMIT_DEFAULT_QUOTA`, `RATE_LIMIT_PREMIUM_QUOTA`, `RATE_LIMIT_ADMIN_QUOTA`, `RATE_LIMIT_WINDOW_SECONDS` | `true`, `10`, `50`, unlimited, `60` | Requests per window |
| Cache | `CACHE_ENABLED`, `CACHE_MAX_SIZE`, `CACHE_*_TTL` | on, `1000`, 300–900 s | |
| Redis | `REDIS_ENABLED`, `REDIS_URL` | `false`, `redis://localhost:6379/0` | |
| PDF | `PDF_ENABLED`, `PDF_PAGESIZE`, `PDF_FONT`, `PDF_WATERMARK_ENABLED`, `PDF_WATERMARK_TEXT`, `PDF_ENCRYPTION_ENABLED`, … | see `config.py` | Branding colours: `PDF_COLOR_PRIMARY/SECONDARY/ACCENT` |
| WebSocket | `WEBSOCKET_ENABLED`, `WEBSOCKET_MAX_CONNECTIONS_PER_USER`, heartbeat settings | on, `5` | |

## 4. Users, roles and access

### 4.1 Roles

| Role | AD group | Sees | Can do |
|---|---|---|---|
| `admin` | `SBL_HPMS_ADMIN` | every project | everything, including admin consoles, regulatory requirements, stakeholder contacts, audit retention |
| `maker` | `SBL_HPMS_MAKER` | projects they own | propose changes (maker-checker), record regulatory filings, run CBS sync on owned projects |
| `approver` | `SBL_HPMS_APPROVER` | projects they own, plus projects with approvals pending for them | recommend / approve / reject proposed changes |
| `auditor` | `SBL_HPMS_AUDITOR` | every project, read-only | read everything, run portfolio reports, view report schedules; cannot change data or create schedules |
| `guest` | (no group) | nothing | log in only |

A user in several AD groups holds several roles. `admin` passes every role check.

### 4.2 Row-level security

Every project-scoped API call checks that the caller may see the project; projects they may not see answer
**404**, not 403, so identifiers do not leak. A maker gains access to a project by being recorded as its owner
(`project_owner` table). Portfolio-wide reports, the report builder and the regulatory
calendar require `admin` or `auditor`. This is enforced in application code; there is no database-level
row security yet.

### 4.3 Demo accounts

`LocalDevAuthProvider` accepts built-in accounts (`admin`, `maker`, `approver`, `auditor`, `guest`, with passwords of the
form `<role>123`, visible in the source repository). They are available only when Active Directory is off **and**
either `DEBUG=true` (local development) or `ALLOW_DEV_AUTH=true` is set deliberately. Otherwise login answers
503 "No authentication provider is configured". For production set `USE_LDAP=true`.

The hosted demo on Render (`render.yaml`: `USE_LDAP=false`, `DEBUG=false`) therefore stops accepting these logins
after the next deploy; add `ALLOW_DEV_AUTH=true` to its environment only if you want a public demo with
published passwords and no real data.

### 4.4 Multi-factor authentication

Users enrol themselves on the web **Security** page (`/security`): scan a QR code with an authenticator app, confirm
with a code, and save ten one-time backup codes. From then on:

1. `POST /api/v1/auth/login` with a correct password returns `{"mfa_required": true, "mfa_token": …}` instead of a
   session. The `mfa_token` is valid for 5 minutes and is not an access token (every other endpoint refuses it).
2. `POST /api/v1/auth/login/mfa` with that token and a 6-digit code (or a backup code such as `ABCD-1234`) returns the
   session.

Rules enforced by the server: a TOTP code works **once** (a replayed or older code is refused), five wrong codes in a
row lock the account for 15 minutes (HTTP 429, also at the password step), a backup code is spent when used, and
switching MFA off (`DELETE /api/v1/mfa/disable`) needs a current code or backup code, so a stolen session cannot
remove it. The server fails closed: if MFA is on, a password alone never yields a session.

**Lost device and backup codes:** an admin resets the user with `DELETE /api/v1/mfa/admin/{username}`; the user can
then sign in with the password and enrol again. The reset is written to the audit trail with the acting admin.

Not built: trusted-device skipping (the table exists but is unused), SMS and e-mail codes, and *blocking* sign-in
for roles in `MFA_REQUIRED_ROLES` until they enrol (it only flags them).

### 4.5 The Admin page

The web "Admin" page (admin role only) currently shows **sample users and settings, not live data**. Manage real
accounts in Active Directory, and project ownership through the API.

## 5. Maker-checker (dual control)

Endpoints: `POST /api/v1/mutations/submit-with-justification`, `GET /mutations/approval-queue`,
`POST /mutations/approve`, `POST /mutations/reject`.

Rules enforced by the service:

- Only `maker` and `admin` can submit; the justification must be at least 20 characters.
- For `PROJECT` and `LOAN` targets the submitter must be allowed to update the project.
- Field policy ([`security/field_policy.py`](../backend/app/security/field_policy.py)): CBS-owned balances
  (`finacle_account_id`, `outstanding_*`, `overdue_*`), calculated covenants (`dscr`, `ltv`, `icr`) and audit
  columns can never be proposed; `sanctioned_amount`, `disbursed_amount`, `interest_rate_pct`, maturity dates,
  and project master fields only by maker/admin. To change the policy edit `POLICY` in that file.
- Approval takes two steps (submitted → recommended → approved). Only `approver` and `admin` can act; nobody
  acts on their own submission; the two steps need different people.
- Rejection needs remarks of at least 10 characters and is only possible while the request is open.
- Makers see their own requests in the queue; admins, approvers and auditors see all.
- **Approving records the decision and its audit entry; it does not yet apply the proposed change to the
  record.** Applying approved changes is not implemented.
- The web "Approval queue" page exists in the code but is not linked from the navigation.

## 6. Network access control

- Set `ADMIN_IP_ALLOWLIST` (for example `10.20.0.0/16,192.168.5.10`) to restrict the prefixes in
  `ADMIN_PROTECTED_PREFIXES`; other IPs get 403. An invalid entry stops the application at startup.
- Behind a load balancer set `TRUSTED_PROXY_HOPS` to the number of proxies (usually 1). The API then takes the
  address from the right-hand side of `X-Forwarded-For`; entries to the left are ignored because clients can
  forge them. With the wrong value the allow-list evaluates the proxy's address instead of the user's.
- API responses carry a strict Content-Security-Policy and `Cache-Control: no-store`; `/docs` uses a relaxed
  policy. CORS and trusted hosts are lists in `main.py` and include `*.onrender.com`; tighten them for
  production.

## 7. Background jobs

| Job | Schedule | Where | Notes |
|---|---|---|---|
| Daily alert scan | `ALERT_SCAN_HOUR_UTC` (02:00 UTC) | `services/alert_daemon.py` | expiry (PPA, licence, insurance, permit), milestone slippage, filing due/overdue, automatic risks; marks late filings overdue; emails due user reminders; emails the digest to `ALERT_RECIPIENTS` and each stakeholder contact |
| Scheduled reports | every 60 s poll | `services/report_daemon.py` | runs export jobs whose `next_run_at` has passed; safe with several workers (row locks) |
| Loan exposure sync | every 60 s poll | `services/background_sync_executor.py` | runs schedules created at `/api/v1/loan-accounts/sync-schedule` (hourly, daily, weekly at HH:MM UTC; a missed occurrence runs once on recovery; new schedules wait for their next occurrence). Source `BANK_API` fetches `source_config.webhook_url` (http/https JSON), ingests in-process, writes history, raises DSCR/LTV alerts by email. `FINACLE_CBS` is recorded as failed ("not implemented"); `CSV_UPLOAD` has nothing to fetch |

All three run inside the API process; if the API restarts, jobs resume from stored state.

## 8. Reports and scheduling

- Sources: `portfolio`, `covenant_summary`, `capex_progress`, `covenant_shortfall`. List them with
  `GET /api/v1/reports/sources` (columns and filters per source). Filters include province, district and
  local level.
- Formats: JSON, CSV, Excel, Word, and PDF for portfolio / covenant / capex. Excel, Word and PDF carry the
  generation date in both AD and BS. PowerPoint is **not** produced (decision pending).
- Saved reports: `/api/v1/reports/definitions` (private or shared). Run with
  `POST /reports/definitions/{id}/run?format=word`.
- Schedules (create, change, delete and run-now are admin-only because they email reports to arbitrary recipients; auditors can list them and see run history): `POST /api/v1/reports/schedules` with a UTC cron expression, format, recipients and either
  `definition_id` or `report_id`. Example (every Monday 06:00 UTC, Word file by email):
  ```json
  {"name": "Weekly covenant shortfall", "schedule": "0 6 * * 1", "export_format": "word",
   "recipients": ["credit.risk@sbl.example"], "report_id": "covenant_shortfall",
   "filters": {"province": "Gandaki"}}
  ```
  `POST /reports/schedules/{id}/run` sends it immediately; `GET /reports/schedules/{id}/runs` shows history.
  Mail only leaves the system when `EMAIL_BACKEND=smtp`.

## 9. Regulatory calendar and alert recipients

No regulatory content is shipped. The compliance team must enter requirements:

1. `POST /api/v1/regulatory/requirements` — `code`, `title`, `authority` (NRB, MOEWRI, NEA, DOED, ERC, OTHER),
   `frequency` (`monthly`, `quarterly`, `semi_annual`, `annual`), `lag_days` (days after period end the filing
   is due), `applies_to` (`portfolio` or `project`).
2. `POST /regulatory/requirements/{id}/generate` with `from_date`/`to_date` creates the calendar rows. Periods
   follow the Nepali fiscal year (starts 1 Shrawan; quarters end Ashwin, Poush, Chaitra, Ashadh). Re-running is safe.
3. Makers/admins record a filing with `PATCH /regulatory/calendar/{id}` (`status: filed`, `reference_no`).
4. `POST /api/v1/stakeholders` adds an alert recipient (internal or external), optionally pinned to a project,
   limited to alert types (`PPA`, `LICENSE`, `INSURANCE`, `PERMIT`, `MILESTONE`, `FILING`) and a minimum
   urgency (`warning` or `critical`).

## 10. Audit trail administration

- Every maker-checker action and every project create/update writes a hash-chained row to `audit_logs`; a database trigger forbids UPDATE,
  DELETE and TRUNCATE on the table.
- `GET /api/v1/admin/audit/verify` walks the chain and reports the first broken link. Rows written by the older
  approve/reject code have blank hashes and will be reported; they are history and have not been rewritten.
- `GET /api/v1/admin/audit/retention` previews what the retention period would remove (read-only).
  `POST /api/v1/admin/audit/retention/purge` with `{"confirm_cutoff_date": "<cutoff from the preview>"}` deletes
  the oldest rows past the cutoff and stores a checkpoint. It only works when `AUDIT_PURGE_ENABLED=true`, is never
  scheduled automatically, and should be run only after SBL confirms the retention period in writing.
- Other write paths (loan ingest, regulatory filings, schedules, contacts) record `created_by`/`updated_by` but not an `audit_logs` row.
- Read access is audited only for report exports (`audit_log_reads`); a general read-audit middleware is a stub.

## 11. Monitoring, backup and support

- Health: `/health`, `/ready`. Logs go to stdout (Render logs tab or your log shipper).
- Incident handling, backups, restores and checklists: [RUNBOOK.md](RUNBOOK.md); symptoms and fixes:
  [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
- Test suite: `python -m pytest tests`. Database-backed tests are skipped unless a database is available: either the
  role can create databases (`ALTER ROLE <user> CREATEDB;`), or set `TEST_DATABASE_REUSE=1` and
  `TEST_DATABASE_URL=postgresql://…/<db>` to run against an already migrated database (every test rolls back, but
  use a development database: count-based assertions in `test_api_with_db.py` expect it to start empty). Run them
  before each release.
- Data dictionary: regenerate with `python -m backend.scripts.generate_data_dictionary`; a test fails if the
  committed copy is stale. A second test fails if a model has no migration.
- Dependency checks: run `pip-audit` and `npm audit --omit=dev` before every release.

## 12. Known limitations

| Area | Limitation |
|---|---|
| Authentication | Demo accounts need `ALLOW_DEV_AUTH` (§4.3); MFA is opt-in per user and required roles are only flagged (§4.4); trusted devices, SMS and e-mail codes are not implemented |
| CBS | Finacle adapter is a mock until the sandbox is reachable; the CBS sync endpoint always uses it |
| Web UI | Compliance, Analytics, Maintenance and Admin pages show sample data; no screens yet for reports, saved reports, schedules, regulatory calendar, reminders, stakeholder contacts, approval queue, or MFA enrolment (all available through the API at `/docs`) |
| Approvals | Approving does not apply the change |
| Loan sync scheduler | Runs, but only the `BANK_API` source exists; `FINACLE_CBS` is not implemented; never run against a real database or bank endpoint |
| Retention | Period unconfirmed; purge manual |
| Security | No VAPT yet; no database-level row security; Python dependencies are not pinned |
| Data | `finacle_account_id` is stored in plain text although described as encrypted; masked in API responses |
| Reports | No PowerPoint output; no XML / HDF import |
| Verification | Migrations `012`–`018` and the database-backed tests have run against the development database only; production and a staging copy of real data have not been migrated |
