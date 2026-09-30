# Task #25: Audit Logging
## Complete 3-Phase Architecture Specification

**Status:** Phase 1 (UI Screens & Components)  
**Target LOC:** 2,300+ (Phase 1: 1,000+ | Phase 2: 900+ | Phase 3: 400+)  
**E2E Tests:** 30+ comprehensive tests  
**Delivery Timeline:** 3 phases, production-ready

---

## Overview
Comprehensive audit logging system tracking all user actions with timestamps, detailed change records, user attribution, and rollback capability. Enable compliance auditing, forensic investigation, and operational accountability.

---

## PHASE 1: UI Screens & Components (1,000+ LOC)

### Screens (950 LOC)

#### 1. **AuditLogScreen.tsx** (280 LOC)
Master audit log viewer with filtering, search, and export.

```
Layout:
┌─ Filters Row
│  ├─ Date Range Picker (start/end with calendar)
│  ├─ Action Type Dropdown (all/create/update/delete/export/import)
│  ├─ Feature Filter (projects/inspections/workorders/compliance/reports)
│  ├─ User Filter (all users / specific user dropdown)
│  └─ Search Box (free-text search on changes)
├─ Action Bar
│  ├─ "Clear Filters" button
│  ├─ "Export Audit Log" button
│  └─ View Mode Toggle (List/Details)
├─ Audit Log List
│  └─ Rows: [Timestamp] [Action] [User] [Feature] [Summary] [Details Button]
│     - Timestamp: "2026-09-29 14:35:22"
│     - Action: CREATE, UPDATE, DELETE, EXPORT, IMPORT, ROLLBACK
│     - User: "akash@example.com"
│     - Feature: "Projects" / "Inspections" / etc.
│     - Summary: "Updated project status to Active"
│     - Color-coded action badges
└─ Pagination (25/50/100 items per page)
```

**State Management:**
- logs: AuditLog[]
- selectedLog: AuditLog | null
- filters: { dateRange, actionType, feature, user, searchText }
- pagination: { page, limit, total }
- loading: boolean
- viewMode: 'list' | 'details'

**Key Methods:**
- loadLogs(filters): Fetch with applied filters
- updateFilters(newFilters): Reset pagination, reload
- selectLog(log): Show details panel
- exportLogs(): Download filtered logs as CSV/JSON
- clearFilters(): Reset all filters to defaults

---

#### 2. **AuditDetailScreen.tsx** (320 LOC)
Detailed view of a single audit event with before/after comparison.

```
Layout:
┌─ Header
│  ├─ Action Badge (CREATE/UPDATE/DELETE/EXPORT/IMPORT/ROLLBACK)
│  ├─ Timestamp: "2026-09-29 14:35:22 UTC"
│  └─ Back Button
├─ Event Metadata Panel
│  ├─ User: "akash@example.com" (clickable for user history)
│  ├─ Feature: "Projects"
│  ├─ Record ID: "proj-12345"
│  ├─ IP Address: "192.168.1.100"
│  ├─ User Agent: "Mobile App v1.0"
│  └─ Session ID: "sess-abc123"
├─ Changes Section (if UPDATE)
│  └─ Tabular comparison:
│     ┌─ Field | Before Value | After Value
│     ├─ status | "Pending" | "Active"
│     ├─ name | "Old Name" | "New Name"
│     └─ ...
├─ Full Data Section
│  └─ JSON viewer (collapsible)
│     { id: "proj-12345", name: "New Name", status: "Active", ... }
├─ Related Events Section
│  └─ List of other events for this record
│     - 2026-09-28: Updated by another user
│     - 2026-09-27: Created by user
└─ Rollback Section (if DELETE or critical UPDATE)
   ├─ "Restore Record" button (admin only)
   ├─ "Preview Restoration" toggle
   └─ Confirmation prompt
```

**State Management:**
- log: AuditLog (full details)
- relatedLogs: AuditLog[] (other events for same record)
- showPreview: boolean (rollback preview)
- previewData: any (what will be restored)
- rollbackLoading: boolean

**Key Methods:**
- loadLogDetails(logId): Fetch full details + related
- initiateRollback(logId): Show confirmation
- executeRollback(logId): Restore previous state (admin protected)
- copyToClipboard(data): JSON copy
- navigateToRelatedEvent(logId): Jump to related event

---

#### 3. **AuditSearchScreen.tsx** (250 LOC)
Advanced search with filters, saved searches, and analytics.

