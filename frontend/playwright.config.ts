import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Runs full browser-based tests for critical user workflows
 *
 * The suite assumes the synthetic seed and writes change requests. Point it at a stack that is
 * safe to write to with E2E_BASE_URL (for example a second frontend on :5174 in front of a
 * backend on a throwaway seeded database); it defaults to the usual dev server.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/** Specs that change records other runs depend on; three browsers at once would race each other. */
const WRITES_SHARED_STATE = [/3-approvals/, /9-covenant-inputs/, /10-demo-reset/, /12-user-admin/, /13-plans-and-settings/, /14-sprint-d3/];

export default defineConfig({
  testDir: './e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the CI run if a test.only was left in
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI only
  retries: process.env.CI ? 2 : 0,

  // Every test hits one dev backend; more workers than this makes it the bottleneck and tests flaky
  workers: process.env.CI ? 1 : 4,

  // The first query after a cold start can take several seconds
  expect: { timeout: 15_000 },

  // Reporter configuration
  reporter: [
    ['html'],
    ['list'],
  ],

  // Shared test settings
  use: {
    // Base URL for navigation
    baseURL: BASE_URL,

    // Collect artifacts on failure
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeout for actions (30 seconds)
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  // Global timeout: 60 seconds per test
  timeout: 60 * 1000,

  // Dev server configuration
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    // With E2E_BASE_URL the stack is started by hand, so one must already be running there
    reuseExistingServer: !process.env.CI || !!process.env.E2E_BASE_URL,
    timeout: 120 * 1000,
  },

  // Chromium by default, for a fast loop. E2E_ALL_BROWSERS=1 adds Firefox and the installed Microsoft Edge,
  // the browsers the RFP names (TECH B.2, B.4). Specs that change shared data run once, on Chromium.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.E2E_ALL_BROWSERS
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: WRITES_SHARED_STATE },
          { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' }, testIgnore: WRITES_SHARED_STATE },
        ]
      : []),
  ],

  // Global setup/teardown (optional, add later if needed)
  // globalSetup: require.resolve('./e2e/global-setup.ts'),
  // globalTeardown: require.resolve('./e2e/global-teardown.ts'),
});
