import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures/auth';

/**
 * Sprint D2 screens against the real backend: budget and cost, the loan projection plan, application
 * settings and approval rules. Every change is a change request; these specs raise it on screen, decide it
 * through the API, then reload to check what was kept.
 *
 * Serial, and run once (not on every browser): settings and approval rules are shared by the whole app, so
 * each test that changes one puts it back.
 */

const stamp = Date.now().toString(36);
const QUEUE = '/api/v1/mutations/approval-queue';

interface QueueItem { id: string; justification: string; current_state: string }

async function requestWith(api: APIRequestContext, justification: string): Promise<QueueItem> {
  const items = (await (await api.get(QUEUE)).json()).data.approvals as QueueItem[];
  const match = items.find((item) => item.justification === justification);
  if (!match) throw new Error(`No change request with justification "${justification}"`);
  return match;
}

async function decide(api: APIRequestContext, id: string) {
  const response = await api.post('/api/v1/mutations/approve', { data: { approval_request_id: id } });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).data;
}

async function propose(api: APIRequestContext, entity_type: string, entity_id: string, changes: object, justification: string) {
  const response = await api.post('/api/v1/mutations/submit-with-justification', {
    data: { entity_type, entity_id, action: 'UPDATE', changes, justification },
  });
  expect(response.status(), await response.text()).toBeLessThan(300);
  return (await response.json()).data.approval_request_id as string;
}

test.describe.configure({ mode: 'serial' });

