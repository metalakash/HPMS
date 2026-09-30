# Modal/Drawer Component Library

## Overview

A reusable, accessible modal and drawer component library built with React, TypeScript, and Tailwind CSS. Provides a foundation for all dialog-based interactions in the HPMS application.

## Components

### 1. BaseModal

**Purpose:** Foundation modal component for all specific modal types.

**Features:**
- Overlay with semi-transparent backdrop
- Click-outside to close
- Escape key support
- Smooth animations (fade-in, zoom-in)
- Accessibility: `role="dialog"`, `aria-modal="true"`
- Customizable size (sm, md, lg, xl)
- Optional header with close button
- Scrollable body content
- Optional footer for actions

**Usage:**

```tsx
import { BaseModal } from '@/components/modals';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      
      <BaseModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Modal Title"
        description="Optional description"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setIsOpen(false)}>Cancel</button>
            <button className="bg-primary text-white">Confirm</button>
          </div>
        }
      >
        <p>Modal content goes here</p>
      </BaseModal>
    </>
  );
}
```

### 2. DetailDrawer

**Purpose:** Right-aligned slide-over drawer for displaying detailed information.

**Features:**
- Slides in from right side
- Full height with max-width
- Click-outside to close
- Escape key support
- Loading state with spinner
- Scrollable content area
- Optional footer

**Usage:**

```tsx
import { DetailDrawer } from '@/components/drawers';

function CovenantDetailView() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async (covenantId: string) => {
    setLoading(true);
    const response = await fetch(`/api/covenants/${covenantId}`);
    setData(await response.json());
    setLoading(false);
    setIsOpen(true);
  };

  return (
    <>
      <button onClick={() => handleOpen('cov-123')}>View Details</button>
      
      <DetailDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Covenant Details"
        loading={loading}
      >
        {data && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted">DSCR</p>
              <p className="text-lg font-semibold">{data.dscr}</p>
            </div>
            {/* More content */}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
```

### 3. ConfirmationModal

**Purpose:** Confirm destructive or important actions.

**Features:**
- Mandatory confirmation dialog
- Customizable button text
- Danger mode for destructive actions (red button)
- Loading state during action
- Accessible design

**Usage:**

```tsx
import { ConfirmationModal } from '@/components/modals';

function DeleteButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    await api.deleteProject('project-123');
    setIsLoading(false);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-danger text-white"
      >
        Delete Project
      </button>
      
      <ConfirmationModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Delete Project?"
        message="This action cannot be undone. All associated data will be permanently deleted."
        confirmText="Delete"
        isDangerous={true}
        isLoading={isLoading}
        onConfirm={handleDelete}
      />
    </>
  );
}
```

### 4. JustificationModal

**Purpose:** Capture mandatory justification for maker-checker mutations.

**Features:**
- Mandatory reason field (min 20 characters)
- Optional document upload
- File validation (type, size)
- Real-time character count
- Error handling
- Info banner about audit trail
- Maker-checker context display

**Usage:**

```tsx
import { JustificationModal } from '@/components/modals';
import { useModalStore } from '@/store/useModalStore';

function UpdateRCODButton({ projectId }) {
  const { modals, openModal, closeModal } = useModalStore();
  const isOpen = modals['justification']?.isOpen || false;

  const handleSubmit = async (data) => {
    await api.submitMutation({
      entityType: 'PROJECT',
      entityId: projectId,
      action: 'UPDATE_RCOD',
      changes: { rcod_date: '2027-03-31' },
      justification: data.reason,
      documentUrl: data.documentUrl,
    });
    // API returns approval_request_id
  };

  return (
    <>
      <button onClick={() => openModal('justification', { projectId })}>
        Update RCOD
      </button>
      
      <JustificationModal
        isOpen={isOpen}
        onClose={() => closeModal('justification')}
        entityType="PROJECT"
        entityId={projectId}
        actionName="update Revised Commercial Operation Date"
        onSubmit={handleSubmit}
      />
    </>
  );
}
```

### 5. BulkImportModal

**Purpose:** Handle bulk data ingestion with validation preview.

