# Modal Library - Quick Start Guide

## 1-Minute Overview

The modal library provides 5 reusable components for dialogs and confirmations:

- **BaseModal** - Foundation for custom modals
- **DetailDrawer** - Right-aligned drill-down panel
- **ConfirmationModal** - Confirm destructive actions
- **JustificationModal** - Capture reason for changes (maker-checker)
- **BulkImportModal** - Handle file uploads with validation

All state is managed by `useModalStore` (Zustand).

---

## Quick Examples

### Open a Confirmation Modal

```tsx
import { useModalStore } from '@/store/useModalStore';
import { ConfirmationModal } from '@/components/modals';

export function DeleteButton({ projectId }) {
  const { modals, openModal, closeModal } = useModalStore();
  const isOpen = modals['confirmation']?.isOpen || false;

  return (
    <>
      <button onClick={() => openModal('confirmation')}>Delete</button>
      
      <ConfirmationModal
        isOpen={isOpen}
        onClose={() => closeModal('confirmation')}
        title="Delete Project?"
        message="This cannot be undone."
        isDangerous={true}
        onConfirm={async () => {
          await api.deleteProject(projectId);
        }}
      />
    </>
  );
}
```

### Open a Justification Modal (Maker-Checker)

```tsx
import { useModalStore } from '@/store/useModalStore';
import { JustificationModal } from '@/components/modals';

export function UpdateRCODButton({ projectId }) {
  const { modals, openModal, closeModal } = useModalStore();
  const isOpen = modals['justification']?.isOpen || false;

  return (
    <>
      <button onClick={() => openModal('justification')}>
        Update RCOD
      </button>
      
      <JustificationModal
        isOpen={isOpen}
        onClose={() => closeModal('justification')}
        entityType="PROJECT"
        entityId={projectId}
        actionName="update Revised Commercial Operation Date"
        onSubmit={async (data) => {
          await api.submitMutation({
            entityType: 'PROJECT',
            entityId: projectId,
            action: 'UPDATE_RCOD',
            justification: data.reason,
            documentUrl: data.documentUrl,
          });
        }}
      />
    </>
  );
}
```

### Open a Drill-Down Drawer

```tsx
import { useModalStore } from '@/store/useModalStore';
import { DetailDrawer } from '@/components/drawers';

export function CovenantRow({ covenant }) {
  const { modals, openModal, closeModal } = useModalStore();
  const isOpen = modals['covenant-detail']?.isOpen || false;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    const result = await api.getCovenantHistory(covenant.id);
    setData(result);
    setLoading(false);
    openModal('covenant-detail', { covenantId: covenant.id });
  };

  return (
    <>
      <tr onClick={handleOpen} className="cursor-pointer hover:bg-surface-2">
        <td>{covenant.type}</td>
        <td>{covenant.value}</td>
      </tr>

      <DetailDrawer
        isOpen={isOpen}
        onClose={() => closeModal('covenant-detail')}
        title={`${covenant.type} History`}
        loading={loading}
      >
        {data && (
          <div className="space-y-4">
            {/* Trend chart, history table, etc */}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
```

### Handle Bulk Import

```tsx
import { useModalStore } from '@/store/useModalStore';
import { BulkImportModal } from '@/components/modals';

export function ImportProjects() {
  const { modals, openModal, closeModal } = useModalStore();
  const isOpen = modals['bulk-import']?.isOpen || false;

  return (
    <>
      <button onClick={() => openModal('bulk-import')}>
        Import Projects
      </button>

      <BulkImportModal
        isOpen={isOpen}
        onClose={() => closeModal('bulk-import')}
        entityType="projects"
        onSubmit={async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          await api.importProjects(formData);
        }}
      />
    </>
  );
}
```

---

## Common Patterns

### Pattern 1: Two-Button Footer

```tsx
<BaseModal
  // ... props
  footer={
    <div className="flex gap-3 justify-end">
      <button onClick={onClose}>Cancel</button>
      <button onClick={handleSubmit} className="bg-primary text-white">
        Submit
      </button>
    </div>
  }
>
  {/* content */}
</BaseModal>
```

### Pattern 2: Async Operations with Loading

```tsx
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await api.doSomething();
    onClose();
  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};

return (
  <BaseModal isOpen={isOpen} onClose={onClose}>
    {error && <div className="bg-danger/10 text-danger p-3">{error}</div>}
    {/* form */}
    <button onClick={handleSubmit} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Submit'}
    </button>
  </BaseModal>
);
```

### Pattern 3: Modal with Data from Query

```tsx
const { modals, openModal, closeModal } = useModalStore();
const data = modals['my-modal']?.data;

const handleOpen = (entityId) => {
  openModal('my-modal', { entityId });
};

return (
  <BaseModal isOpen={isOpen}>
    Entity ID: {data?.entityId}
  </BaseModal>
);
```

---

## CSS Classes Reference

### Button Styles

**Primary:**
```jsx
<button className="bg-primary hover:bg-primary/90 text-white">Button</button>
```

**Secondary (Outline):**
```jsx
<button className="border border-line hover:bg-surface-2">Button</button>
```

**Danger:**
```jsx
<button className="bg-danger hover:bg-danger/90 text-white">Delete</button>
```

### Input Styles

```jsx
<input
  type="text"
  className="border border-line rounded-lg px-3 py-2 bg-surface text-fg"
/>
```

### Text Styles

```jsx
<h2 className="text-lg font-semibold text-fg">Heading</h2>
<p className="text-sm text-muted">Muted text</p>
<span className="text-xs text-danger">Error text</span>
```

---

## Troubleshooting

### Modal not opening?
- Check if using `useModalStore` and calling `openModal()`
- Verify `isOpen` boolean is bound correctly
- Check browser console for errors

### Styling looks off?
- Ensure Tailwind CSS is loaded
- Check dark mode: `dark:` prefixed classes
- Verify color tokens exist in theme

### Form validation failing?
- JustificationModal requires min 20 characters
- BulkImportModal only accepts CSV/XLS/XLSX
- Check file size limits (10MB documents, 50MB imports)

### Not accessible?
- All modals have `role="dialog"` and `aria-modal="true"`
- Escape key closes all modals
- Tab focus is managed automatically

---

## Import Cheatsheet

```tsx
// Types
import type { 
  ModalConfig, 
  BaseModalProps, 
  JustificationData 
} from '@/types/modal';

// Store
import { useModalStore } from '@/store/useModalStore';

// Components
import { 
  BaseModal, 
  ConfirmationModal, 
  JustificationModal, 
  BulkImportModal 
} from '@/components/modals';

import { DetailDrawer } from '@/components/drawers';

// Utilities
import { adToBs, bsToAd, getDatePair } from '@/utils/dateConverter';
```

---

## File Size Limits

- **Document upload (JustificationModal):** 10MB
- **Bulk import file (BulkImportModal):** 50MB
- **Accepted formats:** PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, CSV

---

## Next Steps

1. **Try it out:** Implement one modal in existing page
2. **Read full docs:** See `MODAL_LIBRARY.md` for complete API
3. **Build features:** Use in Compliance, Project Tabs, etc.
4. **Test accessibility:** Use keyboard navigation and screen reader
5. **Check responsiveness:** Test on mobile (< 768px)

---

## Support

For detailed documentation, see: `MODAL_LIBRARY.md`

For implementation examples, see:
- `frontend/src/components/modals/*.tsx`
- `frontend/src/components/drawers/*.tsx`
