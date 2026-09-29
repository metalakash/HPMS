# Task #22: Bulk Operations - Planning & Architecture
## Phase 7.3 Mobile App Enhancement

**Date:** 2026-09-29  
**Scope:** Multi-select, batch operations, progress tracking, rollback  
**Estimated LOC:** 2,500-3,000 across 3 phases  
**Tech Stack:** React Native 0.72, TypeScript, Zustand, Detox

---

## Overview

Bulk Operations enables users to perform actions on multiple items simultaneously: create, update, delete, archive, export, and restore. Key features include progress tracking, concurrent request management, and automatic rollback on failures.

---

## Phase 1: Screens & Components (900 LOC)

### 1.1 BulkSelectScreen.tsx (250 LOC)
**Purpose:** Multi-select interface for choosing items to bulk operate on

**Features:**
- Item list with checkboxes
- Select All / Deselect All buttons
- Selected count badge
- Search/filter within bulk list
- Item preview (title, status, type)
- Scroll through large lists (pagination)
- Select by feature type (inspections, maintenance, documents, etc.)
- Quick actions for selected items

**State:**
```
selectedItems: Map<string, Item>
selectAll: boolean
isSearching: boolean
searchQuery: string
featureFilter: string
```

**Props:**
- `items: Item[]`
- `onSelectionChange: (selected: string[]) => void`
- `onBulkActionStart: () => void`
- `maxSelectable?: number`

