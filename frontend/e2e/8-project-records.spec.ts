import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { fetchProjects, loadedRows, tableByCaption } from './utils/helpers';

/**
 * The record screens added in Phase 14 (insurance, ESIA, community, milestones, risk register,
 * stakeholder contacts, scheduled delivery) against the real backend. Their unit tests mock
 * the API; these save a record through each screen and reload before checking it was kept.
 */

const stamp = Date.now().toString(36);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** The last operating project, so these writes stay clear of the projects other specs read. */
async function openTab(page: Page, projectId: string, tab: string) {
  await page.goto(`/projects/${projectId}`);
  // The tab row reflows as the header loads, so a click can land on a neighbour; retry until this tab is selected
  const button = page.getByRole('tab', { name: tab, exact: true });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
  }).toPass();
}

test.describe('8. Project records', () => {
  let projectId: string;

  test.beforeEach(async ({ api }) => {
    const { rows } = await fetchProjects(api, { stage: 'operation', page_size: 100 });
    projectId = rows[rows.length - 1].id;
  });

  test('an insurance policy is saved and its status can be changed', async ({ authenticatedPage: page }) => {
    const number = `POL-${stamp}`;
    await openTab(page, projectId, 'Insurance');
    await page.getByRole('button', { name: 'Add policy' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Add policy' })).toBeDisabled();
    await dialog.getByLabel('Policy number').fill(number);
    await dialog.getByLabel('Insurer').fill('E2E Insurance Co.');
    await dialog.getByLabel('Sum insured (NPR)').fill('500000000');
    await dialog.getByLabel('Valid from').fill(inDays(-300));
    await dialog.getByLabel('Valid to').fill(inDays(40));
    await dialog.getByRole('button', { name: 'Add policy' }).click();
    await expect(dialog).toHaveCount(0);

    await openTab(page, projectId, 'Insurance');
    const row = (await loadedRows(tableByCaption(page, 'Insurance policies'))).filter({ hasText: number });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('E2E Insurance Co.');

    await row.getByRole('button', { name: 'Set status' }).click();
    await page.getByRole('dialog').getByLabel('Status').selectOption('renewed');
    await page.getByRole('dialog').getByRole('button', { name: 'Save status' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openTab(page, projectId, 'Insurance');
    await expect((await loadedRows(tableByCaption(page, 'Insurance policies'))).filter({ hasText: number })).toContainText('Renewed');
  });

  test('an ESIA result and a resolved grievance are saved', async ({ authenticatedPage: page }) => {
    const parameter = `Noise at intake ${stamp}`;
    await openTab(page, projectId, 'ESIA monitoring');
    await page.getByRole('button', { name: 'Record result' }).click();
    const esia = page.getByRole('dialog');
    await esia.getByLabel('Parameter').fill(parameter);
    await esia.getByLabel('Compliance').selectOption('observation');
    await esia.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(esia).toHaveCount(0);
    await openTab(page, projectId, 'ESIA monitoring');
    await expect((await loadedRows(tableByCaption(page, 'ESIA monitoring'))).filter({ hasText: parameter })).toContainText('Observation');

    const summary = `Access road dust complaint ${stamp}`;
    await openTab(page, projectId, 'Community & grievances');
    await page.getByRole('button', { name: 'Record', exact: true }).click();
    const record = page.getByRole('dialog');
    await record.getByLabel('Summary').fill(summary);
    await record.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(record).toHaveCount(0);

    await openTab(page, projectId, 'Community & grievances');
    const row = (await loadedRows(tableByCaption(page, 'Community engagement'))).filter({ hasText: summary });
    await row.getByRole('button', { name: 'Mark resolved' }).click();
    const resolve = page.getByRole('dialog');
    await expect(resolve.getByRole('button', { name: 'Mark resolved' })).toBeDisabled();
    await resolve.getByLabel('How it was resolved').fill('Road is watered twice a day during works');
    await resolve.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(resolve).toHaveCount(0);
    await openTab(page, projectId, 'Community & grievances');
    const resolved = (await loadedRows(tableByCaption(page, 'Community engagement'))).filter({ hasText: summary });
    await expect(resolved.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0);
  });

  test('a milestone and a risk are saved, and the severity comes from the server', async ({ authenticatedPage: page }) => {
    const milestone = `Switchyard upgrade ${stamp}`;
    await openTab(page, projectId, 'Milestones');
    await page.getByRole('button', { name: 'Add milestone' }).click();
    const add = page.getByRole('dialog');
    await add.getByLabel('Milestone', { exact: true }).fill(milestone);
    await add.getByLabel('Planned date').fill(inDays(120));
    await add.getByRole('button', { name: /^Add/ }).click();
    await expect(add).toHaveCount(0);
    await openTab(page, projectId, 'Milestones');
    const saved = (await loadedRows(tableByCaption(page, 'Milestones'))).filter({ hasText: milestone });
    await expect(saved).toHaveCount(1);

    // A forecast past the plan flags the delay; completing needs the actual date
    await saved.getByRole('button', { name: 'Update' }).click();
    const update = page.getByRole('dialog');
    await update.getByLabel('Forecast date').fill(inDays(150));
    await update.getByRole('button', { name: 'Save milestone' }).click();
    await expect(update).toHaveCount(0);
    await openTab(page, projectId, 'Milestones');
    const late = (await loadedRows(tableByCaption(page, 'Milestones'))).filter({ hasText: milestone });
    await expect(late).toContainText('30 days late');

    await late.getByRole('button', { name: 'Update' }).click();
    await update.getByLabel('Status').selectOption('completed');
    await expect(update.getByText('A completed milestone needs its actual date')).toBeVisible();
    await expect(update.getByRole('button', { name: 'Save milestone' })).toBeDisabled();
    await update.getByLabel('Actual date').fill(inDays(0));
    await update.getByRole('button', { name: 'Save milestone' }).click();
    await expect(update).toHaveCount(0);
    await openTab(page, projectId, 'Milestones');
    const done = (await loadedRows(tableByCaption(page, 'Milestones'))).filter({ hasText: milestone });
    await expect(done).toContainText('Completed');
    await expect(done).toContainText('100%');
    await expect(done).not.toContainText('days late'); // finished ahead of plan

    const risk = `Transformer lead time ${stamp}`;
    await openTab(page, projectId, 'Risk register');
    await page.getByRole('button', { name: 'Add risk' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Risk', { exact: true }).fill(risk);
    await dialog.getByLabel('Likelihood (1-5)').fill('5');
    await dialog.getByLabel('Impact (1-5)').fill('5');
    await dialog.getByRole('button', { name: /^Add/ }).click();
    await expect(dialog).toHaveCount(0);

    await openTab(page, projectId, 'Risk register');
    const row = (await loadedRows(tableByCaption(page, 'Risk register'))).filter({ hasText: risk });
    await expect(row).toContainText('Critical'); // 5 x 5, worked out by the API
    await row.getByRole('button', { name: 'Update' }).click();
    await page.getByRole('dialog').getByLabel('Mitigation status').selectOption('mitigated');
    await page.getByRole('dialog').getByRole('button', { name: /Save|Update/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openTab(page, projectId, 'Risk register');
    await expect((await loadedRows(tableByCaption(page, 'Risk register'))).filter({ hasText: risk })).toContainText('Mitigated');

    await page.getByRole('button', { name: 'Scan for risks' }).click();
    await expect(page.getByText(/Scan finished: \d+ new risk/)).toBeVisible();
  });

  test('a stakeholder contact and a report schedule are saved and removed', async ({ authenticatedPage: page }) => {
    const contact = `E2E Contact ${stamp}`;
    await page.goto('/regulatory');
    await page.getByRole('button', { name: 'Add contact' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(contact);
    await dialog.getByLabel('Email').fill(`contact.${stamp}@example.com`);
    await dialog.getByRole('button', { name: 'Add contact' }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    const row = (await loadedRows(tableByCaption(page, 'Stakeholder contacts'))).filter({ hasText: contact });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Remove/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(contact)).toHaveCount(0);

    const schedule = `E2E weekly portfolio ${stamp}`;
    await page.goto('/reports');
    await page.getByRole('button', { name: 'Schedule a report' }).click();
    const add = page.getByRole('dialog');
    await add.getByLabel('Name').fill(schedule);
    await add.getByLabel('Report', { exact: true }).selectOption({ label: 'Portfolio overview' });
    await add.getByLabel('Recipients (comma separated)').fill(`reports.${stamp}@example.com`);
    await add.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(add).toHaveCount(0);

    await page.reload();
    const scheduled = (await loadedRows(tableByCaption(page, 'Scheduled reports'))).filter({ hasText: schedule });
    await expect(scheduled).toHaveCount(1);
    await scheduled.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(schedule)).toHaveCount(0);
  });
});
