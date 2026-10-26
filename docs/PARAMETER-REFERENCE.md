# HPMS Parameter Reference

Generated from the code by `python -m backend.scripts.generate_parameter_reference`; do not edit by hand.
Every value below is read by the code that uses it. The system study (`SYSTEM-STUDY.md`) explains how the
parts fit together.

## 1. Settings an administrator changes in the application

On the Settings page. A change is a change request (type `SETTING`): proposed by an administrator, final
approval by a different administrator unless the approval rule is changed. Stored only when different from
the default (`app_parameters`).

| Setting | Area | Default | Allowed | Controls |
|---|---|---|---|---|
| `alert_warning_days` | Alerts | 90 days | 7 to 365 days | Permits, licences, PPAs and insurance policies are flagged this many days before they expire. |
| `alert_critical_days` | Alerts | 30 days | 1 to 180 days | Within this many days of expiry an alert is marked critical. Must be shorter than the warning lead time. |
| `default_dscr_min` | Covenant defaults | 1.25 x | 0.5 to 5 x | Used for a facility with no sanction terms of its own. |
| `default_icr_min` | Covenant defaults | 2.0 x | 0.5 to 10 x | Used for a facility with no sanction terms of its own. |
| `default_ltv_max` | Covenant defaults | 70 % | 10 to 100 % | Used for a facility with no sanction terms of its own. |
| `default_warning_margin_pct` | Covenant defaults | 8 % | 0 to 50 % | A ratio within this share of its threshold is reported as a warning rather than compliant. |

## 2. Approval rules

Who decides each type of change request, on the Settings page. A rule change is itself a change request
(`APPROVAL_RULE`). A request keeps the rule in force when it was raised. Whatever the rule, nobody checks
their own change and the two checks of a two-step rule come from different people.

| Change type | What it changes | Default checks | Recommended by | Final approval by |
|---|---|---|---|---|
| `PROJECT` | Project details | 2 | approver, admin | approver, admin |
| `LOAN` | Loan terms | 2 | approver, admin | approver, admin |
| `FINANCIAL_PERIOD` | Quarterly covenant figures | 2 | approver, admin | approver, admin |
| `COVENANT_TERMS` | Sanction terms | 2 | approver, admin | admin |
| `BUDGET_LINE` | Budget and cost lines | 2 | approver, admin | approver, admin |
| `LOAN_PROJECTION` | Loan projection | 2 | approver, admin | approver, admin |
| `SETTING` | Application settings | 2 | approver, admin | admin |
| `APPROVAL_RULE` | Approval rules | 2 | approver, admin | admin |
| `EXCHANGE_RATE` | Exchange rates | 2 | approver, admin | approver, admin |

## 3. Who may propose each change

| Change type | Proposed by | Scope |
|---|---|---|
| `PROJECT`, `LOAN` | maker, admin (on projects they may update) | a project or loan |
| `FINANCIAL_PERIOD` | maker, admin | a project |
| `COVENANT_TERMS` | admin | a project |
| `APPROVAL_RULE` | admin | bank-wide |
| `BUDGET_LINE` | admin, maker | a project the proposer may update |
| `EXCHANGE_RATE` | admin, maker | bank-wide |
| `LOAN_PROJECTION` | admin, maker | a project the proposer may update |
| `SETTING` | admin | bank-wide |

## 4. Field-level rights

### Write (fields a change request may name)