**Features:**
- File upload (CSV, XLS, XLSX)
- Validation before import
- Error preview with downloadable error report
- Progress tracking (valid/invalid rows)
- File size validation
- Row-by-row error display

**Usage:**

```tsx
import { BulkImportModal } from '@/components/modals';
import { useModalStore } from '@/store/useModalStore';

function ImportProjectsButton() {
  const { modals, openModal, closeModal } = useModalStore();
  const isOpen = modals['bulk-import']?.isOpen || false;

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    await api.importProjects(formData);
  };

  return (
    <>
      <button onClick={() => openModal('bulk-import')}>
        Import Projects
      </button>
      
      <BulkImportModal
        isOpen={isOpen}
        onClose={() => closeModal('bulk-import')}
        entityType="projects"
        onSubmit={handleImport}
        onValidationComplete={(results) => {
          console.log(`Valid: ${results.validRows}, Invalid: ${results.invalidRows}`);
        }}
      />
    </>
  );
}
```

## Zustand Store Integration

### useModalStore

Global state management for all modals using Zustand.

**Usage:**

```tsx
import { useModalStore } from '@/store/useModalStore';

function MyComponent() {
  const { modals, openModal, closeModal, updateModalData } = useModalStore();

  // Check if specific modal is open
  const isOpen = modals['covenant-detail']?.isOpen || false;
  const data = modals['covenant-detail']?.data;

  return (
    <>
      <button 
        onClick={() => openModal('covenant-detail', { covenantId: 'cov-123' })}
      >
        Open
      </button>

      {isOpen && (
        <DetailDrawer
          isOpen={isOpen}
          onClose={() => closeModal('covenant-detail')}
          title="Covenant Details"
        >
          {data && <p>Covenant ID: {data.covenantId}</p>}
        </DetailDrawer>
      )}
    </>
  );
}
```

## Predefined Modal IDs

```tsx
enum ModalId {
  COVENANT_DETAIL = 'covenant-detail',
  ALERT_REMEDIATION = 'alert-remediation',
  JUSTIFICATION = 'justification',
  CONFIRMATION = 'confirmation',
  BULK_IMPORT = 'bulk-import',
  CBS_SYNC = 'cbs-sync',
  MAINTENANCE_DETAIL = 'maintenance-detail',
  ADMIN_PERMISSION = 'admin-permission',
}
```

## Accessibility

All components follow WCAG 2.1 guidelines:

- `role="dialog"` and `aria-modal="true"` for screen readers
- Focus management with escape key
- Keyboard navigation support
- Color contrast ratios >= 4.5:1
- Clear error messages
- Loading states with spinners

## Styling

Components use existing Tailwind CSS variables:

- **Colors:**
  - Primary: `bg-primary`, `text-primary`
  - Danger: `bg-danger`, `text-danger`
  - Warning: `bg-warning`, `text-warning`
  - Info: `bg-info`, `text-info`
  - Success: `bg-success`, `text-success`
  - Surface: `bg-surface`, `bg-surface-2`
  - Line: `border-line`, `divide-line`
  - Text: `text-fg`, `text-muted`

- **Animations:**
  - Fade-in: `animate-in fade-in`
  - Slide-in: `animate-in slide-in-from-right`
  - Zoom-in: `animate-in zoom-in`

## Best Practices

1. **Use Zustand Store for State:**
   ```tsx
   const { openModal } = useModalStore();
   openModal('justification', { entityId: '123' });
   ```

2. **Handle Errors Gracefully:**
   ```tsx
   try {
     await onSubmit(data);
   } catch (err) {
     setError(err.message);
   }
   ```

3. **Provide Loading States:**
   ```tsx
   <JustificationModal isLoading={isLoading} />
   ```

4. **Close on Success:**
   ```tsx
   await onSubmit(data);
   onClose(); // Always close after success
   ```

5. **Clear on Close:**
   ```tsx
   const handleClose = () => {
     setError('');
     setReason('');
     onClose();
   };
   ```

## Future Enhancements

- [ ] Toast notifications for success/error messages
- [ ] File upload progress bars
- [ ] Drag-and-drop file upload
- [ ] Modal animations (spring physics)
- [ ] Dialog stacking (multiple modals)
- [ ] Form validation integration
- [ ] API error boundary integration
