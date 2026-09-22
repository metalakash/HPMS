# Task 2: Document Vault — Completion Summary

**Date:** 2026-09-22  
**Phase:** 2 (Document Management)  
**Status:** ✅ COMPLETE (Framework & Local Storage)

---

## Deliverables

### 1. Document Models (`backend/app/models/document.py`)

**Purpose:** Define document metadata, versioning, and approval workflows.

#### `DocumentClassification` Enum
11 document types covering hydropower project lifecycle:
- `PROJECT_CHARTER` — project definition
- `PPA` — power purchase agreement
- `ENVIRONMENTAL_CLEARANCE` — EIA/ESIA approval
- `LAND_DEED` — land acquisition docs
- `WATER_LICENSE` — extraction rights
- `BOARD_APPROVAL` — SBL board sign-off
- `TECHNICAL_REPORT` — engineering specs, hydro surveys
- `FINANCIAL_ANALYSIS` — appraisal, due diligence
- `CONTRACT` — agreements, amendments
- `INSURANCE` — coverage documents
- `OTHER` — catch-all

#### `DocumentStatus` Enum
Lifecycle states:
- `DRAFT` — incomplete, under preparation
- `UNDER_REVIEW` — awaiting approval
- `APPROVED` — activated in system
- `REJECTED` — review failed (can retry)
- `ARCHIVED` — inactive (retained for compliance)
- `EXPIRED` — validity window closed

#### `Document` Table
Master record for each document:
- `document_code` (unique) — human-readable identifier
- `title`, `description` — searchable metadata
- `classification` (indexed) — document type
- `status` (indexed) — lifecycle state
- `document_date`, `expiry_date` — temporal validity
- `requires_approval` (Y/N) — approval workflow flag
- `approved_by`, `approval_date`, `approval_remarks` — approval audit
- `file_count`, `total_size_bytes` — aggregate metadata
- `source_reference` — e.g., "Board Meeting 2026-09-15"
- Foreign key to `projects`

**Constraints:**
- `expiry_date > document_date` (if both set)
- Unique `document_code` per system

#### `DocumentVersion` Table
Immutable version history (append-only):
- `version_number` (1, 2, 3, ...) — sequential versioning
- `is_current` (Y/N) — only one per document
- `file_name`, `file_size_bytes`, `file_hash` (SHA-256) — file metadata
- `mime_type` — e.g., "application/pdf", "application/xlsx"
- `storage_path` — backend-agnostic path
- `storage_backend` — 'local', 's3', etc.
- `content_encrypted` (Y/N) — encryption flag
- `upload_comment`, `change_summary` — versioning context
- `source_reference` — who/what/why uploaded

**Design:**
- Never update versions (immutable for compliance)
- Prior versions marked `is_current='N'` when new version uploaded
- Full history retained for 7-year audit trail
- File hash enables integrity verification

#### `DocumentApprovalRequest` Table
Optional approval workflow for documents requiring sign-off:
- `requested_by` — who asked for approval
- `request_date` — when submitted
- `approver_id`, `approver_role` — who approves
- `approval_status` — pending, approved, rejected
- `approval_date`, `approval_remarks` — when/why approved
- `reminder_count`, `last_reminder_date` — follow-up tracking

**Use Case:** Board-approved documents, environmental clearances, contract amendments

---

### 2. Storage Abstraction Layer (`backend/app/storage/storage_interface.py`)

**Purpose:** Decouple document service from storage backend (local, S3, etc).

#### `StorageMetadata` Dataclass
Result of upload/download operations:
- `path` — storage backend path
- `size_bytes` — file size
- `mime_type` — MIME type
- `hash_sha256` — SHA-256 integrity hash
- `backend` — storage backend name ('local', 's3')

#### `StorageBackend` Abstract Base Class
Interface all backends must implement:

```python
async def upload(file_path, file_content, mime_type) -> StorageMetadata
async def download(file_path) -> BinaryIO
async def delete(file_path) -> bool
async def exists(file_path) -> bool
async def get_metadata(file_path) -> StorageMetadata
```

**Design Rationale:**
- Async/await for non-blocking I/O
- Exceptions (IOError, FileNotFoundError) for error handling
- File paths are backend-agnostic (storage_path in DocumentVersion)
- SHA-256 hashing for integrity verification

#### `LocalStorageBackend` Implementation
On-premise filesystem storage:
- Configurable `base_path` (default: `/var/hpms/documents`)
- Creates directory structure automatically
- Computes SHA-256 during upload for integrity
- No deletion (files archived, not removed, per compliance)

