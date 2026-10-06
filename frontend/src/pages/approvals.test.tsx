import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope, projectDetail } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import type { ApprovalItem } from '@/types/api';

function makeApproval(overrides: Partial<ApprovalItem> = {}): ApprovalItem {
  return {
    id: 'ar-1',
    entity_type: 'PROJECT',
    entity_id: 'p-1',
    entity_label: 'Upper Trishuli (SBL-HPP-0001)',
    current_state: 'submitted',
    maker_id: 'u-maker',
    maker_name: 'Maya Maker',
    submitted_at: '2026-10-05T10:00:00',
    completed_at: null,
    action: 'UPDATE',
    justification: 'Monsoon delay per NEA letter 2083/06/15',
    changes: { forecast_cod_ad: '2027-03-31' },
    previous_values: { forecast_cod_ad: null },
    can_decide: true,
    ...overrides,
  };
}

/** Serves the queue and records what the page asked for and decided. */
function serveQueue(approvals: ApprovalItem[]) {
  const seen = { queries: [] as URLSearchParams[], decisions: [] as { verb: string; body: unknown }[] };
  server.use(
    http.get('*/api/v1/mutations/approval-queue', ({ request }) => {
      seen.queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(envelope({ total: approvals.length, approvals }));
    }),
    http.post('*/api/v1/mutations/:verb', async ({ request, params }) => {
      seen.decisions.push({ verb: String(params.verb), body: await request.json() });
      return HttpResponse.json(envelope({ approval_request_id: 'ar-1', new_state: 'recommended' }));
    }),
  );
  return seen;
}

describe('navigation', () => {
  it('offers Approvals to makers and checkers but not to guests', async () => {
    serveQueue([]);
    signIn({ roles: ['approver'] });
    const first = renderRoute('/approvals');
    expect(await screen.findByRole('link', { name: 'Approvals' })).toBeInTheDocument();
    first.unmount();

    signIn({ roles: ['guest'] });
    renderRoute('/');
    await screen.findByRole('link', { name: 'Dashboard' });
    expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
  });
});

