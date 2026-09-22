# Phase 4: Production Enhancement & Extended Features

**Start Date:** 2026-10-06  
**Duration:** 2-3 Weeks (Optional Enhancements)  
**Primary Deliverables:** MFA, PDF Reports, Mobile API, Real-time Updates  
**Completion Target:** 2026-10-27

---

## Phase 3 → Phase 4 Handoff

**Phase 3 Status:**
- ✅ Active Directory authentication (JWT tokens)
- ✅ Row-level security (user-scoped data)
- ✅ File export endpoints (CSV/Excel with S3)
- ✅ Scheduled exports (cron-based with email)
- ✅ Rate limiting & performance (caching, token bucket)
- ✅ 4,805+ lines of production code
- ✅ Production-ready for UAT

**Phase 3 Validated:**
- All performance targets met
- Security baseline established (OWASP)
- Tested at 1000 concurrent users
- Audit trail complete and immutable
- Ready for SBL deployment

**Phase 4 Roadmap:** Optional enhancements for competitive advantage

---

## Phase 4 Scope

### Task 1: Multi-Factor Authentication (MFA) (1-2 days)

**Goal:** Add TOTP/SMS two-factor authentication for enhanced security.

**Scope:**
- TOTP (Time-based One-Time Password) via authenticator apps
- SMS verification as fallback option
- MFA enforcement per role (optional for users, required for admins)
- Device trust (remember this device for 30 days)
- Backup codes for account recovery
- MFA audit trail (login attempts, verification results)

**Key Files to Create/Update:**
- `backend/app/models/mfa.py` (new)
- `backend/app/services/mfa_service.py` (new)
- `backend/app/api/routes_mfa.py` (new)
- `backend/app/config.py` (MFA settings)
- `alembic/versions/007_add_mfa_tables.py` (new migration)
- `tests/integration/test_mfa.py` (new)

**Features:**
- TOTP via pyotp library
- SMS via Twilio (or similar)
- QR code generation for authenticator setup
- Backup codes (10 codes, each use once)
- Device trust with cookie-based tracking
- MFA enforcement policy (per role)
- Recovery codes for account lockout

**RFP Alignment:** TECH B.3+ (Enhanced authentication)

---

### Task 2: PDF Report Generation (1-2 days)

**Goal:** Generate formatted PDF reports with SBL branding for print/email distribution.

**Scope:**
- ReportLab or WeasyPrint for PDF generation
- SBL branding (logo, headers, footers)
- Report types: portfolio, covenant, capex (same as PowerBI)
- Charts/graphs: capacity distribution, rate timeline, budget variance
- Multi-language support (English/Nepali headers)
- Watermarking and document protection
- Page breaks and table formatting

**Key Files to Create/Update:**
- `backend/app/services/pdf_service.py` (new)
- `backend/app/api/routes_reports.py` (enhance)
- `backend/app/config.py` (PDF settings)
- `tests/integration/test_pdf_export.py` (new)

**Features:**
- Professional PDF layouts with SBL branding
- Charts using matplotlib/plotly
- Multi-page reports with TOC
- Watermark: "CONFIDENTIAL" or "DRAFT"
- Document metadata (title, author, subject)
- Password protection (optional)
- Signed PDFs (Phase 4.5 with digital signature)

**RFP Alignment:** FUNC F.11 (PDF reports, Phase 4)

---

### Task 3: Mobile API / GraphQL Endpoint (1-2 days)

**Goal:** Create mobile-friendly API or GraphQL endpoint for smartphone/tablet access.

**Scope:**
- GraphQL endpoint (`POST /graphql`) or REST subset for mobile
- Query only essential fields (reduce bandwidth)
- Pagination with cursor-based navigation
- Offline-first design (cached data, sync on reconnect)
- Push notifications for export completion
- Touch-optimized endpoints (batch operations)

