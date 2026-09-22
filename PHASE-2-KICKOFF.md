# Phase 2: Finacle CBS Integration & Document Vault

**Start Date:** 2026-09-22  
**Duration:** Week 2 (7 calendar days per 1-Month Build Plan)  
**Primary Deliverables:** CBS integration middleware, document vault, bulk import  

---

## Phase 1 Summary

✅ **COMPLETE** — Phase 1 delivered:
- Database schema (19 tables, 5 ENUM types, 105+ indexes)
- Security baseline (CORS, rate limiting, security headers, field-level encryption ready)
- Audit trail infrastructure (immutable logs, SHA-256 chaining, compliance-grade retention)
- Domain models for projects, financial, consortium, governance, audit
- Effective-dating for mutable fields (capacity, rates, COD/RCOD)
- Data provenance tracking across all entities
- Alembic migrations (001 base + 002 effective-dating)
- FastAPI skeleton with health/ready checks and security middleware

**Compliance Lock-In:**
- 7-year audit retention (AUDIT_RETENTION_YEARS=7 in config)
- Dual-calendar support (Gregorian AD + Bikram Sambat BS)
- Four-eyes separation (Maker ≠ Recommender ≠ Approver)
- Read-only Finacle boundary (HPMS = system of accountability, not record)

---

## Phase 2 Scope

### Task 1: CBS Integrator Adapter (2-3 days)

**Goal:** Create isolated middleware layer between Finacle CBS and HPMS.

**Scope:**
- Read-only view adapter (`backend/app/integration/finacle_adapter.py`)
- Support three sync types: REALTIME_INQUIRY, EOD_BATCH, BOD_BATCH
- Implement circuit breaker + DLQ for failed syncs
- Encrypt CBS request/response payloads in `cbs_sync_log` table
- Map Finacle account fields → HPMS loan_accounts table
- Handle rate resets: create `loan_account_rate_history` entries on rate changes

**Key Files to Create/Update:**
- `backend/app/integration/finacle_adapter.py` (new)
- `backend/app/integration/finacle_schema.py` (field mapping)
- `backend/app/services/cbs_sync_service.py` (orchestration)
- `backend/app/models/financial.py` (update CBSSyncLog usage)

**Testing:**
- Mock CBS response scenarios (success, timeout, malformed, partial)
- Verify rate history chain on rate reset
- Confirm DLQ flag handling for retryable errors

**RFP Alignment:**
- FUNC C.15 — Finacle account reconciliation
- TECH C.2 — Read-only external integration
- TECH D.2 — Circuit breaker resilience

---

### Task 2: Document Vault & File Storage (2-3 days)

**Goal:** Secure document repository with encryption, audit trail, and lifecycle management.

**Scope:**
- Create `documents` and `document_versions` tables
- Implement file storage interface (backend: local SAN, Phase 3: S3)
- Field-level encryption for sensitive document content (pgcrypto)
- Document classification: PROJECT_CHARTER, PPA, ENVIRONMENTAL_CLEARANCE, LAND_DEED, etc.
- Link documents to projects via foreign key
- Full audit trail (who uploaded, when, format, hash)
- Document approval workflow (optional, per document type)

**Key Files to Create/Update:**
- `backend/app/models/document.py` (new)
- `backend/app/services/document_service.py` (new)
- `backend/app/storage/` (abstraction layer)
- `backend/app/storage/local_storage.py` (initial implementation)
- `alembic/versions/003_add_documents.py` (migration)

**Testing:**
- Upload/download cycle with encryption
- Version history chain
- Audit trail for access
- Large file handling (>100MB)

**RFP Alignment:**
- FUNC E.5 — Document management
- FUNC E.6 — Document versioning
- TECH A.6 — Field encryption
- TECH D.5 — Audit trail for access

---

### Task 3: Bulk Import (Excel/CSV) (1-2 days)

**Goal:** Allow bank staff to upload project and financial data in bulk.

**Scope:**
- Support Excel (.xlsx) and CSV formats
- Validate against RFP data rules (e.g., capacity must be > 0, dates must be valid)
- Batch processing with transaction rollback on error
- Import log with line-by-line error reporting
- Dual-calendar support: accept BS dates, store in both AD + BS
- Link imports to audit trail (who uploaded, when, what changed)

**Key Files to Create/Update:**
- `backend/app/services/bulk_import_service.py` (new)
- `backend/app/schemas/bulk_import_schema.py` (Pydantic models)
- `backend/app/services/validation_service.py` (enhanced)
- `alembic/versions/003_add_import_tracking.py` (migration addendum)

**Supported Formats:**
- Projects: project_code, name_en, name_np, province, capacity_mw, stage, pipeline_status
- Loan Accounts: project_code, finacle_account_id, facility_type, sanctioned_amount
- Consortium: project_code, lead_bank, facilities_limit, consortium_members (array)
- Budget: project_code, category, budgeted_amount, actual_amount

**Testing:**
- Valid uploads with 100+ rows
- Invalid date handling (BS/AD, malformed)
- Duplicate detection (project_code, account_id)
- Rollback on constraint violation
- Performance with large datasets

**RFP Alignment:**
- FUNC B.2 — Bulk data entry
- FUNC G.3 — Import/export templates
- TECH C.1 — Performance under load

---

### Task 4: REST API Layer (1-2 days)

**Goal:** Create endpoints for core workflows (read-only + data entry).

**Scope:**
- `GET /api/v1/projects` — list with filters (status, stage, province)
- `GET /api/v1/projects/{id}` — detail with COD history
- `GET /api/v1/projects/{id}/loan-accounts` — linked accounts + rate history
- `GET /api/v1/loan-accounts` — all accounts with CBS sync status
- `POST /api/v1/projects` — create new project (maker role)
- `POST /api/v1/projects/{id}/approvals` — submit for approval
- `GET /api/v1/approvals` — workflow queue by role
- `POST /api/v1/documents/{id}/upload` — document upload
- `GET /api/v1/audit-logs?entity_type=projects&entity_id=...` — audit trail