test.describe('13. Plans and settings', () => {
  test('a maker changes a budget line and uploads a sheet; both apply only after two checks', async ({ pageAs, apiAs }) => {
    const makerApi = await apiAs('maker');
    const owned = (await (await makerApi.get('/api/v1/compliance/covenants')).json()).data;
    const projectId = owned[0].project_id;
    const before = (await (await makerApi.get(`/api/v1/projects/${projectId}/budget`)).json()).data;
    expect(before.lines.length, 'the demo seed gives the project a budget').toBeGreaterThan(0);
    const line = before.lines[0];
    const newActual = String(Number(line.actual_amount) + 1000 + (Date.now() % 1000));

    const page = await pageAs('maker');
    await page.goto(`/projects/${projectId}?tab=budget`);
    await expect(page.getByRole('table', { name: 'Budget and cost' })).toContainText(line.category);
    await page.getByRole('button', { name: 'Change budget' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Actual (NPR)').first().fill(newActual);
    await dialog.getByLabel('Source of the figures').fill('Contractor bills to date (E2E)');
    const reason = `E2E ${stamp}: actual cost updated from the contractor's latest bill`;
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await dialog.getByRole('button', { name: 'Submit for Approval' }).click();
    await expect(page.getByRole('status')).toContainText('Budget change sent for approval');

    const adminApi = await apiAs('admin');
    const request = await requestWith(adminApi, reason);
    await decide(await apiAs('approver'), request.id);
    await decide(adminApi, request.id);
    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(line.category) })).toContainText(Number(newActual).toLocaleString('en-IN'));

    // Upload: one usable new line, one row that cannot be used
    const category = `Spares E2E ${stamp}`;
    await page.getByRole('button', { name: 'Upload budget' }).click();
    const upload = page.getByRole('dialog');
    await upload.getByLabel('Budget sheet (Excel or CSV)').setInputFiles({
      name: 'budget.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`Category,Budgeted amount,Actual amount\n${category},25000,1000\nBad row,abc,1\n`),
    });
    await expect(upload).toContainText('1 new, 0 updated, 1 rows cannot be used');
    await expect(upload.getByRole('list', { name: 'Rows that cannot be used' })).toContainText('Row 3');
    await upload.getByLabel('Source of the figures').fill('Spares budget sheet (E2E)');
    const uploadReason = `E2E ${stamp}: spares budget loaded from the sheet`;
    await upload.getByRole('textbox', { name: /Justification/ }).fill(uploadReason);
    await upload.getByRole('button', { name: 'Submit for Approval' }).click();
    await expect(page.getByRole('status')).toContainText('1 budget lines from budget.csv sent for approval');

    const uploaded = await requestWith(adminApi, uploadReason);
    await decide(await apiAs('approver'), uploaded.id);
    await decide(adminApi, uploaded.id);
    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(category) })).toContainText('25,000');
  });

  test('a maker changes a quarter of the loan projection and the balance carries down', async ({ pageAs, apiAs }) => {
    const makerApi = await apiAs('maker');
    const owned = (await (await makerApi.get('/api/v1/compliance/covenants')).json()).data;
    const project = owned[0];
    const rows = (await (await makerApi.get(`/api/v1/projects/${project.project_id}/projection`)).json()).data;
    const target = rows.find((r: { is_opening: boolean }) => !r.is_opening);
    const added = 1000 + (Date.now() % 1000);
    const disbursement = String(Number(target.projected_disbursement) + added);

    const page = await pageAs('maker');
    await page.goto('/projection');
    await page.getByRole('row', { name: new RegExp(project.project_code) }).getByRole('button', { name: 'Change plan' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(`Disbursement FY ${target.fiscal_year} Q${target.quarter}`).fill(disbursement);
    await dialog.getByLabel('Source of the figures').fill('Revised drawdown plan (E2E)');
    const reason = `E2E ${stamp}: drawdown brought forward per the developer's plan`;
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await dialog.getByRole('button', { name: 'Submit for Approval' }).click();
    await expect(page.getByRole('status')).toContainText('sent for approval');

    const adminApi = await apiAs('admin');
    const request = await requestWith(adminApi, reason);
    await decide(await apiAs('approver'), request.id);
    await decide(adminApi, request.id);
    const after = (await (await makerApi.get(`/api/v1/projects/${project.project_id}/projection`)).json()).data;
    const last = after.length - 1;
    expect(Number(after[last].projected_outstanding)).toBeCloseTo(Number(rows[last].projected_outstanding) + added, 2);
  });

  test('an admin changes a setting; another admin gives the final approval', async ({ pageAs, apiAs }) => {
    const page = await pageAs('admin');
    await page.goto('/settings');
    const row = page.getByRole('row', { name: /Expiry warning lead time/ });
    await row.getByRole('button', { name: 'Change' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Expiry warning lead time (days)').fill('400');
    await expect(dialog.getByText('Between 7 and 365 days')).toBeVisible();
    await dialog.getByLabel('Expiry warning lead time (days)').fill('75');
    const reason = `E2E ${stamp}: insurers now ask for seventy-five days of notice`;
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await dialog.getByRole('button', { name: 'Submit for Approval' }).click();
    await expect(page.getByRole('status')).toContainText('sent for approval');

    const adminApi = await apiAs('admin');
    const request = await requestWith(adminApi, reason);
    await decide(await apiAs('approver'), request.id);
    const own = await adminApi.post('/api/v1/mutations/approve', { data: { approval_request_id: request.id } });
    expect(own.status()).toBe(403); // the proposer cannot give the final approval
    await decide(await apiAs('admin2'), request.id);
    await page.reload();
    await expect(page.getByRole('row', { name: /Expiry warning lead time/ })).toContainText('75 days');

    // Put it back for everything else
    const back = await propose(adminApi, 'SETTING', 'alert_warning_days', { value: '90' }, `E2E ${stamp}: restore the default lead time`);
    await decide(await apiAs('approver'), back);
    await decide(await apiAs('admin2'), back);
  });

  test('a one-check approval rule applies to requests raised after it', async ({ pageAs, apiAs }) => {
    const adminApi = await apiAs('admin');
    const page = await pageAs('admin');
    await page.goto('/settings');
    await page.getByRole('row', { name: /Budget and cost lines/ }).getByRole('button', { name: 'Change' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Checks').selectOption('one');
    await dialog.getByRole('checkbox', { name: 'Admin' }).uncheck();
    const reason = `E2E ${stamp}: budget lines need a single approver's check`;
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await dialog.getByRole('button', { name: 'Submit for Approval' }).click();
    await expect(page.getByRole('status')).toContainText('Requests already raised keep the current rule');
    const request = await requestWith(adminApi, reason);
    await decide(await apiAs('approver'), request.id);
    await decide(await apiAs('admin2'), request.id);
    await page.reload();
    await expect(page.getByRole('row', { name: /Budget and cost lines/ })).toContainText('One');

    // A budget change raised now needs only the approver
    const makerApi = await apiAs('maker');
    const projectId = (await (await makerApi.get('/api/v1/compliance/covenants')).json()).data[0].project_id;
    const budgetReason = `E2E ${stamp}: contingency line added under the one-check rule`;
    await propose(makerApi, 'BUDGET_LINE', projectId,
      { source_reference: 'E2E', lines: [{ category: `Contingency E2E ${stamp}`, budgeted_amount: '5000' }] }, budgetReason);
    const item = await requestWith(adminApi, budgetReason);
    const result = await decide(await apiAs('approver'), item.id);
    expect(result.new_state).toBe('approved');

    // Put the standard two-check rule back
    const back = await propose(adminApi, 'APPROVAL_RULE', 'BUDGET_LINE',
      { steps: ['submitted', 'recommended', 'approved'], recommend_roles: ['admin', 'approver'], approve_roles: ['admin', 'approver'] },
      `E2E ${stamp}: restore two checks for budget lines`);
    await decide(await apiAs('approver'), back);
    await decide(await apiAs('admin2'), back);
  });

  test('settings are offered to admins only', async ({ pageAs, apiAs }) => {
    const page = await pageAs('maker');
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    const refused = await (await apiAs('maker')).get('/api/v1/admin/settings');
    expect(refused.status()).toBe(403);
  });
});
