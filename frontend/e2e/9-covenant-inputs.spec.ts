import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures/auth';

/**
 * Entering covenant inputs through the app, against the real backend. Figures and sanction terms
 * never change directly: the screen raises a change request, two different checkers decide it,
 * and only then are the project's covenants re-tested.
 *
 * Serial: both flows use the approval queue, and the second changes a project's thresholds.
 */

const QUEUE = '/api/v1/mutations/approval-queue';
const stamp = Date.now().toString(36);
/** A DSCR floor no earlier run used, and far above any seeded result, so the re-test must breach. */
const DSCR_FLOOR = (5 + (Date.now() % 4000) / 1000).toFixed(3);

interface QueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  current_state: string;
  justification: string;
}

async function requestWith(api: APIRequestContext, justification: string): Promise<QueueItem> {
  const body = await (await api.get(QUEUE)).json();
  const match = (body.data.approvals as QueueItem[]).find((item) => item.justification === justification);
  if (!match) throw new Error(`No change request with justification "${justification}"`);
  return match;
}

async function decide(api: APIRequestContext, id: string) {
  const response = await api.post('/api/v1/mutations/approve', { data: { approval_request_id: id } });
  expect(response.status(), await response.text()).toBe(200);
}

const calculation = async (api: APIRequestContext, projectId: string) =>
  (await (await api.get(`/api/v1/compliance/covenants/${projectId}/calculation`)).json()).data;

test.describe.configure({ mode: 'serial' });

test.describe('9. Covenant inputs', () => {
  test('a maker records a quarter and the covenants are re-tested only after two checkers approve', async ({
    pageAs,
    apiAs,
  }) => {
    const reason = `E2E ${stamp}: corrected operating costs from the audited accounts`;
    const makerApi = await apiAs('maker');
    const adminApi = await apiAs('admin');
    // An operating project the maker owns: it already has a tested quarter to correct
    const mine = (await (await makerApi.get('/api/v1/compliance/covenants')).json()).data;
    const target = mine.find((row: { dscr: { value: string | null } }) => row.dscr.value !== null);
    expect(target, 'the demo maker owns a project with a tested DSCR').toBeTruthy();
    const before = await calculation(adminApi, target.project_id);

    const page = await pageAs('maker');
    await page.goto('/compliance');
    await page.getByRole('button', { name: new RegExp(target.project_code) }).click();
    await page.getByRole('button', { name: 'Record quarterly figures' }).click();

    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Submit for Approval' });
    // The latest quarter is on file, so the form starts from its figures
    await expect(dialog.getByLabel('Fiscal quarter')).toContainText('correct the figures on file');
    await expect(dialog.getByLabel('Revenue (NPR)')).not.toHaveValue('');
    const revenue = Number(await dialog.getByLabel('Revenue (NPR)').inputValue());

    // A value that differs from what is on file, whatever an earlier run left there
    const onFile = Number(await dialog.getByLabel('Operating expenses (NPR)').inputValue());
    await dialog.getByLabel('Operating expenses (NPR)').fill('-5');
    await expect(dialog.getByText('Enter an amount, with at most two decimals')).toBeVisible();
    const share = Math.abs(onFile - revenue * 0.9) < 1 ? 0.8 : 0.9;
    await dialog.getByLabel('Operating expenses (NPR)').fill((revenue * share).toFixed(2));
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await expect(submit).toBeDisabled(); // no source given yet
    await dialog.getByLabel('Source of the figures').fill('Audited accounts (E2E)');
    await submit.click();
    await expect(page.getByRole('status')).toContainText('sent for approval');

    const request = await requestWith(adminApi, reason);
    expect([request.entity_type, request.current_state]).toEqual(['FINANCIAL_PERIOD', 'submitted']);
    expect((await calculation(adminApi, target.project_id)).dscr.value).toBe(before.dscr.value);

    await decide(await apiAs('approver'), request.id);
    expect((await calculation(adminApi, target.project_id)).dscr.value).toBe(before.dscr.value);
    await decide(adminApi, request.id);

    const after = await calculation(adminApi, target.project_id);
    expect(after.dscr.value).not.toBe(before.dscr.value);

    // The screen shows the re-tested result
    await page.reload();
    await page.getByRole('button', { name: new RegExp(target.project_code) }).click();
    await expect(page.getByRole('dialog').getByText(`${Number(after.dscr.value).toFixed(2)}x`).first()).toBeVisible();
  });

  test('sanction terms are proposed by an admin and need a different admin for the final approval', async ({
    pageAs,
    apiAs,
  }) => {
    const reason = `E2E ${stamp}: thresholds per the revised sanction letter`;
    const adminApi = await apiAs('admin');
    const results = (await (await adminApi.get('/api/v1/compliance/covenants')).json()).data;
    const target = results.findLast((row: { dscr: { value: string | null } }) => row.dscr.value !== null);

    const page = await pageAs('admin');
    await page.goto('/compliance');
    await page.getByRole('button', { name: new RegExp(target.project_code) }).click();
    await page.getByRole('button', { name: 'Change sanction terms' }).click();

    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Submit for Approval' });
    await dialog.getByLabel('Maximum LTV (%)').fill('140');
    await expect(dialog.getByText('A percentage cannot exceed 100')).toBeVisible();
    await dialog.getByLabel('Maximum LTV (%)').fill('65');
    await dialog.getByLabel('Minimum DSCR (x)').fill(DSCR_FLOOR);
    await dialog.getByLabel('Sanction letter or agreement reference').fill(`SL/E2E/${stamp}`);
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await submit.click();
    await expect(page.getByRole('status')).toContainText('Sanction terms sent for approval');

    const request = await requestWith(adminApi, reason);
    expect(request.entity_type).toBe('COVENANT_TERMS');
    await decide(await apiAs('approver'), request.id);

    // The admin who proposed it cannot also give the final approval
    const own = await adminApi.post('/api/v1/mutations/approve', { data: { approval_request_id: request.id } });
    expect(own.status()).not.toBe(200);
    expect(Number((await calculation(adminApi, target.project_id)).dscr.threshold)).not.toBe(Number(DSCR_FLOOR));

    await decide(await apiAs('admin2'), request.id);
    const after = await calculation(adminApi, target.project_id);
    expect(Number(after.dscr.threshold)).toBe(Number(DSCR_FLOOR));
    expect(after.dscr.status).toBe('breached');
    expect(after.terms_source).toBe('sanction terms');
  });

  test('an auditor can read covenant results but is not offered either form', async ({ pageAs, apiAs }) => {
    const results = (await (await (await apiAs('admin')).get('/api/v1/compliance/covenants')).json()).data;
    const page = await pageAs('auditor');
    await page.goto('/compliance');
    await page.getByRole('button', { name: new RegExp(results[0].project_code) }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { name: `Covenants: ${results[0].project_name}` })).toBeVisible();
    await expect(drawer.getByRole('button', { name: /Record quarterly figures|Change sanction terms/ })).toHaveCount(0);
  });
});
