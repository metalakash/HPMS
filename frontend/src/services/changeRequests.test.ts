import { describe, expect, it } from 'vitest';
import { carryDown, isAmount, type ProjectionRow } from './changeRequests';

const row = (quarter: number, opening: boolean, disbursement: string, repayment: string, outstanding: string): ProjectionRow => ({
  fiscal_year: '2083/84', quarter, period_end_ad: '2026-10-16', period_end_bs: null, is_opening: opening,
  projected_disbursement: disbursement, projected_repayment: repayment, projected_outstanding: outstanding, source_reference: null,
});

describe('carryDown', () => {
  const rows = [row(1, true, '0', '0', '1000'), row(2, false, '100', '50', '1050'), row(3, false, '0', '50', '1000')];

  it('starts from the opening position and adds disbursement less repayment each quarter', () => {
    expect(carryDown(rows, {})).toEqual([1000, 1050, 1000]);
  });

  it('carries an edit into every later quarter', () => {
    expect(carryDown(rows, { '2083/84-2': { disbursement: '300', repayment: '50' } })).toEqual([1000, 1250, 1200]);
  });

  it('treats a blank field as zero', () => {
    expect(carryDown(rows, { '2083/84-3': { disbursement: '', repayment: '' } })).toEqual([1000, 1050, 1050]);
  });
});

describe('isAmount', () => {
  it('accepts whole and two-decimal amounts, with or without thousands separators', () => {
    expect(isAmount('1200')).toBe(true);
    expect(isAmount('1,20,000.50')).toBe(true);
    expect(isAmount('-5')).toBe(false);
    expect(isAmount('1.234')).toBe(false);
  });
});
