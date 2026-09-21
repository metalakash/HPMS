# SBL HPMS — RFP Traceability Matrix

Every requirement in `RFP_of_Hydropower_Project_Management_Solution.docx` (July 2025)
mapped to the Phase 1 instruction that covers it, or to the phase that will.

**Legend** — `P1-n` = covered by Instruction *n* of the Phase 1 pack · `P2`/`P3`/`P4` =
Build Plan Week 2/3/4 · `PRUNED` = removed by the In-House Scope Rationalization ·
`INFRA` = SBL infrastructure dependency, not application code ·
`BID` = bid-response/process obligation, no code.

---

## Technical Requirements

### A — Security and Encryption

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| TECH A.1 | CR | Comprehensive SDLC with policies, testing, audits | P1-1 (quality gates) + BID |
| TECH A.2 | CR | Code security review before Go-Live; resolve high-risk findings | P4 (Day 20–21 OWASP hardening / VAPT) |
| TECH A.3 | ER | Written certification of security review | BID |
| TECH A.4 | ER | Minimum industry security standard | P1-1 |
| TECH A.5 | CR | Secure data transfer user↔server and to third parties | P1-1 (TLS, security headers) + P2 (CBS mTLS) |
| **TECH A.6** | **CR** | **RDBMS with access security and encryption** | **P1-1** (pgcrypto, RLS) + INFRA (SAN at-rest) |
| TECH A.7 | ER | IP whitelisting for service and admin consoles | P1-1 |

### B — Integration

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| TECH B.1 | ER | Standardized APIs and middleware | P1-1 (FastAPI) + P2 (Finacle adapter) |
| TECH B.2 | ER | Responsive across devices, browsers, OS | P3 (React 18 layer) |
| **TECH B.3** | **CR** | **Active Directory / Office 365 / digital signature** | **P1-1** (AD stub + contract), live bind P2 |
| TECH B.4 | CR | Compatible with ≥2 of Edge/Firefox/Chrome | P3 |
| TECH B.5 | CR | Integration with CBS, DWH, Asset Mgmt, HCMS | P2 (Finacle); DWH/HCMS = extension points |
| **TECH B.6** | **CR** | **Nepali calendar with automatic AD conversion** | **P1-2** (`nepali_calendar.py`, derived `_bs` fields) |
| TECH B.7 | ER | Handle Nepali Unicode for processing and reporting | P1-2 (`name_np`, UTF-8 collation, unaccent index) |
| TECH B.8 | ER | Import/export SQL, XML, CSV, HDF, ETL; online + batch | P2 (bulk ingestion) + P4 (report spooler) |

### C — Scalability

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| TECH C.1 | CR | Large data volumes without performance loss | P1-1 (indexing, PgBouncer) + INFRA |
| TECH C.2 | CR | Expandable servers and databases | INFRA |
| TECH C.3 | CR | Scalable to multiple nodes | P4 (DC/DR active-passive) + INFRA |
| TECH C.4 | CR | Horizontal and vertical scaling | INFRA |

### D — Hardware & Software

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| TECH D.1 | CR | State minimum hardware/software prerequisites | BID (RFP Annexure D) |
| TECH D.2 | CR | Recommended OS, middleware, DB platform | BID (Annexure D) |
| TECH D.3 | CR | Compatible OS, middleware, DB | BID (Annexure D) |
| TECH D.4 | CR | Comply with NRB guidelines and Nepal data privacy law | P1-4 (audit) + P4 (reporting) |
| **TECH D.5** | **CR** | **OWASP and ISG/internal audit guidelines** | **P1-1** (rate limit, CORS, headers) + P4 (VAPT) |
| TECH D.6 | CR | Integrate with HA clustering software | INFRA (PostgreSQL HA per Blueprint) |
| TECH D.7 | CR | Data Dictionary documentation for custom reports | P1 (generate from Alembic/ORM metadata) |
| TECH D.8 | CR | Architectural design documentation | Master Blueprint (delivered) |
| TECH D.9 | CR | Parameterized rule-based, combinable with ML/AI | P1-6 (`workflow_definitions` JSONB) + P3 |
| TECH D.10 | CR | TCP/IP, web services, HTTP/HTTPS | P1-1 + P2 |
| TECH D.11 | CR | Import/export multiple formats, online + batch | P2 + P4 |
| TECH D.12 | ER | System study, parameterization, admin and user manuals | P4 + BID |

