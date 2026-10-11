import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';

const SOURCES = [{ key: 'portfolio', label: 'Portfolio overview', columns: [], filters: [] }];
const SCHEDULE = {
  id: 's-1', name: 'Weekly portfolio to NEA', report_id: 'portfolio', definition_id: null, export_format: 'excel',
  schedule: '0 6 * * 1', recipients: ['nea@example.org'], filters: null, is_enabled: true,
  last_run_at: null, next_run_at: '2026-10-19T06:00:00+00:00',
};
const RUN = { id: 'r-1', status: 'success', started_at: '2026-10-12T06:00:00+00:00', completed_at: null,
               record_count: 50, emails_sent: 1, error: null };
const CONTACT = {
  id: 'c-1', name: 'Sita Rai', organization: 'NEA', role: 'Engineer', category: 'external', email: 'sita@nea.example',
  phone: null, alert_types: ['PPA', 'LICENSE'], min_urgency: 'critical', is_active: true, project_id: null,
};

/** Empty answers for the regulatory endpoints the page loads alongside contacts. */
function serveRegulatoryEmpties() {
  server.use(
    http.get('*/api/v1/regulatory/requirements', () => HttpResponse.json({ requirements: [] })),
    http.get('*/api/v1/regulatory/calendar', () => HttpResponse.json({ filings: [] })),
    http.get('*/api/v1/reminders', () => HttpResponse.json({ reminders: [] })),
  );
}

