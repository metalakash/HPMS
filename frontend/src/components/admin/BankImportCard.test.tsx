import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';

const summary = (agrees = true) => ({
  as_of: 'Principal Outst as on 31 Chaitra 2081',
  borrowers: 2,
  agrees,
  totals: [
    { field: 'mw', parsed: '30', workbook: '30', matches: true },
    { field: 'limit', parsed: '1400', workbook: agrees ? '1400' : '1500', matches: agrees },
    { field: 'outstanding', parsed: '400', workbook: '400', matches: true },
  ],
  statuses: [
    { status: 'under_operation', label: 'in operation', count: 1, mw: '10', limit: '500', outstanding: '400',
      workbook_count: 1, workbook_mw: '10' },
    { status: 'yet_to_start_drawdown', label: 'yet to start drawdown', count: 1, mw: '20', limit: '900',
      outstanding: '0', workbook_count: 2, workbook_mw: '20' },
  ],
  projection: { quarters: 4, borrowers: 2, first: '2081-12-31', last: '2082-09-30' },
  bonds: { count: 0, amount: '0' },
  ratio_quarters: 0,
  new_loans: { limits: 0, quarters: 0, amount: '0' },
  generation: { borrowers: 1, plants: 1, months: 3 },
  located: 0,
  notes: ['Bonds: no bond table found; no bonds loaded'],
});

const upload = (overrides: object = {}) => ({
  id: 'imp-1',
  status: 'previewed',
  projection_filename: 'Projection.xlsx',
  generation_filename: 'Generation.xlsx',
  uploaded_by: 'admin',
  uploaded_at: '2026-10-26T10:00:00+00:00',
  agrees: true,
  files: 'f'.repeat(64),
  applied_by: null,
  applied_at: null,
  result: null,
  request: null,
  replaces: { projects: 50, loans: 41, documents: 12, change_requests: 4 },
  summary: summary(),
  ...overrides,
});

function serve(imports: object[], enabled = true) {
  server.use(
    http.get('*/api/v1/admin/users', () => HttpResponse.json(envelope([]))),
    http.get('*/api/v1/admin/audit/verify', () =>
      HttpResponse.json({ ok: true, rows_checked: 1, first_bad_id: null, problem: null })),
    http.get('*/api/v1/cbs/status', () =>
      HttpResponse.json(envelope({
        adapter: 'mock',
        circuit_breaker: { state: 'CLOSED', failure_count: 0 },
        rate_limiter: { max_calls_per_day: 1, calls_used_today: 0, remaining_calls: 1 },
      }))),
    http.get('*/api/v1/admin/demo-reset', () => HttpResponse.json({ enabled: false })),
    http.get('*/api/v1/admin/bank-import', () => HttpResponse.json(envelope({ enabled, imports }))),
  );
}

describe('Import bank workbooks', () => {
  it('is not shown where the backend does not offer it', async () => {
    serve([], false);
    signIn({ roles: ['admin'] });
    renderRoute('/admin');
    expect(await screen.findByText(/All 1 entries link/)).toBeInTheDocument();
    expect(screen.queryByText('Import bank workbooks')).not.toBeInTheDocument();
  });

  it('shows the reconciliation, flags a legend that disagrees, and offers submission when it adds up', async () => {
    serve([upload()]);
    signIn({ roles: ['admin'] });
    renderRoute('/admin');

    expect(await screen.findByText('Import bank workbooks')).toBeInTheDocument();
    const totals = await screen.findByRole('table', { name: 'Totals against the workbook' });
    expect(within(totals).getAllByText('Matches')).toHaveLength(3);
    const statuses = screen.getByRole('table', { name: /Facilities by status/ });
    expect(within(statuses).getByText(/^2 ·/)).toHaveClass('text-warning'); // the legend says 2, the colours 1
    expect(screen.getByText(/50 projects, 41 loans, 12 documents and 4 project change requests/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
    expect(screen.getByText('Notes from reading the workbooks (1)')).toBeInTheDocument();
  });

  it('does not offer submission for workbooks that do not add up', async () => {
    serve([upload({ agrees: false, summary: summary(false) })]);
    signIn({ roles: ['admin'] });
    renderRoute('/admin');
    expect(await screen.findByText('Does not add up')).toBeInTheDocument();
    expect(screen.getByText('Differs')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
  });

  it('points to Approvals once submitted', async () => {
    serve([upload({ request: { id: 'r-1', state: 'recommended' } })]);
    signIn({ roles: ['admin'] });
    renderRoute('/admin');
    expect(await screen.findByText('Waiting for approval (Recommended)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    const pointer = screen.getByText(/Another administrator approves it in/);
    expect(within(pointer).getByRole('link', { name: 'Approvals' })).toHaveAttribute('href', '/approvals');
  });
});
