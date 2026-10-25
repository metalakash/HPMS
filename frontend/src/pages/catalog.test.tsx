import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderRoute, signIn } from '@/test/render';
import { server } from '@/test/server';

describe('Projects: My Portfolio and National Catalog', () => {
  it('opens on the bank portfolio and asks the API for it by default', async () => {
    signIn();
    const { router } = renderRoute('/projects');
    expect(await screen.findByRole('tab', { name: 'My Portfolio', selected: true })).toBeInTheDocument();
    expect(await screen.findByText('Upper Trishuli')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    // The catalog's records are not listed in the portfolio view
    expect(screen.queryByText('Seti Catalog Hydro')).not.toBeInTheDocument();
  });

  it('switches to a searchable catalog that keeps its view in the URL', async () => {
    signIn({ roles: ['maker'] });
    const { router } = renderRoute('/projects');
    fireEvent.click(await screen.findByRole('tab', { name: 'National Catalog' }));

    expect(await screen.findByText('Seti Catalog Hydro')).toBeInTheDocument();
    expect(screen.getByText('DoED-GEN-2075-014')).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('view')).toBe('catalog');

    fireEvent.change(screen.getByLabelText('Search the catalog'), { target: { value: 'tamor' } });
    await waitFor(() => expect(screen.queryByText('Seti Catalog Hydro')).not.toBeInTheDocument());
    expect(screen.getByText('Tamor Reference Hydro')).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('tamor');
  });

  it('lets a maker propose a catalog project with a justification', async () => {
    signIn({ roles: ['maker'] });
    let sent: unknown = null;
    server.use(
      http.post('*/api/v1/projects/:id/originate', async ({ request, params }) => {
        sent = { id: params.id, body: await request.json() };
        return HttpResponse.json(
          { data: { approval_request_id: 'ar-1', current_state: 'submitted' }, meta: {}, audit: {} },
          { status: 202 },
        );
      }),
    );
    renderRoute('/projects?view=catalog');

    fireEvent.click(await screen.findByRole('button', { name: 'Propose Seti Catalog Hydro for financing' }));
    const dialog = await screen.findByRole('dialog');
    // The baseline parameters come from the national record
    expect(within(dialog).getByText('DoED-GEN-2075-014')).toBeInTheDocument();
    expect(within(dialog).getByText('Kaski')).toBeInTheDocument();

    const submit = within(dialog).getByRole('button', { name: /submit for approval/i });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/justification/i), {
      target: { value: 'Sponsor requested a 70 percent term loan; licence and PPA are in order' },
    });
    fireEvent.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent('Seti Catalog Hydro was proposed');
    expect(sent).toEqual({
      id: 'c-1',
      body: { justification: 'Sponsor requested a 70 percent term loan; licence and PPA are in order' },
    });
  });

  it('shows the catalog read-only to roles that cannot originate', async () => {
    signIn({ roles: ['auditor'] });
    renderRoute('/projects?view=catalog');
    expect(await screen.findByText('Seti Catalog Hydro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /propose/i })).not.toBeInTheDocument();
  });
});
