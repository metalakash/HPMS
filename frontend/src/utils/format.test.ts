import { describe, expect, it } from 'vitest';
import {
  formatCompact,
  formatDate,
  formatMW,
  formatNPR,
  formatPercent,
  humanize,
  toNumber,
} from './format';
import { projectName, statusTone } from './status';

describe('toNumber', () => {
  it('parses Decimal strings from the API', () => {
    expect(toNumber('216.0000')).toBe(216);
    expect(toNumber(12.5)).toBe(12.5);
  });

  it.each([null, undefined, '', 'abc'])('returns null for %s', (value) => {
    expect(toNumber(value)).toBeNull();
  });
});

describe('formatters', () => {
  it('compacts large numbers only', () => {
    expect(formatCompact(1284)).toBe('1,284');
    expect(formatCompact(12_900)).toBe('12.9K');
    expect(formatCompact(null)).toBe('—');
  });

  it('formats capacity in MW', () => {
    expect(formatMW('216.0000')).toBe('216 MW');
    expect(formatMW('42.125')).toBe('42.13 MW');
    expect(formatMW(null)).toBe('—');
  });

  it('formats NPR with lakh/crore grouping', () => {
    expect(formatNPR('1500000000.00')).toMatch(/1,50,00,00,000/);
    expect(formatNPR(undefined)).toBe('—');
  });

  it('formats percentages and dates', () => {
    expect(formatPercent('9.25')).toBe('9.25%');
    expect(formatDate('2027-07-15')).toMatch(/2027/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('humanizes snake_case enum values', () => {
    expect(humanize('proposal_under_pipeline')).toBe('Proposal under pipeline');
    expect(humanize('CBS_SYNCED')).toBe('Cbs synced');
    expect(humanize(null)).toBe('—');
  });
});

describe('status helpers', () => {
  it('maps statuses to tones case-insensitively, defaulting to neutral', () => {
    expect(statusTone('approved')).toBe('success');
    expect(statusTone('FAILED')).toBe('danger');
    expect(statusTone('something_new')).toBe('neutral');
    expect(statusTone(undefined)).toBe('neutral');
  });

  it('picks the Nepali name when available', () => {
    const p = { name_en: 'Upper Trishuli', name_np: 'माथिल्लो त्रिशूली' };
    expect(projectName(p, 'ne')).toBe('माथिल्लो त्रिशूली');
    expect(projectName(p, 'en')).toBe('Upper Trishuli');
    expect(projectName({ ...p, name_np: '' }, 'ne')).toBe('Upper Trishuli');
  });
});
