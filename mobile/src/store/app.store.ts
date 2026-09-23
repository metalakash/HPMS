/**
 * Global app state management with Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Actions
  initialize: () => Promise<void>;
  login: (userId: string, token: string, role: string) => void;
  logout: () => void;
  setDarkMode: (enabled: boolean) => void;
  setLanguage: (lang: 'en' | 'ne') => void;
  setOnline: (online: boolean) => void;
  setSyncPending: (pending: boolean) => void;
}

const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        language: state.language,
      }),
    }
  )
);

export default useAppStore;