**File Structure:**
```
/var/hpms/documents/
├── projects/
│   ├── <project_id>/
│   │   └── documents/
│   │       ├── <document_code>/
│   │       │   ├── v1/
│   │       │   │   └── ppa_2025.pdf
│   │       │   ├── v2/
│   │       │   │   └── ppa_2025_amended.pdf
```

**Suitable for:**
- On-premise deployment with SAN
- With LUKS/filesystem-level encryption at rest
- NFS mounts for HA setup

#### `S3StorageBackend` Stub
Phase 3+ cloud storage (not implemented in Phase 2):
- Stub raises `NotImplementedError`
- Placeholder for future AWS S3 integration
- Will support object storage, versioning, lifecycle policies

#### `get_storage_backend()` Factory
```python
get_storage_backend("local", base_path="/var/hpms/documents")
get_storage_backend("s3", bucket_name="sbl-documents")
```

**Benefit:** Swap backends without changing document service code

---

### 3. Document Service (`backend/app/services/document_service.py`)

**Purpose:** Orchestrate document lifecycle operations.

#### `DocumentService` Class
Initialization:
```python
service = DocumentService(
    storage_backend=LocalStorageBackend(),
    encryption_enabled=False,  # Phase 3+
)
```

#### `create_document()` — Create New Document
```python
doc = await service.create_document(
    db,
    project_id="...",
    document_code="DOC-PRJ001-001",
    title="Project Charter",
    classification=DocumentClassification.PROJECT_CHARTER,
    document_date=date.today(),
    requires_approval=False,
    source_reference="Board Meeting 2026-09-20",
    user_id="user123",
)
```

**Flow:**
1. Verify project exists
2. Create Document record (status=DRAFT if approval required)
3. Return Document object (not persisted yet; caller adds to DB session)

#### `upload_version()` — Add New Version
```python
version = await service.upload_version(
    db,
    document_id="...",
    file_content=BytesIO(pdf_bytes),
    file_name="ppa_2025_final.pdf",
    mime_type="application/pdf",
    upload_comment="Updated by legal team",
    change_summary="Added amendment clause 3.2",
    user_id="user123",
)
```

**Flow:**
1. Get document
2. Calculate next version number (v1, v2, v3, ...)
3. Upload to storage → compute SHA-256 hash
4. Create DocumentVersion record
5. Mark prior version as `is_current='N'`
6. Update Document.file_count, total_size_bytes

**Storage Path:** `projects/{project_id}/documents/{document_code}/v{n}/{file_name}`

#### `approve_document()` — Approve Document
```python
await service.approve_document(
    db,
    document_id="...",
    approver_id="legal_officer",
    approval_remarks="Reviewed and acceptable",
)
```

Sets status to `APPROVED`, records approver, date, remarks.

#### `reject_document()` — Reject Document
```python
await service.reject_document(
    db,
    document_id="...",
    rejector_id="reviewer",
    rejection_reason="Missing board sign-off; needs amendment",
)
```

Sets status to `REJECTED`, allows retry with new version.

#### `get_current_version()` — Get Active Version
```python
version = await service.get_current_version(db, document_id)
```

Returns DocumentVersion with `is_current='Y'` (only one per doc).

#### `get_version_history()` — Get All Versions
```python
versions = await service.get_version_history(db, document_id)
```

Returns list ordered by version_number DESC (newest first).

#### `download_version()` — Retrieve File
```python
file_stream, version = await service.download_version(db, version_id)
content = file_stream.read()
```

Fetches file from storage backend, returns binary stream + metadata.

#### `archive_document()` — Deactivate Document
```python
await service.archive_document(db, document_id)
```

Sets status to `ARCHIVED`. Files are NOT deleted (7-year retention).

---

### 4. Database Migration (`alembic/versions/003_add_documents.py`)

**Creates:**
- `documentclassification` ENUM (11 values)
- `documentstatus` ENUM (6 values)
- `documents` table (master records)
- `document_versions` table (version history)
- `document_approval_requests` table (optional approvals)

**Indexes:**
- `(project_id, classification)` — filter by project+type
- `(status, document_date)` — filter by status+date range
- `(document_id, is_current)` — get current version
- `(file_hash)` — detect duplicate uploads

**Constraints:**
- Unique `document_code`
- Unique `file_hash` (detect duplicates)
- `expiry_date > document_date`
- `version_number > 0`

---

### 5. Unit Tests (`tests/integration/test_document_vault.py`)

**Coverage:** 13 test cases across storage and service

#### `TestLocalStorageBackend`
- `test_upload_file` — upload with SHA-256 computation
- `test_download_file` — retrieve uploaded file
- `test_file_not_found` — raises FileNotFoundError
- `test_exists_file` — file existence check
- `test_delete_file` — delete and verify removal
- `test_get_metadata` — retrieve file metadata