```
Layout:
┌─ Search Header
│  ├─ "Search Audit Logs" title
│  └─ Help icon: "Search syntax help"
├─ Search Box (advanced mode)
│  └─ Free-text search (supports: user:email, action:UPDATE, feature:Projects, date:>2026-09-20)
├─ Quick Filters Row
│  ├─ "Last 24 Hours" button
│  ├─ "Last 7 Days" button
│  ├─ "This Month" button
│  ├─ "Custom Range" button
│  ├─ "My Actions" button
│  └─ "Admin Actions" button (admin only)
├─ Advanced Filter Panel (collapsible)
│  ├─ Action Type: Checkboxes (CREATE/UPDATE/DELETE/EXPORT/IMPORT/ROLLBACK)
│  ├─ Feature: Multi-select (Projects/Inspections/WorkOrders/Compliance/Reports)
│  ├─ User: Multi-select dropdown
│  ├─ Change Type: Checkboxes (Field changes / Status changes / Data added / Data removed)
│  ├─ Severity: Checkboxes (Info / Warning / Critical)
│  └─ Apply Filters button
├─ Saved Searches Section
│  └─ Rows: [Name] [Query] [Last Used] [Delete]
│     - "Recent Exports" - action:EXPORT, feature:Projects
│     - "My Updates" - user:akash@example.com, action:UPDATE
├─ Search Results
│  └─ Paginated list matching query
└─ Save Current Search Dialog (modal)
   ├─ Search Name: text input
   └─ Save button
```

**State Management:**
- searchQuery: string
- filters: AdvancedFilters
- results: AuditLog[]
- savedSearches: SavedSearch[]
- selectedSavedSearch: SavedSearch | null
- resultCount: number
- loading: boolean

**Key Methods:**
- performSearch(query, filters): Execute search
- applyQuickFilter(type): Apply preset time/user/action filter
- loadSavedSearches(): Fetch user's saved searches
- saveSearch(name, query, filters): Create new saved search
- deleteSavedSearch(id): Remove saved search
- applySearch(savedSearch): Load and execute saved search

---

#### 4. **AuditStatsScreen.tsx** (220 LOC)
Audit statistics and analytics dashboard.

```
Layout:
┌─ Period Selector
│  ├─ "This Week" / "This Month" / "This Year" / "Custom" buttons
│  └─ Date range display
├─ Summary Statistics Cards (4-column grid)
│  ├─ "Total Events" - large number with trend arrow
│  │  └─ "↑ 12% from last period"
│  ├─ "Create Operations" - number
│  │  └─ "45 new records added"
│  ├─ "Update Operations" - number
│  │  └─ "128 existing records modified"
│  └─ "Delete Operations" - number
│     └─ "12 records removed"
├─ Actions by Type (bar chart)
│  └─ CREATE: 45 | UPDATE: 128 | DELETE: 12 | EXPORT: 8 | IMPORT: 3 | ROLLBACK: 0
├─ Feature Activity (horizontal bar)
│  └─ Projects: ████████ 45 | Inspections: ██████████ 128 | WorkOrders: ████ 12
├─ Top Users (leaderboard)
│  └─ Rows: [User] [Actions] [Last Active]
│     1. akash@example.com - 245 actions - 2 min ago
│     2. john@example.com - 128 actions - 1 hour ago
├─ Activity Timeline (sparkline chart)
│  └─ Daily event count for period
└─ Export Analytics button
```

**State Management:**
- period: 'week' | 'month' | 'year' | 'custom'
- dateRange: { start, end }
- stats: { totalEvents, creates, updates, deletes, exports, imports, rollbacks }
- actionCounts: Record<ActionType, number>
- featureActivity: Record<Feature, number>
- topUsers: UserActivity[]
- timelineData: DailyCount[]
- loading: boolean

**Key Methods:**
- loadStats(period, dateRange): Fetch aggregated statistics
- generateChart(data, type): Render chart visualization
- exportStats(format): Download as PDF/CSV
- updatePeriod(period): Change time range

---

### Components (50 LOC)

#### 1. **AuditLogRow.tsx** (25 LOC)
Reusable audit log table row component.

```typescript
Props:
- log: AuditLog
- onSelect: (log: AuditLog) => void
- isSelected: boolean

Renders:
- [Timestamp badge] [Action badge] [User name] [Feature] [Summary] [Chevron]
- Color-coded action badges (CREATE: green, UPDATE: blue, DELETE: red, etc.)
- Hover: background highlight + cursor pointer
- Click: calls onSelect
```

#### 2. **ChangeComparison.tsx** (25 LOC)
Before/after value comparison for update operations.