### E — Backup and Recovery

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| TECH E.1 | CR | Data history with snapshots between backup intervals | P1-4 (`pre_state`/`post_state` JSONB) + INFRA |
| TECH E.2 | CR | Online DB and storage replication to DR | INFRA (SAN replication, Blueprint §2) |
| TECH E.3 | ER | Load balancing (CPU, disk, memory) | INFRA |

---

## Functional Requirements

### A — User Management

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC A.1 | CR | Roles (super-admin/admin/maker/recommender/checker), **field-level** rights | **P1-6** |
| FUNC A.2 | CR | Admin control panel; create/block/modify users, maker-checker | P1-6 + P3 |
| FUNC A.3 | CR | Configurable workflows; single or multiple recommenders/approvers | **P1-6** (`workflow_definitions`) |
| FUNC A.4 | CR | Access by user, branch, province, head office | **P1-1** (RLS) + P1-6 |
| FUNC A.5 | ER | Admin-managed application parameters | P1-1 (config service) |
| FUNC A.6 | ER | Rich creative design / content management | **PRUNED** — replaced by React/Tailwind components |
| FUNC A.7 | ER | Admin-managed user portal | **PRUNED** — subsumed into FUNC A.2 admin panel |
| FUNC A.8 | CR | Concurrent/multiple users without degradation | P1-1 (PgBouncer) + P4 (load test) |

### B — Financial Data Integration

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC B.1 | CR | Finacle CBS import of disbursement, repayment, outstanding | **P1-3** (schema) + P2 (adapter) |
| FUNC B.2 | CR | Project budgets, actuals, variances; bulk upload | **P1-3** (`budget_lines`) + P2 (ingestion) |
| **FUNC B.3** | **ER** | **Support for multiple currencies** | **P1-3** (`currency_code`, FX snapshot) |
| FUNC B.4 | CR | Forecast and project financial metrics | P3 (DSCR projection models) |
| FUNC B.5 | CR | Classify project by current status | **P1-2** (`PipelineStatus`) |
| FUNC B.6 | CR | Manual entry of pre-disbursement and projection data | P1-3 + P3 |
| FUNC B.7 | CR | Define/track PPA tariff rates vs actual revenue | P3 (PPA tariff engine) |

### C — Project Information Management

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC C.1 | CR | Centralized document repository | P2 (encrypted document vault) |
| FUNC C.2 | CR | Project name, location, capacity, stage, milestones, stakeholders | **P1-2** |
| FUNC C.3 | CR | Store PPA, sanction letters, feasibility studies with revisions | P2 |
| FUNC C.4 | CR | Cost breakdown initial vs final, variance analysis | **P1-3** (`budget_lines`) |
| FUNC C.5 | ER | Construction schedule planned vs actual, flag delays | P3 (milestones) |
| FUNC C.6 | CR | River and hydrological data | **P1-2** (`hydrology_records`) |
| FUNC C.7 | CR | Pipeline tracking: Under Review, Approved, Dropped | **P1-2** (`PipelineStatus`) |
| FUNC C.8 | ER | Record rejection/dropout reasons | **P1-2** (`drop_reason`) — *added, absent from draft* |
| FUNC C.9 | ER | Stakeholder directory with performance history | P3 |
| FUNC C.10 | CR | Version-controlled documents with timestamps | P2 |
| FUNC C.11 | ER | Land ownership, acquisition, compensation | **P1-2** (`land_records`) |
| FUNC C.12 | ER | Water licences with validity, terms, river basin | **P1-2** (`water_licenses`) |

