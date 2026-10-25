import { describe, expect, it } from 'vitest';
import { amountsFrom, isAmount } from './covenantInputs';

describe('covenant input amounts', () => {
  it('leaves blank fields out so "not reported" is not sent as zero', () => {
    expect(amountsFrom({ revenue_npr: ' 100.50 ', royalty_npr: '', tax_paid_npr: '0' }, ['revenue_npr', 'royalty_npr', 'tax_paid_npr', 'depreciation_npr']))
      .toEqual({ revenue_npr: '100.50', tax_paid_npr: '0' });
  });

  it.each(['0', '12', '12.5', '12.50', ' 7 '])('accepts %s', (value) => expect(isAmount(value)).toBe(true));
  it.each(['-5', '1,000', '12.345', 'abc', '', '1e6'])('rejects %s', (value) => expect(isAmount(value)).toBe(false));
});