```typescript
Props:
- before: any
- after: any
- fieldName: string

Renders:
- Two-column layout: [Before Value] | [After Value]
- Highlighting differences (strikethrough before, underline after)
- JSON formatting for complex objects
- Handles null/undefined gracefully
```

---

## PHASE 2: Services & API (900+ LOC)

### Services (450 LOC)

#### 1. **audit.service.ts** (250 LOC)
Core audit logging and data access layer.

```typescript
Interface AuditLog {
  id: string
  timestamp: ISO8601
  userId: string
  userEmail: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT' | 'ROLLBACK'
  feature: 'projects' | 'inspections' | 'workorders' | 'compliance' | 'reports'
  recordId: string
  recordType: string
  changes: FieldChange[]  // for UPDATE
  before?: any            // for UPDATE/DELETE
  after?: any             // for CREATE/UPDATE
  ipAddress: string
  userAgent: string
  sessionId: string
  severity: 'info' | 'warning' | 'critical'
  metadata: Record<string, any>
}

Interface FieldChange {
  field: string
  before: any
  after: any
  type: 'string' | 'number' | 'date' | 'object' | 'array'
}

Methods:

• logEvent(event: AuditEventInput): Promise<AuditLog>
  - Records user action with full context
  - Auto-detects IP, user agent, session
  - Assigns severity based on action type
  - Returns created log entry

• getLog(logId: string): Promise<AuditLog>
  - Fetch single log by ID

• searchLogs(query: AuditLogQuery): Promise<{ logs: AuditLog[], total: number }>
  - Query: { dateRange, actionType, feature, userId, text, page, limit }
  - Full-text search on changes field
  - Supports complex filtering

• getUserLogs(userId: string, limit?: number): Promise<AuditLog[]>
  - All actions by specific user

• getRecordHistory(recordId: string, feature: string): Promise<AuditLog[]>
  - All events for specific record (ordered by timestamp DESC)

• exportLogs(query: AuditLogQuery, format: 'csv' | 'json'): Promise<Blob>
  - Export filtered logs to file

• getStats(dateRange: DateRange): Promise<AuditStats>
  - Aggregated statistics: counts by action/feature/user, timeline

• canRollback(logId: string): Promise<boolean>
  - Check if rollback is permitted (admin + log not too old)

• rollbackEvent(logId: string, reason: string): Promise<void>
  - Admin-only: restore record to previous state, log the rollback itself
```

#### 2. **audit-api.ts** (200 LOC)
API endpoints for audit operations.

```typescript
API Endpoints:

GET /audits
  Query: { dateStart, dateEnd, action, feature, userId, text, page=1, limit=25 }
  Returns: { logs: AuditLog[], total: number, page, limit }
  Permissions: authenticated user

GET /audits/{id}
  Returns: AuditLog (full details)
  Permissions: authenticated user

POST /audits/search
  Body: { query: string, filters: AdvancedFilters, page, limit }
  Returns: { logs: AuditLog[], total: number, query, appliedFilters }
  Permissions: authenticated user

GET /audits/user/{userId}
  Query: { limit=50 }
  Returns: AuditLog[]
  Permissions: authenticated user

GET /audits/record/{recordId}
  Query: { feature, limit=100 }
  Returns: AuditLog[] (ordered by timestamp DESC)
  Permissions: authenticated user

GET /audits/export
  Query: { dateStart, dateEnd, action, feature, format='csv' }
  Returns: File blob (CSV or JSON)
  Permissions: authenticated user

GET /audits/stats
  Query: { dateStart, dateEnd, groupBy='action' }
  Returns: { stats, breakdown, topUsers, timeline }
  Permissions: authenticated user

GET /audits/saved-searches
  Returns: SavedSearch[] (user's saved searches)
  Permissions: authenticated user

POST /audits/saved-searches
  Body: { name: string, query: string, filters: AdvancedFilters }
  Returns: SavedSearch
  Permissions: authenticated user

DELETE /audits/saved-searches/{id}
  Permissions: authenticated user (owner only)

POST /audits/{id}/rollback
  Body: { reason: string }
  Returns: { success: boolean, restoredData: any }
  Permissions: admin only
  Side-effect: Creates new ROLLBACK audit log entry
```

---

### API Integration Services (450 LOC)

Already created in Phase 2: export-api.ts, import-api.ts follow same pattern. 
Audit API integrates with all feature APIs.

