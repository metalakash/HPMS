import { test, expect } from './fixtures/auth';
import { loadedRows, tableByCaption } from './utils/helpers';

/**
 * Covenant results on the Compliance page, against the real backend.
 * The seed reports quarterly financials; the covenant engine works the results out from them.
 */

test.describe('5. Compliance', () => {
  test('lists the latest covenant test per project and shows the working', async ({
    authenticatedPage: page,
    api,
  }) => {
    const results = (await (await api.get('/api/v1/compliance/covenants')).json()).data;
    expect(results.length, 'seeded financed projects have covenant results').toBeGreaterThan(0);
    const worst = results[0];
    const working = (
      await (await api.get(`/api/v1/compliance/covenants/${worst.project_id}/calculation`)).json()
    ).data;

    await page.goto('/compliance');
    const table = tableByCaption(page, 'Latest covenant test per project');
    await expect(await loadedRows(table)).toHaveCount(results.length);
    await expect((await loadedRows(table)).first()).toContainText(worst.project_name);

    await page.getByRole('button', { name: new RegExp(worst.project_code) }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { name: `Covenants: ${worst.project_name}` })).toBeVisible();
    // The API labels a fiscal quarter "2082-83-Q4"; the screen shows it as "FY 2082/83 Q4"
    const [, from, to, quarter] = working.quarter.match(/^(\d{4})-(\d{2})-Q(\d)$/);
    await expect(drawer.getByText(`How FY ${from}/${to} Q${quarter} was calculated`)).toBeVisible();
    await expect(drawer.getByText(`${Number(working.ltv.value).toFixed(2)}%`).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });

  test('a guest sees no covenant results', async ({ pageAs }) => {
    const page = await pageAs('guest');
    await page.goto('/compliance');
    await expect(page.getByText('No covenant tests yet')).toBeVisible();
  });
});
