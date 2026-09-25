import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';
/** Matches the backend's Accept-Language codes (backend/app/i18n). */
export type Language = 'en' | 'ne';

interface UIState {
  theme: ThemePreference;
  language: Language;
  sidebarOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setSidebarOpen: (open: boolean) => void;
}

// The persisted key is also read by the pre-paint script in index.html.
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      sidebarOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'hpms-ui',
      partialize: ({ theme, language }) => ({ theme, language }),
    },
  ),
);