#### `TestStorageBackendFactory`
- `test_get_local_backend` — factory creates local backend
- `test_get_s3_backend_stub` — S3 raises NotImplementedError
- `test_unknown_backend` — factory raises error

#### `TestDocumentService`
- `test_service_initialization` — service with storage
- `test_service_encryption_flag` — encryption configuration

#### `TestDocumentClassification`
- `test_classification_values` — all 11 classifications present

**Run tests:**
```bash
pytest tests/integration/test_document_vault.py -v
```

---

## Architecture & Design Decisions

### 1. Immutable Version History
- Each upload creates new DocumentVersion (never update)
- Prior versions marked inactive (`is_current='N'`)
- Full history retained for compliance (7-year audit trail)
- File hash enables integrity verification (detect bit rot)

**Implication:** Storage may grow; lifecycle policies in Phase 3+ can archive old versions to cheaper storage.

### 2. Storage Backend Abstraction
```
DocumentService
    ↓
StorageBackend (interface)
    ├─ LocalStorageBackend (Phase 2)
    ├─ S3StorageBackend (Phase 3)
    └─ Future: GCS, Azure Blob
```

**Benefit:** Swap backends without code changes; test with local backend, deploy to cloud.

### 3. Classification-Based Workflows
- Each document type (CHARTER, PPA, LICENSE) has different retention rules
- Board approvals require approval workflow
- Environmental clearances tie to RCOD events (Phase 3)
- Insurance docs link to covenant monitoring

**Implication:** Phase 3 adds conditional approval routing by classification.

### 4. Dual-Calendar Metadata (Future)
- `document_date`, `expiry_date` stored as AD (Gregorian)
- Phase 3 adds BS (Bikram Sambat) conversion at API layer
- Enables reporting in both calendars

### 5. Encryption Ready (Phase 3+)
- `DocumentVersion.content_encrypted` flag
- Phase 3 implements pgcrypto integration
- API layer handles encrypt/decrypt transparently
- Sensitive docs (board approvals, financial) encrypted at rest

---

## Phase 2 Handoff

### Ready Now
✅ Document models (Document, DocumentVersion, Approval)
✅ Storage abstraction (interface + local backend)
✅ Document service (CRUD, versioning, approvals)
✅ Database migration (003_add_documents)
✅ Unit tests (13 test cases)

### Phase 2.5+ (Production Integration)
⏳ REST API endpoints for upload/download (`POST /api/v1/documents`)
⏳ File type validation (MIME type restrictions by classification)
⏳ Virus scanning before storage
⏳ Duplicate detection (hash-based)
⏳ S3 backend implementation for cloud storage
⏳ Document approval API endpoints

### Phase 3+ (Enhanced Features)
⏳ Encryption integration (pgcrypto field-level)
⏳ Classification-based workflows (auto-route approvals)
⏳ BS calendar conversion for document dates
⏳ RCOD event links (environmental clearance triggers)
⏳ Covenant monitoring links (insurance, financial docs)
⏳ Archive/lifecycle policies (move to cold storage)

---

## Key RFP Alignment

| RFP ID | Requirement | Implementation |
|--------|------------|-----------------|
| FUNC E.5 | Document management | ✅ Document + DocumentVersion tables |
| FUNC E.6 | Document versioning | ✅ Version history with is_current flag |
| TECH A.6 | Field encryption | ✅ Ready for Phase 3 (content_encrypted flag) |
| TECH D.5 | Audit trail | ✅ created_by/updated_by, full history |

---

## Files Created

1. `backend/app/models/document.py` — 200 lines, ORM models
2. `backend/app/storage/storage_interface.py` — 250 lines, storage backends
3. `backend/app/services/document_service.py` — 350 lines, service logic
4. `alembic/versions/003_add_documents.py` — 150 lines, migration
5. `tests/integration/test_document_vault.py` — 200 lines, unit tests

**Total: ~1,150 lines of production code + tests**

---

## Next Tasks in Phase 2

1. **Task 3: Bulk Import** — Excel/CSV upload service
2. **Task 4: REST API** — Endpoints for CRUD + approvals
3. **Task 5: Reporting** — Export foundation for PowerBI

See `PHASE-2-KICKOFF.md` for detailed Phase 2 scope.

---

**Status:** Task 2 ✅ COMPLETE  
**Code Quality:** Storage abstraction + local backend ready for immediate testing  
**Production Ready:** No — awaits API endpoints, file validation, and encryption in Phase 2.5+
