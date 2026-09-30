/**
 * Global app state management with Zustand
 * Includes offline queue for data synchronization
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: 'inspection' | 'maintenance' | 'project' | string;
  data: any;
  timestamp: number;
  retries: number;
  error?: string;
}

interface AppState {
  // Auth state
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  userRole: 'admin' | 'operator' | 'inspector' | 'viewer' | null;

  // App state
  isInitialized: boolean;
  isDarkMode: boolean;
  language: 'en' | 'ne';
  isOnline: boolean;
  syncPending: boolean;

  // Offline sync state
  offlineQueue: SyncItem[];
  lastSyncTime: number | null;
  syncErrors: Map<string, string>;

  // Actions
  initialize: () => Promise<void>;
  login: (userId: string, token: string, role: string) => void;
  logout: () => void;
  setDarkMode: (enabled: boolean) => void;
  setLanguage: (lang: 'en' | 'ne') => void;
  setOnline: (online: boolean) => void;
  setSyncPending: (pending: boolean) => void;

  // Offline queue actions
  addToQueue: (item: Omit<SyncItem, 'id' | 'timestamp' | 'retries'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setSyncError: (id: string, error: string) => void;
  clearSyncError: (id: string) => void;
  setLastSyncTime: (time: number) => void;
  processQueue: () => Promise<SyncItem[]>;
}

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      userId: null,
      token: null,
      userRole: null,
      isInitialized: false,
      isDarkMode: false,
      language: 'en',
      isOnline: true,
      syncPending: false,
      offlineQueue: [],
      lastSyncTime: null,
      syncErrors: new Map(),

      // Actions
      initialize: async () => {
        try {
          // Initialize app - load persisted data
          // Check network status, connect to backend
          set({ isInitialized: true });
        } catch (error) {
          console.error('Error initializing app:', error);
          set({ isInitialized: true }); // Continue anyway
        }
      },

      login: (userId: string, token: string, role: string) => {
        set({
          isAuthenticated: true,
          userId,
          token,
          userRole: role as any,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          userId: null,
          token: null,
          userRole: null,
          syncPending: false,
          offlineQueue: [],
          syncErrors: new Map(),
        });
      },

      setDarkMode: (enabled: boolean) => {
        set({ isDarkMode: enabled });
      },

      setLanguage: (lang: 'en' | 'ne') => {
        set({ language: lang });
      },

      setOnline: (online: boolean) => {
        set({ isOnline: online });
      },

      setSyncPending: (pending: boolean) => {
        set({ syncPending: pending });
      },

      // Offline queue actions
      addToQueue: (item) => {
        const state = get();
        const syncItem: SyncItem = {
          ...item,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          retries: 0,
        };
        set({
          offlineQueue: [...state.offlineQueue, syncItem],
        });
      },

      removeFromQueue: (id: string) => {
        const state = get();
        set({
          offlineQueue: state.offlineQueue.filter(item => item.id !== id),
        });
      },

      clearQueue: () => {
        set({
          offlineQueue: [],
          syncErrors: new Map(),
        });
      },

      setSyncError: (id: string, error: string) => {
        const state = get();
        const newErrors = new Map(state.syncErrors);
        newErrors.set(id, error);
        set({ syncErrors: newErrors });
      },

      clearSyncError: (id: string) => {
        const state = get();
        const newErrors = new Map(state.syncErrors);
        newErrors.delete(id);
        set({ syncErrors: newErrors });
      },

      setLastSyncTime: (time: number) => {
        set({ lastSyncTime: time });
      },

      processQueue: async () => {
        const state = get();
        const synced: SyncItem[] = [];

        for (const item of state.offlineQueue) {
          try {
            // Process each item (would call API in real implementation)
            console.log(`Processing ${item.action} for ${item.entity}:`, item.data);
            synced.push(item);
            get().removeFromQueue(item.id);
            get().clearSyncError(item.id);
          } catch (error: any) {
            get().setSyncError(item.id, error.message);
          }
        }

        set({
          lastSyncTime: Date.now(),
          syncPending: false,
        });

        return synced;
      },
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        language: state.language,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);

export { useAppStore };
export default useAppStore;
