# Phase 3: Authentication, Security & Enhancement

**Start Date:** 2026-09-23  
**Duration:** 2 Weeks (10 calendar days per 1-Month Build Plan)  
**Primary Deliverables:** Active Directory Auth, Row-Level Security, File Export, Scheduled Reports  
**Completion Target:** 2026-10-06

---

## Phase 2 → Phase 3 Handoff

**Phase 2 Delivered:**
- ✅ Core CRUD endpoints (projects, loan accounts)
- ✅ CBS adapter with circuit breaker
- ✅ Document vault with versioning
- ✅ Bulk import with validation
- ✅ PowerBI reporting foundation (JSON export)
- ✅ Standard response envelope (data/meta/audit)
- ✅ 5,570+ lines of production code
- ✅ All Phase 2 acceptance criteria met

**Known Limitations (from Phase 2):**
- ❌ No Active Directory authentication (using X-User-ID header)
- ❌ No row-level security (all users see all projects)
- ❌ No file download endpoints (JSON only)
- ❌ No scheduled exports
- ❌ No rate limiting enforcement
- ❌ No PDF reports

**Phase 3 Roadmap:** Address all limitations above

---

## Phase 3 Scope

### Task 1: Active Directory Integration (2-3 days)

**Goal:** Replace dev-mode header auth with production LDAP/AD authentication.

**Scope:**
- LDAP authentication provider (ldap3 library)
- User role mapping (admin, maker, approver, auditor)
- Token validation via AD domain
- Session management (FastAPI security)
- Role-based endpoint access control
- Audit log with AD user context

**Key Files to Create/Update:**
- `backend/app/security/ldap_provider.py` (new)
- `backend/app/security/auth_middleware.py` (updated)
- `backend/app/models/auth.py` (new, User + Role models)
- `backend/app/config.py` (AD configuration)
- `tests/integration/test_ldap_auth.py` (new)

**Feature Matrix:**
- Login: Username + password → AD validation → JWT token
- Roles: Query AD groups (SBL_HPMS_ADMIN, SBL_HPMS_MAKER, etc.)
- Fallback: LocalDevAuthProvider for dev/test
- MFA: Deferred to Phase 4 (LDAP TLS only)

**Integration:**
- All endpoints protected by @require_auth decorator
- User context passed to services (audit trail)
- Permission checks on sensitive operations (delete, approve)

**RFP Alignment:** TECH B.3 (Authentication layer)

---

### Task 2: Row-Level Security (2-3 days)

**Goal:** Implement user-scoped data visibility (users see only authorized projects).

**Scope:**
- Row-level security (RLS) framework
- Project ownership model (owner ≠ creator)
- Consortium membership checking
- Admin override capability
- Approver role sees own approval queue
- Auditor role sees all data
- Cascading security to loan accounts + documents

**Key Files to Create/Update:**
- `backend/app/security/rls_manager.py` (new)
- `backend/app/models/auth.py` (add user ↔ project relations)
- Updated all GET endpoints (apply RLS filters)
- `backend/app/services/rls_service.py` (new)
- `tests/integration/test_row_level_security.py` (new)

**Security Model:**
```
User Role → Project Visibility
├─ Admin → All projects
├─ Maker → Projects I created + my consortium projects
├─ Approver → Projects with pending approvals for me
├─ Auditor → All projects (read-only)
└─ Guest → No projects
```

**Implementation:**
- Add user_id + project_id to project_owners junction table
- Filter all queries: WHERE project_id IN (SELECT id FROM projects WHERE ... OR owner_id = user_id)
- Batch query optimization (eager load ownership)

**Audit Trail:**
- Log RLS denials (user attempted access to unauthorized project)
- Track who can approve what

**RFP Alignment:** TECH D.1 (Data isolation)

---

### Task 3: File Export Endpoints (1-2 days)

**Goal:** Add CSV/Excel download capability with S3 presigned URLs.

**Scope:**
- Generate CSV/Excel files from report data
- Upload to S3 with 1-hour presigned URL
- Endpoint returns download URL + metadata
- File cleanup (delete after 7 days)
- Progress tracking for large exports

**Key Files to Create/Update:**
- `backend/app/services/export_service.py` (new)
- `backend/app/api/routes_reports.py` (enhanced)
- `backend/app/config.py` (S3 configuration)
- `backend/app/storage/s3_storage.py` (new)
- `tests/integration/test_file_export.py` (new)

**Endpoints:**
- `POST /api/v1/reports/export` — returns download_url + file_id
- `GET /api/v1/files/{file_id}/download` — redirect to presigned URL
- `DELETE /api/v1/files/{file_id}` — cleanup (admin only)

