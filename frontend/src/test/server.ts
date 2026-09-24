import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { envelope, makeLoan, makeProject, projectDetail, tokenResponse } from './fixtures';

const STAGE_TOTALS: Record<string, number> = { feasibility: 4, construction: 7, operation: 12 };

/** Default happy-path handlers; override per test with server.use(...). */
export const handlers = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string };
    if (body.password !== 'correct') {
      return HttpResponse.json({ detail: 'Invalid username or password' }, { status: 401 });
    }
    return HttpResponse.json(tokenResponse);
  }),
  http.post('*/api/v1/auth/logout', () => HttpResponse.json({ message: 'ok' })),

  http.get('*/api/v1/projects', ({ request }) => {
    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');
    const pageSize = Number(url.searchParams.get('page_size') ?? 20);
    const total = stage ? (STAGE_TOTALS[stage] ?? 0) : 23;
    const rows = [
      makeProject(),
      makeProject({
        id: 'p-2',
        project_code: 'SBL-HPP-0002',
        name_en: 'Kali Gandaki B',
        name_np: 'कालीगण्डकी बी',
        installed_capacity_mw: '144.0000',
      }),
    ];
    return HttpResponse.json(
      envelope(rows.slice(0, pageSize), { page: 1, page_size: pageSize, total_count: total }),
    );
  }),
  http.get('*/api/v1/projects/:id', ({ params }) =>
    params.id === 'p-1'
      ? HttpResponse.json(envelope(projectDetail))
      : HttpResponse.json({ detail: 'Project not found' }, { status: 404 }),
  ),
  http.get('*/api/v1/projects/:id/loan-accounts', () => HttpResponse.json(envelope([makeLoan()]))),

  http.get('*/api/v1/loan-accounts', ({ request }) => {
    const pageSize = Number(new URL(request.url).searchParams.get('page_size') ?? 20);
    return HttpResponse.json(
      envelope([makeLoan()], { page: 1, page_size: pageSize, total_count: 31 }),
    );
  }),
];

export const server = setupServer(...handlers);
