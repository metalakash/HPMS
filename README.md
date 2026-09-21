# SBL Hydropower Project Management Solution (HPMS)

**Phase 1: Foundation and Database Schema**

A secure, audit-ready hydropower project-finance monitoring platform for Siddhartha Bank Limited.

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Development Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -e .

# Start PostgreSQL (Docker)
docker-compose up -d postgres

# Run migrations
alembic upgrade head

# Start development server
uvicorn backend.app.main:app --reload
```

Visit http://localhost:8000/docs for Swagger UI.

### Docker Setup

```bash
docker-compose up --build
```

Database will be available at `localhost:5432`.

## Architecture

### Project Structure

```
sbl-hpms/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM models (Phase 1)
│   │   │   ├── project.py   # Projects, milestones, hydrology, licenses
│   │   │   ├── financial.py # Loans, disbursements, repayments, budget
│   │   │   ├── consortium.py# Syndication and pro-rata allocation
│   │   │   ├── governance.py# Roles, permissions, approval workflows
│   │   │   ├── audit.py     # Immutable audit trail with SHA-256 chaining
│   │   │   └── base.py      # Base model and mixins
│   │   ├── api/             # REST endpoints (Phase 2+)
│   │   ├── services/        # Business logic (Phase 2+)
│   │   ├── integration/     # Finacle CBS adapter (Phase 2+)
│   │   ├── auth/            # Authentication (AD, LDAP stub)
│   │   ├── utils/           # Utilities (Nepali calendar, encryption)
│   │   ├── config.py        # Application settings
│   │   ├── database.py      # Database connection and session management
│   │   └── main.py          # FastAPI application factory
│   └── Dockerfile
├── alembic/                 # Database migrations
├── docs/
│   ├── PHASE-1-ANTIGRAVITY-INSTRUCTIONS.md    # Detailed implementation guide
│   ├── PHASE-1-INTEGRATION-NOTES.md           # Design decisions and corrections
│   ├── POSITIONING-REVIEW.md                  # Feature scope analysis
│   ├── RESEARCH-BRIEF-PERPLEXITY.md           # Research questions for South Asian context
│   └── RFP-TRACEABILITY-MATRIX.md             # RFP requirement mapping
├── pyproject.toml           # Dependencies and build config
├── docker-compose.yml       # Local development stack
├── .env                     # Environment variables (dev)
└── README.md               # This file
```

## Phase 1 Implementation Summary

### Entities Implemented

**Project Information Management**
- `projects` - Core project master record with pipeline status and COD tracking
- `project_technical_specs` - Technical specifications (MW, design, turbine type)
- `hydrology_records` - River and hydrological data for environmental assessment
- `water_licenses` - Water extraction rights and validity periods
- `land_records` - Land acquisition and compensation tracking

**Financial Data Integration**
- `loan_accounts` - Finacle-linked loan accounts with encrypted account IDs
- `disbursement_tranches` - Disbursement schedule and tracking
- `repayments` - Repayment schedule with overdue tracking
- `cbs_sync_log` - CBS synchronisation audit log (encrypted payloads)
- `budget_lines` - Project budget and variance tracking

**Consortium & Syndication**
- `consortium_facilities` - Multi-bank facility structure
- `consortium_members` - Effective-dated member shares (supports transitions)

**Governance & Workflow**
- `roles` - User role definitions (super-admin, admin, maker, recommender, approver, auditor)
- `permissions` - Field-level permission matrix (NONE, READ, WRITE)
- `approval_requests` - Workflow instances with state machine
- `approval_steps` - Individual approval steps with actor and state transition
- `workflow_definitions` - Configurable workflow routing per use case

**Audit & Compliance**
- `audit_logs` - Immutable append-only log with SHA-256 state hashing and chain linking
- `audit_log_reads` - Tracking of sensitive data access (export, view)

### Key Features

**Security (TECH A.6, D.5, B.3)**
- PostgreSQL pgcrypto field-level encryption for sensitive identifiers
- Rate limiting on all endpoints
- CORS restricted to internal intranet only
- Security headers (HSTS, X-Frame-Options, CSP)
- IP whitelisting configuration framework
- Row-Level Security (RLS) ready on sensitive tables
- Immutable audit trail with SHA-256 state hashing and chain verification

**Data Integrity**
- Dual-calendar support (Gregorian AD / Bikram Sambat BS) with automatic conversion
- Effective-dating for mutable fields (consortium shares, rates, capacity, COD)
- Data provenance tracking (CBS_SYNCED, MANUAL_ENTRY, CALCULATED, DOCUMENT_VERIFIED)
- Strict Numeric(20,4) for all monetary fields (never Float)
- Nepali Unicode support with UTF-8 collation for name fields

**Governance**
- Four-eyes separation of duties (Maker ≠ Recommender ≠ Approver)
- Multi-tier approval workflow (DRAFT → SUBMITTED → RECOMMENDED → APPROVED → DISBURSED)
- Field-level access control by role
- Configurable workflow definitions (no code changes for new flows)
- Approval reasons mandatory

**Integration Preparation**
- Finacle adapter isolation (no direct CBS access from API)
- CBS sync audit log with circuit breaker and DLQ support
- Read-only Finacle integration (HPMS as system of accountability)

## Configuration

### Environment Variables (`.env`)

```
DATABASE_URL=postgresql://hpms:password@localhost:5432/sbl_hpms_dev
DEBUG=true
LOG_LEVEL=INFO
SECRET_KEY=dev-secret-key-change-in-production
AUDIT_RETENTION_YEARS=7
```

## API Health Checks

```bash
# System health
curl http://localhost:8000/health

# Readiness (includes DB check)
curl http://localhost:8000/ready
```

## Next Steps (Phase 2-4)

**Phase 2 (Week 2)** — Finacle CBS Integration & Document Vault
- CBS read-only middleware adapter
- EOD/BOD batch reconciliation
- Document repository with encryption
- Bulk Excel/CSV ingestion

**Phase 3 (Week 3)** — Domain Engine & Frontend
- PPA tariff and COD/RCOD management
- Covenant engine (DSCR, debt-equity, cost overrun)
- Milestone and Gantt scheduling
- React 18 + TypeScript dashboard

**Phase 4 (Week 4)** — Reporting & Hardening
- Dual-calendar reporting (BS + AD)
- PowerBI/Office integration
- OWASP hardening and VAPT
- DC/DR failover testing
- Production deployment

## Documentation

See `docs/` folder for:
- PHASE-1-ANTIGRAVITY-INSTRUCTIONS.md — Implementation guide
- PHASE-1-INTEGRATION-NOTES.md — RFP reconciliation
- POSITIONING-REVIEW.md — Feature scope analysis
- RESEARCH-BRIEF-PERPLEXITY.md — Research questions
- RFP-TRACEABILITY-MATRIX.md — Full requirement mapping (116 requirements)

## RFP Compliance

Phase 1 covers **41 of 116 RFP requirements**.

## License

Proprietary — Siddhartha Bank Limited