| Change type | Field | Who may propose it | Why |
|---|---|---|---|
| `LOAN` | `id` | no one (owned by another system) | audit/system column |
| `LOAN` | `created_at` | no one (owned by another system) | audit/system column |
| `LOAN` | `created_by` | no one (owned by another system) | audit/system column |
| `LOAN` | `updated_by` | no one (owned by another system) | audit/system column |
| `LOAN` | `state_hash` | no one (owned by another system) | audit/system column |
| `LOAN` | `prev_hash` | no one (owned by another system) | audit/system column |
| `LOAN` | `finacle_account_id` | no one (owned by another system) | owned by the core banking system; changes arrive through CBS sync |
| `LOAN` | `outstanding_principal` | no one (owned by another system) | owned by the core banking system; changes arrive through CBS sync |
| `LOAN` | `outstanding_interest` | no one (owned by another system) | owned by the core banking system; changes arrive through CBS sync |
| `LOAN` | `overdue_principal` | no one (owned by another system) | owned by the core banking system; changes arrive through CBS sync |
| `LOAN` | `overdue_interest` | no one (owned by another system) | owned by the core banking system; changes arrive through CBS sync |
| `LOAN` | `dscr` | no one (owned by another system) | calculated by the covenant engine |
| `LOAN` | `ltv` | no one (owned by another system) | calculated by the covenant engine |
| `LOAN` | `icr` | no one (owned by another system) | calculated by the covenant engine |
| `LOAN` | `sanctioned_amount` | admin, maker | financial term: maker or admin only |
| `LOAN` | `disbursed_amount` | admin, maker | financial term: maker or admin only |
| `LOAN` | `interest_rate_pct` | admin, maker | financial term: maker or admin only |
| `LOAN` | `maturity_ad` | admin, maker | financial term: maker or admin only |
| `LOAN` | `maturity_bs` | admin, maker | financial term: maker or admin only |
| `PROJECT` | `id` | no one (owned by another system) | audit/system column |
| `PROJECT` | `created_at` | no one (owned by another system) | audit/system column |
| `PROJECT` | `created_by` | no one (owned by another system) | audit/system column |
| `PROJECT` | `updated_by` | no one (owned by another system) | audit/system column |
| `PROJECT` | `state_hash` | no one (owned by another system) | audit/system column |
| `PROJECT` | `prev_hash` | no one (owned by another system) | audit/system column |
| `PROJECT` | `project_code` | admin, maker | project master data: maker or admin only |
| `PROJECT` | `installed_capacity_mw` | admin, maker | project master data: maker or admin only |
| `PROJECT` | `pipeline_status` | admin, maker | project master data: maker or admin only |
| `PROJECT` | `project_stage` | admin, maker | project master data: maker or admin only |
| `PROJECT` | `is_bank_financed` | admin, maker | project master data: maker or admin only |
| `FINANCIAL_PERIOD` | `id` | no one (owned by another system) | audit/system column |
| `FINANCIAL_PERIOD` | `created_at` | no one (owned by another system) | audit/system column |
| `FINANCIAL_PERIOD` | `created_by` | no one (owned by another system) | audit/system column |
| `FINANCIAL_PERIOD` | `updated_by` | no one (owned by another system) | audit/system column |
| `FINANCIAL_PERIOD` | `state_hash` | no one (owned by another system) | audit/system column |
| `FINANCIAL_PERIOD` | `prev_hash` | no one (owned by another system) | audit/system column |
| `FINANCIAL_PERIOD` | `quarter_ad` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `revenue_npr` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `operating_expenses_npr` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `royalty_npr` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `tax_paid_npr` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `depreciation_npr` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `security_value_npr` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `is_audited` | admin, maker | reported financials: maker or admin only |
| `FINANCIAL_PERIOD` | `source_reference` | admin, maker | reported financials: maker or admin only |
| `COVENANT_TERMS` | `id` | no one (owned by another system) | audit/system column |
| `COVENANT_TERMS` | `created_at` | no one (owned by another system) | audit/system column |
| `COVENANT_TERMS` | `created_by` | no one (owned by another system) | audit/system column |
| `COVENANT_TERMS` | `updated_by` | no one (owned by another system) | audit/system column |
| `COVENANT_TERMS` | `state_hash` | no one (owned by another system) | audit/system column |
| `COVENANT_TERMS` | `prev_hash` | no one (owned by another system) | audit/system column |
| `COVENANT_TERMS` | `dscr_min` | admin | sanction terms: admin only |
| `COVENANT_TERMS` | `ltv_max` | admin | sanction terms: admin only |
| `COVENANT_TERMS` | `icr_min` | admin | sanction terms: admin only |
| `COVENANT_TERMS` | `warning_margin_pct` | admin | sanction terms: admin only |
| `COVENANT_TERMS` | `source_reference` | admin | sanction terms: admin only |

### Read (fields withheld from roles without the right)

A withheld field is `null` in every JSON response, and `X-Fields-Withheld` names it.