**File Formats:**
- **CSV:** RFC 4180 compliant (UTF-8 with BOM)
- **Excel:** .xlsx with multiple sheets (one per report type)
- **PDF:** Phase 4 (requires template engine)

**S3 Integration:**
- Bucket: `hpms-exports-{env}` (dev/staging/prod)
- Expiry: 1 hour (user downloads or expires)
- Versioning: Enabled for audit trail
- Encryption: AES-256 at rest

**Features:**
- Progress bar (for exports > 10MB)
- Email delivery option (Phase 4)
- Archive to cold storage after 30 days

**RFP Alignment:** FUNC F.11 (PowerBI integration Phase 3)

---

### Task 4: Scheduled Exports (1-2 days)

**Goal:** Automated daily/weekly export job with optional email delivery.

**Scope:**
- Cron-based scheduler (APScheduler)
- Export jobs table (tracks status, last run)
- Email notification (via SMTP)
- Retry logic for failed exports
- Audit logging per export job

**Key Files to Create/Update:**
- `backend/app/scheduler/export_scheduler.py` (new)
- `backend/app/models/scheduler.py` (new, ExportJob model)
- `backend/app/services/email_service.py` (new)
- `alembic/versions/005_add_scheduler.py` (new migration)
- `backend/app/config.py` (scheduler configuration)

**Features:**
- Configurable schedule (daily 6am, weekly Monday)
- Report type selection (portfolio, covenant, capex)
- Recipient email list
- Subject/body templates
- Retry on failure (exponential backoff)
- Dry-run capability (test without sending)

**Database Schema:**
- `export_jobs` (id, report_id, schedule, recipients, status, last_run_at)
- `export_job_runs` (id, job_id, status, file_url, error_message, timestamp)

**Example Job:**
```json
{
  "report_id": "portfolio",
  "schedule": "0 6 * * *",  // daily at 6am
  "recipients": ["finance@sbl.local", "portfolio@sbl.local"],
  "subject": "Daily Portfolio Report",
  "enabled": true
}
```

**RFP Alignment:** FUNC F.11 (PowerBI scheduled exports)

---

### Task 5: Rate Limiting & Performance (1 day)

**Goal:** Enforce rate limits and optimize query performance.

**Scope:**
- Per-user rate limiting (10 req/min default)
- Token bucket algorithm
- HTTP 429 Too Many Requests responses
- Performance optimization (indexing, caching)
- Query result caching (5-minute TTL)
- Load testing (1000 concurrent users)

**Key Files to Create/Update:**
- `backend/app/middleware/rate_limit.py` (new)
- `backend/app/cache/cache_manager.py` (new)
- `backend/app/config.py` (rate limit configuration)
- `tests/performance/test_load.py` (new)

**Rate Limit Configuration:**
```python
RATE_LIMITS = {
    "default": "10/minute",
    "premium_user": "50/minute",
    "admin": "unlimited",
    "read_operation": "100/minute",
    "write_operation": "10/minute",
}
```

**Caching Strategy:**
- Portfolio list (5min): varies by filters
- Project detail (10min): by project_id
- Covenant rates (15min): slow query
- Capex summary (30min): aggregation query

**Query Optimization:**
- Add composite indexes on common filters (province, status)
- Eager load relationships (consortiums, loan_accounts)
- Pagination on large result sets (default 100)
- Query explain analysis for bottlenecks

**Performance Targets:**
- Portfolio list: < 200ms
- Project detail: < 100ms
- Covenant report: < 500ms
- Capex report: < 800ms

**Load Testing:**
- Simulate 1000 concurrent users
- Measure response times and error rates
- Identify bottlenecks

**RFP Alignment:** TECH C.1 (Performance under load)

---

### Task 6: Enhanced Testing & Documentation (1 day)

**Goal:** Complete test coverage and production runbook.

**Scope:**
- Integration tests for all new features
- End-to-end workflow tests (create → approve → disburse)
- Security tests (RLS bypass attempts, auth failures)
- Performance benchmarks
- Production deployment guide
- Runbook for common operations

**Key Files to Create/Update:**
- `tests/integration/test_e2e_workflow.py` (new)
- `tests/security/test_rls_bypass.py` (new)
- `tests/performance/test_query_perf.py` (new)
- `docs/DEPLOYMENT.md` (new)
- `docs/OPERATIONS-RUNBOOK.md` (new)
- `docs/TROUBLESHOOTING.md` (new)

**Test Coverage Targets:**
- Authentication: 100% (login success/failure, token expiry)
- RLS: 100% (owner sees own, admin sees all, unauthorized denied)
- File export: 95% (CSV, Excel, S3 upload, cleanup)
- Scheduled exports: 90% (run, retry, email delivery)
- Rate limiting: 95% (enforce, fallback, admin override)

