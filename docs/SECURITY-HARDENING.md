# HPMS — Security Hardening Record (Phase 11.4)

Date: 2026-10-02 · Scope: backend API, frontend headers, dependencies
RFP: A.1, A.2, A.5, A.6, A.7, D.5, E.1, E.4

**This is an internal self-assessment, not a VAPT.** RFP A.2 (third-party code review / VAPT before
go-live) is still open: the findings below were found by reading code and writing tests, and no
penetration test, DAST scan or dynamic fuzzing was performed.

## What changed

| Area | Change | Where |
|---|---|---|
| Response headers | Strict CSP (`default-src 'none'`) on API responses, relaxed CSP for `/docs` only, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` on `/api/` | `middleware/security.py` |
| SPA headers | CSP (inline theme script allowed by hash), nosniff, frame-deny, HSTS on the Vercel frontend. A test fails if `index.html`'s inline script changes without updating the hash | `vercel.json`, `tests/security/test_network_hardening.py` |
| IP allow-list (A.7) | Admin, CBS, report-schedule, regulatory-requirement and stakeholder endpoints can be limited to listed networks. Off until `ADMIN_IP_ALLOWLIST` is set | `IPAllowlistMiddleware` |
| Row-level security | Covenant history and alert remediation endpoints had **no** project check (any user could read any project). CBS sync ignored the project (any loan id was syncable). Both now enforce RLS | `routes_compliance.py`, `routes_cbs_sync.py`, `cbs_sync_real_service.py` |
| Maker-checker (A.1, A.2, E.21) | `/mutations/*` was **not mounted** (404 in production). Once mounted it had no authorisation: anyone, including guests and the submitting maker, could approve; rejected/approved requests could be re-rejected. Now: role checks, nobody approves their own submission, two-step approval needs two different people, only open requests can be rejected, makers see only their own queue | `mutation_service.py`, `routes_mutations.py`, `main.py` |
| Field-level rights (A.1) | System-owned fields (CBS balances, calculated covenant metrics, audit columns) cannot be proposed by anyone; money terms only by maker/admin. Unlisted fields are unrestricted | `security/field_policy.py` |
| Audit log (E.1, E.3) | Approve/reject wrote blank `state_hash` / `prev_hash`, which broke the chain and violated `UNIQUE(state_hash)` on the second write. One chained writer (`append_audit_log`) now serialises appends with an advisory lock and hashes content plus predecessor. Source IP now comes from the request instead of a hard-coded `0.0.0.0`. Project create and update now write chained audit rows (before: only maker-checker actions did, so ordinary edits left no `audit_logs` trail) | `services/audit_chain.py` |
| Audit immutability | DB trigger blocks UPDATE, DELETE and TRUNCATE on `audit_logs`; only the retention purge may delete, through a transaction-local flag | migration `015` |
| Audit retention (E.4) | `GET /admin/audit/retention` previews, `POST /admin/audit/retention/purge` deletes the oldest contiguous prefix past the cutoff and writes a checkpoint so the chain still verifies; `GET /admin/audit/verify` walks the chain. Purge is manual and disabled by default | `routes_audit_admin.py` |
| Python 3.11 compatibility | `email_service.py` contained an f-string that is valid only on Python 3.12+; the Dockerfile uses 3.11, so the module could not be imported there. `analytics/risk.py` used `List` without importing it (NameError at import on 3.11). Both fixed; the whole backend now compiles under 3.11 | |
| Dependencies | Floors raised for packages with known advisories (see below) | `pyproject.toml` |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ADMIN_IP_ALLOWLIST` | empty (off) | Comma-separated IPs / CIDRs allowed to reach protected prefixes. A typo fails startup |
| `ADMIN_PROTECTED_PREFIXES` | admin, cbs, report schedules, regulatory requirements, stakeholders | Path prefixes the allow-list guards |
| `TRUSTED_PROXY_HOPS` | `0` | Proxies in front of the app. With N > 0 the Nth `X-Forwarded-For` entry from the right is used; entries to its left are client-controlled and ignored. **Set this correctly behind Render/Vercel/nginx or the allow-list sees the proxy's address** |
| `AUDIT_RETENTION_YEARS` | `7` | **Not a confirmed NRB requirement.** Research brief §1.1 is still unanswered; set from the bank's records-retention policy |
| `AUDIT_PURGE_ENABLED` | `false` | Must be `true` for the purge endpoint to act |

## OWASP Top 10 (2021) self-assessment

| # | Risk | Status | Evidence / gap |
|---|---|---|---|
| A01 | Broken access control | 🟡 | App-layer RLS on projects, loans, compliance, CBS, risk-domain, regulatory; maker-checker fixed this phase. **No database-level RLS** (audit row A.6): a bug in any route bypasses it. Several older routers (`routes_loans` schedule routes use `require_admin`; others rely on per-route checks) have not been re-reviewed line by line |
| A02 | Cryptographic failures | ❌ | JWT HS256 with a dev default `SECRET_KEY` / `JWT_SECRET_KEY` in `config.py`: **must be overridden in production**. Passwords for the dev auth provider are hard-coded demo values. `finacle_account_id` is described as pgcrypto-encrypted but is stored and compared in plain text; TOTP secrets and backup codes are stored unprotected (finding 5) |
| A03 | Injection | ✅ (static) | SQLAlchemy parameterised queries; report builder accepts only whitelisted source/column/sort names. Not fuzzed |
| A04 | Insecure design | 🟡 | Dual control, field policy and append-only audit added. Rate limiting is per-IP (slowapi) and not per-user |
| A05 | Security misconfiguration | 🟡 | CSP, nosniff, frame-deny, no-store added. `DEBUG` defaults to `true`; `TrustedHostMiddleware` and CORS lists are hard-coded and include a "TEMP DEMO" wildcard for `*.onrender.com` |
| A06 | Vulnerable components | 🟡 | `npm audit --omit=dev`: 0 vulnerabilities. `pip-audit`: 9 runtime packages with advisories at the versions installed here; floors raised and tests re-run (see below). Python deps remain unpinned (`>=`), so builds are not reproducible. `PyPDF2` is unmaintained |
| A07 | Identification and authentication failures | 🟡 | MFA and LDAP exist. Login throttling and lockout not verified. The dev provider with demo passwords is active on the hosted deployment (finding 4) |
| A08 | Software and data integrity failures | ✅ | Hash-chained, append-only audit log with verification; no unsigned deserialisation found |
| A09 | Logging and monitoring failures | 🟡 | Write audit is chained; read audit middleware is still a TODO stub that does not write `audit_log_reads` (only the export service does) |
| A10 | SSRF | ✅ (static) | The app makes outbound calls only to configured SMTP, S3 and CBS endpoints; no user-supplied URLs are fetched |

## Dependency scan (2026-10-02)

Runtime closure of `pyproject.toml`: 64 packages checked with `pip-audit` against the versions installed
in the development environment.

| Package | Installed | Advisories | Fixed in | Action |
|---|---|---|---|---|
| cryptography | 46.0.5 | 6 | 50.0.0 | floor `>=50.0.0` |
| urllib3 | 2.6.3 | 5 | 2.8.0 | floor `>=2.8.0` |
| pyasn1 | 0.6.2 | 4 | 0.6.4 | floor `>=0.6.4` |
| python-multipart | 0.0.27 | 3 | 0.0.31 | floor `>=0.0.31` |
| anyio | 4.13.0 | 2 | 4.14.2 | floor `>=4.14.2` |
| idna | 3.11 | 1 | 3.15 | floor `>=3.15` |
| lxml | 6.0.2 | 1 | 6.1.0 | floor `>=6.1.0` |
| ecdsa | 0.19.2 | 1 | none | transitive via `python-jose`; consider `PyJWT` |
| PyPDF2 | 3.0.1 | 1 | none (`pypdf` fixes it) | migrate `pdf_service` to `pypdf` |

After installing the new floors the full test suite passed (655 passed). Re-run `pip-audit` and
`npm audit` before every release; dev-only tools in the same environment were excluded.

## Findings made along the way (fixed unless marked otherwise)

1. The CBS router was never registered (`/api/v1/cbs/*` returned 404) and its sync always failed on a missing
   `request_id` argument (Phase 10; fixed in 11.4a/b).
2. The circuit breaker never counted async failures, so it could not open (Phase 10).
3. The covenant PDF route referenced `RLSService` without importing it, so it always returned 500.
4. (OPEN) **The hosted demo accepts published passwords.** With `USE_LDAP=false` (as in `render.yaml`) login uses
   `LocalDevAuthProvider`; `admin/admin123` and the other demo accounts work on the public Render deployment.
   No switch disables this outside development. Not changed here because it would lock out the demo; needs a
   decision (for example an `ALLOW_DEV_AUTH` flag that defaults off when `DEBUG=false`).
5. (OPEN) **MFA secrets are stored unprotected.** `user_mfa.totp_secret`, `backup_code.code` and `sms_verification.code`
   are plain columns; a database read lets an attacker generate valid codes.
6. (OPEN) **The loan-sync scheduler never starts in deployed builds.** `apscheduler` is not in `pyproject.toml`; `main.py`
   logs "APScheduler not installed" and continues.
7. **Loan sync schedule tables had no migration** (fixed: migration `016`; a test now fails if a model lacks one).
8. **Report schedules** were first built so an auditor could create them (mailing reports to arbitrary
   addresses); create/change/delete/run are now admin-only.
9. (OPEN) `routes/workflow.py` imports `app.*` modules that do not exist and is not mounted, so the audit row D.9
   ("workflow routes present") overstates the state of the workflow API. Not fixed here.

## Open items

- **A.2** Independent VAPT / code-security review before go-live.
- **A.6** Database-level RLS (policies) and pgcrypto for sensitive columns.
- **A.5** CBS mTLS is not evidenced in the adapter; real Finacle binding is pending the sandbox.
- **E.4** Retention period must be confirmed against NRB / BAFIA requirements (research brief §1.1).
- Legacy `audit_logs` rows written by the old approve/reject code have blank hashes; `GET /admin/audit/verify`
  will report the first one. They are history and have not been rewritten.
- Rotate `SECRET_KEY`, `JWT_SECRET_KEY` and disable the dev auth provider in production.
- DB-backed tests for the trigger, purge and chain (`tests/security/test_audit_chain_db.py`) are written but
  skipped here: the `hpms` role lacks `CREATEDB`, so migrations `013`–`015` have not been applied to a real database.
