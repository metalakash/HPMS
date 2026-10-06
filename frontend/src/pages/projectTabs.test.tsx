import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';

const GENERATION = {
  ppa: { agreement_number: 'NEA-001', purchaser: 'Nepal Electricity Authority', tariff_type: 'ROR', escalation_pct: 3, status: 'active' },
  monthly_data: [
    { month: '2026-08-01', month_bs: null, season: 'wet', contract_mwh: 1000, actual_mwh: 900, variance_pct: '-10.00', variance_status: 'warning', availability_pct: 95, curtailment_mwh: 0, revenue_npr: 4320000 },
  ],
  summary: { total_generated_mwh: 900, total_contract_mwh: 1000, total_revenue_npr: 4320000, avg_variance_pct: -10, months_available: 1 },
};
const EMPTY_GENERATION = {
  ppa: null,
  monthly_data: [],
  summary: { total_generated_mwh: 0, total_contract_mwh: 0, total_revenue_npr: 0, avg_variance_pct: 0, months_available: 0 },
};
const HYDROLOGY = {
  hydrology: { river_basin: 'Koshi', design_discharge_q90_m3s: 45.5, median_flow_q50_m3s: 52.3, catchment_area_sqkm: 2850 },
  water_licenses: [
    { license_number: 'WL-9', issuing_authority: 'DoED', river_basin: 'Koshi', validity_from: '2020-06-15', validity_to: '2026-12-01', days_until_expiry: 56, status: 'expiring_soon' },
  ],
  licenses_expiring_soon: 1,
};
const LAND = {
  land_acquisition: { total_area_required_ropani: 2500, total_area_acquired_ropani: 2350, acquisition_pct: 94, compensation_paid_npr: 45000000, compensation_outstanding_npr: 3500000 },
  board_of_directors: { total_members: 1, members: [{ director_name: 'Sita Rai', title: 'Chairperson', appointment_date: '2021-01-15' }] },
  shareholding: { total_shareholders: 1, total_share_pct: 51, shareholders: [{ entity_name: 'Promoter group', entity_type: 'promoter', share_pct: 51 }] },
};
const ESG = {
  environmental: { carbon_credits_generated: 85000, ghg_emissions_avoided_tonnes: 125000, co2_avoided_tonnes_per_year: 125000 },
  social: { local_employment_count: 450, community_grievance_count: 8, grievance_resolution_rate_pct: 87.5 },
  metrics_as_of: '2026-09-01',
  eia_mitigation: { total_measures: 1, completed_measures: 1, overall_completion_pct: 100, measures: [{ id: 'm1', measure: 'Fish passage', status: 'completed', completion_pct: 100 }] },
};

/** Serves the tab endpoints and counts how often each was called. */
function serveTabs(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, number> = {};
  const data: Record<string, unknown> = {
    'generation-ppa': GENERATION,
    hydrology: HYDROLOGY,
    'land-governance': LAND,
    esg: ESG,
    ...overrides,
  };
  server.use(
    ...Object.keys(data).map((name) =>
      http.get(`*/api/v1/projects/:id/${name}`, () => {
        calls[name] = (calls[name] ?? 0) + 1;
        return HttpResponse.json(envelope(data[name]));
      }),
    ),
  );
  return calls;
}

