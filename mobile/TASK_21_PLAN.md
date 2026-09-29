# Task #21: Advanced Search & Filtering - PLANNING ✅

**Date:** 2026-09-29  
**Status:** PLANNING PHASE  
**Target:** Complete in 3-4 days  

---

## Executive Summary

Task #21 adds powerful search and filtering capabilities across all HPMS features. Enables users to quickly find inspections, work orders, documents, and covenants with full-text search, multi-field filters, saved searches, and search history.

---

## Feature Breakdown

### 1. Full-Text Search

**Overview:** Search across all features using keywords

**Supported Features:**
- Inspections: Search title, description, location, checklist items
- Maintenance: Search work order title, description, assigned person
- Documents: Search filename, category, tags, notes
- Analytics: Search report title, metric names
- Covenants: Search covenant name, category, description

**API Endpoints:**
```
POST   /search                  - Full-text search
GET    /inspections/search      - Inspection-specific search
GET    /work-orders/search      - Work order search
GET    /documents/search        - Document search
GET    /covenants/search        - Covenant search
GET    /search/history          - Search history
DELETE /search/history/{id}     - Clear history item
```

**Features:**
- Real-time search suggestions
- Search history tracking
- Result pagination
- Result highlighting
- Filter refinement from results

---

### 2. Multi-Field Filtering

**Overview:** Filter by multiple criteria per feature

**Inspection Filters:**
- Type (Routine, Special, Follow-up, etc.)
- Status (Draft, Submitted, Approved, Rejected)
- Date range (From/To)
- Location
- Assigned to
- Priority (Low, Medium, High)
- Checklist completion

**Maintenance Filters:**
- Work order type (Preventive, Corrective, Emergency)
- Status (Scheduled, In Progress, Completed, Cancelled)
- Date range
- Assigned to
- Priority
- Cost range
- Contractor

**Document Filters:**
- Category (Permit, Report, Photo, etc.)
- Type (PDF, Image, Excel, etc.)
- Date uploaded
- Status (Active, Archived, Expired)
- Shared with
- Tags

**Covenant Filters:**
- Category (Financial, Operational, Environmental)
- Status (Compliant, Warning, Breached, Pending)
- Frequency (Daily, Weekly, Monthly, etc.)
- Risk level
- Breach status
- Last verified date range

**Analytics Filters:**
- Metric type
- Time period (7D, 30D, 90D, Year)
- Status (Improved, Stable, Declining)

---

### 3. Saved Search Filters

**Overview:** Save frequently used filter combinations

**Features:**
- Save current filter set with custom name
- List saved filters with preview
- Quick-apply saved filters
- Edit saved filter
- Delete saved filter
- Share saved filter with team
- Set as default filter
- Filter version history

**API Endpoints:**
```
POST   /saved-filters           - Create filter
GET    /saved-filters           - List filters
GET    /saved-filters/{id}      - Get filter details
PUT    /saved-filters/{id}      - Update filter
DELETE /saved-filters/{id}      - Delete filter
POST   /saved-filters/{id}/share - Share with team
```

---

### 4. Search History

**Overview:** Track and recall previous searches

**Features:**
- Auto-save last 20 searches
- Show recent searches
- Quick search from history
- Clear search history
- Export search history
- Search analytics

---

## Screens to Build

### 1. Advanced Search Screen (Modal/Full Screen)

**Features:**
- Search input with autocomplete
- Real-time suggestions
- Search across all features toggle
- Recent searches list
- Recent suggestions
- Search history
- Clear search history

**File:** `src/screens/AdvancedSearchModal.tsx` (250 LOC)

### 2. Search Results Screen

**Features:**
- Show results grouped by feature
- Highlight matching terms
- Result snippets
- Result count
- Refinement options
- Filter results

**File:** `src/screens/SearchResultsScreen.tsx` (300 LOC)

### 3. Saved Filters Screen

**Features:**
- List all saved filters
- Filter by feature
- Preview filter criteria
- Apply filter
- Edit/Delete filter
- Share filter

**File:** `src/screens/SavedFiltersScreen.tsx` (280 LOC)

### 4. Filter Builder Screen

**Features:**
- Interactive filter builder
- Add/remove filter criteria
- Preset filter templates
- Filter preview
- Save filter
- Clear filters

**File:** `src/screens/FilterBuilderScreen.tsx` (320 LOC)

### 5. Search History Screen

**Features:**
- List recent searches
- Search metadata (time, results count)
- Quick re-search
- Clear history
- Export history

**File:** `src/screens/SearchHistoryScreen.tsx` (200 LOC)

---

## Services to Build

### 1. SearchService (350 LOC)

**Methods:**
```typescript
search(query: string, features?: string[]): Promise<SearchResult[]>
getSearchSuggestions(query: string): Promise<string[]>
getSearchHistory(): Promise<SearchHistoryItem[]>
addToSearchHistory(query: string, resultCount: number): Promise<void>
clearSearchHistory(): Promise<void>
deleteSearchHistoryItem(id: string): Promise<void>
```

### 2. FilterService (300 LOC)

**Methods:**
```typescript
getAvailableFilters(feature: string): Promise<FilterOption[]>
applyFilters(feature: string, filters: Filter[]): Promise<any[]>
validateFilter(filter: Filter): boolean
buildFilterQuery(filters: Filter[]): string
getFilterPresets(feature: string): Promise<FilterPreset[]>
```

### 3. SavedFilterService (250 LOC)

