import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import { cleanFilters } from '@/services/reporting';

const SOURCES = [
  { key: 'portfolio', label: 'Portfolio overview', columns: ['project_code', 'capacity_mw'], filters: ['province'] },
  { key: 'capex_progress', label: 'Capex budget vs actual', columns: ['budget_category'], filters: [] },
];

describe('cleanFilters', () => {
  it('drops empty values and collapses to null', () => {
    expect(cleanFilters({ province: 'Koshi', district: '' })).toEqual({ province: 'Koshi' });
    expect(cleanFilters({ province: '' })).toBeNull();
    expect(cleanFilters(null)).toBeNull();
  });
});

describe('ReportsPage', () => {
  it('sends the chosen columns and filters and previews what comes back', async () => {
    const sent: unknown[] = [];
    server.use(
      http.get('*/api/v1/reports/sources', () => HttpResponse.json({ sources: SOURCES })),
      http.get('*/api/v1/reports/definitions', () => HttpResponse.json({ definitions: [] })),
      http.post('*/api/v1/reports/builder/run', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ source: 'portfolio', record_count: 1, generated_at: 'now',
                                   data: [{ project_code: 'HPM-KO-0001', capacity_mw: 12.5 }] });
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['auditor'] });
    renderRoute('/reports');

    await user.click(await screen.findByLabelText('Capacity mw'));
    await user.selectOptions(screen.getByLabelText('Filter by province'), 'Koshi');
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    const table = await screen.findByRole('table', { name: 'Report preview' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Capacity mw']);
    expect(within(table).getByText('12.5')).toBeInTheDocument();
    expect(sent).toEqual([{ source: 'portfolio', columns: ['capacity_mw'], filters: { province: 'Koshi' }, format: 'json' }]);
    expect(screen.getByText('1 row')).toBeInTheDocument();
    expect(screen.getByText('No saved reports')).toBeInTheDocument();
    // A source without a province filter does not offer one
    await user.selectOptions(screen.getByLabelText('Report on'), 'capex_progress');
    expect(screen.queryByLabelText('Filter by province')).not.toBeInTheDocument();
  });
});

describe('RegulatoryPage', () => {
  it('shows a maker only their reminders, and an auditor the calendar without filing actions', async () => {
    const filing = {
      id: 'f-1', requirement_id: 'r-1', requirement_code: 'Q-RET', title: 'Quarterly return', authority: 'NRB',
      project_id: null, period_label: 'FY 2083/84 Q1', period_end_ad: '2026-10-17', due_date_ad: '2026-11-16',
      due_date_bs: '2083-08-01', status: 'overdue', filed_date_ad: null, reference_no: null, assigned_to: null,
      remarks: null,
    };
    server.use(
      http.get('*/api/v1/reminders', () => HttpResponse.json({ reminders: [] })),
      http.get('*/api/v1/regulatory/calendar', () => HttpResponse.json({ filings: [filing] })),
      http.get('*/api/v1/regulatory/requirements', () => HttpResponse.json({ requirements: [] })),
    );
    signIn({ roles: ['maker'] });
    const first = renderRoute('/regulatory');
    expect(await screen.findByText('No reminders set.')).toBeInTheDocument();
    expect(screen.queryByText('Filing calendar')).not.toBeInTheDocument();
    first.unmount();

    signIn({ roles: ['auditor'] });
    renderRoute('/regulatory');
    const table = await screen.findByRole('table', { name: 'Filing calendar' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Quarterly return');
    expect(row).toHaveTextContent('2083-08-01 BS');
    expect(within(row as HTMLElement).getByText('Overdue')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByRole('button', { name: 'Record filing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add requirement' })).not.toBeInTheDocument();
    expect(screen.getByText('No requirements recorded')).toBeInTheDocument();
  });
});