describe('ApprovalQueuePage', () => {
  it('lists requests with what they change, who raised them and their state', async () => {
    serveQueue([
      makeApproval(),
      makeApproval({ id: 'ar-2', current_state: 'approved', can_decide: false, entity_label: 'Kali Gandaki B (X-2)' }),
    ]);
    signIn({ roles: ['approver'] });
    renderRoute('/approvals');

    const table = await screen.findByRole('table', { name: 'Change requests' });
    await within(table).findByText('Upper Trishuli (SBL-HPP-0001)'); // past the loading skeleton
    const [, first, second] = within(table).getAllByRole('row');
    expect(first).toHaveTextContent('Upper Trishuli (SBL-HPP-0001)');
    expect(first).toHaveTextContent('Forecast cod ad');
    expect(first).toHaveTextContent('Maya Maker');
    expect(first).toHaveTextContent('Awaiting first check');
    expect(within(first as HTMLElement).getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(second).toHaveTextContent('Approved');
    expect(within(second as HTMLElement).getByRole('button', { name: 'View' })).toBeInTheDocument();
  });

  it('filters by state through the API and the URL', async () => {
    const seen = serveQueue([]);
    signIn({ roles: ['approver'] });
    const { router } = renderRoute('/approvals');

    await screen.findByText('No change requests');
    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), 'recommended');

    await waitFor(() => expect(seen.queries.at(-1)?.get('status')).toBe('recommended'));
    expect(router.state.location.search).toBe('?status=recommended');
    expect(await screen.findByText('No requests in this state')).toBeInTheDocument();
  });

  it('shows the proposed change against the value it replaces, and recommends it', async () => {
    const seen = serveQueue([makeApproval()]);
    const user = userEvent.setup();
    signIn({ roles: ['approver'] });
    renderRoute('/approvals');

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = screen.getByRole('dialog', { name: 'Upper Trishuli (SBL-HPP-0001)' });
    expect(dialog).toHaveTextContent('Monsoon delay per NEA letter 2083/06/15');
    const change = within(within(dialog).getByRole('table', { name: 'Proposed changes' })).getAllByRole('row')[1];
    expect(change).toHaveTextContent('Forecast cod ad');
    expect(change).toHaveTextContent('—');
    expect(change).toHaveTextContent('2027-03-31');
    expect(dialog).toHaveTextContent('Nothing changes yet');

    await user.type(within(dialog).getByLabelText(/Remarks/), 'Checked against the site report');
    await user.click(within(dialog).getByRole('button', { name: 'Recommend' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(seen.decisions).toEqual([
      { verb: 'approve', body: { approval_request_id: 'ar-1', remarks: 'Checked against the site report' } },
    ]);
    // The queue is refetched after a decision
    expect(seen.queries.length).toBeGreaterThanOrEqual(2);
  });

  it('labels the second check as the one that applies the change', async () => {
    serveQueue([makeApproval({ current_state: 'recommended' })]);
    const user = userEvent.setup();
    signIn({ roles: ['admin'] });
    renderRoute('/approvals');

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    expect(screen.getByRole('button', { name: 'Approve and apply' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Nothing changes yet');
  });

  it('requires a reason of at least 10 characters to reject', async () => {
    const seen = serveQueue([makeApproval()]);
    const user = userEvent.setup();
    signIn({ roles: ['approver'] });
    renderRoute('/approvals');

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const confirm = screen.getByRole('button', { name: 'Confirm rejection' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Remarks/), 'too short');
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Remarks/), ', the letter is missing');
    await user.click(confirm);

    await waitFor(() => expect(seen.decisions).toHaveLength(1));
    expect(seen.decisions[0]).toEqual({
      verb: 'reject',
      body: { approval_request_id: 'ar-1', remarks: 'too short, the letter is missing' },
    });
  });

  it('offers no decision on a request the user may not decide', async () => {
    serveQueue([makeApproval({ can_decide: false })]);
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/approvals');

    await user.click(await screen.findByRole('button', { name: 'View' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('2027-03-31');
    expect(within(dialog).queryByRole('button', { name: /Recommend|Approve|Reject/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Remarks/)).not.toBeInTheDocument();
  });

  it('keeps the dialog open and shows the server reason when a decision is refused', async () => {
    serveQueue([makeApproval({ current_state: 'recommended' })]);
    server.use(
      http.post('*/api/v1/mutations/approve', () =>
        HttpResponse.json(
          { detail: 'The final approval must come from a different person than the recommender' },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    signIn({ roles: ['approver'] });
    renderRoute('/approvals');

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Approve and apply' }));

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'The final approval must come from a different person than the recommender',
    );
  });

  it('shows an error with retry when the queue cannot be loaded', async () => {
    server.use(
      http.get('*/api/v1/mutations/approval-queue', () =>
        HttpResponse.json({ detail: 'Failed to retrieve approval queue' }, { status: 500 }),
      ),
    );
    signIn({ roles: ['approver'] });
    renderRoute('/approvals');
    expect(await screen.findByText('Failed to retrieve approval queue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('proposing a change from a project', () => {
  function captureSubmission(response: () => Response) {
    const bodies: unknown[] = [];
    server.use(
      http.post('*/api/v1/mutations/submit-with-justification', async ({ request }) => {
        bodies.push(await request.json());
        return response();
      }),
    );
    return bodies;
  }

  it('is offered to makers and admins only', async () => {
    signIn({ roles: ['auditor'] });
    renderRoute('/projects/p-1');
    await screen.findByRole('heading', { name: projectDetail.name_en });
    expect(screen.queryByRole('button', { name: 'Propose change' })).not.toBeInTheDocument();
  });

  it('submits only the fields that changed, with the justification', async () => {
    const bodies = captureSubmission(() =>
      HttpResponse.json(envelope({ approval_request_id: 'ar-7', current_state: 'submitted' })),
    );
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/projects/p-1');

    await user.click(await screen.findByRole('button', { name: 'Propose change' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Submit for Approval' });

    // A justification alone is not a change
    await user.type(within(dialog).getByRole('textbox', { name: /Justification/ }), 'Plant commissioned on schedule');
    expect(submit).toBeDisabled();

    await user.selectOptions(within(dialog).getByLabelText('Pipeline status'), 'under_operation');
    await user.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent('Change request submitted');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodies).toEqual([
      {
        entity_type: 'PROJECT',
        entity_id: 'p-1',
        action: 'UPDATE',
        changes: { pipeline_status: 'under_operation' },
        justification: 'Plant commissioned on schedule',
      },
    ]);
    expect(screen.getByRole('link', { name: 'View approvals' })).toHaveAttribute('href', '/approvals');
  });

  it('asks for a drop reason before a project can be dropped', async () => {
    const bodies = captureSubmission(() =>
      HttpResponse.json(envelope({ approval_request_id: 'ar-8', current_state: 'submitted' })),
    );
    const user = userEvent.setup();
    signIn({ roles: ['admin'] });
    renderRoute('/projects/p-1');

    await user.click(await screen.findByRole('button', { name: 'Propose change' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /Justification/ }), 'Developer withdrew the application');
    await user.selectOptions(within(dialog).getByLabelText('Pipeline status'), 'dropped');
    const submit = within(dialog).getByRole('button', { name: 'Submit for Approval' });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Drop reason'), 'Withdrawn by developer');
    await user.click(submit);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      changes: { pipeline_status: 'dropped', drop_reason: 'Withdrawn by developer' },
    });
  });

  it('shows the server refusal and keeps the form', async () => {
    captureSubmission(() => HttpResponse.json({ detail: 'Not permitted to change this project' }, { status: 403 }));
    const user = userEvent.setup();
    signIn({ roles: ['maker'] });
    renderRoute('/projects/p-1');

    await user.click(await screen.findByRole('button', { name: 'Propose change' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /Justification/ }), 'Plant commissioned on schedule');
    await user.selectOptions(within(dialog).getByLabelText('Stage'), 'operation');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for Approval' }));

    expect(await within(dialog).findByText('Not permitted to change this project')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
