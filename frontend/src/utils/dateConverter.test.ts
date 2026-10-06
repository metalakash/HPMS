import { describe, expect, it, vi } from 'vitest';
import {
  adToBs,
  adYearToBsYear,
  bsToAd,
  bsYearToAdYear,
  formatDatePair,
  getDatePair,
  isValidDateFormat,
  parseDate,
} from './dateConverter';

describe('isValidDateFormat', () => {
  it('accepts YYYY-MM-DD only', () => {
    expect(isValidDateFormat('2026-09-15')).toBe(true);
    expect(isValidDateFormat('15-09-2026')).toBe(false);
    expect(isValidDateFormat('2026-9-5')).toBe(false);
    expect(isValidDateFormat('2026-09-15T00:00:00')).toBe(false);
    expect(isValidDateFormat('')).toBe(false);
  });

  it('rejects an impossible month', () => {
    expect(isValidDateFormat('2026-13-01')).toBe(false);
  });
});

describe('formatDatePair', () => {
  it('formats day-month-year in the chosen calendar', () => {
    expect(formatDatePair('2026-09-15', '2083-05-30')).toBe('15-09-2026');
    expect(formatDatePair('2026-09-15', '2083-05-30', 'bs')).toBe('30-05-2083');
    expect(formatDatePair('2026-09-15', '2083-05-30', 'both')).toBe('15-09-2026 (30-05-2083 BS)');
  });
});

describe('getDatePair / parseDate', () => {
  it('returns empty strings for a missing date', () => {
    expect(getDatePair(null)).toEqual({ ad: '', bs: '' });
    expect(getDatePair(undefined)).toEqual({ ad: '', bs: '' });
  });

  it('keeps the AD date it was given', () => {
    expect(getDatePair('2026-09-15').ad).toBe('2026-09-15');
    expect(getDatePair(new Date('2026-09-15T00:00:00Z')).ad).toBe('2026-09-15');
  });

  it('returns null for an empty or unparseable string', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('2026-09-15')?.ad).toBe('2026-09-15');
  });
});

describe('year conversion', () => {
  it('round-trips between AD and BS years', () => {
    expect(bsYearToAdYear(adYearToBsYear(2026))).toBe(2026);
  });
});

describe('adToBs / bsToAd', () => {
  it('returns an empty string for invalid input', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(adToBs('garbage')).toBe('');
    expect(bsToAd('')).toBe('');
  });

  // dateConverter.ts is still a placeholder that echoes its input, so these fail today.
  // Nepali new year 2081 fell on 13 April 2024. Change `it.fails` to `it` once conversion is real.
  it.fails('converts an AD date to Bikram Sambat', () => {
    expect(adToBs('2024-04-13')).toBe('2081-01-01');
  });

  it.fails('converts a Bikram Sambat date to AD', () => {
    expect(bsToAd('2081-01-01')).toBe('2024-04-13');
  });
});
