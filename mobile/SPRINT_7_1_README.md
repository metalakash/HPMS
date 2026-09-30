# Sprint 7.1: Foundation & Dashboard

**Duration:** 2 weeks (12 person-days)  
**Branch:** `phase-7-1-foundation`  
**Target Completion:** ~1,800-2,200 LOC + 100+ E2E tests

## Sprint Tasks

### Task #1: Kickoff (✅ IN PROGRESS)
- [x] Verify project structure
- [x] Create feature branch
- [x] Set up directories: components/, services/, utils/, hooks/
- [ ] Verify dependencies (npm install)
- [ ] Run existing E2E tests to ensure baseline

### Task #2: Component Library Part 1 - Layout Components
**Target:** 400-500 LOC  
**Components to build:**
- ScreenContainer
- Card + CardHeader + CardBody
- Badge (status-colored)
- ListItem
- Header (top navigation)
- TabBar (bottom navigation)
- EmptyState
- ErrorState
- LoadingOverlay
- PullToRefresh wrapper

**Files:**
- `src/components/layout/ScreenContainer.tsx`
- `src/components/layout/Card.tsx`
- `src/components/layout/Badge.tsx`
- `src/components/layout/ListItem.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/index.ts` (barrel export)
- `src/components/layout/*.test.tsx` (basic tests)

### Task #3: Component Library Part 2 - Form & Chart Components
**Target:** 500-600 LOC  
**Components to build:**
- TextInput
- Select/Dropdown
- DatePicker
- Checkbox
- SegmentedControl
- LineChart (SVG-based)
- BarChart (SVG-based)
- GaugeChart (SVG-based)
- ProgressBar
- Spinner
- Skeleton (loading placeholder)

**Files:**
- `src/components/forms/TextInput.tsx`
- `src/components/forms/Select.tsx`
- `src/components/forms/DatePicker.tsx`
- `src/components/forms/Checkbox.tsx`
- `src/components/charts/LineChart.tsx`
- `src/components/charts/BarChart.tsx`
- `src/components/charts/GaugeChart.tsx`
- `src/components/display/*.tsx` (indicators)
- `src/components/index.ts` (main barrel export)

### Task #4: Enhance Zustand Store with Offline Queue
**Target:** 300-400 LOC  
**Updates to `src/store/app.store.ts`:**
- Add offline mode detection (isOnline: boolean)
- Add sync queue (offlineQueue: SyncItem[])
- Add sync state tracking (syncPending, lastSyncTime, syncErrors)
- Implement queue actions:
  - `addToQueue(action, data)` - Add to pending queue
  - `processQueue()` - Sync pending items when online
  - `clearQueue()` - Clear all pending items
  - `setSyncError(id, error)` - Track sync failures
- Add localStorage persistence for queue

**Files:**
- `src/store/app.store.ts` (enhanced)
- `src/utils/offline.ts` (queue management helpers)

### Task #5: Initialize WatermelonDB Schema
**Target:** 200-300 LOC  
**Setup:**
- Create WatermelonDB database schema
- Define tables:
  - `projects` (id, name, capacity_mw, status, lastUpdated)
  - `inspections` (id, projectId, date, notes, photos, syncStatus)
  - `maintenanceWorks` (id, projectId, equipment, status, dueDate)
  - `projectAnalytics` (projectId, metrics, lastUpdated)
  - `documents` (id, projectId, fileName, localPath)
- Create indexes for common queries
- Initialize database service with sync helpers

**Files:**
- `src/services/database.service.ts`
- `src/database/schema.ts`
- `src/database/migrations/index.ts`

### Task #6: Implement Dashboard Screen
**Target:** 400-500 LOC  
**Components:**
- Portfolio KPI Cards (4 metrics)
- Projects List (FlatList with pagination)
- Pull-to-refresh
- Real-time update indicator
- Empty/error states

**Files:**
- `src/screens/Dashboard.tsx` (refactored from placeholder)
- `src/screens/components/PortfolioKPI.tsx`
- `src/screens/components/ProjectsList.tsx`

### Task #7: Set up API Integration
**Target:** 200-300 LOC  
**Endpoints:**
- `GET /api/v1/analytics/portfolio` → Portfolio metrics
- `GET /api/v1/projects?page=1&page_size=10` → Projects list
- Implement caching strategy
- Error handling & retry logic

**Files:**
- `src/services/api.service.ts` (enhance existing)
- `src/services/endpoints.ts` (organize API calls)

### Task #8: Integrate WebSocket for Real-time Updates
**Target:** 200-300 LOC  
**Features:**
- WebSocket connection to backend
- Real-time project status updates
- Notification badge for updates
- Connection status indicator
- Auto-refresh on status changes

**Files:**
- `src/services/websocket.service.ts`
- `src/hooks/useWebSocket.ts`

### Task #9: Set up E2E Test Framework
**Target:** 100+ test cases  
**Tests:**
- Dashboard load
- Projects list rendering
- Pull-to-refresh
- Navigation to project detail
- KPI cards visibility
- Real-time update handling
- Offline scenarios

**Files:**
- `e2e/dashboard.e2e.ts`
- `e2e/helpers/testData.ts`
- `e2e/helpers/actions.ts`

### Task #10: Documentation
**Target:** Markdown docs  
**Docs to create:**
- `COMPONENT_LIBRARY.md` - Usage examples and patterns
- `OFFLINE_SYNC.md` - Queue & sync documentation
- `API_INTEGRATION.md` - How to fetch data
- `TESTING.md` - E2E test patterns

## Daily Standup Template

```
What did I do?
What will I do?
Blockers?
Component library progress: X%
Dashboard progress: X%
Test coverage: X%
```

## Success Criteria

- [ ] All 20 components implemented and tested
- [ ] Dashboard screen fully functional
- [ ] Offline queue working with Zustand
- [ ] WatermelonDB initialized and tested
- [ ] 100+ E2E tests passing
- [ ] Documentation complete
- [ ] Code coverage > 70%
- [ ] Zero console errors/warnings

## Dependency Chain

```
#1 (Kickoff) → #2, #4, #5 (parallel)
#2, #3, #4, #5 → #6 (Dashboard)
#6 → #7 (API Integration)
#7 → #8 (WebSocket)
#6 → #9 (E2E Tests)
#1-9 → #10 (Documentation)
```

## Known Risks

1. **WatermelonDB learning curve** - May need to research schema design
2. **Performance with large lists** - Test with real data sizes
3. **WebSocket reliability** - Need fallback strategies
4. **Image handling** - Need to test photo storage/retrieval

## Resources

- WatermelonDB Docs: https://watermelondb.org/
- React Native Navigation: https://reactnavigation.org/
- Zustand Docs: https://github.com/pmndrs/zustand
- Detox Testing: https://detox.e2e.dev/

---

**Created:** 2026-09-27  
**Sprint Lead:** Claude  
**Status:** 🟢 ACTIVE
