import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope, makeLoan } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';

describe('LoansPage', () => {
  it('lists loan accounts with formatted amounts and sync status', async () => {
    signIn();
    renderRoute('/loans');

    const table = await screen.findByRole('table', { name: 'Loan accounts' });
    const row = (await within(table).findByText('SBL-HPP-0001')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Term loan');
    expect(row).toHaveTextContent('9.25%');
    expect(row).toHaveTextContent('Success');
    // NPR 1,500,000,000 with lakh/crore grouping
    expect(row).toHaveTextContent('1,50,00,00,000');
    expect(screen.getByText('1–20 of 31')).toBeInTheDocument();
  });

  it('sends the sync-status filter to the API, keeps it in the URL and resets the page', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get('*/api/v1/loan-accounts', ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(
          envelope([makeLoan({ sync_status: 'failed' })], { page: 1, page_size: 20, total_count: 1 }),
        );
      }),
    );
    signIn();
    const { router } = renderRoute('/loans?page=2');

    await screen.findByRole('heading', { name: 'Loan accounts' });
    await userEvent.setup().selectOptions(screen.getByLabelText('CBS sync status'), 'failed');

    await waitFor(() => expect(requests.at(-1)?.get('status')).toBe('failed'));
    expect(requests.at(-1)?.get('page')).toBe('1');
    expect(router.state.location.search).toBe('?status=failed');
  });

  it('shows a status-specific empty state', async () => {
    server.use(
      http.get('*/api/v1/loan-accounts', () =>
        HttpResponse.json(envelope([], { page: 1, page_size: 20, total_count: 0 })),
      ),
    );
    signIn();
    renderRoute('/loans?status=failed');

    expect(await screen.findByText('No loan accounts with this status')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('shows an error with retry when loading fails, and recovers', async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/loan-accounts', () =>
        fail
          ? HttpResponse.json({ detail: 'CBS mirror offline' }, { status: 500 })
          : HttpResponse.json(envelope([makeLoan()], { page: 1, page_size: 20, total_count: 1 })),
      ),
    );
    signIn();
    renderRoute('/loans');

    expect(await screen.findByText('CBS mirror offline')).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SBL-HPP-0001')).toBeInTheDocument();
  });
});
