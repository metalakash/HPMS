import { create } from 'zustand';
import type { ModalState, ModalConfig } from '@/types/modal';

/**
 * Global modal state management using Zustand.
 * Centralized store for all modal open/close/data operations.
 */
export const useModalStore = create<ModalState>((set) => ({
  modals: {},

  openModal: (id: string, data?: Record<string, any>) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [id]: {
          isOpen: true,
          data: data || {},
          error: undefined,
        },
      },
    })),

  closeModal: (id: string) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [id]: {
          isOpen: false,
          data: undefined,
          error: undefined,
        },
      },
    })),

  closeAllModals: () =>
    set(() => ({
      modals: {},
    })),

  updateModalData: (id: string, data: Record<string, any>) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [id]: {
          ...state.modals[id],
          data: { ...state.modals[id]?.data, ...data },
        },
      },
    })),

  setModalError: (id: string, error?: string) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [id]: {
          ...state.modals[id],
          error,
        },
      },
    })),
}));