| Field | Readable by |
|---|---|
| `actual_amount` | admin, approver, auditor, maker |
| `budgeted_amount` | admin, approver, auditor, maker |
| `closing_outstanding` | admin, approver, auditor, maker |
| `current_rate_pct` | admin, approver, auditor, maker |
| `current_rate_percent` | admin, approver, auditor, maker |
| `debt_service_npr` | admin, approver, auditor, maker |
| `depreciation_npr` | admin, approver, auditor, maker |
| `disbursed_amount` | admin, approver, auditor, maker |
| `disbursed_amount_npr` | admin, approver, auditor, maker |
| `dscr` | admin, approver, auditor, maker |
| `icr` | admin, approver, auditor, maker |
| `interest_npr` | admin, approver, auditor, maker |
| `interest_rate_pct` | admin, approver, auditor, maker |
| `ltv` | admin, approver, auditor, maker |
| `opening_outstanding` | admin, approver, auditor, maker |
| `operating_expenses_npr` | admin, approver, auditor, maker |
| `outstanding_interest` | admin, approver, auditor, maker |
| `outstanding_principal` | admin, approver, auditor, maker |
| `outstanding_principal_npr` | admin, approver, auditor, maker |
| `overdue_interest` | admin, approver, auditor, maker |
| `overdue_principal` | admin, approver, auditor, maker |
| `projected_disbursement` | admin, approver, auditor, maker |
| `projected_outstanding` | admin, approver, auditor, maker |
| `projected_repayment` | admin, approver, auditor, maker |
| `revenue_npr` | admin, approver, auditor, maker |
| `royalty_npr` | admin, approver, auditor, maker |
| `sanctioned_amount` | admin, approver, auditor, maker |
| `sanctioned_amount_npr` | admin, approver, auditor, maker |
| `security_value_npr` | admin, approver, auditor, maker |
| `tax_paid_npr` | admin, approver, auditor, maker |
| `total_disbursement` | admin, approver, auditor, maker |
| `total_repayment` | admin, approver, auditor, maker |
| `total_sanctioned_amount` | admin, approver, auditor, maker |
| `variance_amount` | admin, approver, auditor, maker |
| `variance_pct` | admin, approver, auditor, maker |

## 5. Environment settings read by the application

Set on the server, outside the application; a change needs a restart. Secrets are named, never shown.

