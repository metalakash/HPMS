import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import type { PerformanceRow, PortfolioMaintenance, UserAccount } from '@/types/api';

const performanceRow = (overrides: Partial<PerformanceRow> = {}): PerformanceRow => ({
  project_id: 'p-1',
  project_code: 'HPM-KO-0015',
  project_name: 'Sabha Khola',
  installed_capacity_mw: '3.3000',
  months: 12,
  first_month: '2025-10-01',
  last_month: '2026-09-01',
  actual_gwh: '90.00',
  contract_gwh: '100.00',
  delivery_pct: '90.00',
  revenue_npr: '120676920.00',
  avg_plf_pct: '59.60',
  avg_availability_pct: '93.90',
  forced_outage_hours: 20,
  open_risks: 2,
  serious_risks: 1,
  covenant_status: 'warning',
  ...overrides,
});

const MAINTENANCE: PortfolioMaintenance = {
  upcoming: [
    { id: 'm-1', project_id: 'p-1', project_code: 'HPM-BA-0009', project_name: 'Kulekhani-I',
      equipment_name: 'Step-up transformer', maintenance_type: 'preventive', contractor_name: 'O&M contractor',
      scheduled_date_ad: '2026-10-23', scheduled_date_bs: '2083-07-06', estimated_duration_hours: 24,
      estimated_impact_mwh: '720.00', status: 'scheduled', overdue: false },
    { id: 'm-2', project_id: 'p-2', project_code: 'HPM-BA-0004', project_name: 'Devighat',
      equipment_name: 'Desander gates', maintenance_type: 'preventive', contractor_name: null,
      scheduled_date_ad: '2026-09-01', scheduled_date_bs: null, estimated_duration_hours: null,
      estimated_impact_mwh: null, status: 'scheduled', overdue: true },
  ],
  completed: [
    { id: 'l-1', project_id: 'p-1', project_code: 'HPM-BA-0009', project_name: 'Kulekhani-I',
      equipment_name: 'Unit 2 generator', maintenance_type: 'corrective', contractor_name: 'O&M contractor',
      actual_date_ad: '2026-08-02', actual_date_bs: '2083-04-17', duration_hours: 48, downtime_mwh: '1152.00',
      cost_npr: '2500000.00', notes: 'Completed as planned' },
  ],
};

const USERS: UserAccount[] = [
  { id: 'u-1', username: 'admin', full_name: 'Admin User', email: 'admin@sbl.local', role: 'admin',
    is_active: true, directory_synced: false, last_login_at: '2026-10-07' },
  { id: 'u-2', username: 'r.sharma', full_name: null, email: 'r.sharma@sbl.local', role: 'maker',
    is_active: false, directory_synced: true, last_login_at: null },
];