**Documentation:**
- Deployment checklist (prereqs, config, migration)
- Operational procedures (add user, reset password, troubleshoot)
- Troubleshooting guide (common issues + solutions)
- Performance tuning (indexes, caching, optimization)

**RFP Alignment:** TECH C.4 (Testing & QA)

---

## Implementation Priority

**Days 1-2:** Task 1 (AD Authentication)  
**Days 3-4:** Task 2 (Row-Level Security)  
**Days 5-6:** Tasks 3 & 4 (File Export + Scheduling)  
**Days 7-8:** Task 5 (Rate Limiting & Performance)  
**Days 9-10:** Task 6 (Testing & Documentation)

---

## Acceptance Criteria

✅ All endpoints require valid AD authentication  
✅ Users see only authorized projects (verified via RLS tests)  
✅ File exports work (CSV, Excel) with S3 presigned URLs  
✅ Scheduled exports run on schedule with email delivery  
✅ Rate limiting enforces per-user quotas  
✅ All queries perform < 1 second at scale  
✅ 95%+ test coverage on new code  
✅ Production runbook complete and validated  
✅ Zero security issues (OWASP + RLS bypass tests)  
✅ Load test passes 1000 concurrent users

---

## Architecture Updates

### Authentication Flow (Phase 3)
```
User Login (LDAP)
    ↓
Validate AD domain
    ↓
Query AD groups (roles)
    ↓
Issue JWT token (FastAPI security)
    ↓
Token validates all requests
    ↓
User context in audit trail
```

### Row-Level Security Layers
```
User Request
    ↓
Auth Middleware (valid token?)
    ↓
Authorization Middleware (has permission?)
    ↓
RLS Filter (see own data only)
    ↓
Query executes with WHERE filters
    ↓
Response returned (only authorized rows)
```

### File Export Pipeline
```
Report Export Request
    ↓
Generate CSV/Excel (memory or temp file)
    ↓
Upload to S3 bucket
    ↓
Generate presigned URL (1-hour expiry)
    ↓
Return URL to client
    ↓
[Client downloads] → [S3 serves file] → [Cleanup after expiry]
```

---

## Dependency Check

**New Libraries Required:**
- `ldap3` — LDAP client for Active Directory
- `python-jose[cryptography]` — JWT token generation
- `passlib[bcrypt]` — Password hashing (fallback auth)
- `boto3` — AWS S3 client
- `apscheduler` — Cron-based job scheduling
- `aiosmtplib` — Async SMTP for email
- `slowapi` — Rate limiting (already installed Phase 2)
- `openpyxl` — Excel file generation
- `pandas` — CSV writing (already have)

**External Services:**
- Active Directory server (SBL domain)
- AWS S3 bucket (or MinIO for dev)
- SMTP server for email

**Infrastructure:**
- S3 bucket with versioning + encryption
- AD user account for service account (HPMS_SERVICE)

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| AD unavailable in dev | LocalDevAuthProvider fallback mode | Dev |
| RLS performance overhead | Composite indexes + caching | Dev |
| S3 cost (many exports) | 1-hour expiry + cleanup policy | DevOps |
| Email delivery failure | Retry logic + dead letter queue | Dev |
| Rate limiting false positives | Whitelist + admin override | Dev |
| Load test failure | Identify bottleneck + optimize | Dev |

---

## Phase 3 Kickoff Checklist

- [ ] Confirm AD credentials + domain name
- [ ] Provision AWS S3 bucket (or MinIO)
- [ ] Install new dependencies (ldap3, boto3, apscheduler)
- [ ] Design JWT token schema
- [ ] Create project ownership schema (migration)
- [ ] Set up CI/CD for automated testing
- [ ] Schedule UAT with Credit Administration
- [ ] Prepare deployment runbook

---

## Success Criteria (End of Phase 3)

1. ✅ Users authenticate via AD (no header auth)
2. ✅ Each user sees only authorized projects
3. ✅ PowerBI can download reports as CSV/Excel files
4. ✅ Daily/weekly exports run automatically
5. ✅ Rate limiting prevents API abuse
6. ✅ Performance under load (1000 concurrent users)
7. ✅ All tests passing (95%+ coverage)
8. ✅ Production ready for SBL deployment

---

## Next Phase: Phase 4 (Optional, Future)

- Multi-factor authentication (MFA)
- PDF report generation with branding
- Mobile app API (GraphQL or REST subset)
- Real-time WebSocket updates
- Multi-language UI (English/Nepali)
- Covenant compliance engine
- Predictive analytics (disbursement forecasting)

---

**Phase 3 Owner:** Full-stack development team  
**Phase 3 Duration:** 2 weeks  
**Phase 3 Ready Date:** 2026-10-06  
**Stakeholder:** SBL IT Operations, InfoSec, Finance

