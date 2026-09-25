import { Monitor, Moon, Sun } from 'lucide-react';
import { useUIStore, type ThemePreference } from '@/store/useUIStore';

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const Icon = THEME_ICON[theme];
  const label = `Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`;

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT_THEME[theme])}
      className="rounded-md p-2 hover:bg-surface-2"
      aria-label={label}
      title={label}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}

export function LanguageToggle() {
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const next = language === 'en' ? 'ne' : 'en';

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-surface-2"
      aria-label={next === 'ne' ? 'Switch to Nepali' : 'Switch to English'}
      lang={next}
    >
      {next === 'ne' ? 'नेपाली' : 'English'}
    </button>
  );
}
