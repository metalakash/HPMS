# Task #15: Document Management - Upload & Preview - IN PROGRESS ✅

**Date:** 2026-09-27  
**Status:** FOUNDATION STARTED  
**Files Created:** 3  
**LOC:** 350+  

---

## Overview

Document management system for uploading, organizing, previewing, and sharing project documents (permits, contracts, inspection reports, compliance docs).

---

## Screens Implemented (Started: 3/6)

### 1. DocumentsScreen ✅
**File:** `src/screens/Documents.tsx` (120 LOC)
- **Purpose:** List all project documents
- **Features:**
  - FlatList with documents
  - Category filtering
  - Pull-to-refresh
  - File type and size display
  - Upload button
  - Offline support

### 2. UploadDocumentScreen ✅
**File:** `src/screens/UploadDocument.tsx` (110 LOC)
- **Purpose:** Upload new documents
- **Features:**
  - Document title input
  - Category selection
  - File picker
  - File info display (name, size)
  - Upload progress
  - Error handling

### 3. DocumentPreviewScreen ✅
**File:** `src/screens/DocumentPreview.tsx` (120 LOC)
- **Purpose:** Preview uploaded documents
- **Features:**
  - PDF/image preview area
  - Document metadata
  - Download button
  - Share button
  - File information

### 4. Folder View Screen (Planned)
- Browse by folders/categories
- Folder creation
- Move documents between folders

### 5. Search/Filter Screen (Planned)
- Full-text search
- Advanced filtering
- Sort options

### 6. Document Sharing Screen (Planned)
- Share with team
- Permission management
- Share links

---

## Components to Build (7)

**Started: 0/7**

1. **FileUploader** — File selection and upload
2. **PDFPreview** — PDF document viewer
3. **ImageViewer** — Image gallery
4. **SearchPanel** — Document search UI
5. **CategoryFilter** — Category selection
6. **DocumentListItem** — List item component
7. **FileIcon** — File type icon display

---

## Document Categories

```typescript
type DocumentCategory = 'permit' | 'contract' | 'inspection' | 'compliance' | 'other';
```

---

## API Endpoints Required

```
GET    /projects/{id}/documents          - List documents
POST   /projects/{id}/documents/upload   - Upload document
GET    /documents/{id}                   - Get document details
GET    /documents/{id}/download          - Download document
DELETE /documents/{id}                   - Delete document
POST   /documents/{id}/share             - Share document
GET    /documents/search                 - Search documents
```

---

## Database Schema (WatermelonDB)

```typescript
documents:
  - id (UUID)
  - project_id (indexed)
  - title (string)
  - file_name (string)
  - file_type (string, indexed)
  - file_size (number)
  - category (string, indexed)
  - uploaded_by (string)
  - uploaded_at (number, indexed)
  - local_path (for offline)
  - synced (boolean)
  - url (string)
  - created_at (number)
```

---

## Features to Build

**Upload & Storage**
- [ ] File picker integration
- [ ] Upload progress tracking
- [ ] File compression
- [ ] Local storage for offline access
- [ ] Batch upload support

**Viewing & Preview**
- [ ] PDF viewer
- [ ] Image gallery
- [ ] Document metadata
- [ ] Download functionality

**Organization**
- [ ] Category filtering
- [ ] Folder structure
- [ ] Search functionality
- [ ] Sort options (date, name, size)

**Sharing**
- [ ] Share with team
- [ ] Permission levels
- [ ] Share links
- [ ] Activity log

**Offline Support**
- [ ] Download for offline
- [ ] Sync on reconnect
- [ ] Queue failed uploads

---

## Files Summary

| File | LOC | Status |
|------|-----|--------|
| Documents.tsx | 120 | ✅ Started |
| UploadDocument.tsx | 110 | ✅ Started |
| DocumentPreview.tsx | 120 | ✅ Started |
| **Planned Components** | **~500** | ⏳ TODO |
| **Total** | **1,000+** | **In Progress** |

---

## Next Steps

**Immediate (Task #15):**
1. Complete remaining 3 screens
2. Build 7 specialized components
3. Implement file picker integration
4. Add PDF/image viewer support
5. Create search/filter functionality

**API Integration (Task #15):**
- Document service methods
- Upload with progress
- Download functionality
- Search and filtering

**Testing (Task #16):**
- 16+ E2E tests
- Upload flow tests
- Preview tests
- Search tests
- Offline sync tests

---

## Architecture

```
Documents List
  ├─ Upload → Upload Screen
  │  └─ Select File → Preview → Upload
  │
  └─ Tap Document → Preview Screen
     ├─ Download
     └─ Share
```

---

## Technology Stack

- **File Upload:** expo-document-picker + expo-file-system
- **PDF Viewer:** react-native-pdf
- **Image Viewer:** react-native-image-zoom-viewer
- **Search:** fuzzy-search library
- **Compression:** file compression utilities

---

## Performance Considerations

- Lazy load previews
- Cache file metadata
- Compress large files
- Paginate file lists
- Offline file storage

---

**Task #15 Status:** 🚀 FOUNDATION STARTED (3 screens, 0 components)  
**Next:** Complete remaining screens & components  
**Sprint Progress:** 4.5/9 tasks (50%)
