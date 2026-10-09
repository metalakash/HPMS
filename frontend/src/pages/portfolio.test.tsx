import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import type {
  EnergyFinancing, EnergyFinancingQuarter, LoanProjection, PerformanceRow, PortfolioMaintenance, UserAccount,
} from '@/types/api';

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

const quarter = (fiscal_year: string, q: number, label: string, end: string, figures: [string, string, string]) => ({
  fiscal_year, quarter: q, label, period_end_ad: end, period_end_bs: null, is_opening: false,
  disbursement: figures[0], repayment: figures[1], outstanding: figures[2],
});

const PROJECTION: LoanProjection = {
  quarters: [
    { ...quarter('2081/82', 3, 'Chaitra end', '2025-04-13', ['0', '0', '1000.00']), period_end_bs: '2081-12-31', is_opening: true },
    quarter('2081/82', 4, 'Ashad end', '2025-07-16', ['500.00', '100.00', '1400.00']),
    quarter('2099/00', 1, 'Ashoj end', '2099-10-17', ['300.00', '200.00', '1500.00']),
  ],
  projects: [
    { project_id: 'p-1', project_code: 'HPM-KO-0015', project_name: 'Sabha Khola', pipeline_status: 'under_construction',
      sanctioned_amount: '2000.00', opening_outstanding: '1000.00', closing_outstanding: '1500.00',
      peak_outstanding: '1500.00', total_disbursement: '800.00', total_repayment: '300.00',
      outstanding: ['1000.00', '1400.00', '1500.00'] },
  ],
};