**Key Files to Create/Update:**
- `backend/app/api/routes_graphql.py` or `/routes_mobile.py` (new)
- `backend/app/schemas/mobile_schema.py` (new)
- GraphQL schema definitions
- `tests/integration/test_mobile_api.py` (new)

**Features (GraphQL Approach):**
- Type-safe queries (self-documenting)
- Flexible field selection (no over-fetching)
- Nested queries (project → loans → rates)
- Real-time subscriptions (WebSocket)
- Batch mutations for bulk operations
- Rate limiting per device

**Features (REST Subset Approach):**
- `/api/v1/mobile/projects` (lightweight list)
- `/api/v1/mobile/projects/{id}` (essential fields only)
- `/api/v1/mobile/loans` (paginated, cursor-based)
- Compressed responses (gzip)
- Retry-safe idempotency keys

**RFP Alignment:** FUNC G.1+ (Mobile access, Phase 4+)

---

### Task 4: Real-Time WebSocket Updates (1 day)

**Goal:** Push live updates to connected clients (new exports, approvals, notifications).

**Scope:**
- WebSocket server for persistent connections
- Publish/subscribe pattern (channels per user)
- Event types: export_completed, approval_requested, rate_changed
- Client reconnection with message replay (Redis)
- Scalability with Redis pub/sub (multi-server)
- Heartbeat to detect stale connections

**Key Files to Create/Update:**
- `backend/app/websocket/ws_handler.py` (new)
- `backend/app/api/routes_ws.py` (new)
- `backend/app/services/notification_service.py` (new)
- `backend/app/config.py` (WebSocket settings)
- `tests/integration/test_websocket.py` (new)

**Features:**
- Per-user channels (secure, no cross-user data)
- Event queue with Redis (survives server restart)
- Auto-reconnect with backoff
- Message acknowledgment
- Rate limiting on subscribers
- Memory-efficient (connection pooling)

**RFP Alignment:** FUNC A.10+ (Real-time notifications, Phase 4+)

---

### Task 5: Multi-Language UI (1 day)

**Goal:** Add Nepali language support to API responses and frontend templates.

**Scope:**
- Internationalization (i18n) framework (babel or similar)
- Translate API response labels (field names, enums, errors)
- Nepali translations for common terms (project, loan, rate, etc.)
- Accept-Language header detection
- Per-user language preference
- Fallback to English if translation missing

**Key Files to Create/Update:**
- `backend/app/i18n/translations.py` (new)
- `backend/app/i18n/nepali.json` (new translation file)
- Middleware for language detection
- API response transformation (translate enums)

**Features:**
- Field-level translations (capacity_mw → क्षमता_मेगावाट)
- Enum translations (under_operation → अपरिचालनयोग्य)
- Error message translations
- Date formatting per locale (AD/BS)
- Number formatting per locale
- Dynamic translation loading

**RFP Alignment:** FUNC H.2+ (Multi-language support, Phase 4+)

---

## Implementation Priority

**Phase 4 Tier 1 (Must-Have for UAT):**
- Nothing — Phase 3 is already production-ready

**Phase 4 Tier 2 (Nice-to-Have, 1-2 weeks):**
1. PDF report generation (add to export endpoints)
2. Mobile API (GraphQL or REST subset)
3. Multi-language support (Nepali translations)

**Phase 4 Tier 3 (Competitive, 2+ weeks):**
4. Multi-factor authentication (TOTP/SMS)
5. Real-time WebSocket updates (live notifications)

**Phase 4 Tier 4 (Future, Phase 5+):**
- Covenant compliance engine (rule-based monitoring)
- Predictive analytics (disbursement forecasting)
- Advanced reporting (custom dashboards)
- Mobile app (native iOS/Android)

---

## Acceptance Criteria

✅ PDF reports generate with SBL branding  
✅ Mobile API serves <10KB responses (vs 100KB desktop)  
✅ Nepali translations on 80% of common fields  
✅ MFA setup via authenticator app in <2 min  
✅ WebSocket delivers export completion in <1 second  
✅ All features tested on mobile devices (iOS/Android)  
✅ Performance: mobile API < 500ms, PDF gen < 5 seconds  
✅ Backwards compatible: Phase 3 endpoints unchanged  

