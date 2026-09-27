/**
 * E2E Test Initialization
 * Setup and teardown for test suite
 */

beforeAll(async () => {
  // Initialize test environment
  console.log('[E2E] Initializing test environment');

  // Wait for app to fully load
  await waitFor(element(by.testID('app-ready')))
    .toBeVisible()
    .withTimeout(10000);
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('[E2E] Cleaning up test environment');
});

beforeEach(async () => {
  // Setup before each test
  // Reset app state if needed
});

afterEach(async () => {
  // Teardown after each test
  // Log results
  console.log('[E2E] Test completed');
});

/**
 * Global test configuration
 */
jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000; // 2 minutes

/**
 * Test data
 */
export const TEST_DATA = {
  projects: [
    {
      id: '1',
      name: 'Kali Gandaki A',
      code: 'KGA-01',
      capacityMw: 144,
      stage: 'operation',
    },
    {
      id: '2',
      name: 'Chisapani',
      code: 'CSP-02',
      capacityMw: 3000,
      stage: 'construction',
    },
    {
      id: '3',
      name: 'Upper Marsyandi',
      code: 'UMD-03',
      capacityMw: 600,
      stage: 'construction',
    },
  ],
  portfolioMetrics: {
    totalProjects: 12,
    totalCapacityMw: 450,
    activeProjects: 8,
    averageProgress: 65,
  },
};

/**
 * Mock responses for testing
 */
export const MOCK_RESPONSES = {
  portfolioMetrics: {
    status: 200,
    body: TEST_DATA.portfolioMetrics,
  },
  projectsList: {
    status: 200,
    body: TEST_DATA.projects,
  },
  projectNotFound: {
    status: 404,
    body: { error: 'Project not found' },
  },
  serverError: {
    status: 500,
    body: { error: 'Internal server error' },
  },
  unauthorized: {
    status: 401,
    body: { error: 'Unauthorized' },
  },
};
