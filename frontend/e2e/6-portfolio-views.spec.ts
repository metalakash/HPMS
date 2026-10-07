import { test, expect } from './fixtures/auth';
import { loadedRows, tableByCaption } from './utils/helpers';

/**
 * Analytics, Maintenance and Admin against the real backend: every figure on these pages
 * comes from the API, none is built into the page.
 */

test.describe('6. Portfolio views', () => {
  test('analytics lists every generating plant from the API', async ({ authenticatedPage: page, api }) => {
    const rows = (await (await api.get('/api/v1/analytics/performance')).json()).data;
    expect(rows.length, 'seeded operating projects report generation').toBeGreaterThan(0);

    await page.goto('/analytics');
    const table = tableByCaption(page, 'Plant performance by project');
    await expect(await loadedRows(table)).toHaveCount(rows.length);
    await expect((await loadedRows(table)).first()).toContainText(rows[0].project_name);

    await page.getByRole('link', { name: new RegExp(rows[0].project_code) }).click();
    await expect(page).toHaveURL(`/projects/${rows[0].project_id}?tab=generation`);
    await expect(tableByCaption(page, 'Monthly generation')).toBeVisible();
  });

  test('maintenance lists scheduled and completed work from the API', async ({ authenticatedPage: page, api }) => {
    const data = (await (await api.get('/api/v1/maintenance')).json()).data;

    await page.goto('/maintenance');
    await expect(await loadedRows(tableByCaption(page, 'Upcoming maintenance'))).toHaveCount(data.upcoming.length);
    await expect(await loadedRows(tableByCaption(page, 'Completed maintenance'))).toHaveCount(
      data.completed.length,
    );
  });

  test('admin shows the accounts and what the system is connected to', async ({ authenticatedPage: page, api }) => {
    const users = (await (await api.get('/api/v1/admin/users')).json()).data;
    const chain = await (await api.get('/api/v1/admin/audit/verify')).json();

    await page.goto('/admin');
    await expect(await loadedRows(tableByCaption(page, 'User accounts'))).toHaveCount(users.length);
    await expect(page.getByRole('heading', { name: 'Core banking connection' })).toBeVisible();
    await expect(page.getByText(chain.ok ? 'Chain intact' : 'Chain broken')).toBeVisible();
  });
});
