import type { Language } from '@/store/useUIStore';

const locale = (language: Language) => (language === 'ne' ? 'ne-NP' : 'en-IN');

/** Parses a Decimal-as-string API value; null for missing or malformed values. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Compact figure for stat tiles: 1,284 / 12.9K / 4.2M. */
export function formatCompact(value: number | null, language: Language = 'en'): string {
  if (value === null) return '—';
  return new Intl.NumberFormat(locale(language), {
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(
  value: string | number | null | undefined,
  language: Language = 'en',
  maximumFractionDigits = 2,
): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits }).format(n);
}

export function formatMW(value: string | number | null | undefined, language: Language = 'en') {
  const n = toNumber(value);
  return n === null ? '—' : `${formatNumber(n, language, 2)} MW`;
}

/** Nepali rupees with lakh/crore grouping (en-IN / ne-NP). */
export function formatNPR(value: string | number | null | undefined, language: Language = 'en') {
  const n = toNumber(value);
  if (n === null) return '—';
  return new Intl.NumberFormat(locale(language), {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(
  value: string | number | null | undefined,
  language: Language = 'en',
) {
  const n = toNumber(value);
  return n === null ? '—' : `${formatNumber(n, language, 2)}%`;
}

export function formatDate(value: string | null | undefined, language: Language = 'en'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale(language), { dateStyle: 'medium' }).format(date);
}

/** "under_review" -> "Under review" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const text = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
