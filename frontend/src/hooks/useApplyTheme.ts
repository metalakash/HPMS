import { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';

/** Resolves the theme preference to data-theme on <html> and follows OS changes in "system" mode. */
export function useApplyTheme() {
  const theme = useUIStore((s) => s.theme);
  const language = useUIStore((s) => s.language);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}
