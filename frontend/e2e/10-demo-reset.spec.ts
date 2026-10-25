import { test, expect } from './fixtures/auth';

/**
 * The Admin screen's "Reset demo data", against the real backend. It replaces every project, so it
 * runs only when asked (E2E_DEMO_RESET=1), on its own: alongside the other suites it would pull their
 * data out from under them. The backend must have DEMO_RESET_ENABLED=true.
 *
 * Afterwards the database is a fresh seed, so the other suites can run on it straight away.
 */

test.skip(!process.env.E2E_DEMO_RESET, 'replaces all project data; run alone with E2E_DEMO_RESET=1');

test.describe('10. Demo data reset', () => {
  test('an admin resets the demo to the synthetic portfolio, discarding what was entered', async ({ pageAs, apiAs }) => {
    const adminApi = await apiAs('admin');
    const makerApi = await apiAs('maker');
    // Something entered during a demo: an extra change request on top of the seeded four
    const projectId = (await (await makerApi.get('/api/v1/compliance/covenants')).json()).data[0].project_id;
    const financials = (await (await makerApi.get(`/api/v1/compliance/covenants/${projectId}/financials`)).json()).data;
    const raised = await makerApi.post('/api/v1/mutations/submit-with-justification', {
      data: {
        entity_type: 'FINANCIAL_PERIOD',
        entity_id: projectId,
        action: 'UPDATE',
        changes: {
          quarter_ad: financials.reportable_quarters[0].quarter,
          security_value_npr: '1000.00',
          source_reference: 'E2E reset',
        },
        justification: `E2E reset ${Date.now()}: entered during a demo`,
      },
    });
    expect(raised.status(), await raised.text()).toBeLessThan(300);

    const page = await pageAs('admin');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Reset demo data' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('cannot be undone');
    await dialog.getByRole('button', { name: 'Reset demo data' }).click();
    await expect(page.getByRole('status')).toContainText('50 projects and 4 change requests', { timeout: 120_000 });

    // Checked after a reload, from the server
    await page.reload();
    await expect(page.getByText(/All \d+ entries link to the one before them/)).toBeVisible();
    const projects = (await (await adminApi.get('/api/v1/projects?page_size=1')).json()).meta.total_count;
    expect(projects).toBe(50);
    const queue = (await (await adminApi.get('/api/v1/mutations/approval-queue')).json()).data.approvals;
    expect(queue.some((item: { justification: string }) => item.justification.includes('entered during a demo'))).toBe(false);
  });

  test('a maker is not offered the reset and cannot call it', async ({ pageAs, apiAs }) => {
    const refused = await (await apiAs('maker')).post('/api/v1/admin/demo-reset');
    expect(refused.status()).toBe(403);
    const page = await pageAs('maker');
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'Reset demo data' })).toHaveCount(0);
  });
});
