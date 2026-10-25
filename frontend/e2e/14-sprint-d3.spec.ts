import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures/auth';

/**
 * Sprint D3 against the real backend: stakeholder history, confidential figures withheld from a guest,
 * exchange rates, and the consolidated report.
 *
 * Serial and run once: an exchange rate is bank-wide data, and each run adds its own (dated uniquely).
 */

const stamp = Date.now().toString(36);
const QUEUE = '/api/v1/mutations/approval-queue';

async function decideAll(apis: APIRequestContext[], justification: string, adminApi: APIRequestContext) {
  const items = (await (await adminApi.get(QUEUE)).json()).data.approvals as { id: string; justification: string }[];
  const item = items.find((i) => i.justification === justification);
  if (!item) throw new Error(`No change request with justification "${justification}"`);
  for (const api of apis) {
    const r = await api.post('/api/v1/mutations/approve', { data: { approval_request_id: item.id } });
    expect(r.status(), await r.text()).toBe(200);
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('14. Sprint D3', () => {
  test('an interaction is recorded and the contact shows its history and rating', async ({ pageAs, apiAs }) => {
    const adminApi = await apiAs('admin');
    const name = `Contact E2E ${stamp}`;
    const created = await adminApi.post('/api/v1/stakeholders', {
      data: { name, organization: 'Department of Electricity Development', email: `${stamp}@example.org`, category: 'external' },
    });
    expect(created.status(), await created.text()).toBe(201);

    const page = await pageAs('admin');
    await page.goto('/regulatory');
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('None yet');
    await row.getByRole('button', { name: `History of ${name}` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('How it went').selectOption('4');
    await dialog.getByLabel('What happened').fill('Licence renewal agreed at the meeting (E2E)');
    await dialog.getByRole('button', { name: 'Record interaction' }).click();
    await expect(dialog.getByRole('list', { name: 'Interactions' })).toContainText('Licence renewal agreed');
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('1 · 4 of 5');
  });

  test('a guest sees the portfolio dashboard with confidential totals withheld', async ({ pageAs, apiAs }) => {
    const guestApi = await apiAs('guest');
    const response = await guestApi.get('/api/v1/analytics/portfolio');
    expect(response.status()).toBe(200);
    expect(response.headers()['x-fields-withheld']).toContain('total_sanctioned_amount');
    const adminTotals = await (await apiAs('admin')).get('/api/v1/analytics/portfolio');
    expect(adminTotals.headers()['x-fields-withheld']).toBeUndefined();

    // Labels are not figures: the guest's screens keep their wording
    const labels = await guestApi.get('/api/v1/i18n/translations');
    expect(labels.headers()['x-fields-withheld']).toBeUndefined();
    const page = await pageAs('guest');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('an exchange rate is added through maker-checker and shown on the Settings page', async ({ pageAs, apiAs }) => {
    const adminApi = await apiAs('admin');
    // A date no earlier run used, in the past so it is in force
    const day = new Date(Date.now() - (1 + (Date.now() % 900)) * 86_400_000).toISOString().slice(0, 10);
    const rate = (130 + (Date.now() % 1000) / 100).toFixed(2);

    const page = await pageAs('admin');
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Add a currency' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Currency').fill('NPR');
    await expect(dialog.getByText('A three-letter code other than NPR')).toBeVisible();
    await dialog.getByLabel('Currency').fill('JPY');
    await dialog.getByLabel('NPR per unit').fill(rate);
    await dialog.getByLabel('In force from').fill(day);
    await dialog.getByLabel('Source').fill('NRB reference rate (E2E)');
    const reason = `E2E ${stamp}: yen reference rate for a trade-finance facility`;
    await dialog.getByRole('textbox', { name: /Justification/ }).fill(reason);
    await dialog.getByRole('button', { name: 'Submit for Approval' }).click();
    await expect(page.getByRole('status')).toContainText('JPY rate');

    await decideAll([await apiAs('approver'), await apiAs('admin2')], reason, adminApi);
    await page.reload();
    await expect(page.getByRole('row', { name: /JPY/ })).toBeVisible();
    const listed = (await (await adminApi.get('/api/v1/admin/exchange-rates')).json()).data;
    const jpy = listed.find((c: { currency_code: string }) => c.currency_code === 'JPY');
    expect(jpy.history.some((h: { effective_from_ad: string }) => h.effective_from_ad === day)).toBe(true);
  });

  test('the consolidated report combines lending, covenants and budget per project', async ({ pageAs, apiAs }) => {
    const adminApi = await apiAs('admin');
    const run = await adminApi.post('/api/v1/reports/builder/run', { data: { source: 'consolidated', format: 'json' } });
    expect(run.status(), await run.text()).toBe(200);
    const rows = (await run.json()).data;
    expect(rows.length).toBeGreaterThanOrEqual(50);
    expect(rows.some((r: { dscr: number | null; budgeted_amount: number | null }) => r.dscr !== null && r.budgeted_amount !== null)).toBe(true);

    const page = await pageAs('admin');
    await page.goto('/reports');
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.locator('option', { hasText: 'Consolidated' })).toHaveCount(1);
  });
});
