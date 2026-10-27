import { test, expect, E2E_PASSWORD, E2E_USERNAME } from './fixtures/auth';

/** Smoke: the app, the backend behind the proxy, and sign-in all work together. */
test.describe('0. Smoke', () => {
  test('redirects a signed-out visitor to the login page', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to HPMS' })).toBeVisible();
  });

  test('signs in through the login form and returns to the requested page', async ({ page }) => {
    await page.goto('/projects');
    await page.getByLabel('Username').fill(E2E_USERNAME);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  });

  test('rejects a wrong password with an error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(E2E_USERNAME);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an authenticated session opens the dashboard without console errors', async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      // Firefox logs the notification socket that the development build opens and closes at once (React mounts
      // twice in development) and one cut off by navigation; the socket that follows connects. Not app errors.
      const browserNoise = /ws:\/\/\S+\/ws\/notifications/.test(message.text());
      if (message.type() === 'error' && !browserNoise) errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('signing out returns to the login page and ends the session on the server', async ({ page }) => {
    // Its own session: signing out revokes the token, so the worker's shared one must not be used here
    await page.goto('/login');
    await page.getByLabel('Username').fill(E2E_USERNAME);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('hpms-auth') ?? '{}').state?.token);
    expect(token).toBeTruthy();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    const after = await page.request.get('/api/v1/projects', { headers: { Authorization: `Bearer ${token}` } });
    expect(after.status()).toBe(401);
  });
});