| Setting | Area | Default | Read by | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | Database | (secret) | `database`, `seed_projects`, `seed_synthetic_loans` |  |
| `SECRET_KEY` | Sign-in tokens | (secret) | `secret_box`, `startup_checks` |  |
| `ALGORITHM` | Sign-in tokens | `HS256` | `auth_middleware` |  |
| `JWT_SECRET_KEY` | Sign-in tokens | (secret) | `auth_middleware`, `startup_checks` |  |
| `JWT_EXPIRY_MINUTES` | Sign-in tokens | `480` | `auth_middleware` | 8 hours |
| `USE_LDAP` | Directory sign-in | `false` | `routes_auth`, `auth_selection`, `demo_reset` |  |
| `ALLOW_DEV_AUTH` | Demo | `(unset)` | `auth_selection`, `demo_reset` | Built-in demo accounts (public passwords). Unset = allowed only while DEBUG=true; see security/auth_selection.py |
| `DEMO_RESET_ENABLED` | Demo | `false` | `demo_reset` | Admin button that replaces all project data with the synthetic demo portfolio. Hosted demo only; also needs the demo accounts allowed, and refuses a database holding bank data (services/demo_reset.py) |
| `DB_ROW_SECURITY` | Data security | `false` | `auth_middleware`, `db_row_security` | PostgreSQL row policies on project data, behind the application's own checks (security/db_row_security.py, # migration 033). Needs the application to connect as a non-superuser, which row security never applies to. |
| `LOGIN_MAX_FAILURES` | Other | `5` | `signin_guard` | Interactive API documentation (/docs, /redoc, /openapi.json). Off in production unless asked for: it maps every endpoint for an attacker. Unset = on while DEBUG is on. Sign-in protection (services/signin_guard.py): failed attempts per username, then per source address, within the window; over the limit, sign-in is refused for the rest of the window. |
| `LOGIN_IP_MAX_FAILURES` | Other | `20` | `signin_guard` |  |
| `LOGIN_LOCKOUT_MINUTES` | Other | `15` | `signin_guard` |  |
| `LOGIN_LOCKOUT_SCOPE` | Other | `user` | `signin_guard` | user = a username is locked wherever the failures came from (inside the bank); user_ip = only from the address that failed, so a public site's accounts cannot be locked by strangers (the hosted demo) |
| `API_DOCS_ENABLED` | Other | `true` | `main` |  |
| `AD_SERVER` | Directory sign-in | `ldap.sbl.local` | `auth_selection` |  |
| `AD_DOMAIN` | Directory sign-in | `sbl.local` | `auth_selection` |  |
| `AD_BASE_DN` | Directory sign-in | `dc=sbl,dc=local` | `auth_selection` |  |
| `AD_SERVICE_ACCOUNT_USERNAME` | Directory sign-in | (empty) | `auth_selection` |  |
| `AD_SERVICE_ACCOUNT_PASSWORD` | Directory sign-in | (secret) | `auth_selection` |  |
| `AD_GROUP_ROLE_MAP` | Directory sign-in | `SBL_HPMS_ADMIN=admin,SBL_HPMS_MAKER=maker,SBL_HPMS_APPROVER=approver,SBL_HPMS_AUDITOR=auditor` | `auth_selection`, `ldap_provider` | Directory group -> HPMS role, comma-separated group=role pairs (admin, maker, approver, auditor, guest). The default names are placeholders: set the bank's own groups. A wrong value stops the server at startup. |
| `MFA_REQUIRED_ROLES` | Multi-factor authentication | (empty) | `routes_auth` | Roles that should have MFA; users in them without it get `mfa_enrollment_required` at login (comma separated) |
| `MFA_ENCRYPTION_KEY` | Multi-factor authentication | (secret) | `secret_box`, `startup_checks` | Encrypts TOTP seeds at rest (security/secret_box.py). Falls back to SECRET_KEY when unset. |
| `MFA_ENCRYPTION_KEY_OLD` | Multi-factor authentication | (secret) | `secret_box` | previous key(s), comma separated |
| `DEBUG` | Application | `true` | `routes_ws`, `database`, `main` … |  |
| `ADMIN_IP_ALLOWLIST` | Network access | (empty) | `main` | Network access control (RFP A.7). Empty allow-list = disabled. comma-separated IPs / CIDRs |
| `ADMIN_PROTECTED_PREFIXES` | Network access | `/api/v1/admin,/api/v1/cbs,/api/v1/reports/schedules,/api/v1/regulatory/requirements,/api/v1/stakeholders` | `main` |  |
| `TRUSTED_PROXY_HOPS` | Network access | `0` | `routes_admin`, `routes_auth`, `routes_cbs_sync` … | proxies in front of the app (X-Forwarded-For) |
| `CBS_ADAPTER` | Core banking | `mock` | `routes_cbs_sync`, `routes_loans`, `finacle_adapter` … | Core banking integration (integration/cbs_adapters.py, docs/CBS-INTEGRATION.md) mock = built-in sample record, never saved; stub = refuse; file = end-of-day extract; http = API inquiry |
| `CBS_MAPPING_FILE` | Core banking | (empty) | `finacle_adapter` | JSON: where each field is in the bank's data |
| `CBS_EXTRACT_DIR` | Core banking | (empty) | `finacle_adapter` | file adapter: where the bank drops its extract |
| `CBS_EXTRACT_MAX_AGE_HOURS` | Core banking | `0` | `finacle_adapter` | 0 = any age accepted |
| `CBS_HTTP_BASE_URL` | Core banking | (empty) | `cbs_adapters`, `finacle_adapter` |  |
| `CBS_HTTP_AUTH_HEADER` | Core banking | (empty) | `finacle_adapter` | e.g. Authorization or X-API-Key |
| `CBS_HTTP_AUTH_VALUE` | Core banking | (secret) | `finacle_adapter` | secret; set in the environment only |
| `CBS_HTTP_TIMEOUT_SECONDS` | Core banking | `15` | `finacle_adapter` |  |
| `CBS_HTTP_VERIFY_TLS` | Core banking | `true` | `cbs_adapters`, `finacle_adapter` |  |
| `CBS_HTTP_CLIENT_CERT` | Core banking | (empty) | `finacle_adapter` | mutual TLS, if the bank requires it |
| `CBS_HTTP_CLIENT_KEY` | Core banking | (empty) | `finacle_adapter` |  |
| `CBS_MAX_CALLS_PER_DAY` | Core banking | `1000` | `finacle_adapter` |  |
| `DOCUMENT_STORAGE` | Documents | `database` | `routes_documents`, `document`, `seed_demo_documents` | Project documents (services/document_service.py). database = in PostgreSQL (survives redeploys on # hosting without a disk); local = DOCUMENT_STORAGE_PATH on disk. Files are encrypted with the MFA key. |
| `DOCUMENT_STORAGE_PATH` | Documents | `/var/hpms/documents` | `routes_documents`, `seed_demo_documents` |  |
| `DOCUMENT_MAX_MB` | Documents | `10` | `routes_documents` |  |
| `DOCUMENT_ENCRYPTION` | Documents | `true` | `routes_documents`, `seed_demo_documents` |  |
| `AUDIT_RETENTION_YEARS` | Audit log | `7` | `routes_audit_admin`, `document` | Not a confirmed NRB figure: set from the bank's records-retention policy. Purging is manual and off by default. |
| `AUDIT_PURGE_ENABLED` | Audit log | `false` | `routes_audit_admin` |  |
| `STORAGE_BACKEND` | Export files | `s3` | `routes_reports` | s3, minio, local |
| `S3_BUCKET_NAME` | Export files | `hpms-exports-dev` | `routes_reports` |  |
| `S3_REGION` | Export files | `us-east-1` | `routes_reports` |  |
| `S3_ACCESS_KEY_ID` | Export files | (secret) | `routes_reports` |  |
| `S3_SECRET_ACCESS_KEY` | Export files | (secret) | `routes_reports` |  |
| `PRESIGNED_URL_EXPIRY_SECONDS` | Export files | `3600` | `routes_reports` | 1 hour |
| `REDIS_ENABLED` | Live notifications | `false` | `redis_service` |  |
| `REDIS_URL` | Live notifications | (secret) | `redis_service` |  |

## 6. Environment settings defined but read by nothing

These appear in `backend/app/config.py` but no code reads them, so setting them has **no effect**.
They are candidates for removal or for being wired up.

| Setting | Area | Default |
|---|---|---|
| `JWT_ALGORITHM` | Sign-in tokens | `HS256` |
| `LOG_LEVEL` | Application | `INFO` |
| `S3_ENDPOINT_URL` | Export files | (empty) |
| `EXPORT_FILE_EXPIRY_HOURS` | Export files | `24` |
| `MAX_EXPORT_RECORDS` | Export files | `100000` |
| `RATE_LIMIT_ENABLED` | Rate limiting | `true` |
| `RATE_LIMIT_DEFAULT_QUOTA` | Rate limiting | `10` |
| `RATE_LIMIT_PREMIUM_QUOTA` | Rate limiting | `50` |
| `RATE_LIMIT_ADMIN_QUOTA` | Rate limiting | `unlimited` |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limiting | `60` |
| `CACHE_ENABLED` | Caching | `true` |
| `CACHE_MAX_SIZE` | Caching | `1000` |
| `CACHE_DEFAULT_TTL_SECONDS` | Caching | `300` |
| `CACHE_PROJECT_LIST_TTL` | Caching | `300` |
| `CACHE_PROJECT_DETAIL_TTL` | Caching | `600` |
| `CACHE_REPORT_TTL` | Caching | `900` |
| `PDF_ENABLED` | PDF reports | `true` |
| `PDF_FONT` | PDF reports | `Helvetica` |
| `PDF_PAGESIZE` | PDF reports | `letter` |
| `PDF_MARGIN_TOP` | PDF reports | `72` |
| `PDF_MARGIN_BOTTOM` | PDF reports | `72` |
| `PDF_MARGIN_LEFT` | PDF reports | `54` |
| `PDF_MARGIN_RIGHT` | PDF reports | `54` |
| `PDF_COLOR_PRIMARY` | PDF reports | `#1F4788` |
| `PDF_COLOR_SECONDARY` | PDF reports | `#2E7D32` |
| `PDF_COLOR_ACCENT` | PDF reports | `#F57C00` |
| `PDF_WATERMARK_ENABLED` | PDF reports | `false` |
| `PDF_WATERMARK_TEXT` | PDF reports | `CONFIDENTIAL` |
| `PDF_WATERMARK_OPACITY` | PDF reports | `0.3` |
| `PDF_WATERMARK_ANGLE` | PDF reports | `45` |
| `PDF_ENCRYPTION_ENABLED` | PDF reports | `false` |
| `PDF_ENCRYPTION_ALGORITHM` | PDF reports | `AES128` |
| `PDF_ENCRYPTION_DEFAULT_PASSWORD` | PDF reports | (secret) |
| `PDF_MAX_FILE_SIZE_MB` | PDF reports | `50` |
| `WEBSOCKET_ENABLED` | Live notifications | `true` |
| `WEBSOCKET_HEARTBEAT_INTERVAL` | Live notifications | `30` |
| `WEBSOCKET_HEARTBEAT_TIMEOUT` | Live notifications | `60` |
| `WEBSOCKET_MAX_CONNECTIONS_PER_USER` | Live notifications | `5` |
| `WEBSOCKET_MESSAGE_QUEUE_SIZE` | Live notifications | `1000` |
| `WEBSOCKET_RECONNECT_TIMEOUT` | Live notifications | `300` |
