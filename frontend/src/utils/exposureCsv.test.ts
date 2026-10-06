import { describe, expect, it } from 'vitest';
import { parseCsv, parseExposureCsv } from './exposureCsv';

const HEADER =
  'project_id,facility_type,sanctioned_amount,disbursed_amount,outstanding_principal,outstanding_interest,' +
  'interest_rate_pct,tenor_years,grace_years,sanction_date,disbursement_date,maturity_date,risk_rating,ifrs9_stage,dscr,ltv,icr';
const ID = '550e8400-e29b-41d4-a716-446655440000';
const GOOD = `${ID},Construction Term Loan,50000000,40000000,35000000,0,11.5,15,3,2023-01-15,2023-02-01,2038-02-01,AA,Stage 1,2.5,50.0,3.2`;

const csv = (...lines: string[]) => [HEADER, ...lines].join('\n');
/** GOOD with one column replaced. */
const withColumn = (name: string, value: string) => {
  const cells = GOOD.split(',');
  cells[HEADER.split(',').indexOf(name)] = value;
  return cells.join(',');
};

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes, CRLF, a BOM and blank lines', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + 'a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ]);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(parseCsv('a\n"line 1\nline 2"')).toEqual([['a'], ['line 1\nline 2']]);
  });
});

describe('parseExposureCsv', () => {
  it('types a template row for the API', () => {
    const result = parseExposureCsv(csv(GOOD));
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(1);
    expect(result.rows).toEqual([
      {
        project_id: ID,
        facility_type: 'Construction Term Loan',
        sanctioned_amount: 50000000,
        disbursed_amount: 40000000,
        outstanding_principal: 35000000,
        outstanding_interest: 0,
        interest_rate_pct: 11.5,
        tenor_years: 15,
        grace_years: 3,
        sanction_date: '2023-01-15',
        disbursement_date: '2023-02-01',
        maturity_date: '2038-02-01',
        risk_rating: 'AA',
        ifrs9_stage: 'Stage 1',
        dscr: 2.5,
        ltv: 50,
        icr: 3.2,
      },
    ]);
  });

  it('omits empty optional columns and accepts a file without them', () => {
    const header = 'project_id,facility_type,sanctioned_amount,outstanding_principal,interest_rate_pct,tenor_years,grace_years,sanction_date,disbursement_date,maturity_date';
    const result = parseExposureCsv(`${header}\n${ID},Working Capital,100,50,12,10,0,2023-06-01,2023-06-15,2033-06-15`);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).not.toHaveProperty('dscr');
    expect(result.rows[0]).not.toHaveProperty('risk_rating');
  });

  it('matches column names regardless of case and order', () => {
    const header = HEADER.split(',').reverse().join(',').toUpperCase();
    const row = GOOD.split(',').reverse().join(',');
    expect(parseExposureCsv(`${header}\n${row}`).rows[0]?.project_id).toBe(ID);
  });

  it('reports a missing column once and imports nothing', () => {
    const result = parseExposureCsv('project_id,facility_type\nx,y\nz,w');
    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ line: 1 });
    expect(result.errors[0]?.message).toContain('Missing columns: sanctioned_amount');
  });

  it('reports an empty file', () => {
    expect(parseExposureCsv('').errors).toEqual([{ line: 1, message: 'The file is empty' }]);
  });

  it.each([
    ['project_id', 'not-a-uuid', 'project_id is not a valid id'],
    ['facility_type', '', 'facility_type is required'],
    ['sanctioned_amount', '5 crore', 'sanctioned_amount must be a number'],
    ['outstanding_principal', '-1', 'outstanding_principal cannot be negative'],
    ['tenor_years', '12.5', 'tenor_years must be a whole number'],
    ['sanction_date', '15/01/2023', 'sanction_date must be a date as YYYY-MM-DD'],
    ['maturity_date', '2038-02-30', 'maturity_date must be a date as YYYY-MM-DD'],
    ['dscr', 'high', 'dscr must be a number'],
    ['outstanding_principal', '60000000', 'outstanding_principal exceeds sanctioned_amount'],
    ['maturity_date', '2022-01-01', 'maturity_date must be after sanction_date'],
  ])('rejects a row whose %s is %j', (column, value, message) => {
    const result = parseExposureCsv(csv(withColumn(column, value)));
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ line: 2, message }]);
  });

  it('keeps the good rows, and reports the bad ones by file line with every problem', () => {
    const bad = withColumn('tenor_years', 'x').replace('11.5', 'eleven');
    const result = parseExposureCsv(csv(GOOD, bad, GOOD));
    expect(result.totalRows).toBe(3);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([
      { line: 3, message: 'interest_rate_pct must be a number; tenor_years must be a whole number' },
    ]);
  });
});