```typescript
// Auto-log wrapper
const loggedAPI = {
  async updateProject(id, data) {
    const before = await getProject(id);
    const result = await projectAPI.update(id, data);
    
    auditAPI.logEvent({
      action: 'UPDATE',
      feature: 'projects',
      recordId: id,
      before,
      after: result,
      changes: detectChanges(before, result)
    });
    
    return result;
  }
}
```

---

## PHASE 3: Hooks & E2E Tests (400+ LOC, 30+ tests)

### Hooks (150 LOC)

#### **useAuditLog.ts** (150 LOC)
Manage audit log operations and state.

```typescript
Interface AuditLogState {
  logs: AuditLog[]
  selectedLog: AuditLog | null
  filters: AuditLogFilters
  searchResults: AuditLog[]
  stats: AuditStats | null
  savedSearches: SavedSearch[]
  loading: boolean
  error: string | null
  pagination: { page, limit, total }
}

Methods:

• loadLogs(filters?, page?)
  - Fetch logs with optional filters
  - Update pagination

• selectLog(logId)
  - Load log details + related events

• updateFilters(newFilters)
  - Apply new filter set, reset to page 1

• searchLogs(query, filters)
  - Execute text + advanced search

• exportLogs(format: 'csv' | 'json')
  - Download filtered logs

• loadStats(dateRange)
  - Fetch aggregated statistics

• saveSavedSearch(name, query, filters)
  - Create and store named search

• applySavedSearch(searchId)
  - Load and execute saved search

• rollbackLog(logId, reason)
  - Restore record (admin only)

• getUserHistory(userId)
  - All actions by user

• getRecordHistory(recordId, feature)
  - All events for record
```

---

### E2E Tests (250+ LOC, 30+ tests)

**File:** audit-logging.e2e.ts

#### Audit Log Viewer Tests (10 tests)
- Open audit log screen
- Display logs in list view
- Click log to show details
- Filter by date range
- Filter by action type
- Filter by feature
- Filter by user
- Search with text
- Pagination (prev/next/page selection)
- Clear all filters

#### Detail View Tests (8 tests)
- Show log details panel
- Display before/after comparison
- Show related events list
- Navigate to related event
- Copy JSON to clipboard
- Show metadata (user, IP, session)
- Close details panel
- View related audit chain

#### Search & Filter Tests (7 tests)
- Advanced search dropdown
- Apply multiple filters together
- Save current search (name + save)
- Load saved search
- Delete saved search
- Quick filter buttons (Last 24H, Last 7D, My Actions)
- Clear saved search

#### Statistics Tests (3 tests)
- Load audit stats
- Show action counts by type
- Display top users leaderboard

#### Rollback Tests (2 tests)
- Show rollback confirmation (admin only)
- Execute rollback and verify new log created

**Total:** 30+ comprehensive E2E tests

---

## Success Criteria

### Phase 1 ✓
- [ ] 4 screens (AuditLogScreen, AuditDetailScreen, AuditSearchScreen, AuditStatsScreen)
- [ ] 2 components (AuditLogRow, ChangeComparison)
- [ ] Full filtering, searching, pagination
- [ ] Before/after comparison UI
- [ ] Statistics dashboard
- [ ] Clean, consistent UI matching previous tasks

### Phase 2 ✓
- [ ] audit.service.ts with all methods
- [ ] audit-api.ts with 11 endpoints
- [ ] Full-text search implementation
- [ ] Rollback preview + execution
- [ ] Export to CSV/JSON
- [ ] Statistics aggregation
- [ ] Saved searches storage

### Phase 3 ✓
- [ ] useAuditLog hook with all state management
- [ ] 30+ E2E tests (viewer, details, search, stats, rollback)
- [ ] All tests passing
- [ ] Error handling validated
- [ ] Performance tested (1000+ logs load < 3s)

---

## Estimated Completion
- Phase 1: 4-5 hours
- Phase 2: 4-5 hours
- Phase 3: 3-4 hours
- **Total:** ~12 hours development + testing

---

## Dependencies & Integration Points
- Uses existing API service patterns from Tasks #20-24
- Integrates with all feature APIs (projects, inspections, workorders, compliance, reports)
- Requires user/session context from authentication layer
- Storage: PostgreSQL audit_logs table with appropriate indexes
- Caching: Redis cache for stats (5-minute TTL)

---

## Notes for Implementation
- Follow established 3-phase pattern from Tasks #20-24
- Maintain TypeScript strict mode + React Native best practices
- Use Zustand for state management (consistent with existing app)
- E2E tests use Detox framework
- All code must be production-ready with error handling
- Comprehensive jsdoc comments on services