function daysFromToday(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

describe('scheduled report delivery', () => {
  it('lets an admin schedule a report, with recipients checked before saving', async () => {
    const sent: unknown[] = [];
    server.use(
      http.get('*/api/v1/reports/sources', () => HttpResponse.json({ sources: SOURCES })),
      http.get('*/api/v1/reports/definitions', () => HttpResponse.json({ definitions: [] })),
      http.get('*/api/v1/reports/schedules', () => HttpResponse.json({ schedules: [SCHEDULE] })),
      http.post('*/api/v1/reports/schedules', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(SCHEDULE, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['admin'] });
    renderRoute('/reports');

    const table = await screen.findByRole('table', { name: 'Scheduled reports' });
    expect(within(table).getByText('Weekly portfolio to NEA')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Run now' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Schedule a report' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Monthly to bank');
    await user.selectOptions(within(dialog).getByLabelText('Report'), 'portfolio');
    await user.type(within(dialog).getByLabelText('Recipients (comma separated)'), 'nea@example.org, not-an-email');
    expect(within(dialog).getByText(/Not an email address: not-an-email/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Schedule' })).toBeDisabled();

    await user.clear(within(dialog).getByLabelText('Recipients (comma separated)'));
    await user.type(within(dialog).getByLabelText('Recipients (comma separated)'), 'nea@example.org, bank@example.org');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      name: 'Monthly to bank', report_id: 'portfolio', export_format: 'excel', schedule: '0 6 * * 1',
      recipients: ['nea@example.org', 'bank@example.org'],
    });
  }, 20_000);

  it('shows an auditor the schedules and their runs, without any controls to change them', async () => {
    server.use(
      http.get('*/api/v1/reports/sources', () => HttpResponse.json({ sources: SOURCES })),
      http.get('*/api/v1/reports/definitions', () => HttpResponse.json({ definitions: [] })),
      http.get('*/api/v1/reports/schedules', () => HttpResponse.json({ schedules: [SCHEDULE] })),
      http.get('*/api/v1/reports/schedules/:id/runs', () => HttpResponse.json({ runs: [RUN] })),
    );
    const user = userEvent.setup();
    signIn({ roles: ['auditor'] });
    renderRoute('/reports');

    const table = await screen.findByRole('table', { name: 'Scheduled reports' });
    expect(screen.queryByRole('button', { name: 'Schedule a report' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'History' }));
    const runs = await screen.findByRole('table', { name: 'Runs of Weekly portfolio to NEA' });
    expect(within(runs).getByText('Success')).toBeInTheDocument();
    expect(within(runs).getByText('50')).toBeInTheDocument();
  });
});

describe('stakeholder contacts', () => {
  it('lets an admin edit a contact without sending the category the API does not accept', async () => {
    serveRegulatoryEmpties();
    const patched: Record<string, unknown>[] = [];
    server.use(
      http.get('*/api/v1/regulatory/stakeholders', () => HttpResponse.json({ contacts: [CONTACT] })),
      http.patch('*/api/v1/regulatory/stakeholders/:id', async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ...CONTACT, organization: 'NEA Head Office' });
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['admin'] });
    renderRoute('/regulatory');

    const table = await screen.findByRole('table', { name: 'Stakeholder contacts' });
    await user.click(within(table).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('Category')).not.toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Organisation'));
    await user.type(within(dialog).getByLabelText('Organisation'), 'NEA Head Office');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0]).not.toHaveProperty('category');
    expect(patched[0]).toMatchObject({ organization: 'NEA Head Office', alert_types: ['PPA', 'LICENSE'], min_urgency: 'critical' });
  });

  it('shows an auditor the contacts without any way to change them', async () => {
    serveRegulatoryEmpties();
    server.use(http.get('*/api/v1/regulatory/stakeholders', () => HttpResponse.json({ contacts: [CONTACT] })));
    signIn({ roles: ['auditor'] });
    renderRoute('/regulatory');

    const table = await screen.findByRole('table', { name: 'Stakeholder contacts' });
    expect(within(table).getByText('Sita Rai')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add contact' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('project records', () => {
  it('flags an insurance policy close to expiry and records a new one', async () => {
    const posted: Record<string, unknown>[] = [];
    server.use(
      http.get('*/api/v1/projects/:id/insurance', () =>
        HttpResponse.json(envelope([{
          id: 'i-1', policy_number: 'CAR-77', insurer: 'Nepal Insurance', policy_type: 'CAR',
          sum_insured_npr: '500000000', premium_npr: null, valid_from_ad: '2025-11-01',
          valid_to_ad: daysFromToday(30), status: 'active',
        }]))),
      http.post('*/api/v1/projects/:id/insurance', async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(envelope({ id: 'i-2' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/projects/p-1?tab=insurance');

    const table = await screen.findByRole('table', { name: 'Insurance policies' });
    expect(within(table).getByText('CAR-77')).toBeInTheDocument();
    expect(within(table).getByText('30 days')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add policy' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Policy number'), 'CAR-78');
    await user.type(within(dialog).getByLabelText('Insurer'), 'Himalayan General');
    fireEvent.change(within(dialog).getByLabelText('Valid to'), { target: { value: daysFromToday(400) } });
    await user.click(within(dialog).getByRole('button', { name: 'Add policy' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ policy_number: 'CAR-78', insurer: 'Himalayan General', policy_type: 'CAR', valid_to_ad: daysFromToday(400) });
  });

  it('records how a grievance was resolved', async () => {
    const patched: Record<string, unknown>[] = [];
    server.use(
      http.get('*/api/v1/projects/:id/community-engagements', () =>
        HttpResponse.json(envelope([{
          id: 'g-1', engagement_type: 'grievance', engagement_date_ad: '2026-09-02', stakeholder_group: 'Ward 4 farmers',
          summary: 'Irrigation channel blocked during construction', status: 'open', resolution: null, resolved_date_ad: null,
        }]))),
      http.patch('*/api/v1/projects/:id/community-engagements/:item', async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(envelope({ id: 'g-1', status: 'resolved' }));
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/projects/p-1?tab=community');

    const table = await screen.findByRole('table', { name: 'Community engagement' });
    await user.click(within(table).getByRole('button', { name: 'Mark resolved' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Mark resolved' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('How it was resolved'), 'Channel reopened within a week');
    await user.click(confirm);

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0]).toMatchObject({ status: 'resolved', resolution: 'Channel reopened within a week' });
  });

  it('adds a risk with its likelihood and impact, and reports what a scan raised', async () => {
    const posted: Record<string, unknown>[] = [];
    let scans = 0;
    server.use(
      http.get('*/api/v1/projects/:id/risks', () =>
        HttpResponse.json(envelope([{
          id: 'k-1', title: 'Monsoon flooding of intake', description: null, risk_type: 'environmental',
          likelihood: 4, impact: 4, severity: 'high', mitigation_action: null, mitigation_owner: 'Site engineer',
          mitigation_due_ad: null, mitigation_status: 'open', trigger_source: 'milestone_delay',
        }]))),
      http.post('*/api/v1/projects/:id/risks', async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(envelope({ id: 'k-2' }), { status: 201 });
      }),
      http.post('*/api/v1/projects/:id/risks/auto-scan', () => {
        scans += 1;
        return HttpResponse.json(envelope({ risks_created: 1 }));
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/projects/p-1?tab=risks');

    const table = await screen.findByRole('table', { name: 'Risk register' });
    expect(within(table).getByText('Monsoon flooding of intake')).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Scan for risks' }));
    expect(await screen.findByText(/Scan finished: 1 new risk/)).toBeInTheDocument();
    expect(scans).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Add risk' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Risk'), 'Transmission line outage');
    await user.clear(within(dialog).getByLabelText('Likelihood (1-5)'));
    await user.type(within(dialog).getByLabelText('Likelihood (1-5)'), '5');
    await user.clear(within(dialog).getByLabelText('Impact (1-5)'));
    await user.type(within(dialog).getByLabelText('Impact (1-5)'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Add risk' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ title: 'Transmission line outage', likelihood: 5, impact: 5, risk_type: 'financial', mitigation_status: 'open' });
  });

  it('adds a milestone with its planned date and progress', async () => {
    const posted: Record<string, unknown>[] = [];
    server.use(
      http.get('*/api/v1/projects/:id/milestones', () =>
        HttpResponse.json(envelope([{
          id: 'm-1', name: 'Diversion tunnel breakthrough', category: 'civil', planned_date_ad: '2026-06-30',
          forecast_date_ad: '2026-09-15', actual_date_ad: null, status: 'delayed', percent_complete: '82.00', remarks: null,
        }]))),
      http.post('*/api/v1/projects/:id/milestones', async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(envelope({ id: 'm-2' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/projects/p-1?tab=milestones');

    const table = await screen.findByRole('table', { name: 'Milestones' });
    expect(within(table).getByText('Diversion tunnel breakthrough')).toBeInTheDocument();
    expect(within(table).getByText('82%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add milestone' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Milestone'), 'Penstock welding');
    fireEvent.change(within(dialog).getByLabelText('Planned date'), { target: { value: '2027-02-01' } });
    await user.click(within(dialog).getByRole('button', { name: 'Add milestone' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ name: 'Penstock welding', planned_date_ad: '2027-02-01', status: 'planned', percent_complete: 0 });
  });
});
