import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test';

/**
 * Signs in through the real login API (via the Vite proxy), once per worker and account, and seeds
 * the browser with the session the app itself would have stored.
 *
 * Needs the backend running with the built-in demo accounts (DEBUG=true or ALLOW_DEV_AUTH=true).
 * Override the default account with E2E_USERNAME / E2E_PASSWORD.
 */

export const E2E_USERNAME = process.env.E2E_USERNAME ?? 'admin';
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'admin123';

/** Key and shape written by the zustand `persist` middleware in src/store/useAuthStore.ts. */
const SESSION_KEY = 'hpms-auth';

interface Session {
  token: string;
  stored: string;
}

type Sessions = (username?: string) => Promise<Session>;

interface Fixtures {
  /** A page signed in as the default account. */
  authenticatedPage: Page;
  /** API client carrying the default account's token, for looking up expected values. */
  api: APIRequestContext;
  /** A page in its own browser context, signed in as a demo account (`maker`, `approver`, `admin`...). */
  pageAs: (username: string) => Promise<Page>;
  /** API client signed in as a demo account. */
  apiAs: (username: string) => Promise<APIRequestContext>;
}

async function signIn(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string | undefined,
  username: string,
): Promise<Session> {
  // The demo accounts all follow <name>/<name>123
  const password = username === E2E_USERNAME ? E2E_PASSWORD : `${username}123`;
  const request = await playwright.request.newContext({ baseURL });
  const response = await request.post('/api/v1/auth/login', { data: { username, password } });
  if (!response.ok()) {
    throw new Error(
      `E2E login as ${username} failed (${response.status()}): is the backend running with demo accounts enabled? ` +
        (await response.text()),
    );
  }
  const body = await response.json();
  await request.dispose();
  if (!body.access_token) throw new Error(`${username} requires MFA; use an account without it`);

  return {
    token: body.access_token,
    stored: JSON.stringify({
      state: {
        token: body.access_token,
        expiresAt: Date.now() + body.expires_in_seconds * 1000,
        user: body.user,
        mfaEnrollmentRequired: false,
      },
      version: 0,
    }),
  };
}

async function seedSession(page: Page, session: Session) {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.sessionStorage.getItem(key)) window.sessionStorage.setItem(key, value);
    },
    [SESSION_KEY, session.stored],
  );
}

export const test = base.extend<Fixtures, { sessions: Sessions }>({
  sessions: [
    async ({ playwright }, use, workerInfo) => {
      const cache = new Map<string, Promise<Session>>();
      await use((username = E2E_USERNAME) => {
        if (!cache.has(username)) {
          cache.set(username, signIn(playwright, workerInfo.project.use.baseURL, username));
        }
        return cache.get(username)!;
      });
    },
    { scope: 'worker' },
  ],

  authenticatedPage: async ({ page, sessions }, use) => {
    await seedSession(page, await sessions());
    await use(page);
  },

  api: async ({ apiAs }, use) => {
    await use(await apiAs(E2E_USERNAME));
  },

  pageAs: async ({ browser, sessions }, use, testInfo) => {
    const contexts: Awaited<ReturnType<Browser['newContext']>>[] = [];
    await use(async (username) => {
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
      contexts.push(context);
      const page = await context.newPage();
      await seedSession(page, await sessions(username));
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },

  apiAs: async ({ playwright, sessions }, use, testInfo) => {
    const clients: APIRequestContext[] = [];
    await use(async (username) => {
      const client = await playwright.request.newContext({
        baseURL: testInfo.project.use.baseURL,
        extraHTTPHeaders: { Authorization: `Bearer ${(await sessions(username)).token}` },
      });
      clients.push(client);
      return client;
    });
    await Promise.all(clients.map((client) => client.dispose()));
  },
});

export { expect };