### D — Support Methodology

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC D.1 | CR | 24×7×365 emergency support with SLA matrix | **PRUNED** → internal SBL IT SOP |
| FUNC D.2 | CR | On-site support ≥4 weeks post Go-Live | **PRUNED** → internal team |
| FUNC D.3 | CR | Latest upgrades and patches before Go-Live | P4 |
| FUNC D.4 | ER | Single Point of Contact / qualified PM | **PRUNED** → internal PM |
| FUNC D.5 | ER | Support portal / issue tracker | **PRUNED** → SBL internal ticketing |

### E — Compliance & Portfolio Monitoring

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC E.1 | CR | Audit trail of all events; security and admin logs | **P1-4** |
| FUNC E.2 | CR | Automated alerts for deadlines, breaches, missing documents | P3 (alert service) |
| FUNC E.3 | CR | Audit logs: user ID, timestamp, action, **reason** | **P1-4** (`reason_for_action` NOT NULL) |
| FUNC E.4 | ER | Define audit log retention period | **P1-4** (configurable; default flagged — see notes §9) |
| FUNC E.5 | CR | Concurrent and post-facto audit of all processes | **P1-4** (`verify_chain`, `cbs_sync_log`) |
| FUNC E.6 | CR | Bank's right to audit vendor's system | **PRUNED** — no external vendor |
| FUNC E.7 | CR | Track regulatory requirements and compliance deadlines | P3 |
| FUNC E.8 | CR | KPIs per project and portfolio (progress, capacity, DSCR) | P3 |
| FUNC E.9 | CR | Risk identification, mitigation, tracking | P3 |
| FUNC E.10 | CR | Quarterly compliance % (approved/disbursed/repayment) | P3, on **P1-3** ledger |
| FUNC E.11 | ER | Insurance details vs project risk profile | P3 |
| FUNC E.12 | CR | Link project status to RCOD and COD milestones | P3 |
| FUNC E.13 | ER | Shareholding structure and BOD details | P3 |
| FUNC E.14 | CR | Contract energy vs actual generation | P3 (`energy_generation`) |
| FUNC E.15 | ER | Alerts to internal and external stakeholders | P3 |
| FUNC E.16 | CR | Alerts before expiry of permits, licences, PPAs, insurance | P3, on **P1-2** validity dates |
| FUNC E.17 | CR | EIA/ESIA records, mitigation, monitoring | P3 |
| FUNC E.18 | ER | Community consultations, grievances, resolutions | P3 |
| FUNC E.19 | CR | Project risks by type, severity, mitigation | P3 |
| FUNC E.20 | ER | Alerts on multiple risk triggers | P3 |
| FUNC E.21 | CR | Review/approval trails for changes to critical data | **P1-4 + P1-6** |
| FUNC E.22 | ER | User-defined reminders on milestones/deadlines | P3 |
| FUNC E.23 | ER | Calendar of regulatory filings (NRB, Ministry, NEA) | P4 |
| FUNC E.24 | CR | Operational performance: output, outages, maintenance cost | P3 |
| FUNC E.25 | ER | CSR activity tracker | P3 |

