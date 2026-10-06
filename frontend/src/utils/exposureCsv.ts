import type { ExposureImportItem } from '@/types/api';

/** Columns of backend/data/loan_exposure_import_template.csv. */
const REQUIRED = [
  'project_id',
  'facility_type',
  'sanctioned_amount',
  'outstanding_principal',
  'interest_rate_pct',
  'tenor_years',
  'grace_years',
  'sanction_date',
  'disbursement_date',
  'maturity_date',
] as const;
const OPTIONAL_NUMBERS = ['disbursed_amount', 'outstanding_interest', 'dscr', 'ltv', 'icr'] as const;
const OPTIONAL_TEXT = ['risk_rating', 'ifrs9_stage'] as const;
const NUMBERS = ['sanctioned_amount', 'outstanding_principal', 'interest_rate_pct'] as const;
const INTEGERS = ['tenor_years', 'grace_years'] as const;
const DATES = ['sanction_date', 'disbursement_date', 'maturity_date'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ExposureRowError {
  /** Line in the file, counting the header as line 1. */
  line: number;
  message: string;
}

export interface ExposureCsvResult {
  rows: ExposureImportItem[];
  errors: ExposureRowError[];
  totalRows: number;
}

/** Splits CSV text into records, honouring quoted fields with embedded commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  // Drop a byte-order mark, which Excel adds to CSV exports
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toAmount(value: string): number | null {
  if (value === '' || !/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Number(value);
}

/**
 * Turns the template CSV into API rows. A row with any problem is left out of `rows` and reported
 * in `errors`; a missing column is reported once, against the header.
 */
export function parseExposureCsv(text: string): ExposureCsvResult {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], errors: [{ line: 1, message: 'The file is empty' }], totalRows: 0 };

  const columns = header.map((name) => name.trim().toLowerCase());
  const missing = REQUIRED.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` }],
      totalRows: body.length,
    };
  }

  const rows: ExposureImportItem[] = [];
  const errors: ExposureRowError[] = [];

  body.forEach((cells, index) => {
    const line = index + 2;
    const get = (name: string) => (cells[columns.indexOf(name)] ?? '').trim();
    const problems: string[] = [];
    const row: Record<string, string | number> = {};

    if (!UUID.test(get('project_id'))) problems.push('project_id is not a valid id');
    row.project_id = get('project_id');
    if (!get('facility_type')) problems.push('facility_type is required');
    row.facility_type = get('facility_type');

    for (const name of NUMBERS) {
      const amount = toAmount(get(name));
      if (amount === null) problems.push(`${name} must be a number`);
      else if (amount < 0) problems.push(`${name} cannot be negative`);
      else row[name] = amount;
    }
    for (const name of INTEGERS) {
      if (!/^\d+$/.test(get(name))) problems.push(`${name} must be a whole number`);
      else row[name] = Number(get(name));
    }
    for (const name of DATES) {
      if (!isRealDate(get(name))) problems.push(`${name} must be a date as YYYY-MM-DD`);
      else row[name] = get(name);
    }
    for (const name of OPTIONAL_NUMBERS) {
      if (get(name) === '') continue;
      const amount = toAmount(get(name));
      if (amount === null) problems.push(`${name} must be a number`);
      else row[name] = amount;
    }
    for (const name of OPTIONAL_TEXT) {
      if (get(name)) row[name] = get(name);
    }

    if (problems.length === 0) {
      const outstanding = row.outstanding_principal as number;
      const sanctioned = row.sanctioned_amount as number;
      if (outstanding > sanctioned) problems.push('outstanding_principal exceeds sanctioned_amount');
      if ((row.maturity_date as string) <= (row.sanction_date as string)) {
        problems.push('maturity_date must be after sanction_date');
      }
    }

    if (problems.length > 0) errors.push({ line, message: problems.join('; ') });
    else rows.push(row as unknown as ExposureImportItem);
  });

  return { rows, errors, totalRows: body.length };
}
