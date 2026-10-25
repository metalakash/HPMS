import { test, expect } from './fixtures/auth';

/**
 * Admin user management against the real backend. It changes a seeded staff account that no other suite
 * signs in with (the demo accounts are used by the other suites), and puts it back afterwards.
 * Sign-in refusal and the end of open sessions are covered by tests/integration/test_user_admin_db.py.
 */

const TARGET = 'bikash.adhikari'; // created by seed_test_workflows

test.describe.configure({ mode: 'serial' });

test.describe('12. User admin', () => {
  test('an admin blocks and unblocks an account, with a reason, and sets its role', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/admin');
    const row = page.getByRole('row', { name: new RegExp(TARGET) });

    // A reason is required
    await row.getByRole('button', { name: 'Block' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Block account' })).toBeDisabled();
    await dialog.getByLabel('Reason').fill('On long leave (E2E)');
    await dialog.getByRole('button', { name: 'Block account' }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(row).toContainText('Blocked');
    await expect(row).toContainText('On long leave (E2E)');

    await row.getByRole('button', { name: 'Unblock' }).click();
    await page.getByRole('dialog').getByLabel('Reason').fill('Back from leave (E2E)');
    await page.getByRole('dialog').getByRole('button', { name: 'Unblock account' }).click();
    await page.reload();
    await expect(row).toContainText('Active');

    // Role set in HPMS, then back to the directory's
    await row.getByRole('button', { name: 'Role' }).click();
    await page.getByRole('dialog').getByLabel('Role in HPMS').selectOption('auditor');
    await page.getByRole('dialog').getByLabel('Reason').fill('Covering internal audit (E2E)');
    await page.getByRole('dialog').getByRole('button', { name: 'Save role' }).click();
    await page.reload();
    await expect(row).toContainText('Auditor');
    await expect(row).toContainText('Set in HPMS');

    await row.getByRole('button', { name: 'Role' }).click();
    await page.getByRole('dialog').getByLabel('Role in HPMS').selectOption('');
    await page.getByRole('dialog').getByLabel('Reason').fill('Cover ended (E2E)');
    await page.getByRole('dialog').getByRole('button', { name: 'Save role' }).click();
    await page.reload();
    await expect(row).not.toContainText('Set in HPMS');
  });

  test('an admin is not offered changes to their own account', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/admin');
    const own = page.getByRole('row', { name: /^Admin User admin / });
    await expect(own).toContainText('You');
    await expect(own.getByRole('button', { name: /Block|Role/ })).toHaveCount(0);
  });

  test('a maker cannot block anyone', async ({ apiAs }) => {
    const users = (await (await (await apiAs('admin')).get('/api/v1/admin/users')).json()).data;
    const target = users.find((u: { username: string }) => u.username === TARGET);
    const refused = await (await apiAs('maker')).post(`/api/v1/admin/users/${target.id}/block`, { data: { reason: 'No' } });
    expect(refused.status()).toBe(403);
  });
});