### F — Reporting & Dashboard

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC F.1 | CR | Spool reports in Excel/Word/PDF, **Nepali and English calendars** | P4, on **P1-2** dual-calendar pattern |
| FUNC F.2 | CR | Real-time disbursement status and trends | P3, on **P1-3** |
| FUNC F.3 | CR | Financial overview at RO/URM, project and portfolio level | P3, on **P1-3 + P1-5** |
| FUNC F.4 | ER | Portfolio health; actual vs projected exposure | P3, on **P1-5** exposure view |
| FUNC F.5 | CR | Report creation without query-language knowledge | P3 |
| FUNC F.6 | ER | Combine data sources into consolidated reports | P4 |
| FUNC F.7 | CR | Dashboards with graphs, tables, charts | P3 (Recharts) |
| FUNC F.8 | ER | Drill-down into underlying detail | P3 |
| FUNC F.9 | ER | Cost analysis / overspend identification | P3, on **P1-3** `budget_lines` |
| FUNC F.10 | CR | Custom, compliance and shortfall reports with filters | P4 |
| FUNC F.11 | CR | Integrate with Word/Excel/PowerPoint/PowerBI; scheduled delivery | P4 |
| FUNC F.12 | CR | Expected vs actual revenue | P3 (PPA engine) |
| FUNC F.13 | CR | Filter by Province, District, Local Level | P3, on **P1-2** geo FKs |
| FUNC F.14 | ER | Estimated CO₂ avoidance for ESG reporting | P3, on **P1-2** `installed_capacity_mw` |
| FUNC F.15 | CR | Visual milestone calendar (Gantt-style) | P3 |
| FUNC F.16 | CR | Executive dashboard by region, type, risk, exposure | P3 |

> **Note:** FUNC F.14 is present in the source table but its cell carries irregular
> whitespace (`|  F.14  |`), so ID-extraction scripts run over the RFP will silently drop
> it. Worth knowing if you script any further requirement parsing.

### G — Others

| ID | CR/ER | Requirement (abbrev.) | Coverage |
|---|---|---|---|
| FUNC G.1 | CR | BCP; DC and DR in different seismic zones; failover | INFRA + P4 (DC/DR staging) |
| FUNC G.2 | ER | Vendor training programmes | **PRUNED** → internal SOPs and knowledge transfer |
| FUNC G.3 | CR | Bulk upload of budgets, expenses, variances | **P1-3** (`upload_batch_id`) + P2 |
| FUNC G.4 | CR | Arithmetic formulas; avoid mandatory entry of all fields | **P1-3** (generated/derived columns) |
| FUNC G.5 | CR | Attach jpg, jpeg, pdf, word, excel | P2 (document vault) |
| FUNC G.6 | ER | Propagate changes across dimensions and hierarchies | P3 |
| FUNC G.7 | CR | Export to PDF, Excel, Word | P4 |
| FUNC G.8 | ER | Link prior-year data for budget forecasting | P3 |
| FUNC G.9 | ER | Industry / peer bank comparison with bulk upload | P3 |

---

## Coverage summary

Counted by *primary* owning phase (requirements spanning two phases are counted once,
against the earlier one).

| Phase | Functional | Technical | Total |
|---|---|---|---|
| **Phase 1 (this pack)** | 25 | 16 | **41** |
| Phase 2 (Week 2 — CBS + document vault) | 4 | 3 | 7 |
| Phase 3 (Week 3 — domain engine + frontend) | 37 | 2 | 39 |
| Phase 4 (Week 4 — reporting + hardening) | 7 | 3 | 10 |
| INFRA (SBL infrastructure dependency) | 1 | 5 | 6 |
| BID / process only (no code) | 0 | 5 | 5 |
| PRUNED (In-House rationalization) | 8 | 0 | 8 |
| **Total** | **82** | **34** | **116** |

Every one of the 116 requirements is assigned. Phase 1 alone lands 41 of them, including
all six Critical Requirements the database schema can satisfy on its own
(TECH A.6, TECH B.3, TECH B.6, TECH D.5, FUNC A.1, FUNC E.3).

**Three Critical Requirements are deliberately pruned** by the In-House Scope
Rationalization because they are vendor-procurement obligations with no counterparty in an
internal build: **FUNC D.1** (24×7 vendor emergency support SLA), **FUNC D.2** (4 weeks
vendor on-site support post Go-Live) and **FUNC E.6** (Bank's right to audit the vendor's
system). If this pack is ever reused to answer the RFP as an external bidder rather than to
drive the in-house build, those three must be reinstated — they are scored CR.
