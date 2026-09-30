# Task #24: Data Export/Import - 3-Phase Delivery Plan

## Overview
Enable users to export project data (projects, inspections, work orders, compliance records, reports) in multiple formats (CSV/JSON/Excel/PDF) and import bulk data with conflict resolution. Total estimated delivery: 2,450 LOC + 40 E2E tests.

---

## Phase 1: Export/Import UI Screens & Components (1,100 LOC)

### Screens (800 LOC)

#### 1. ExportScreen (250 LOC)
- Feature multi-select (Projects, Inspections, Work Orders, Compliance, Reports)
- Format selector buttons (CSV, JSON, Excel, PDF)
- Date range picker (optional)
- Filter options per feature
- Export configuration preview
- "Export Data" button with progress tracking
- Recent exports list with download/delete/share

#### 2. ImportScreen (250 LOC)
- File upload area (drag-drop + button)
- Supported format indicator
- Feature type auto-detection dropdown
- Column mapping UI (if CSV)
- Import preview (first 5 rows)
- Conflict resolution strategy selector (Skip, Merge, Replace)
- "Import Data" button
- Import history list

#### 3. ExportProgressScreen (150 LOC)
- Animated progress bar (0-100%)
- Item counters (processed/total)
- Current feature being exported
- Estimated time remaining
- Pause/Cancel buttons
- Export speed metrics (items/sec)
- Completion summary with export size

#### 4. ImportProgressScreen (150 LOC)
- Progress bar with step indicators
- Records processed/total
- Current feature being imported
- Error/warning counter
- Pause/Cancel buttons
- Conflict counter (if applicable)
- Completion summary

### Components (300 LOC)

#### 1. ExportFormatSelector (60 LOC)
- 4 format option buttons (CSV, JSON, Excel, PDF)
- Format info tooltip (file size estimate, features supported)
- Active format highlight
- Format-specific options (Excel: compression level)

#### 2. FeatureCheckboxList (80 LOC)
- Checkboxes for each exportable feature
- Record count per feature
- Estimated file size per feature
- "Select All" / "Deselect All" buttons
- Feature info icons

#### 3. ImportFileUploader (70 LOC)
- Drag-drop zone with visual feedback
- File type indicator
- File size display
- Upload button
- File preview toggle
- Clear button

#### 4. ConflictResolutionDialog (50 LOC)
- Radio options: Skip, Merge, Replace
- Description per option
- Preview of affected records
- "Continue" button

#### 5. ExportDownloadCard (40 LOC)
- Export name, format, file size
- Download button
- Share button
- Delete button
- Export date and duration
- Feature breakdown (e.g., "5 projects, 20 inspections")

---

## Phase 2: Export/Import Services & API (900 LOC)

### Services

#### 1. export.service.ts (250 LOC)
- buildExportData(features, format, filters)
- formatAsCSV(data)
- formatAsJSON(data)
- formatAsExcel(data)
- formatAsPDF(data)
- estimateFileSize(data, format)
- Methods per feature (exportProjects, exportInspections, etc.)
- Streaming support for large datasets
- Progress callback for real-time updates

#### 2. import.service.ts (250 LOC)
- parseCSV(file)
- parseJSON(file)
- parseExcel(file)
- detectFeatureType(file)
- validateData(data, feature)
- mapColumns(csvHeaders, targetFields)
- batchImport(data, feature, conflictStrategy)
- detectConflicts(newData, existingData)
- applyConflictResolution(conflicts, strategy)

#### 3. export-api.ts (200 LOC)
- POST /exports - Create export job
- GET /exports - List exports
- GET /exports/{id} - Get export details
- GET /exports/{id}/download - Download export file
- DELETE /exports/{id} - Delete export
- POST /exports/{id}/share - Share export
- GET /exports/status/{jobId} - Check export progress

