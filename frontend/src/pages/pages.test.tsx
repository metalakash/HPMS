import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { envelope } from '@/test/fixtures';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

describe('routing and auth', () => {
  it('redirects signed-out users to login', async () => {
    const { router } = renderRoute('/projects');
    expect(await screen.findByRole('heading', { name: 'Sign in to HPMS' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('signs in and returns to the originally requested page', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/loans');

    await user.type(await screen.findByLabelText('Username'), 'ram.sharma');
    await user.type(screen.getByLabelText('Password'), 'correct');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Loan accounts' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/loans');
    expect(useAuthStore.getState().user?.full_name).toBe('Ram Sharma');
  });

  it('shows the server error for bad credentials', async () => {
    const user = userEvent.setup();
    renderRoute('/login');

    await user.type(await screen.findByLabelText('Username'), 'ram.sharma');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password');
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('keeps the sign-in button disabled until both fields are filled', async () => {
    renderRoute('/login');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('signs out from the header', async () => {
    const user = userEvent.setup();
    signIn();
    const { router } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('hides Admin from non-admin users and shows it to admins', async () => {
    signIn({ roles: ['maker'] });
    const first = renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument();
    first.unmount();

    signIn({ roles: ['admin'] });
    renderRoute('/');
    const adminNav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(adminNav).getByRole('link', { name: /Admin/ })).toBeInTheDocument();
  });

  it('renders a not-found page for unknown routes', async () => {
    signIn();
    renderRoute('/nope');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('shows placeholders for screens without backend routes', async () => {
    signIn();
    renderRoute('/compliance');
    expect(await screen.findByText('Coming in Task 6.2')).toBeInTheDocument();
  });
});

describe('DashboardPage', () => {
  it('shows portfolio totals from meta.total_count and per-stage counts', async () => {
    signIn();
    renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'Portfolio overview' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    const tile = (label: string) => main.getByText(label).closest('div')!.parentElement!;
    await waitFor(() => expect(tile('Projects')).toHaveTextContent('23'));
    expect(tile('Loan accounts')).toHaveTextContent('31');
    expect(tile('In feasibility')).toHaveTextContent('4');
    expect(tile('In construction')).toHaveTextContent('7');
    expect(tile('In operation')).toHaveTextContent('12');

    const table = screen.getByRole('table', { name: 'Recently added projects' });
    expect(within(table).getByRole('link', { name: 'Upper Trishuli' })).toBeInTheDocument();
    expect(within(table).getByText('216 MW')).toBeInTheDocument();
  });

  it('shows Nepali project names when the language is ne', async () => {
    signIn();
    useUIStore.getState().setLanguage('ne');
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'माथिल्लो त्रिशूली' })).toBeInTheDocument();
  });

  it('shows an error with retry when projects fail to load', async () => {
    server.use(
      http.get('*/api/v1/projects', () =>
        HttpResponse.json({ detail: 'DB down' }, { status: 500 }),
      ),
    );
    signIn();
    renderRoute('/');
    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('DB down');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('ProjectsPage', () => {
  it('sends filters to the API and keeps them in the URL', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get('*/api/v1/projects', ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(envelope([], { page: 1, page_size: 20, total_count: 0 }));
      }),
    );
    const user = userEvent.setup();
    signIn();
    const { router } = renderRoute('/projects?page=3');

    await screen.findByRole('heading', { name: 'Projects' });
    await user.selectOptions(screen.getByLabelText('Stage'), 'operation');

    await waitFor(() => expect(requests.at(-1)?.get('stage')).toBe('operation'));
    // Changing a filter resets to page 1.
    expect(requests.at(-1)?.get('page')).toBe('1');
    expect(router.state.location.search).toBe('?stage=operation');
    expect(await screen.findByText('No projects match these filters')).toBeInTheDocument();
  });

  it('paginates using total_count', async () => {
    const user = userEvent.setup();
    signIn();
    const { router } = renderRoute('/projects');

    expect(await screen.findByText('1–20 of 23')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(router.state.location.search).toBe('?page=2');
  });

  it('opens a project on row click', async () => {
    const user = userEvent.setup();
    signIn();
    const { router } = renderRoute('/projects');
    await user.click(await screen.findByText('Kali Gandaki B'));
    expect(router.state.location.pathname).toBe('/projects/p-2');
  });
});

describe('ProjectDetailPage', () => {
  it('shows details, COD history and linked loans', async () => {
    signIn();
    renderRoute('/projects/p-1');

    expect(await screen.findByRole('heading', { name: 'Upper Trishuli' })).toBeInTheDocument();
    expect(screen.getByText('SBL-HPP-0001 · Rasuwa, Bagmati')).toBeInTheDocument();
    expect(screen.getByText('2083-08-16')).toBeInTheDocument();
    const loans = await screen.findByRole('table', { name: 'Loan accounts for this project' });
    expect(within(loans).getByText('9.25%')).toBeInTheDocument();
  });

  it('shows not-found for an unknown project', async () => {
    signIn();
    renderRoute('/projects/missing');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