describe('AnalyticsPage', () => {
  it('totals generation and flags plants delivering below contract', async () => {
    server.use(http.get('*/api/v1/analytics/performance', () => HttpResponse.json(envelope([
      performanceRow(),
      performanceRow({ project_id: 'p-2', project_name: 'Mai Khola', actual_gwh: '110.00', delivery_pct: '110.00',
                       open_risks: 0, serious_risks: 0, covenant_status: null }),
    ]))));
    signIn();
    renderRoute('/analytics');

    const table = await screen.findByRole('table', { name: 'Plant performance by project' });
    const [, weak, strong] = within(table).getAllByRole('row');
    expect(weak).toHaveTextContent('Sabha Khola');
    expect(weak).toHaveTextContent('90% (below contract)');
    expect(weak).toHaveTextContent('2 (1 high)');
    expect(within(weak as HTMLElement).getByText('Warning')).toBeInTheDocument();
    expect(strong).not.toHaveTextContent('below contract');
    expect(within(weak as HTMLElement).getByRole('link', { name: /Sabha Khola/ })).toHaveAttribute(
      'href', '/projects/p-1?tab=generation');

    expect(screen.getByText('Energy generated').parentElement?.parentElement).toHaveTextContent('200 GWh');
    expect(screen.getByText('Delivery against contract').parentElement?.parentElement).toHaveTextContent('100%');
    expect(screen.getByText('Plants below 95% delivery').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('says so when no plant has reported generation', async () => {
    server.use(http.get('*/api/v1/analytics/performance', () => HttpResponse.json(envelope([]))));
    signIn();
    renderRoute('/analytics');
    expect(await screen.findByText('No generation data')).toBeInTheDocument();
  });
});

describe('MaintenancePage', () => {
  it('lists upcoming and completed work and marks what is overdue', async () => {
    server.use(http.get('*/api/v1/maintenance', () => HttpResponse.json(envelope(MAINTENANCE))));
    signIn();
    renderRoute('/maintenance');

    const upcoming = await screen.findByRole('table', { name: 'Upcoming maintenance' });
    const [, first, second] = within(upcoming).getAllByRole('row');
    expect(first).toHaveTextContent('Kulekhani-I');
    expect(first).toHaveTextContent('2083-07-06 BS');
    expect(first).toHaveTextContent('720 MWh');
    expect(within(second as HTMLElement).getByText('Overdue')).toBeInTheDocument();

    const completed = screen.getByRole('table', { name: 'Completed maintenance' });
    expect(within(completed).getAllByRole('row')[1]).toHaveTextContent('Corrective');
    expect(screen.getByText('1 overdue')).toBeInTheDocument();
  });
});

describe('AdminPage', () => {
  function serve(chain: object, cbs: object) {
    server.use(
      http.get('*/api/v1/admin/users', () => HttpResponse.json(envelope(USERS))),
      http.get('*/api/v1/admin/audit/verify', () => HttpResponse.json(chain)),
      http.get('*/api/v1/cbs/status', () => HttpResponse.json(envelope(cbs))),
    );
  }
  const limiter = { max_calls_per_day: 1000, calls_used_today: 3, remaining_calls: 997 };
  const breaker = { state: 'CLOSED', failure_count: 0 };

  it('shows the real accounts, the core banking source and an intact audit chain', async () => {
    serve({ ok: true, rows_checked: 214, first_bad_id: null, problem: null },
          { adapter: 'file', mapping: 'Bank nightly extract', latest_file: 'loans_20261006.txt',
            latest_file_age_hours: 9.5, circuit_breaker: breaker, rate_limiter: limiter });
    signIn({ roles: ['admin'] });
    renderRoute('/admin');

    const table = await screen.findByRole('table', { name: 'User accounts' });
    const [, admin, maker] = within(table).getAllByRole('row');
    expect(admin).toHaveTextContent('Admin User');
    expect(maker).toHaveTextContent('r.sharma');
    expect(maker).toHaveTextContent('Directory');
    expect(within(maker as HTMLElement).getByText('Inactive')).toBeInTheDocument();

    expect(await screen.findByText('loans_20261006.txt')).toBeInTheDocument();
    expect(screen.getByText('Bank nightly extract')).toBeInTheDocument();
    expect(screen.getByText('3 of 1000')).toBeInTheDocument();
    expect(await screen.findByText('All 214 entries link to the one before them.')).toBeInTheDocument();
  });

  it('reports a broken audit chain and an unconnected core banking source plainly', async () => {
    serve({ ok: false, rows_checked: 122, first_bad_id: 123, problem: 'row 123 does not follow the previous row' },
          { adapter: 'mock', circuit_breaker: breaker, rate_limiter: limiter });
    signIn({ roles: ['admin'] });
    renderRoute('/admin');

    expect(await screen.findByText('row 123 does not follow the previous row')).toBeInTheDocument();
    expect(screen.getByText('Chain broken')).toBeInTheDocument();
    expect(await screen.findByText(/never changed/)).toBeInTheDocument();
  });
});