#### 4. import-api.ts (200 LOC)
- POST /imports - Upload and start import
- GET /imports - List imports
- GET /imports/{id} - Get import details
- GET /imports/{id}/conflicts - Get detected conflicts
- POST /imports/{id}/resolve - Apply conflict resolution
- DELETE /imports/{id} - Cancel import
- GET /imports/status/{jobId} - Check import progress

---

## Phase 3: Custom Hooks & E2E Tests (550 LOC + 40 tests)

### Hooks (150 LOC)

#### 1. useExport (75 LOC)
- exportData(features, format, filters)
- getExportStatus(jobId)
- downloadExport(exportId)
- deleteExport(exportId)
- shareExport(exportId, recipients)
- state: { exports, selectedExport, exporting, progress, error }
- estimateSize(features, format)

#### 2. useImport (75 LOC)
- uploadFile(file)
- getImportStatus(jobId)
- detectConflicts(importId)
- resolveConflicts(importId, strategy)
- cancelImport(importId)
- state: { imports, selectedImport, importing, conflicts, progress, error }
- validateFile(file)

### E2E Tests (450+ LOC, 40+ tests)

#### Export Tests (20 tests)
- Export single feature (Projects, Inspections, Work Orders, Compliance, Reports)
- Export multiple features
- Export with date range filter
- Export in CSV format
- Export in JSON format
- Export in Excel format
- Export in PDF format
- Track export progress
- Download exported file
- Share exported file
- Delete exported file
- Handle export errors (network, permission)
- Export large datasets (10k+ records)
- Recent exports list display
- Pause/resume export
- Cancel export mid-process
- Validate exported data integrity
- Export with custom filters
- Concurrent exports
- Export file size accuracy

#### Import Tests (20 tests)
- Upload CSV file
- Upload JSON file
- Upload Excel file
- Auto-detect feature type
- Map CSV columns
- Import preview display
- Detect import conflicts
- Skip conflict strategy
- Merge conflict strategy
- Replace conflict strategy
- Track import progress
- Handle import errors
- Validate imported data
- Import duplicate records
- Import with validation errors
- Cancel import mid-process
- Import partial data
- Import large datasets
- Import history display
- Concurrent imports

---

## Technical Details

### Export Formats
- **CSV**: Tabular format, column headers, UTF-8 encoding
- **JSON**: Nested structure, metadata, timestamp
- **Excel**: Multiple sheets (one per feature), formatted headers, totals
- **PDF**: Formatted report layout, charts, summary page

### Conflict Resolution Strategies
1. **Skip**: Don't import conflicting records
2. **Merge**: Combine with existing data (newer wins)
3. **Replace**: Overwrite existing records

### File Size Limits
- Import: 100MB max per file
- Export: No limit, stream for large datasets
- Warning at 50MB

### Performance Targets
- Export 10k records: < 5 seconds
- Import 10k records: < 10 seconds
- Column mapping UI: < 500ms
- Conflict detection: < 2 seconds per 1k records

### Caching Strategy
- AsyncStorage: Export history (50 items)
- In-memory: Recent imports (10 items)
- TTL: 24 hours

### Offline Support
- Queue exports for later when offline
- Queue imports for later when offline
- Validate files without network
- Retry on reconnection

---

## Success Criteria

✅ All 5 Phase 1 screens fully functional with preview
✅ All 4 Phase 2 services with complete API integration
✅ All Phase 3 hooks with proper state management
✅ 40+ E2E tests with >95% coverage
✅ Export/import both directions validated
✅ Conflict resolution tested for all strategies
✅ Large dataset performance verified
✅ Error handling for all scenarios
✅ Offline queue persistence
✅ Progress tracking UI responsive

---

## Delivery Timeline
- **Phase 1**: 1,100 LOC (screens + components)
- **Phase 2**: 900 LOC (services + API)
- **Phase 3**: 550 LOC + 40 tests (hooks + E2E)
- **Total**: 2,450 LOC + 40 E2E tests
