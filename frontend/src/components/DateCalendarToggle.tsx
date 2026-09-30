/**
 * DateCalendarToggle: Switch between BS (Bikram Sambat) and AD (Anno Domini) dates
 */

import { useUIStore } from '@/store/useUIStore';
import { useEffect, useState } from 'react';

export interface CalendarPreference {
  format: 'ad' | 'bs';
}

/**
 * Global calendar toggle component - displays in header or sidebar
 */
export function DateCalendarToggle() {
  const [calendarFormat, setCalendarFormat] = useState<'ad' | 'bs'>('ad');

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calendar-format') as 'ad' | 'bs' | null;
      if (saved) setCalendarFormat(saved);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleToggle = (format: 'ad' | 'bs') => {
    setCalendarFormat(format);
    try {
      localStorage.setItem('calendar-format', format);
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-1">
      <button
        onClick={() => handleToggle('ad')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          calendarFormat === 'ad'
            ? 'bg-primary text-white'
            : 'text-muted hover:text-fg'
        }`}
      >
        AD
      </button>
      <button
        onClick={() => handleToggle('bs')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          calendarFormat === 'bs'
            ? 'bg-primary text-white'
            : 'text-muted hover:text-fg'
        }`}
      >
        BS
      </button>
    </div>
  );
}

/**
 * Hook to get current calendar format preference
 */
export function useCalendarFormat() {
  const [format, setFormat] = useState<'ad' | 'bs'>('ad');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('calendar-format') as 'ad' | 'bs' | null;
      if (saved) setFormat(saved);
    } catch {
      // Ignore
    }

    // Listen for changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'calendar-format' && (e.newValue === 'ad' || e.newValue === 'bs')) {
        setFormat(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return format;
}
