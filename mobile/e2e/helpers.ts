/**
 * E2E Test Helpers - Reusable test utilities
 */

/**
 * Login helper
 */
export async function login(username: string, password: string) {
  await element(by.testID('username-input')).typeText(username);
  await element(by.testID('password-input')).typeText(password);
  await element(by.testID('login-button')).tap();

  // Wait for dashboard to load
  await waitFor(element(by.testID('kpi-card-0')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Logout helper
 */
export async function logout() {
  await element(by.testID('menu-button')).tap();
  await element(by.testID('logout-button')).tap();
  await waitFor(element(by.testID('login-screen')))
    .toBeVisible()
    .withTimeout(3000);
}

/**
 * Navigate to project detail
 */
export async function navigateToProject(index: number = 0) {
  await element(by.testID(`project-item-${index}`)).tap();
  await waitFor(element(by.text('Project Details')))
    .toBeVisible()
    .withTimeout(3000);
}

/**
 * Go back to dashboard
 */
export async function backToDashboard() {
  await element(by.text('Back')).tap();
  await waitFor(element(by.text('Projects')))
    .toBeVisible()
    .withTimeout(3000);
}

/**
 * Scroll to bottom of list
 */
export async function scrollToBottom(testID: string = 'projects-list') {
  const list = element(by.testID(testID));
  await list.scrollTo('bottom');
}

/**
 * Scroll to top of list
 */
export async function scrollToTop(testID: string = 'projects-list') {
  const list = element(by.testID(testID));
  await list.scrollTo('top');
}

/**
 * Wait for element with retry
 */
export async function waitForElement(
  testID: string,
  timeout: number = 5000
) {
  return waitFor(element(by.testID(testID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Simulate offline mode (mock)
 */
export async function simulateOffline() {
  // This would require setting up mocks/state
  // For now, just a placeholder
  console.log('[E2E] Simulating offline mode');
}

/**
 * Simulate online mode
 */
export async function simulateOnline() {
  // Placeholder for mock setup
  console.log('[E2E] Simulating online mode');
}

/**
 * Simulate network error
 */
export async function simulateNetworkError() {
  // Mock API error
  console.log('[E2E] Simulating network error');
}

/**
 * Verify KPI card value
 */
export async function verifyKPIValue(index: number, expectedValue: string) {
  await expect(element(by.testID(`kpi-value-${index}`))).toHaveText(
    expectedValue
  );
}

/**
 * Verify project list contains text
 */
export async function verifyProjectListContains(text: string) {
  await expect(element(by.text(text))).toBeVisible();
}

/**
 * Perform pull-to-refresh
 */
export async function pullToRefresh() {
  const list = element(by.testID('projects-list'));
  await list.multiTap();
  // Wait for refresh to complete
  await waitFor(element(by.testID('kpi-card-0')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Switch to tab
 */
export async function switchToTab(tabTestID: string) {
  await element(by.testID(tabTestID)).tap();
  // Allow time for tab switch
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Verify error state
 */
export async function verifyErrorState() {
  await expect(element(by.testID('error-state'))).toBeVisible();
  await expect(element(by.testID('error-retry-button'))).toBeVisible();
}

/**
 * Verify empty state
 */
export async function verifyEmptyState() {
  await expect(element(by.testID('empty-state'))).toBeVisible();
}

/**
 * Verify loading state
 */
export async function verifyLoadingState() {
  await expect(element(by.testID('loading-spinner'))).toBeVisible();
}

/**
 * Verify offline indicator
 */
export async function verifyOfflineIndicator() {
  await expect(element(by.testID('offline-bar'))).toBeVisible();
}

/**
 * Verify real-time connected
 */
export async function verifyRealtimeConnected() {
  await expect(element(by.testID('realtime-indicator'))).toBeVisible();
  await expect(element(by.text(/live/i))).toBeVisible();
}

/**
 * Take screenshot for debugging
 */
export async function takeScreenshot(name: string) {
  await device.takeScreenshot(name);
}

/**
 * Reload app
 */
export async function reloadApp() {
  await device.reloadReactNative();
}

/**
 * Send app to background and foreground
 */
export async function backgroundAndForeground() {
  await device.sendToBack();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await device.bringToFront();
}

/**
 * Check if element has text
 */
export async function elementHasText(testID: string, text: string) {
  return expect(element(by.testID(testID))).toHaveText(text);
}

/**
 * Check if element is visible
 */
export async function isElementVisible(testID: string): Promise<boolean> {
  try {
    await expect(element(by.testID(testID))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}
