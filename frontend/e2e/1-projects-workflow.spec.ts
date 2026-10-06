import { test, expect } from './fixtures/auth';
import { columnTexts, fetchProjects, humanize, loadedRows, tableByCaption } from './utils/helpers';

/**
 * Projects workflow: list, filter, paginate, open a project.
 *
 * Runs against the real backend. Expected values come from the API, so the suite works with any
 * dataset that has more than one page of projects (backend/scripts/seed_realistic_data.py does).
 */

const PAGE_SIZE = 20;
// Column order of the Projects table (src/pages/ProjectsPage.tsx)
const COL = { project: 0, province: 1, capacity: 2, stage: 3, status: 4 };

test.describe('1. Projects workflow', () => {
  test('lists the first page of projects with a matching total', async ({ authenticatedPage: page, api }) => {
    const { rows: expected, total } = await fetchProjects(api, { page: 1, page_size: PAGE_SIZE });
    expect(total, 'seed data should span more than one page').toBeGreaterThan(PAGE_SIZE);

    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();

    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    await expect(rows).toHaveCount(PAGE_SIZE);
    await expect(rows.first()).toContainText(expected[0].name_en);
    await expect(rows.first()).toContainText(expected[0].project_code);

    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pagination).toContainText(`1–${PAGE_SIZE} of ${total}`);
    await expect(pagination).toContainText(`Page 1 of ${Math.ceil(total / PAGE_SIZE)}`);
  });

  test('filters by stage and keeps the filter in the URL', async ({ authenticatedPage: page, api }) => {
    const { total } = await fetchProjects(api, { stage: 'construction', page_size: 1 });
    expect(total).toBeGreaterThan(0);

    await page.goto('/projects');
    await page.getByLabel('Stage').selectOption('construction');
    await expect(page).toHaveURL(/[?&]stage=construction/);

    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    await expect(rows).toHaveCount(Math.min(total, PAGE_SIZE));
    expect(new Set(await columnTexts(rows, COL.stage))).toEqual(new Set(['Construction']));
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText(`of ${total}`);

    // The filter is in the URL, so it survives a reload
    await page.reload();
    await expect(page.getByLabel('Stage')).toHaveValue('construction');
    await expect(await loadedRows(tableByCaption(page, 'Projects'))).toHaveCount(Math.min(total, PAGE_SIZE));
  });

  test('filters by province', async ({ authenticatedPage: page, api }) => {
    const { total } = await fetchProjects(api, { province: 'Bagmati', page_size: 1 });
    expect(total).toBeGreaterThan(0);

    await page.goto('/projects');
    await page.getByLabel('Province').selectOption('Bagmati');
    await expect(page).toHaveURL(/[?&]province=Bagmati/);

    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    await expect(rows).toHaveCount(Math.min(total, PAGE_SIZE));
    expect(new Set(await columnTexts(rows, COL.province))).toEqual(new Set(['Bagmati']));
  });

  test('filters by pipeline status', async ({ authenticatedPage: page, api }) => {
    const { total } = await fetchProjects(api, { status: 'approved', page_size: 1 });
    expect(total).toBeGreaterThan(0);

    await page.goto('/projects');
    await page.getByLabel('Pipeline status').selectOption('approved');
    await expect(page).toHaveURL(/[?&]status=approved/);

    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    await expect(rows).toHaveCount(Math.min(total, PAGE_SIZE));
    expect(new Set(await columnTexts(rows, COL.status))).toEqual(new Set([humanize('approved')]));
  });

  test('combines filters and clears them again', async ({ authenticatedPage: page, api }) => {
    const all = await fetchProjects(api, { page_size: 1 });
    const stageOnly = await fetchProjects(api, { stage: 'operation', page_size: 1 });
    const both = await fetchProjects(api, { stage: 'operation', province: 'Gandaki', page_size: 100 });
    expect(both.total).toBeGreaterThan(0);
    expect(both.total).toBeLessThan(stageOnly.total);

    await page.goto('/projects');
    const pagination = page.getByRole('navigation', { name: 'Pagination' });

    // Let each filter's results render before changing the next one (see the fixme test below).
    await page.getByLabel('Stage').selectOption('operation');
    await expect(pagination).toContainText(`of ${stageOnly.total}`);
    await page.getByLabel('Province').selectOption('Gandaki');
    await expect(page).toHaveURL(/stage=operation.*province=Gandaki/);
    await expect(pagination).toContainText(`of ${both.total}`);
    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    await expect(rows).toHaveCount(both.total);
    for (const project of both.rows) {
      await expect(rows.filter({ hasText: project.project_code })).toHaveCount(1);
    }

    const provinceOnly = await fetchProjects(api, { province: 'Gandaki', page_size: 1 });
    await page.getByLabel('Stage').selectOption('');
    await expect(pagination).toContainText(`of ${provinceOnly.total}`);
    await page.getByLabel('Province').selectOption('');
    await expect(page).toHaveURL(/\/projects$/);
    await expect(pagination).toContainText(`of ${all.total}`);
  });

  // Known defect: ProjectsPage.update() starts from the search params of its last render, so a second
  // filter chosen before the first has re-rendered overwrites it. Seen under load; un-fixme once fixed.
  test.fixme('keeps both filters when they are changed in quick succession', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/projects');
    await page.getByLabel('Stage').selectOption('operation');
    await page.getByLabel('Province').selectOption('Gandaki');
    await expect(page).toHaveURL(/stage=operation.*province=Gandaki/);
  });

  test('shows an empty state when no project matches', async ({ authenticatedPage: page, api }) => {
    // A project in operation is never still "under review"
    const { total } = await fetchProjects(api, { stage: 'operation', status: 'under_review', page_size: 1 });
    expect(total).toBe(0);

    await page.goto('/projects?stage=operation&status=under_review');
    await expect(page.getByText('No projects match these filters')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toHaveCount(0);
  });

  test('pages forward and back', async ({ authenticatedPage: page, api }) => {
    const { rows: secondPage, total } = await fetchProjects(api, { page: 2, page_size: PAGE_SIZE });

    await page.goto('/projects');
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    const previous = pagination.getByRole('button', { name: 'Previous page' });
    const next = pagination.getByRole('button', { name: 'Next page' });
    await expect(previous).toBeDisabled();

    await next.click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(pagination).toContainText(`${PAGE_SIZE + 1}–${Math.min(2 * PAGE_SIZE, total)} of ${total}`);
    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    await expect(rows.first()).toContainText(secondPage[0].project_code);
    await expect(previous).toBeEnabled();

    await previous.click();
    await expect(pagination).toContainText(`1–${PAGE_SIZE} of ${total}`);
    await expect(previous).toBeDisabled();
  });

  test('disables Next on the last page', async ({ authenticatedPage: page, api }) => {
    const { total } = await fetchProjects(api, { page_size: 1 });
    const lastPage = Math.ceil(total / PAGE_SIZE);

    await page.goto(`/projects?page=${lastPage}`);
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pagination).toContainText(`Page ${lastPage} of ${lastPage}`);
    await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await expect(await loadedRows(tableByCaption(page, 'Projects'))).toHaveCount(total - (lastPage - 1) * PAGE_SIZE);
  });

  test('changing a filter returns to the first page', async ({ authenticatedPage: page }) => {
    await page.goto('/projects?page=2');
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2');

    await page.getByLabel('Stage').selectOption('operation');
    await expect(page).toHaveURL(/stage=operation/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 1');
  });

  test('opens a project from its row and returns to the list', async ({ authenticatedPage: page, api }) => {
    const { rows: expected } = await fetchProjects(api, { page: 1, page_size: PAGE_SIZE });
    const project = expected[0];

    await page.goto('/projects');
    const rows = await loadedRows(tableByCaption(page, 'Projects'));
    // Click a cell outside the name link, to exercise the row handler rather than the link
    await rows.first().locator('td').nth(COL.capacity).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
    await expect(page.getByRole('heading', { name: project.name_en, level: 1 })).toBeVisible();
    await expect(page.getByText(project.project_code)).toBeVisible();

    await page.getByRole('link', { name: 'All projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(tableByCaption(page, 'Projects')).toBeVisible();
  });

  test('opens a project from its name link', async ({ authenticatedPage: page, api }) => {
    const { rows: expected } = await fetchProjects(api, { page: 1, page_size: PAGE_SIZE });
    const project = expected[1];

    await page.goto('/projects');
    await page.getByRole('link', { name: project.name_en, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  });

  test('shows loan, tranche and repayment data for a financed project', async ({
    authenticatedPage: page,
    api,
  }) => {
    const { rows: operating } = await fetchProjects(api, { stage: 'operation', page_size: 1 });
    const project = operating[0];
    const loans = (await (await api.get(`/api/v1/projects/${project.id}/loan-accounts`)).json()).data;
    const disbursements = (await (await api.get(`/api/v1/projects/${project.id}/disbursements`)).json()).data;
    expect(loans.length, 'seeded operating projects have a loan').toBeGreaterThan(0);

    const failed: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole('heading', { name: project.name_en, level: 1 })).toBeVisible();
    await expect(page.getByText('Installed capacity')).toBeVisible();

    const loanRows = await loadedRows(tableByCaption(page, 'Loan accounts for this project'));
    await expect(loanRows).toHaveCount(loans.length);
    await expect(loanRows.first()).toContainText(humanize(loans[0].facility_type));
    await expect(loanRows.first()).toContainText('%');

    await expect(await loadedRows(tableByCaption(page, 'Disbursement tranches'))).toHaveCount(
      disbursements.tranches.length,
    );
    await expect(await loadedRows(tableByCaption(page, 'Repayment schedule'))).toHaveCount(
      disbursements.repayments.length,
    );
    await expect(await loadedRows(tableByCaption(page, 'COD history'))).not.toHaveCount(0);

    await page.waitForLoadState('networkidle');
    expect(failed).toEqual([]);
  });

  test('shows empty states for a project without a loan', async ({ authenticatedPage: page, api }) => {
    const { rows } = await fetchProjects(api, { stage: 'feasibility', page_size: 1 });
    const project = rows[0];
    const loans = (await (await api.get(`/api/v1/projects/${project.id}/loan-accounts`)).json()).data;
    test.skip(loans.length > 0, 'this dataset has loans on feasibility projects');

    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole('heading', { name: project.name_en, level: 1 })).toBeVisible();
    await expect(page.getByText('No loan accounts linked')).toBeVisible();
    await expect(page.getByText('No disbursements recorded')).toBeVisible();
    await expect(page.getByText('No repayments scheduled')).toBeVisible();
  });

  test('reports an unknown project as not found', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('Project not found')).toBeVisible();
    await page.getByRole('link', { name: 'All projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });
});
