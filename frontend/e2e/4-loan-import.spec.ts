import { test, expect } from './fixtures/auth';
import { fetchProjects } from './utils/helpers';

/**
 * Loan exposure import. The file is validated in the browser, so these tests stop at the preview
 * and never send an import: importing would overwrite the seeded loans.
 */

const HEADER =
  'project_id,facility_type,sanctioned_amount,outstanding_principal,interest_rate_pct,tenor_years,grace_years,sanction_date,disbursement_date,maturity_date';

const csvFile = (name: string, ...lines: string[]) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from([HEADER, ...lines].join('\n')),
});

test.describe('4. Loan exposure import', () => {
  test('previews which rows of a CSV can be imported', async ({ authenticatedPage: page, api }) => {
    const { rows } = await fetchProjects(api, { page_size: 1 });
    const good = `${rows[0].id},Working Capital,1000000,500000,11.5,10,1,2024-01-15,2024-02-01,2034-02-01`;
    const bad = `not-an-id,Working Capital,1000000,2000000,eleven,10,1,2024-01-15,2024-02-01,2034-02-01`;

    let importRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/exposure-sync')) importRequests += 1;
    });

    await page.goto('/loans');
    await page.getByRole('button', { name: 'Import exposures' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import loan exposures' });
    await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();

    await dialog.locator('input[type="file"]').setInputFiles(csvFile('exposures.csv', good, bad));
    await expect(dialog.getByText('1 of 2 rows are ready to import; 1 will be left out')).toBeVisible();
    await expect(
      dialog.getByText('Line 3: project_id is not a valid id; interest_rate_pct must be a number'),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import 1 row' })).toBeEnabled();

    // A file with a missing column cannot be imported at all
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'wrong.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('project_id,facility_type\nx,y'),
    });
    await expect(dialog.getByText(/Missing columns: sanctioned_amount/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(importRequests).toBe(0);
  });

  test('is not offered to a maker', async ({ pageAs }) => {
    const page = await pageAs('maker');
    await page.goto('/loans');
    await expect(page.getByRole('heading', { name: 'Loan accounts', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import exposures' })).toHaveCount(0);
  });
});
