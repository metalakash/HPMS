import { test, expect } from './fixtures/auth';
import { fetchProjects, loadedRows, tableByCaption } from './utils/helpers';

/**
 * Project detail tabs and the CBS comparison, against the real backend.
 * The seed gives operating projects generation, hydrology, land and ESG data; others have none.
 */

test.describe('2. Project tabs', () => {
  test('switches tabs, keeps the tab in the URL and shows what the API returns', async ({
    authenticatedPage: page,
    api,
  }) => {
    const { rows } = await fetchProjects(api, { stage: 'operation', page_size: 1 });
    const project = rows[0];
    const base = `/api/v1/projects/${project.id}`;
    const generation = (await (await api.get(`${base}/generation-ppa`)).json()).data;
    const land = (await (await api.get(`${base}/land-governance`)).json()).data;
    const esg = (await (await api.get(`${base}/esg`)).json()).data;
    expect(generation.monthly_data.length, 'seeded operating projects have generation data').toBeGreaterThan(0);

    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(tableByCaption(page, 'Loan accounts for this project')).toBeVisible();

    await page.getByRole('tab', { name: 'Generation & PPA' }).click();
    await expect(page).toHaveURL(/[?&]tab=generation/);
    await expect(page.getByText(generation.ppa.agreement_number)).toBeVisible();
    await expect(await loadedRows(tableByCaption(page, 'Monthly generation'))).toHaveCount(
      generation.monthly_data.length,
    );
    await expect(tableByCaption(page, 'Loan accounts for this project')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Hydrology' }).click();
    await expect(page).toHaveURL(/[?&]tab=hydrology/);
    await expect(page.getByText('Design discharge (Q90)')).toBeVisible();

    await page.getByRole('tab', { name: 'Land & governance' }).click();
    await expect(await loadedRows(tableByCaption(page, 'Board of directors'))).toHaveCount(
      land.board_of_directors.members.length,
    );
    await expect(await loadedRows(tableByCaption(page, 'Shareholding'))).toHaveCount(
      land.shareholding.shareholders.length,
    );

    await page.getByRole('tab', { name: 'ESG' }).click();
    await expect(await loadedRows(tableByCaption(page, 'EIA mitigation measures'))).toHaveCount(
      esg.eia_mitigation.measures.length,
    );

    // The tab survives a reload
    await page.reload();
    await expect(page.getByRole('tab', { name: 'ESG' })).toHaveAttribute('aria-selected', 'true');
    await expect(tableByCaption(page, 'EIA mitigation measures')).toBeVisible();

    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(tableByCaption(page, 'Loan accounts for this project')).toBeVisible();
  });

  test('shows empty states for a project with no operations data', async ({ authenticatedPage: page, api }) => {
    const { rows } = await fetchProjects(api, { stage: 'construction', page_size: 1 });
    const failed: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`/projects/${rows[0].id}?tab=generation`);
    await expect(page.getByText('No power purchase agreement recorded')).toBeVisible();
    await expect(page.getByText('No generation data recorded')).toBeVisible();

    await page.getByRole('tab', { name: 'Hydrology' }).click();
    await expect(page.getByText('No hydrology data recorded')).toBeVisible();
    await page.getByRole('tab', { name: 'Land & governance' }).click();
    await expect(page.getByText('No land acquisition data recorded')).toBeVisible();
    await page.getByRole('tab', { name: 'ESG' }).click();
    await expect(page.getByText('No ESG metrics recorded')).toBeVisible();

    expect(failed).toEqual([]);
  });

  test('compares a loan with CBS and, with no Finacle connection, changes nothing', async ({
    authenticatedPage: page,
    api,
  }) => {
    const { rows } = await fetchProjects(api, { stage: 'operation', page_size: 1 });
    const loansUrl = `/api/v1/projects/${rows[0].id}/loan-accounts`;
    const before = (await (await api.get(loansUrl)).json()).data;

    await page.goto(`/projects/${rows[0].id}`);
    await page.getByRole('button', { name: 'Sync with CBS' }).click();

    await expect(page.getByRole('button', { name: /differ.* from CBS|No differences from CBS/ })).toBeVisible();
    const comparison = tableByCaption(page, 'CBS comparison');
    await expect(comparison.getByRole('row', { name: /Outstanding principal/ })).toBeVisible();
    await expect(page.getByText(/Simulated: no Finacle connection is configured/)).toBeVisible();

    const after = (await (await api.get(loansUrl)).json()).data;
    expect(after).toEqual(before);
  });
});