**Methods:**
```typescript
getSavedFilters(feature?: string): Promise<SavedFilter[]>
getSavedFilter(id: string): Promise<SavedFilter>
createSavedFilter(filter: SavedFilter): Promise<SavedFilter>
updateSavedFilter(id: string, filter: SavedFilter): Promise<SavedFilter>
deleteSavedFilter(id: string): Promise<void>
shareFilter(id: string, teamMembers: string[]): Promise<void>
setDefaultFilter(id: string): Promise<void>
```

---

## Custom Hooks

**Hooks to Create:** (350 LOC)

```typescript
useSearch()                    - Search with history + suggestions
useFilters()                   - Filter management
useSavedFilters()             - Saved filter CRUD
useSearchResults()            - Results with pagination
useFilterBuilder()            - Dynamic filter building
useSearchHistory()            - History management
useFilterPresets()            - Preset filter access
```

---

## Data Models

### SearchResult
```typescript
interface SearchResult {
  id: string;
  type: 'inspection' | 'work-order' | 'document' | 'covenant' | 'analytics';
  title: string;
  snippet: string;
  matchedFields: string[];
  metadata: Record<string, any>;
  relevanceScore: number;
  featureId: string;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  resultCount: number;
  timestamp: string;
  features: string[];
}
```

### Filter
```typescript
interface Filter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'range' | 'in' | 'exists';
  value: any;
  label: string;
}

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  feature: string;
  filters: Filter[];
  isDefault: boolean;
  sharedWith: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface FilterPreset {
  id: string;
  name: string;
  feature: string;
  filters: Filter[];
  icon?: string;
}
```

---

## Testing Strategy

### Unit Tests
- Filter validation
- Search query building
- Filter query construction

### Integration Tests
- Search across features
- Filter application
- Saved filter persistence
- Search history tracking

### E2E Tests (45+ tests)

**Advanced Search (10 tests):**
- Open search modal
- Type search query
- Show suggestions
- Select suggestion
- Search all features
- Search specific feature
- Show results
- Highlight matches
- Pagination
- Clear search

**Multi-Field Filtering (12 tests):**
- Add filter criterion
- Remove filter criterion
- Apply single filter
- Apply multiple filters
- Filter by date range
- Filter by status
- Filter by category
- Filter by custom field
- Clear all filters
- Reset filters
- Auto-apply filters
- Persist filters

**Saved Filters (10 tests):**
- Save filter
- List saved filters
- Apply saved filter
- Edit saved filter
- Delete saved filter
- Set default filter
- Share filter
- Preview filter
- Filter search results
- Rename filter

**Search History (8 tests):**
- Show recent searches
- Quick re-search
- Clear history item
- Clear all history
- Search history persistence
- Search count tracking
- Export history
- Limit history size

**Search Results (5 tests):**
- Display results grouped by type
- Show result count
- Navigate to item from result
- Result details display
- Refine results

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Search response | <500ms |
| Suggestions load | <300ms |
| Filter application | <400ms |
| Results pagination | <200ms |
| Saved filters load | <100ms |
| History lookup | <100ms |

---

## Success Criteria

✅ Full-text search working  
✅ Filters for all features  
✅ Saved filters with persistence  
✅ Search history tracking  
✅ 45+ E2E tests passing  
✅ Performance targets met  
✅ Cross-feature search  
✅ Filter templates available  
✅ Autocomplete suggestions  
✅ Highlighted results  

---

## Estimated Metrics

| Component | LOC |
|-----------|-----|
| Screens (5) | 1,350 |
| Services (3) | 900 |
| Hooks (1) | 350 |
| E2E Tests | 500+ |
| Total | 3,100+ |

---

## Files to Create

**Screens:**
- src/screens/AdvancedSearchModal.tsx (250 LOC)
- src/screens/SearchResultsScreen.tsx (300 LOC)
- src/screens/SavedFiltersScreen.tsx (280 LOC)
- src/screens/FilterBuilderScreen.tsx (320 LOC)
- src/screens/SearchHistoryScreen.tsx (200 LOC)

**Services:**
- src/services/search.service.ts (350 LOC)
- src/services/filter.service.ts (300 LOC)
- src/services/saved-filter.service.ts (250 LOC)

**Hooks:**
- src/hooks/useSearch.ts (350 LOC)

**Tests:**
- e2e/search-filtering.e2e.ts (500+ LOC, 45+ tests)

---

## Timeline

**Phase 1 (Screens):** 6-8 hours
**Phase 2 (Services):** 4-5 hours
**Phase 3 (Tests):** 4-5 hours
**Total:** 14-18 hours (2-3 days)

---

## Integration Points

**With Inspection Feature:**
- Search inspections by title, location, type
- Filter by status, date, assigned person
- Save inspection search filters

**With Maintenance Feature:**
- Search work orders by title, type
- Filter by status, priority, contractor
- Save work order filters

**With Documents Feature:**
- Search documents by name, category
- Filter by type, upload date, status
- Save document filters

**With Covenants Feature:**
- Search covenants by name, category
- Filter by status, risk level, breach
- Save covenant filters

**With Analytics Feature:**
- Search reports, metrics
- Filter by time period, status
- Save report filters

---

## Next Steps

1. Create 5 screen components
2. Implement 3 services
3. Build 7 custom hooks
4. Write 45+ E2E tests
5. Test cross-feature search
6. Performance optimization
7. Documentation

---

**Task #21 is ready to build!**