describe('project tabs', () => {
  it('opens on Overview and fetches a tab only when it is selected', async () => {
    const calls = serveTabs();
    const user = userEvent.setup();
    signIn();
    const { router } = renderRoute('/projects/p-1');

    const overview = await screen.findByRole('tab', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('table', { name: 'COD history' })).toBeInTheDocument();
    expect(calls).toEqual({});

    await user.click(screen.getByRole('tab', { name: 'Hydrology' }));
    expect(router.state.location.search).toBe('?tab=hydrology');
    expect(screen.getByRole('tab', { name: 'Hydrology' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('45.5 m³/s')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'COD history' })).not.toBeInTheDocument();
    expect(calls).toEqual({ hydrology: 1 });

    await user.click(screen.getByRole('tab', { name: 'ESG' }));
    await screen.findByText('Fish passage');
    expect(Object.keys(calls).sort()).toEqual(['esg', 'hydrology']);

    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(router.state.location.search).toBe('');
  });

  it('shows the agreement and monthly generation, flagging a shortfall', async () => {
    serveTabs();
    signIn();
    renderRoute('/projects/p-1?tab=generation');

    expect(await screen.findByText('NEA-001')).toBeInTheDocument();
    const row = within(await screen.findByRole('table', { name: 'Monthly generation' })).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Wet');
    expect(row).toHaveTextContent('1,000');
    expect(row).toHaveTextContent('900');
    expect(within(row as HTMLElement).getByText('-10%')).toHaveClass('text-danger');
  });

  it('shows licences with their expiry status', async () => {
    serveTabs();
    signIn();
    renderRoute('/projects/p-1?tab=hydrology');

    const row = within(await screen.findByRole('table', { name: 'Water licences' })).getAllByRole('row')[1];
    expect(row).toHaveTextContent('WL-9');
    expect(row).toHaveTextContent('Expiring soon');
    expect(screen.getByText('1 expiring soon')).toBeInTheDocument();
  });

  it('shows land acquisition, directors and shareholders', async () => {
    serveTabs();
    signIn();
    renderRoute('/projects/p-1?tab=land');

    expect(await screen.findByText('2,350 ropani')).toBeInTheDocument();
    expect(screen.getByText('Acquired (94%)')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Board of directors' })).getByText('Sita Rai')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Shareholding' })).getByText('51%')).toBeInTheDocument();
  });

  it('shows empty states, not zeros, when nothing is recorded', async () => {
    serveTabs({
      'generation-ppa': EMPTY_GENERATION,
      esg: { ...ESG, metrics_as_of: null, eia_mitigation: { total_measures: 0, completed_measures: 0, overall_completion_pct: 0, measures: [] } },
    });
    const user = userEvent.setup();
    signIn();
    renderRoute('/projects/p-1?tab=generation');

    expect(await screen.findByText('No power purchase agreement recorded')).toBeInTheDocument();
    expect(screen.getByText('No generation data recorded')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'ESG' }));
    expect(await screen.findByText('No ESG metrics recorded')).toBeInTheDocument();
    expect(screen.getByText('No mitigation measures recorded')).toBeInTheDocument();
  });

  it('shows an error with retry when a tab fails to load', async () => {
    server.use(
      http.get('*/api/v1/projects/:id/hydrology', () =>
        HttpResponse.json({ detail: 'Failed to fetch hydrology data' }, { status: 500 }),
      ),
    );
    signIn();
    renderRoute('/projects/p-1?tab=hydrology');
    expect(await screen.findByText('Failed to fetch hydrology data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('ignores an unknown tab in the URL', async () => {
    signIn();
    renderRoute('/projects/p-1?tab=nonsense');
    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('CBS sync on the project page', () => {
  it('is offered per loan to makers and admins, not to other roles', async () => {
    signIn({ roles: ['maker'] });
    const first = renderRoute('/projects/p-1');
    expect(await screen.findByRole('button', { name: 'Sync with CBS' })).toBeInTheDocument();
    first.unmount();

    signIn({ roles: ['approver'] });
    renderRoute('/projects/p-1');
    await screen.findByRole('table', { name: 'Loan accounts for this project' });
    await waitFor(() => expect(screen.getByText('Term loan')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Sync with CBS' })).not.toBeInTheDocument();
  });
});

describe('loan exposure import', () => {
  const HEADER = 'project_id,facility_type,sanctioned_amount,outstanding_principal,interest_rate_pct,tenor_years,grace_years,sanction_date,disbursement_date,maturity_date';
  const GOOD = '550e8400-e29b-41d4-a716-446655440000,Working Capital,100,50,12,10,0,2023-06-01,2023-06-15,2033-06-15';
  const file = (text: string, name = 'exposures.csv') => new File([text], name, { type: 'text/csv' });

  it('is offered to admins only', async () => {
    signIn({ roles: ['maker'] });
    renderRoute('/loans');
    await screen.findByRole('heading', { name: 'Loan accounts' });
    expect(screen.queryByRole('button', { name: 'Import exposures' })).not.toBeInTheDocument();
  });

  it('previews the file, sends only the valid rows and shows the server result', async () => {
    const bodies: { loan_accounts: unknown[]; sync_source: string; source_reference: string }[] = [];
    server.use(
      http.post('*/api/v1/loan-accounts/exposure-sync', async ({ request }) => {
        bodies.push((await request.json()) as (typeof bodies)[number]);
        return HttpResponse.json(
          envelope({ sync_id: 's1', total_records: 1, created_count: 0, updated_count: 1, skipped_count: 0, errors: [], warnings: ['Rate changed for 1 account'] }),
          { status: 202 },
        );
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['admin'] });
    renderRoute('/loans');

    await user.click(await screen.findByRole('button', { name: 'Import exposures' }));
    const dialog = screen.getByRole('dialog', { name: 'Import loan exposures' });
    const importButton = within(dialog).getByRole('button', { name: 'Import' });
    expect(importButton).toBeDisabled();

    await user.upload(within(dialog).getByLabelText(/Choose a CSV file/), file(`${HEADER}\n${GOOD}\n${GOOD.replace('100,50', 'lots,50')}`));

    expect(await within(dialog).findByText(/1 of 2 rows are ready to import; 1 will be left out/)).toBeInTheDocument();
    expect(within(dialog).getByText('Line 3: sanctioned_amount must be a number')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Import 1 row' }));

    expect(await within(dialog).findByText(/Import finished: 0 created, 1 updated, 0 skipped/)).toBeInTheDocument();
    expect(within(dialog).getByText('Rate changed for 1 account')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ sync_source: 'CSV', source_reference: 'exposures.csv' });
    expect(bodies[0]?.loan_accounts).toHaveLength(1);
    expect(bodies[0]?.loan_accounts[0]).toMatchObject({ sanctioned_amount: 100, tenor_years: 10 });
  });

  it('refuses a file that is not CSV or has no importable rows', async () => {
    const user = userEvent.setup({ applyAccept: false });
    signIn({ roles: ['admin'] });
    renderRoute('/loans');
    await user.click(await screen.findByRole('button', { name: 'Import exposures' }));
    const dialog = screen.getByRole('dialog');

    await user.upload(within(dialog).getByLabelText(/Choose a CSV file/), file('x', 'exposures.xlsx'));
    expect(await within(dialog).findByText('Choose a .csv file')).toBeInTheDocument();

    await user.upload(within(dialog).getByLabelText(/Choose a CSV file|exposures/), file('project_id\nabc'));
    expect(await within(dialog).findByText(/Missing columns: facility_type/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('shows the server error and lets the user retry', async () => {
    server.use(
      http.post('*/api/v1/loan-accounts/exposure-sync', () => HttpResponse.json({ detail: 'Sync failed' }, { status: 500 })),
    );
    const user = userEvent.setup();
    signIn({ roles: ['admin'] });
    renderRoute('/loans');
    await user.click(await screen.findByRole('button', { name: 'Import exposures' }));
    const dialog = screen.getByRole('dialog');

    await user.upload(within(dialog).getByLabelText(/Choose a CSV file/), file(`${HEADER}\n${GOOD}`));
    await user.click(await within(dialog).findByRole('button', { name: 'Import 1 row' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Sync failed');
    expect(within(dialog).getByRole('button', { name: 'Import 1 row' })).toBeEnabled();
  });
});
