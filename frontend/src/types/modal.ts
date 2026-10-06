/**
 * Type definitions for modal/drawer components
 */

/** Modal configuration state */
export interface ModalConfig {
  isOpen: boolean;
  data?: Record<string, any>;
  error?: string;
}

/** Modal state in Zustand store */
export interface ModalState {
  modals: Record<string, ModalConfig>;
  openModal: (id: string, data?: Record<string, any>) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  updateModalData: (id: string, data: Record<string, any>) => void;
  setModalError: (id: string, error?: string) => void;
}

/** Base modal props */
export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onBackdropClick?: () => void;
}

/** Detail drawer props */
export interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  footer?: React.ReactNode;
}

/** Confirmation modal props */
export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Justification modal props (for maker-checker workflow) */
export interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  actionName: string;
  isLoading?: boolean;
  onSubmit: (data: JustificationData) => void | Promise<void>;
  /** Fields describing the change itself, shown above the justification. */
  children?: React.ReactNode;
  /** False while those fields are incomplete. Defaults to true. */
  canSubmit?: boolean;
  /** Show the supporting-document picker. Only the file name is recorded; there is no upload. */
  allowDocument?: boolean;
}

export interface JustificationData {
  reason: string;
  documentUrl?: string;
}

/** Loan exposure import modal props */
export interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Predefined modal IDs */
export enum ModalId {
  COVENANT_DETAIL = 'covenant-detail',
  ALERT_REMEDIATION = 'alert-remediation',
  JUSTIFICATION = 'justification',
  CONFIRMATION = 'confirmation',
  BULK_IMPORT = 'bulk-import',
  CBS_SYNC = 'cbs-sync',
  MAINTENANCE_DETAIL = 'maintenance-detail',
  ADMIN_PERMISSION = 'admin-permission',
}
