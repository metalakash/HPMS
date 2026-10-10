import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import type { CovenantCalculation, CovenantHistory, CovenantMetric, CovenantResultRow } from '@/types/api';

const metric = (value: string | null, threshold: string, status: CovenantMetric['status']): CovenantMetric => ({
  value,
  threshold,
  status,
});

function makeRow(overrides: Partial<CovenantResultRow> = {}): CovenantResultRow {
  return {
    project_id: 'p-1',
    project_code: 'HPM-BA-0012',
    project_name: 'Mailung Khola',
    project_stage: 'operation',
    quarter: '2083-84-Q1',
    test_date: '2026-10-17',
    overall_status: 'breached',
    dscr: metric('1.0712', '1.2500', 'breached'),
    icr: metric('2.1000', '2.0000', 'warning'),
    ltv: metric('44.3932', '70.0000', 'compliant'),
    ...overrides,
  };
}

const BUILDING = makeRow({
  project_id: 'p-2',
  project_code: 'HPM-BA-0018',
  project_name: 'Balephi',
  project_stage: 'construction',
  overall_status: 'compliant',
  dscr: metric(null, '1.2500', 'not_tested'),
  icr: metric(null, '2.0000', 'not_tested'),
});

const HISTORY: CovenantHistory = {
  project_id: 'p-1',
  quarters_available: 2,
  latest_quarter: '2083-84-Q1',
  overall_status: 'breached',
  trends: [
    { quarter: '2082-83-Q4', quarter_bs: '2082-83-Q4', covenant_date: '2026-07-16',
      dscr: metric('1.3400', '1.25', 'warning'), icr: metric('2.3', '2', 'compliant'), ltv: metric('44.39', '70', 'compliant') },
    { quarter: '2083-84-Q1', quarter_bs: '2083-84-Q1', covenant_date: '2026-10-17',
      dscr: metric('1.0712', '1.25', 'breached'), icr: metric('2.1', '2', 'warning'), ltv: metric('44.39', '70', 'compliant') },
  ],
};

const CALCULATION: CovenantCalculation = {
  quarter: '2083-84-Q1',
  test_date: '2026-10-17',
  window: { from: '2025-10-18', to: '2026-10-17', quarters_used: ['2082-83-Q2', '2082-83-Q3', '2082-83-Q4', '2083-84-Q1'] },
  overall_status: 'breached',
  dscr: { ...metric('1.0712', '1.2500', 'breached'), note: null },
  icr: { ...metric(null, '2.0000', 'not_tested'), note: 'Depreciation is not reported for every quarter' },
  ltv: { ...metric('44.3932', '70.0000', 'compliant'), note: null },
  inputs: {
    revenue: '191873010.00', ebitda: '101558966.00', cfads: '101558966.00', ebit: null,
    principal_due: '38663625.00', interest_due: '56147316.00', debt_service: '94810941.00',
    outstanding_principal: '483295313.00', security_value: '1088670463.00',
  },
  terms_source: 'sanction terms',
};

function serve(rows: CovenantResultRow[]) {
  server.use(
    http.get('*/api/v1/compliance/covenants', () => HttpResponse.json(envelope(rows))),
    http.get('*/api/v1/compliance/covenants/:id/history', () => HttpResponse.json(envelope(HISTORY))),
    http.get('*/api/v1/compliance/covenants/:id/calculation', () => HttpResponse.json(envelope(CALCULATION))),
  );
}

describe('CompliancePage', () => {
  it('lists each project with its ratios and counts breaches and warnings', async () => {
    serve([makeRow(), BUILDING, makeRow({ project_id: 'p-3', project_name: 'Hewa Khola', overall_status: 'warning' })]);
    signIn();
    renderRoute('/compliance');

    const table = await screen.findByRole('table', { name: 'Latest covenant test per project' });
    const [, first, second] = within(table).getAllByRole('row');
    expect(first).toHaveTextContent('Mailung Khola');
    expect(first).toHaveTextContent('1.07x (breached)');
    expect(first).toHaveTextContent('2.10x (warning)');
    expect(first).toHaveTextContent('44.39%');
    expect(within(first as HTMLElement).getByText('Breached')).toBeInTheDocument();
    // A project still being built has no coverage ratios, and that is not shown as zero
    expect(second).toHaveTextContent('Balephi');
    expect(within(second as HTMLElement).getAllByText('—')).toHaveLength(2);

    expect(screen.getByText('Projects tested').parentElement?.parentElement).toHaveTextContent('3');
    expect(screen.getByText('In breach').parentElement?.parentElement).toHaveTextContent('1');
    expect(screen.getByText('Close to a limit').parentElement?.parentElement).toHaveTextContent('1');
  });

  it('opens the working and history for a project', async () => {
    serve([makeRow()]);
    const user = userEvent.setup();
    signIn();
    renderRoute('/compliance');

    await user.click(await screen.findByRole('button', { name: /Mailung Khola/ }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByRole('heading', { name: 'Covenants: Mailung Khola' })).toBeInTheDocument();

    expect(await within(drawer).findByText('How FY 2083/84 Q1 was calculated')).toBeInTheDocument();
    expect(drawer).toHaveTextContent('Required minimum: 1.25x');
    expect(drawer).toHaveTextContent('tested against sanction terms');
    // An untested ratio says why instead of showing a number
    expect(within(drawer).getByText('Depreciation is not reported for every quarter')).toBeInTheDocument();
    expect(within(drawer).getByText('Not tested')).toBeInTheDocument();

    const [, latest, earlier] = within(within(drawer).getByRole('table')).getAllByRole('row');
    expect(latest).toHaveTextContent('FY 2083/84 Q1');
    expect(latest).toHaveTextContent('1.07x (Breached)');
    expect(earlier).toHaveTextContent('FY 2082/83 Q4');
    expect(earlier).toHaveTextContent('1.34x (Warning)');
  });

  it('says so when nothing has been tested, and reports a failed load', async () => {
    serve([]);
    signIn();
    const first = renderRoute('/compliance');
    expect(await screen.findByText('No covenant tests yet')).toBeInTheDocument();
    first.unmount();

    server.use(http.get('*/api/v1/compliance/covenants', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })));
    renderRoute('/compliance');
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this data");
  });
});