**Request/Response:**
- Pydantic models with strict validation
- Dual-calendar response (both AD and BS dates)
- Envelope: `{ data, meta: { timestamp, version }, audit: { user_id, action } }`
- Export support: `?format=json|excel|pdf` (PDF Phase 3)

**Authentication:**
- Stub integration with ActiveDirectoryAuthProvider (defer full AD until Phase 2 end)
- Extract user from X-User-ID header (dev) or LDAP (prod)
- Role-based endpoint access (admin, maker, approver, auditor)

**Testing:**
- Happy path: create, read, approve, disburse
- Validation failures: invalid dates, capacity bounds, duplicate codes
- Authorization: user sees only owned projects (phase 2) or all (admin)
- Performance: list endpoint with 1000 projects

**RFP Alignment:**
- FUNC C.2-C.4 — Project data endpoints
- FUNC D.1-D.3 — Loan account endpoints
- FUNC A.8 — Approval workflow endpoints
- TECH B.3 — Authentication layer
- TECH C.1 — API performance

---

### Task 5: Reporting Stub (0.5 days)

**Goal:** Lay foundation for Phase 3 PowerBI integration.

**Scope:**
- Create `/api/v1/reports/export` endpoint accepting:
  - `report_id`: portfolio, covenant_summary, capex_progress
  - `format`: json, excel, csv (not PDF yet)
  - `filters`: {date_range, province, status}
- Generate flat CSV/Excel output from core tables
- Audit export in AuditLogRead table (user_id, timestamp, export_format, record_count)
- Document PowerBI integration pattern in `docs/POWERBI-INTEGRATION.md`

**Key Files:**
- `backend/app/services/report_service.py` (new, minimal)
- `backend/app/schemas/report_schema.py` (new)
- `docs/POWERBI-INTEGRATION.md` (new)

**RFP Alignment:**
- FUNC F.11 — PowerBI integration (CR, Phase 3 delivery)
- FUNC F.4 — Portfolio reporting

---

## Implementation Priority

**Must-Have (Days 1-4):**
1. CBS adapter + DLQ (Task 1)
2. Document vault (Task 2)
3. Basic REST endpoints (Task 4 — core CRUD only)

**Should-Have (Days 5-6):**
4. Bulk import service (Task 3)
5. Reporting stub (Task 5)

**Nice-to-Have (if time):**
- Rate history auto-sync from CBS
- Document workflow approval

---

## Acceptance Criteria

✅ CBS adapter syncs test loan accounts without error  
✅ Document upload/download works with encryption  
✅ Bulk import processes 100-row Excel file in <5 seconds  
✅ GET /api/v1/projects returns all projects with COD history  
✅ POST /api/v1/projects creates project, triggers audit log  
✅ Export endpoint logs to AuditLogRead  
✅ All endpoints return dual-calendar dates (AD + BS)  
✅ Swagger/OpenAPI docs auto-generated  
✅ Minimum 80% unit test coverage on new code  
✅ Zero OWASP critical findings (SQLi, XSS, broken auth)

---

## Architecture Notes

### Integration Boundary
- CBS = read-only external system (no transactional dependency)
- Finacle Integrator = trusted middleware (on-premise, secured network)
- HPMS = system of accountability (captures evidence, triggers workflows)

### Data Flow
```
Finacle CBS
    ↓ (EOD/BOD batch or realtime)
Finacle Integrator (on-premise)
    ↓ (views, no API)
CBS Adapter (rate resets → loan_account_rate_history)
    ↓
HPMS loan_accounts
    ↓
Covenant Engine (Phase 3)
```

### Audit Trail
```
User Action
    ↓
Audit Middleware
    ↓
Append to audit_logs
    ↓ (for exports/reads)
Audit Read Middleware
    ↓
Append to audit_log_reads
```

---

## Dependency Check

**Already Available (Phase 1):**
- SQLAlchemy ORM with encrypted fields
- FastAPI app skeleton
- Alembic migration framework
- AuditLog infrastructure
- Security middleware

**To Install (Phase 2):**
- `openpyxl` — Excel file parsing
- `pandas` — Bulk data transformation
- `pyopenssl` — SSL/TLS for LDAP
- `ldap3` — LDAP integration (if AD available)

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| CBS adapter delays (no test system available) | Mock Finacle responses; phase real integration | Dev |
| Document storage scaling (10+ GB files) | Use SAN NFS mount; implement cleanup policy | DevOps |
| Bulk import data quality issues | Validate against domain rules; provide error CSV | Dev |
| LDAP unavailable for auth testing | Keep LocalDevAuthProvider; stub AD implementation | Dev |
| API endpoint explosion (scope creep) | Define fixed endpoint list; defer Phase 3 endpoints | PM |

---

## Next Steps

1. **Today (2026-09-22):** Code review Phase 1; prepare Phase 2 sprint board
2. **Tomorrow:** Kick off Task 1 (CBS Adapter) — start with schema mapping
3. **Day 3:** Parallel: Task 2 (Document Vault) + Task 1 integration
4. **Day 5:** Task 3 (Bulk Import) + Task 4 (REST endpoints)
5. **Day 6:** Task 5 (Reporting) + integration testing
6. **Day 7:** UAT prep, documentation, handoff to Phase 3

---

**Phase 2 Owner:** Full-stack development team  
**Stakeholder:** SBL Credit Administration, InfoSec, DevOps  
**Next Review:** End of Phase 2 (2026-09-29)