---

## Architecture Updates

### Multi-Factor Authentication

```
User Login (AD)
    ↓
JWT token issued (but MFA pending)
    ↓
MFA verification required (TOTP/SMS)
    ↓
User enters code from authenticator
    ↓
Verify code valid (time window)
    ↓
Issue final JWT with mfa_verified claim
    ↓
All endpoints check mfa_verified
```

### PDF Generation

```
Export Request (format=pdf)
    ↓
Generate data (ReportService)
    ↓
Format PDF (PDFService)
    ↓
Add charts (matplotlib)
    ↓
Apply SBL branding (logo, headers)
    ↓
Upload to S3
    ↓
Return presigned URL
```

### WebSocket Broadcasting

```
Export Job Completes
    ↓
Post event to Redis pub/sub
    ↓
Broadcast to subscribed clients
    ↓
Client receives notification
    ↓
Update UI in real-time
```

---

## Dependency Check

**New Libraries Required:**
- `pyotp` — TOTP generation
- `qrcode` — QR code for authenticator setup
- `reportlab` or `weasypy` — PDF generation
- `matplotlib` or `plotly` — PDF charts
- `strawberry-graphql` or `graphene` — GraphQL (if chosen)
- `websockets` or `fastapi.websockets` — WebSocket server
- `redis` — Pub/sub for WebSocket scaling
- `babel` — Internationalization

**External Services:**
- Twilio (SMS delivery) — for MFA
- Redis (optional) — for WebSocket scaling, rate limit sync

**Infrastructure:**
- S3 bucket (already exist)
- Redis server (optional, for scaling)

---

## Risk Mitigation

| Risk | Mitigation | Owner |
|------|-----------|-------|
| MFA lockout | Backup codes + admin override | Dev |
| PDF memory usage | Streaming generation for large reports | Dev |
| WebSocket scalability | Redis pub/sub backend | DevOps |
| Mobile API rate limiting | Separate quotas per device | Dev |
| Translation maintenance | Community contribution process | PM |
| Backwards compatibility | Phase 3 endpoints frozen | Dev |

---

## Success Metrics

**Technical:**
- PDF generation < 5 seconds
- Mobile API response < 500ms
- WebSocket message delivery < 1 second
- 80%+ Nepali translation coverage
- MFA enrollment < 2 minutes
- Zero breaking changes to Phase 3 API

**Business:**
- Mobile user engagement increase
- Faster report distribution (PDF + email)
- Reduced support requests (MFA security)
- Improved stakeholder satisfaction (real-time updates)

---

## Phase 4 Roadmap

### Weeks 1-2
- Task 2: PDF report generation (portfolio, covenant, capex)
- Task 3: Mobile API (GraphQL or REST subset)

### Week 3
- Task 1: Multi-factor authentication (TOTP + SMS)
- Task 5: Multi-language support (Nepali)

### Week 4 (if time)
- Task 4: Real-time WebSocket updates

### Phase 5 (Future)
- Covenant compliance engine
- Predictive analytics
- Advanced dashboards
- Native mobile apps

---

## Next Steps

1. **UAT Approval:** Validate Phase 3 with SBL team
2. **Phase 4 Planning:** Prioritize tasks (all 5 or just Tier 2?)
3. **Design Review:** PDF layouts, mobile UI, translations
4. **Deployment:** Staged rollout of Phase 4 features

---

**Phase 4 is OPTIONAL.** System is production-ready without it.  
**Phase 3 Owner:** Ready for handoff to Phase 4 team  
**Phase 4 Start:** 2026-10-06 (pending UAT sign-off)  
**Phase 4 Duration:** 2-3 weeks for all 5 tasks  
**Phase 4 Completion Target:** 2026-10-27  

