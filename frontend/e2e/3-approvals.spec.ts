import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { fetchProjects, loadedRows, tableByCaption } from './utils/helpers';

/**
 * Maker-checker, end to end with three real accounts: `maker` proposes, `approver` gives the first
 * check, `admin` the second. Needs backend/scripts/seed_test_workflows.py to have run (it makes the
 * demo maker the owner of some projects and seeds one request in each state).
 *
 * These tests write: each run adds change requests and audit entries, and the approved one moves a
 * project's forecast COD. Serial, because both flows change the same queue.
 */

const QUEUE = '/api/v1/mutations/approval-queue';
const JUSTIFICATION = 'E2E: revised schedule after the monsoon site inspection';

test.describe.configure({ mode: 'serial' });

interface QueueItem {
  id: string;
  entity_id: string;
  current_state: string;
  changes: Record<string, unknown> | null;
}

async function queue(api: APIRequestContext, params: Record<string, string> = {}): Promise<QueueItem[]> {
  const response = await api.get(QUEUE, { params: { limit: '200', ...params } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.approvals;
}

/** A date no earlier run has used, so each run's request is identifiable. */
function uniqueForecastDate(): string {
  const days = 400 + Math.floor(Math.random() * 3000);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** As the maker: open an owned project and propose a new forecast COD. Returns the project id. */
async function proposeForecast(page: Page, makerApi: APIRequestContext, date: string): Promise<string> {
  const { rows } = await fetchProjects(makerApi, { page_size: 1 });
  expect(rows.length, 'run seed_test_workflows so the demo maker owns a project').toBe(1);
  const project = rows[0];

  await page.goto(`/projects/${project.id}`);
  await page.getByRole('button', { name: 'Propose change' }).click();
  const dialog = page.getByRole('dialog');
  const submit = dialog.getByRole('button', { name: 'Submit for Approval' });
  await expect(submit).toBeDisabled();

  await dialog.getByLabel('New forecast COD').fill(date);
  await dialog.getByRole('textbox', { name: /Justification/ }).fill(JUSTIFICATION);
  await submit.click();

  await expect(page.getByRole('status')).toContainText('Change request submitted');
  await expect(dialog).toHaveCount(0);
  return project.id;
}

async function requestFor(api: APIRequestContext, date: string): Promise<QueueItem> {
  const match = (await queue(api)).find((item) => item.changes?.forecast_cod_ad === date);
  expect(match, `request proposing ${date}`).toBeTruthy();
  return match!;
}

/** The queue row for a request, found by the project name and narrowed by opening it. */
async function openRequest(page: Page, date: string, action: 'Review' | 'View') {
  await page.goto('/approvals');
  const rows = await loadedRows(tableByCaption(page, 'Change requests'));
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const button = rows.nth(i).getByRole('button', { name: action });
    if ((await button.count()) === 0) continue;
    await button.click();
    const dialog = page.getByRole('dialog');
    if ((await dialog.getByRole('cell', { name: date }).count()) > 0) return dialog;
    await dialog.getByRole('button', { name: 'Close modal' }).click();
  }
  throw new Error(`No "${action}" request proposing ${date} in the queue`);
}

test.describe('3. Approvals', () => {
  test('lists the seeded requests and filters them by state', async ({ authenticatedPage: page, api }) => {
    const all = await queue(api);
    const recommended = await queue(api, { status: 'recommended' });
    expect(all.length, 'run seed_test_workflows first').toBeGreaterThanOrEqual(4);
    expect(recommended.length).toBeGreaterThan(0);

    await page.goto('/');
    await page.getByRole('link', { name: 'Approvals' }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    await expect(page.getByRole('heading', { name: 'Approvals', level: 1 })).toBeVisible();
    await expect(await loadedRows(tableByCaption(page, 'Change requests'))).toHaveCount(all.length);

    await page.getByLabel('Status').selectOption('recommended');
    await expect(page).toHaveURL(/status=recommended/);
    const rows = tableByCaption(page, 'Change requests').locator('tbody tr');
    await expect(rows).toHaveCount(recommended.length);
    await expect(rows.first()).toContainText('Awaiting final approval');
  });

  test('a proposed change is applied only after two different checkers approve it', async ({ pageAs, apiAs }) => {
    const date = uniqueForecastDate();
    const makerApi = await apiAs('maker');
    const adminApi = await apiAs('admin');

    const makerPage = await pageAs('maker');
    const projectId = await proposeForecast(makerPage, makerApi, date);
    expect((await requestFor(adminApi, date)).current_state).toBe('submitted');

    // The maker can see their request but not decide it
    const own = await openRequest(makerPage, date, 'View');
    await expect(own.getByText(JUSTIFICATION)).toBeVisible();
    await expect(own.getByRole('button', { name: /Recommend|Approve|Reject/ })).toHaveCount(0);

    // First check
    const approverPage = await pageAs('approver');
    const first = await openRequest(approverPage, date, 'Review');
    await expect(first.getByText('Nothing changes yet')).toBeVisible();
    await first.getByRole('button', { name: 'Recommend' }).click();
    await expect(first).toHaveCount(0);
    expect((await requestFor(adminApi, date)).current_state).toBe('recommended');

    // The same checker is not offered the second check
    await approverPage.reload();
    await openRequest(approverPage, date, 'View');

    // Nothing has changed on the project yet
    const detailUrl = `/api/v1/projects/${projectId}`;
    const codDates = async () =>
      (await (await adminApi.get(detailUrl)).json()).data.cod_history.map((c: { date_ad: string }) => c.date_ad);
    expect(await codDates()).not.toContain(date);

    // Second check, by a different person, applies it
    const adminPage = await pageAs('admin');
    const second = await openRequest(adminPage, date, 'Review');
    await second.getByRole('button', { name: 'Approve and apply' }).click();
    await expect(second).toHaveCount(0);

    expect((await requestFor(adminApi, date)).current_state).toBe('approved');
    expect(await codDates()).toContain(date);
  });

  test('a rejection needs a reason and leaves the project unchanged', async ({ pageAs, apiAs }) => {
    const date = uniqueForecastDate();
    const makerApi = await apiAs('maker');
    const adminApi = await apiAs('admin');
    const projectId = await proposeForecast(await pageAs('maker'), makerApi, date);

    const approverPage = await pageAs('approver');
    const dialog = await openRequest(approverPage, date, 'Review');
    await dialog.getByRole('button', { name: 'Reject' }).click();
    const confirm = dialog.getByRole('button', { name: 'Confirm rejection' });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/Remarks/).fill('E2E: the supporting letter is missing');
    await confirm.click();
    await expect(dialog).toHaveCount(0);

    expect((await requestFor(adminApi, date)).current_state).toBe('rejected');
    const detail = (await (await adminApi.get(`/api/v1/projects/${projectId}`)).json()).data;
    expect(detail.cod_history.map((c: { date_ad: string }) => c.date_ad)).not.toContain(date);
  });

  test('a guest is not offered Approvals', async ({ pageAs }) => {
    const page = await pageAs('guest');
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approvals' })).toHaveCount(0);
  });
});