**Styling:**
- Light theme with checkbox indicators
- Selected item highlight (#E3F2FD)
- Disabled state for max selection reached
- Swipe-to-select gesture support

### 1.2 BulkActionsModal.tsx (200 LOC)
**Purpose:** Choose which bulk operation to perform

**Available Operations:**
1. **Update** - Update fields across selected items
   - Field selector
   - New value input
   - Confirmation preview

2. **Delete** - Delete selected items
   - Confirmation with count
   - Cascade dependency check
   - Permanent deletion warning

3. **Archive** - Archive selected items
   - Keep metadata
   - Reversible operation
   - Archive date stamp

4. **Restore** - Restore archived items
   - Select which archived items
   - Restore metadata
   - Relink dependencies

5. **Export** - Export selected items
   - Format selection (CSV, JSON, Excel)
   - Field selection
   - Download or email

6. **Duplicate** - Duplicate selected items
   - Template selection
   - Field mapping
   - Batch numbering

**UI Elements:**
- Action buttons grid (6 columns, wrap on small screens)
- Icon + label per action
- Disabled state for unavailable actions
- Confirmation step before execution
- Cancel and Proceed buttons

**State:**
```
selectedAction: 'update' | 'delete' | 'archive' | 'restore' | 'export' | 'duplicate'
actionConfig: Record<string, any>
isConfirming: boolean
```

### 1.3 BulkOperationSettings.tsx (200 LOC)
**Purpose:** Configure bulk operation parameters

**For Update:**
- Field selector (dropdown)
- Value input (text, date, select, etc.)
- Apply to all or specific subset
- Preview affected items

**For Delete:**
- Confirm item count
- Show cascade impacts
- Verify deletion reason

**For Export:**
- Format selection
- Field checkboxes
- Include metadata toggle
- Email vs download

**For Archive:**
- Archive reason/notes
- Retention policy
- Tag for categorization

**State:**
```
operationType: string
config: BulkOperationConfig
previewItems: Item[]
validation: ValidationError[]
```

### 1.4 ProgressTracker.tsx (150 LOC)
**Purpose:** Real-time progress visualization during bulk operation execution

**Features:**
- Progress bar (0-100%)
- Item counter (Processed 45 of 120)
- Current item being processed
- Elapsed time and estimated time remaining
- Speed metrics (items/sec)
- Success/Error/Skipped counters
- Cancel operation button
- Pause/Resume buttons
- Animation during processing

**State:**
```
total: number
processed: number
successful: number
failed: number
skipped: number
currentItem?: Item
elapsedTime: number
estimatedTimeRemaining: number
isPaused: boolean
canCancel: boolean
```

**UI:**
- Animated progress bar with gradient
- Real-time statistics
- Current operation log (last 5 items)
- Status badges (success ✓, error ✗, skip ⊖)

### 1.5 BulkOperationResults.tsx (250 LOC)
**Purpose:** Display operation completion summary and detailed results

**Sections:**

**1. Summary Header**
- Operation name
- Total items processed
- Success/failure counts
- Execution time
- Average speed

**2. Results List**
```
For each item:
- Item title
- Status (✓ Success, ✗ Failed, ⊖ Skipped)
- Error message (if failed)
- Action taken (what was done)
- Timestamp
```

**3. Statistics**
- Success rate %
- Average processing time per item
- Failure categories breakdown
- Items by status

**4. Actions**
- Retry failed items (only show if failures exist)
- Undo operation (if reversible: archive, update, duplicate)
- Export results as CSV
- Share results with team
- Return to list

**5. Expandable Error Section**
- Detailed error messages
- Stack traces for debugging
- Suggested remediation
- Retry single item button

**State:**
```
results: OperationResult[]
summary: BulkOperationSummary
expandedError?: string
isRetrying: boolean
```

### 1.6 BulkSelectToolbar.tsx (100 LOC)
**Purpose:** Floating toolbar during bulk selection

**Shows:**
- Selected count badge
- Quick actions (Select All, Clear Selection)
- Proceed to bulk operation button
- Cancel selection button
- Menu button for advanced options

**Features:**
- Sticky bottom position
- Swipe-to-close gesture
- Auto-hide when scrolling
- Touch-optimized button sizes

### 1.7 BulkOperationNotification.tsx (50 LOC)
**Purpose:** Toast-style notification for bulk operation start/completion

**Shows:**
- Operation started toast (5s auto-dismiss)
- Operation completed toast with result link
- Operation failed toast with retry button
- "View Results" action button

---

## Phase 2: Services & API Integration (900 LOC)

### 2.1 bulk-operation.service.ts (350 LOC)
**Purpose:** Main service orchestrating bulk operations

**Methods:**

```typescript
// Operation management
startBulkOperation(type: BulkOperationType, itemIds: string[], config: BulkConfig): Promise<OperationId>
getBulkOperationStatus(operationId: string): Promise<BulkOperationStatus>
cancelBulkOperation(operationId: string): Promise<void>
pauseBulkOperation(operationId: string): Promise<void>
resumeBulkOperation(operationId: string): Promise<void>

// Batch execution
executeBatch(batch: BulkBatch): Promise<BatchResult>
executeWithConcurrency(items: string[], action: (id: string) => Promise<any>, maxConcurrent: number): Promise<ConcurrentResult>

// Rollback
rollbackOperation(operationId: string): Promise<void>
canRollback(operationType: BulkOperationType): boolean

// Results
getOperationResults(operationId: string): Promise<OperationResult[]>
getOperationSummary(operationId: string): Promise<BulkOperationSummary>
retryFailedItems(operationId: string): Promise<OperationId>
```

**Features:**
- Request queuing with priority support
- Concurrent execution (configurable, default 5)
- Automatic retry with exponential backoff
- Progress event emission (via Zustand)
- Request timeout handling
- Memory-efficient batching
- AsyncStorage persistence of operation status

**Queue Management:**
- Max 10 concurrent operations (across all users)
- Queue position tracking
- Estimated wait time calculation
- Priority elevation for smaller batches

### 2.2 bulk-operation-manager.ts (300 LOC)
**Purpose:** Operation execution engine with concurrency and rollback support

**Core Logic:**

```typescript
class BulkOperationManager {
  private executionQueue: BulkOperation[] = []
  private activeOperations: Map<string, ExecutingOperation> = new Map()
  
  async execute(operation: BulkOperation): Promise<void>
  private processBatch(items: string[], action: Function): Promise<BatchResult>
  private handleConcurrency(maxConcurrent: number): Promise<void>
  private trackProgress(operationId: string, processed: number, total: number): void
  private collectFailures(operationId: string, failures: OperationFailure[]): void
}
```

**Concurrency Strategy:**
- Default 5 concurrent requests
- Automatic backoff if API overloaded (503)
- Per-device concurrency limit to prevent bottlenecks
- Task priority queue for VIP batches

**Rollback Implementation:**
- Change log for update operations
- Shadow copies for non-reversible operations
- Undo stack per operation (limited to last 5)
- Atomic rollback at operation level

### 2.3 bulk-validation.service.ts (150 LOC)
**Purpose:** Pre-flight validation before bulk operations

**Methods:**

```typescript
validateBulkUpdate(items: Item[], updates: UpdateConfig): ValidationResult
validateBulkDelete(items: Item[]): ValidationResult  // Check dependencies
validateBulkArchive(items: Item[]): ValidationResult
validateBulkExport(items: Item[], format: ExportFormat): ValidationResult
```

**Checks:**
- No duplicate items selected
- User has permission for operation
- Items meet operation prerequisites
- No circular dependencies (for delete)
- Storage available (for export)
- API rate limit not exceeded
- Batch size within limits

### 2.4 bulk-api.ts (250 LOC)
**Purpose:** API endpoints for bulk operations

**Endpoints:**

```
POST /bulk/update
  { itemIds: string[], updates: Record<string, any> }
  → { operationId: string, queued: boolean, position: number }

POST /bulk/delete
  { itemIds: string[] }
  → { operationId: string, estimatedTime: number }

POST /bulk/archive
  { itemIds: string[], reason?: string }
  → { operationId: string }

POST /bulk/restore
  { itemIds: string[] }
  → { operationId: string }

POST /bulk/export
  { itemIds: string[], format: 'csv'|'json'|'excel', fields?: string[] }
  → { url: string, expiresIn: number }

POST /bulk/duplicate
  { itemIds: string[], templateId?: string }
  → { operationId: string }

GET /bulk/status/:operationId
  → { status: 'queued'|'processing'|'completed'|'failed', progress: number, ... }

GET /bulk/results/:operationId
  → { results: OperationResult[], summary: BulkOperationSummary }

POST /bulk/cancel/:operationId
  → { success: boolean }

POST /bulk/rollback/:operationId
  → { success: boolean, itemsRestored: number }
```

**Error Handling:**
- 429 Too Many Requests: Backoff and retry
- 400 Invalid Batch: Detailed error per item
- 500 Server Error: Automatic retry up to 3 times
- 413 Payload Too Large: Split batch in half and retry

---

## Phase 3: Custom Hooks & E2E Tests (700 LOC, 40+ tests)

### 3.1 useBulkSelect.ts (150 LOC)
**Purpose:** Manage item selection state

```typescript
export const useBulkSelect = (items: Item[]) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectedItems = useMemo(() => items.filter(i => selectedIds.has(i.id)), [items, selectedIds])
  
  return {
    selectedIds,
    selectedItems,
    toggleItem: (id: string) => void
    selectAll: () => void
    clearSelection: () => void
    isSelected: (id: string) => boolean
    count: number
  }
}
```

### 3.2 useBulkOperation.ts (150 LOC)
**Purpose:** Orchestrate bulk operation execution

```typescript
export const useBulkOperation = () => {
  const [operationState, setOperationState] = useState<BulkOperationState>()
  const [progress, setProgress] = useState<ProgressState>()
  
  const startOperation = async (type: BulkOperationType, itemIds: string[], config: any) => {
    // Validate, execute, track progress
  }
  
  const cancelOperation = async () => void
  const pauseOperation = async () => void
  const resumeOperation = async () => void
  const retryFailed = async () => void
  const rollback = async () => void
  
  return { operationState, progress, startOperation, cancelOperation, ... }
}
```

### 3.3 useBulkProgress.ts (100 LOC)
**Purpose:** Track and update progress during execution

```typescript
export const useBulkProgress = (operationId: string) => {
  const [progress, setProgress] = useState<ProgressState>()
  const [stats, setStats] = useState<ProgressStats>()
  
  useEffect(() => {
    // Subscribe to progress events
    const unsubscribe = bulkService.onProgress(operationId, (update) => {
      setProgress(prev => ({ ...prev, ...update }))
      updateStats()
    })
    return unsubscribe
  }, [operationId])
  
  return { progress, stats, timeRemaining }
}
```

### 3.4 E2E Tests (400+ LOC, 40+ tests)

**Test Suites:**

**T001-T010: Bulk Selection (10 tests)**
- Display items with checkboxes
- Toggle individual items
- Select all / deselect all
- Selected count badge
- Max selection limit
- Search within bulk selection
- Filter by feature type
- Disable already-selected items
- Persistence of selection on navigation
- Keyboard support (spacebar to select)

**T011-T020: Bulk Actions Modal (10 tests)**
- Display available actions
- Disable unavailable actions based on selection
- Action button interaction
- Update configuration screen
- Delete confirmation dialog
- Archive with reason input
- Export format selection
- Field selection for export
- Duplicate with template selection
- Cancel operation

**T021-T030: Operation Execution (10 tests)**
- Start bulk update operation
- Start bulk delete operation
- Start bulk archive operation
- Start bulk export operation
- Progress tracking display
- Cancel during execution
- Pause and resume operation
- Handle API timeout gracefully
- Handle partial failures (continue processing)
- Request concurrency (verify max 5 parallel)

**T031-T040: Results & Rollback (10 tests)**
- Display operation summary
- Show success/failure counts
- List results by item
- Expand error details
- Retry failed items only
- Rollback operation (undo)
- Verify rollback reversal (check state)
- Export results as CSV
- Share results with team
- Clear results and return to list

**T041-T050: Edge Cases (10+ tests)**
- Empty selection (disable bulk action)
- Single item selection (allow bulk action)
- Large batch (1000+ items, split handling)
- Network failure during execution
- Duplicate items in selection
- Mixed feature types (handle gracefully)
- Concurrent bulk operations (queue management)
- Operation persistence (refresh doesn't lose state)
- Rapid action toggle (debounce/prevent)
- Memory cleanup on component unmount

---

## Data Models

### BulkOperation
```typescript
interface BulkOperation {
  id: string
  type: 'update' | 'delete' | 'archive' | 'restore' | 'export' | 'duplicate'
  itemIds: string[]
  config: Record<string, any>
  userId: string
  createdAt: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  queuePosition?: number
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  skippedItems: number
  startedAt?: string
  completedAt?: string
  estimatedTimeRemaining?: number
}
```

### OperationResult
```typescript
interface OperationResult {
  itemId: string
  status: 'success' | 'failed' | 'skipped'
  itemTitle: string
  action: string
  error?: string
  errorCode?: string
  timestamp: string
}
```

### BulkOperationConfig
```typescript
interface BulkOperationConfig {
  // For update
  field?: string
  value?: any
  
  // For export
  format?: 'csv' | 'json' | 'excel'
  fields?: string[]
  includeMetadata?: boolean
  
  // For archive
  reason?: string
  
  // For duplicate
  templateId?: string
  numberingPattern?: string
}
```

---

## Success Criteria

✅ Multi-select UI with select-all/none  
✅ 6 bulk operation types (update, delete, archive, restore, export, duplicate)  
✅ Progress tracking with real-time updates  
✅ Concurrent request management (max 5 parallel)  
✅ Automatic rollback for reversible operations  
✅ Error handling and retry logic  
✅ Bulk operation results with detailed view  
✅ 40+ comprehensive E2E tests  
✅ Memory-efficient batching for large selections  
✅ Request queuing and priority support  

---

## Timeline

- **Phase 1 (Screens):** 900 LOC, ~4-5 hours
- **Phase 2 (Services):** 900 LOC, ~4-5 hours
- **Phase 3 (Hooks & Tests):** 700 LOC, 40+ tests, ~4-5 hours

**Total Estimated:** 2,500 LOC, 3 phases, 12-15 hours

---

## Known Limitations & Future Enhancements

1. **Batch Splitting:** Automatic split for >1000 items (future: configurable threshold)
2. **Scheduled Operations:** Future enhancement for scheduled bulk operations
3. **Webhooks:** Future: Notify external systems on bulk operation completion
4. **Advanced Filtering:** Future: Pre-built bulk operation templates
5. **Analytics:** Future: Track bulk operation usage and performance

---

## Integration Points

- **Search:** Selected items from search results
- **Saved Filters:** Apply bulk operations to saved filter results
- **Notifications:** Toast on operation start/completion
- **Analytics:** Track bulk operation metrics
- **Offline:** Queue operations for sync when online