describe('ProjectionPage', () => {
  it('totals the plan and marks the opening position and quarters already past', async () => {
    server.use(http.get('*/api/v1/loans/projection', () => HttpResponse.json(envelope(PROJECTION))));
    signIn();
    renderRoute('/projection');

    const table = await screen.findByRole('table', {
      name: 'Projected disbursement, repayment and outstanding by fiscal quarter',
    });
    const [, opening, past, future] = within(table).getAllByRole('row');
    expect(opening).toHaveTextContent('FY 2081/82 · Chaitra end');
    expect(opening).toHaveTextContent('Opening position');
    expect(past).toHaveTextContent('Date passed');
    expect(past).toHaveTextContent('1,400');
    expect(future).not.toHaveTextContent('Date passed');

    const tile = (label: string) => screen.getByText(label).parentElement?.parentElement;
    expect(tile('Opening outstanding')).toHaveTextContent('1,000');
    expect(tile('Opening outstanding')).toHaveTextContent('as on 2081-12-31 BS');
    expect(tile('Planned disbursement')).toHaveTextContent('800');
    expect(tile('Planned repayment')).toHaveTextContent('300');
    expect(tile('Closing outstanding')).toHaveTextContent('1,500');

    const borrowers = screen.getByRole('table', { name: 'Projection by borrower' });
    expect(within(borrowers).getByRole('link', { name: /Sabha Khola/ })).toHaveAttribute('href', '/projects/p-1');
  });

  it('says so when no projection is on file', async () => {
    server.use(http.get('*/api/v1/loans/projection', () => HttpResponse.json(envelope({ quarters: [], projects: [] }))));
    signIn();
    renderRoute('/projection');

    expect(await screen.findByText('No projection on file')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Projection by borrower' })).not.toBeInTheDocument();
  });
});

const ratioQuarter = (overrides: Partial<EnergyFinancingQuarter>): EnergyFinancingQuarter => ({
  fiscal_year: '2081/82', quarter: 3, label: 'Chaitra end', period_end_ad: '2025-04-13', period_end_bs: '2081-12-31',
  is_actual: true, hydro_outstanding: '900.00', energy_bonds: '100.00', energy_financing: '1000.00',
  base_loans: '10000.00', ratio_pct: '10.0000', required_pct: '6.5000', requirement: '650.00', headroom: '350.00',
  status: 'met', with_pipeline: null, ...overrides,
});

const ENERGY: EnergyFinancing = {
  quarters: [
    ratioQuarter({}),
    ratioQuarter({ fiscal_year: '2099/00', quarter: 1, label: 'Ashoj end', period_end_ad: '2099-10-17',
                   period_end_bs: '2156-06-31', is_actual: false, ratio_pct: '9.2500', required_pct: '10.0000',
                   requirement: '1000.00', headroom: '-75.00', status: 'shortfall' }),
  ],
  pipeline: { limits: [], total_limit: '0', quarters: [], total_disbursement: '0' },
  bonds: [
    { id: 'b-1', name: 'Urja Rinpatra 7%', amount: '100.00', yield_pct: '7.0000', investment_date_ad: '2023-01-05',
      maturity_date_ad: '2099-01-03', maturity_date_bs: null, held: true },
    { id: 'b-2', name: 'Old Energy Bond', amount: '50.00', yield_pct: null, investment_date_ad: '2015-01-01',
      maturity_date_ad: '2020-01-01', maturity_date_bs: null, held: false },
  ],
  bonds_held: '100.00',
};

describe('EnergyFinancingPage', () => {
  it('shows the latest quarter reached, the next shortfall and which bonds still count', async () => {
    server.use(http.get('*/api/v1/energy-financing', () => HttpResponse.json(envelope(ENERGY))));
    signIn();
    renderRoute('/energy-financing');

    const table = await screen.findByRole('table', {
      name: 'Energy financing against the regulatory minimum by fiscal quarter',
    });
    const [, recorded, projected] = within(table).getAllByRole('row');
    expect(recorded).toHaveTextContent('Recorded');
    expect(recorded).toHaveTextContent('10%');
    expect(projected).toHaveTextContent('Projected');
    expect(projected).toHaveTextContent('Short by');

    const tile = (label: string) => screen.getByText(label).parentElement?.parentElement;
    expect(tile('Energy share of lending')).toHaveTextContent('10%');
    expect(tile('Energy share of lending')).toHaveTextContent('Chaitra end FY 2081/82 · recorded');
    expect(tile('Headroom over the minimum')).toHaveTextContent('350');
    expect(tile('Energy bonds held')).toHaveTextContent('1 bonds');
    expect(tile('Next quarter below the minimum')).toHaveTextContent('Ashoj end FY 2099/00');

    const bonds = screen.getByRole('table', { name: 'Energy bonds' });
    const [, held, matured] = within(bonds).getAllByRole('row');
    expect(held).not.toHaveTextContent('Not held');
    expect(matured).toHaveTextContent('Not held');
    expect(screen.queryByRole('table', { name: 'Planned new loan limits' })).not.toBeInTheDocument();
    expect(within(table).queryByText('With planned new loans')).not.toBeInTheDocument();
  });

  it('shows what the planned new loans do to a projected shortfall', async () => {
    const [recorded, projected] = ENERGY.quarters;
    server.use(http.get('*/api/v1/energy-financing', () => HttpResponse.json(envelope({
      ...ENERGY,
      quarters: [
        { ...recorded, with_pipeline: { new_loans_outstanding: '0', ratio_pct: '10.0000', headroom: '350.00', status: 'met' } },
        { ...projected, with_pipeline: { new_loans_outstanding: '150.00', ratio_pct: '10.7500', headroom: '75.00', status: 'met' } },
      ],
      pipeline: {
        limits: [{ fiscal_year: '2098/99', new_limit: '400.00', drawdown_pct: [7.5, 33.75, 40, 18.75] }],
        total_limit: '400.00',
        quarters: [{ fiscal_year: '2099/00', quarter: 1, label: 'Ashoj end', period_end_ad: '2099-10-17',
                     period_end_bs: null, planned_disbursement: '150.00' }],
        total_disbursement: '150.00',
      },
    }))));
    signIn();
    renderRoute('/energy-financing');

    const table = await screen.findByRole('table', {
      name: 'Energy financing against the regulatory minimum by fiscal quarter',
    });
    const [, recordedRow, projectedRow] = within(table).getAllByRole('row');
    expect(within(table).getByText('With planned new loans')).toBeInTheDocument();
    // A recorded quarter is what it was; only the projected one gets a scenario figure
    expect(recordedRow).not.toHaveTextContent('lent');
    expect(projectedRow).toHaveTextContent('Short by');
    expect(projectedRow).toHaveTextContent('10.75%');
    expect(projectedRow).toHaveTextContent('lent');

    const tile = screen.getByText('Next quarter below the minimum').parentElement?.parentElement;
    expect(tile).toHaveTextContent('Ashoj end FY 2099/00');
    expect(tile).toHaveTextContent('with planned new loans: none on file');

    const limits = screen.getByRole('table', { name: 'Planned new loan limits' });
    expect(within(limits).getByText('FY 2098/99')).toBeInTheDocument();
    expect(limits).toHaveTextContent('7.5% · 33.75% · 40% · 18.75%');
  });
});

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
