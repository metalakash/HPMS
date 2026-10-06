import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderWithClient } from '@/test/render';
import { server } from '@/test/server';
import type { CbsSyncResult } from '@/types/api';
import { CBSSyncButton } from './CBSSyncButton';

const RESULT: CbsSyncResult = {
  status: 'success',
  sync_timestamp: '2026-10-06T00:00:00',
  changes_count: 1,
  simulated: false,
  applied: true,
  diff_log: [
    { field: 'outstanding_principal', previous_value: 850000000, new_value: 842000000, status: 'changed' },
    { field: 'interest_rate_pct', previous_value: 9.25, new_value: 9.25, status: 'same' },
  ],
};

function onSync(resolver: () => Response | Promise<Response>) {
  const calls: { path: string; body: unknown }[] = [];
  server.use(
    http.post('*/cbs/sync/:projectId', async ({ request }) => {
      calls.push({ path: new URL(request.url).pathname, body: await request.json() });
      return resolver();
    }),
  );
  return calls;
}

const setup = (onSyncComplete = vi.fn()) => {
  renderWithClient(<CBSSyncButton projectId="p-1" loanId="l-1" onSyncComplete={onSyncComplete} />);
  return { user: userEvent.setup(), onSyncComplete, button: screen.getByRole('button', { name: 'Sync with CBS' }) };
};

describe('CBSSyncButton', () => {
  it('posts the loan id to the versioned sync endpoint and shows the server comparison', async () => {
    const calls = onSync(() => HttpResponse.json(envelope(RESULT)));
    const { user, button, onSyncComplete } = setup();

    await user.click(button);

    expect(await screen.findByText('1 field differs from CBS')).toBeInTheDocument();
    expect(calls).toEqual([{ path: '/api/v1/cbs/sync/p-1', body: { loan_id: 'l-1' } }]);
    expect(screen.getByText('The loan was updated with the CBS values.')).toBeInTheDocument();

    const rows = within(screen.getByRole('table', { name: 'CBS comparison' })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Outstanding principal');
    expect(rows[1]).toHaveTextContent('850000000');
    expect(rows[1]).toHaveTextContent('842000000 (differs)');
    expect(rows[2]).not.toHaveTextContent('(differs)');
    expect(onSyncComplete).toHaveBeenCalledTimes(1);
  });

  it('says so when the comparison is simulated and nothing was changed', async () => {
    onSync(() => HttpResponse.json(envelope({ ...RESULT, simulated: true, applied: false })));
    const { user, button } = setup();
    await user.click(button);

    expect(await screen.findByText(/Simulated: no Finacle connection is configured/)).toBeInTheDocument();
    expect(screen.getByText(/No balances were changed/)).toBeInTheDocument();
    expect(screen.queryByText('The loan was updated with the CBS values.')).not.toBeInTheDocument();
  });

  it('reports a loan that already matches', async () => {
    const same = RESULT.diff_log.map((d) => ({ ...d, new_value: d.previous_value, status: 'same' as const }));
    onSync(() => HttpResponse.json(envelope({ ...RESULT, changes_count: 0, applied: false, diff_log: same })));
    const { user, button } = setup();
    await user.click(button);

    expect(await screen.findByText('No differences from CBS')).toBeInTheDocument();
    expect(screen.getByText('The loan already matches CBS.')).toBeInTheDocument();
  });

  it('disables the button while syncing', async () => {
    onSync(async () => {
      await delay(50);
      return HttpResponse.json(envelope(RESULT));
    });
    const { user, button } = setup();

    await user.click(button);
    expect(screen.getByRole('button', { name: /Syncing/ })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Sync with CBS' })).toBeEnabled();
  });

  it('collapses and expands the comparison', async () => {
    onSync(() => HttpResponse.json(envelope(RESULT)));
    const { user, button } = setup();
    await user.click(button);

    const toggle = await screen.findByRole('button', { name: /differs from CBS/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server detail when the request fails', async () => {
    onSync(() => HttpResponse.json({ detail: 'Not permitted to sync loans of this project' }, { status: 403 }));
    const { user, button, onSyncComplete } = setup();
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('Not permitted to sync loans of this project');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(onSyncComplete).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });

  it('shows the reason when CBS could not be reached, which the API reports with a 200', async () => {
    onSync(() =>
      HttpResponse.json(
        envelope({ status: 'error', error: 'Finacle CBS unreachable', sync_timestamp: 'x', changes_count: 0, diff_log: [] }),
      ),
    );
    const { user, button, onSyncComplete } = setup();
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('Finacle CBS unreachable');
    expect(onSyncComplete).not.toHaveBeenCalled();
  });
});
