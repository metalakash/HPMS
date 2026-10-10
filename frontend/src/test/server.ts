import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useAuthStore } from '@/store/useAuthStore';
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
  // Like the real endpoint, answers for whoever the bearer token belongs to.
  http.get('*/api/v1/auth/me', () => {
    const user = useAuthStore.getState().user;
    return user
      ? HttpResponse.json(user)
      : HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }),

  http.get('*/api/v1/projects', ({ request }) => {
    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');
    const pageSize = Number(url.searchParams.get('page_size') ?? 20);
    // Two of the operating projects are settled facilities
    const total = url.searchParams.get('status') === 'settled' ? 2 : stage ? (STAGE_TOTALS[stage] ?? 0) : 23;
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

  http.get('*/api/v1/projects/:id/milestones', () =>
    HttpResponse.json(
      envelope([
        {
          id: 'm-1',
          project_id: 'p-1',
          name: 'Headworks complete',
          category: 'CIVIL',
          sequence: 1,
          planned_date_ad: '2026-01-01',
          planned_date_bs: '2082-09-17',
          forecast_date_ad: '2026-03-15',
          actual_date_ad: null,
          status: 'delayed',
          percent_complete: '60.00',
        },
      ]),
    ),
  ),
  http.get('*/api/v1/projects/:id/risks', () =>
    HttpResponse.json(
      envelope([
        {
          id: 'r-1',
          project_id: 'p-1',
          title: 'Milestone delay: Headworks complete',
          risk_type: 'technical',
          likelihood: 3,
          impact: 3,
          severity: 'medium',
          mitigation_status: 'open',
          mitigation_owner: null,
          trigger_source: 'milestone_delay',
        },
      ]),
    ),
  ),

  http.get('*/api/v1/loan-accounts', ({ request }) => {
    const pageSize = Number(new URL(request.url).searchParams.get('page_size') ?? 20);
    return HttpResponse.json(
      envelope([makeLoan()], { page: 1, page_size: pageSize, total_count: 31 }),
    );
  }),
];

export const server = setupServer(...handlers);
