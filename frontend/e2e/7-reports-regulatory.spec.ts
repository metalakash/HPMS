import { test, expect } from './fixtures/auth';
import { loadedRows, tableByCaption } from './utils/helpers';

/**
 * Report builder, regulatory calendar and reminders against the real backend.
 * Each test reloads the page before checking what it saved: a save that only looked
 * successful (answered, then discarded) fails here.
 */

const stamp = Date.now().toString(36);

test.describe('7. Reports and regulatory', () => {
  test('builds, previews, saves and deletes a report', async ({ authenticatedPage: page, api }) => {
    const name = `E2E covenant shortfall ${stamp}`;
    await page.goto('/reports');

    await page.getByLabel('Report on').selectOption({ label: 'Portfolio overview' });
    await page.getByLabel('Project code').check();
    await page.getByLabel('Capacity mw').check();
    await page.getByLabel('Filter by province').selectOption('Gandaki');
    await page.getByRole('button', { name: 'Preview' }).click();

    const preview = page.getByRole('table', { name: 'Report preview' });
    await expect(preview.getByRole('columnheader')).toHaveText(['Project code', 'Capacity mw']);
    await expect(preview.getByRole('row').nth(1)).toContainText('HPM-GA-');

    await page.getByLabel('Save as').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(`Saved "${name}"`);

    await page.reload();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByLabel('Filter by province')).toHaveValue('Gandaki');
    await expect(page.getByLabel('Capacity mw')).toBeChecked();
    await expect(page.getByRole('table', { name: 'Report preview' })).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    const left = (await (await api.get('/api/v1/reports/definitions')).json()).definitions;
    expect(left.map((d: { name: string }) => d.name)).not.toContain(name);
  });

  test('a requirement produces a calendar and a filing can be recorded', async ({ authenticatedPage: page, api }) => {
    const code = `E2E-${stamp}`.toUpperCase();
    const title = `E2E sample return ${stamp}`;
    try {
      await page.goto('/regulatory');
      await page.getByRole('button', { name: 'Add requirement' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Code').fill(code);
      await dialog.getByLabel('Title').fill(title);
      await dialog.getByLabel('Authority').selectOption('OTHER');
      await dialog.getByRole('button', { name: 'Add requirement' }).click();
      await expect(dialog).toHaveCount(0);

      const requirement = page.getByRole('list', { name: 'Filing requirements' }).getByRole('listitem').filter({ hasText: title });
      await requirement.getByRole('button', { name: 'Generate calendar' }).click();
      await expect(page.getByRole('status')).toContainText(`added for ${code}`);

      await page.reload();
      const calendar = tableByCaption(page, 'Filing calendar');
      const row = (await loadedRows(calendar)).filter({ hasText: title }).first();
      await expect(row).toContainText('Pending');
      await row.getByRole('button', { name: 'Record filing' }).click();
      const filing = page.getByRole('dialog');
      await expect(filing.getByRole('button', { name: 'Mark as filed' })).toBeDisabled();
      await filing.getByLabel("Regulator's reference number").fill(`REF-${stamp}`);
      await filing.getByRole('button', { name: 'Mark as filed' }).click();
      await expect(filing).toHaveCount(0);

      await page.reload();
      await page.getByLabel('Status').selectOption('filed');
      const filed = (await loadedRows(tableByCaption(page, 'Filing calendar'))).filter({ hasText: title });
      await expect(filed).toHaveCount(1);
      await expect(filed).toContainText(`REF-${stamp}`);
    } finally {
      // Deleting the requirement removes its calendar rows too
      const all = (await (await api.get('/api/v1/regulatory/requirements')).json()).requirements;
      for (const r of all.filter((x: { code: string }) => x.code === code)) {
        await api.delete(`/api/v1/regulatory/requirements/${r.id}`);
      }
    }
  });

  test('a reminder is kept until it is dismissed, and the calendar is hidden from a maker', async ({ pageAs }) => {
    const page = await pageAs('maker');
    const title = `E2E call the valuer ${stamp}`;
    await page.goto('/regulatory');
    await expect(page.getByText('Filing calendar')).toHaveCount(0);

    await page.getByLabel('Remind me to').fill(title);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const reminders = page.getByRole('list', { name: 'Reminders' });
    await expect(reminders.getByText(title)).toBeVisible();

    await page.reload();
    const item = page.getByRole('list', { name: 'Reminders' }).getByRole('listitem').filter({ hasText: title });
    await expect(item).toHaveCount(1);
    await item.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
