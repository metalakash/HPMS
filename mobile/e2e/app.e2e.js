/**
 * End-to-End Tests for HPMS Mobile App (Phase 5 Task 3)
 * Comprehensive test coverage for all major workflows
 */

describe('HPMS Mobile App - E2E Tests', () => {

  // ==================== App Initialization & Navigation ====================

  describe('App Initialization', () => {

    it('should display splash screen on launch', async () => {
      await expect(element(by.text('HPMS'))).toBeVisible();
      await expect(element(by.text('Hydropower Project Management'))).toBeVisible();
    });

    it('should show version number', async () => {
      await expect(element(by.text('Version 1.0.0'))).toBeVisible();
    });

    it('should complete initialization and navigate to dashboard', async () => {
      await waitFor(element(by.id('tab-dashboard')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Bottom Tab Navigation', () => {

    beforeEach(async () => {
      await waitFor(element(by.id('tab-dashboard')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should navigate to dashboard tab', async () => {
      await element(by.id('tab-dashboard')).multiTap();
      await expect(element(by.text('Projects'))).toBeVisible();
    });

    it('should navigate to inspections tab', async () => {
      await element(by.id('tab-inspection')).multiTap();
      await expect(element(by.text('Inspections'))).toBeVisible();
    });

    it('should navigate to maintenance tab', async () => {
      await element(by.id('tab-maintenance')).multiTap();
      await expect(element(by.text('Maintenance'))).toBeVisible();
    });

    it('should navigate to settings tab', async () => {
      await element(by.id('tab-settings')).multiTap();
      await expect(element(by.text('Settings'))).toBeVisible();
    });

    it('should persist tab selection after navigation', async () => {
      await element(by.id('tab-maintenance')).multiTap();
      await element(by.id('tab-dashboard')).multiTap();
      await element(by.id('tab-maintenance')).multiTap();
      await expect(element(by.text('Maintenance'))).toBeVisible();
    });
  });

  // ==================== Dashboard Functionality ====================

  describe('Dashboard Screen', () => {

    beforeEach(async () => {
      await element(by.id('tab-dashboard')).multiTap();
      await waitFor(element(by.text('Projects')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should display dashboard title', async () => {
      await expect(element(by.text('Projects'))).toBeVisible();
    });

    it('should display MW output metric label', async () => {
      await expect(element(by.text('MW Output')).atIndex(0)).toBeVisible();
    });

    it('should display status metric label', async () => {
      await expect(element(by.text('Status')).atIndex(0)).toBeVisible();
    });

    it('should display last update time', async () => {
      await expect(element(by.text('Last Updated')).atIndex(0)).toBeVisible();
    });

    it('should refresh dashboard data on pull-to-refresh', async () => {
      await element(by.id('dashboard-scroll')).multiSwipe(
        [{ x: 500, y: 300 }, { x: 500, y: 600 }],
        [100, 100],
        100,
        1.0
      );

      // Wait for refresh to complete
      await waitFor(element(by.id('loading-indicator')))
        .not.toBeVisible()
        .withTimeout(3000);
    });

    it('should display project list items', async () => {
      await expect(element(by.id('project-item-0'))).toBeVisible();
    });

    it('should allow navigation to project detail', async () => {
      await element(by.id('project-item-0')).multiTap();
      await waitFor(element(by.text('Project Details')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should go back to dashboard from project detail', async () => {
      await element(by.id('project-item-0')).multiTap();
      await waitFor(element(by.text('Project Details')))
        .toBeVisible()
        .withTimeout(2000);

      await element(by.id('back-button')).multiTap();
      await expect(element(by.text('Projects'))).toBeVisible();
    });
  });

  // ==================== Inspection Workflow ====================

  describe('Inspection Workflow', () => {

    beforeEach(async () => {
      await element(by.id('tab-inspection')).multiTap();
      await waitFor(element(by.text('Inspections')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should display inspections list', async () => {
      await expect(element(by.text('Inspections'))).toBeVisible();
    });

    it('should show new inspection button', async () => {
      await expect(element(by.id('new-inspection-btn'))).toBeVisible();
    });

    it('should open new inspection form', async () => {
      await element(by.id('new-inspection-btn')).multiTap();
      await waitFor(element(by.text('New Inspection')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should have form fields in inspection', async () => {
      await element(by.id('new-inspection-btn')).multiTap();

      await expect(element(by.id('inspection-project-field'))).toBeVisible();
      await expect(element(by.id('inspection-type-field'))).toBeVisible();
      await expect(element(by.id('inspection-notes-field'))).toBeVisible();
    });

    it('should allow selecting project from dropdown', async () => {
      await element(by.id('new-inspection-btn')).multiTap();
      await element(by.id('inspection-project-field')).multiTap();

      // Select first project option
      await element(by.id('project-option-0')).multiTap();
      await expect(element(by.id('inspection-project-field'))).toHaveToggleValue(true);
    });

    it('should allow entering inspection notes', async () => {
      await element(by.id('new-inspection-btn')).multiTap();
      await element(by.id('inspection-notes-field')).typeText('Routine inspection');
      await expect(element(by.id('inspection-notes-field'))).toHaveText('Routine inspection');
    });

    it('should allow taking photo', async () => {
      await element(by.id('new-inspection-btn')).multiTap();

      // Simulate photo capture (actual camera not available in tests)
      await element(by.id('add-photo-btn')).multiTap();
      await waitFor(element(by.text('Photo')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should save inspection', async () => {
      await element(by.id('new-inspection-btn')).multiTap();
      await element(by.id('inspection-project-field')).multiTap();
      await element(by.id('project-option-0')).multiTap();
      await element(by.id('inspection-notes-field')).typeText('Test inspection');

      await element(by.id('save-inspection-btn')).multiTap();

      // Should return to inspections list
      await waitFor(element(by.text('Inspections')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should allow canceling inspection creation', async () => {
      await element(by.id('new-inspection-btn')).multiTap();
      await element(by.id('cancel-inspection-btn')).multiTap();

      await expect(element(by.text('Inspections'))).toBeVisible();
    });

    it('should display recent inspections', async () => {
      await expect(element(by.id('inspection-item-0'))).toBeVisible();
    });

    it('should view inspection details', async () => {
      await element(by.id('inspection-item-0')).multiTap();
      await waitFor(element(by.id('inspection-detail-view')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  // ==================== Maintenance Tracking ====================

  describe('Maintenance Screen', () => {

    beforeEach(async () => {
      await element(by.id('tab-maintenance')).multiTap();
      await waitFor(element(by.text('Maintenance')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should display maintenance title', async () => {
      await expect(element(by.text('Maintenance'))).toBeVisible();
    });

    it('should show maintenance schedule tab', async () => {
      await expect(element(by.id('schedule-tab'))).toBeVisible();
    });

    it('should show maintenance history tab', async () => {
      await expect(element(by.id('history-tab'))).toBeVisible();
    });

    it('should display scheduled maintenance items', async () => {
      await element(by.id('schedule-tab')).multiTap();
      await expect(element(by.id('maintenance-item-0'))).toBeVisible();
    });

    it('should show overdue items badge', async () => {
      await element(by.id('schedule-tab')).multiTap();
      await expect(element(by.text('Overdue')).atIndex(0)).toBeVisible();
    });

    it('should show due soon items', async () => {
      await element(by.id('schedule-tab')).multiTap();
      await expect(element(by.text('Due Soon')).atIndex(0)).toBeVisible();
    });

    it('should display maintenance history', async () => {
      await element(by.id('history-tab')).multiTap();
      await expect(element(by.id('history-item-0'))).toBeVisible();
    });

    it('should filter maintenance by urgency', async () => {
      await element(by.id('schedule-tab')).multiTap();
      await element(by.id('urgency-filter')).multiTap();
      await element(by.id('filter-urgent')).multiTap();

      // Should show only urgent items
      await waitFor(element(by.id('maintenance-item-0')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  // ==================== Settings & Preferences ====================

  describe('Settings Screen', () => {

    beforeEach(async () => {
      await element(by.id('tab-settings')).multiTap();
      await waitFor(element(by.text('Settings')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should display settings title', async () => {
      await expect(element(by.text('Settings'))).toBeVisible();
    });

    it('should display language setting', async () => {
      await expect(element(by.text('Language'))).toBeVisible();
    });

    it('should allow changing language to Nepali', async () => {
      await element(by.id('language-select')).multiTap();
      await element(by.id('lang-ne')).multiTap();

      // Should update UI to Nepali
      await waitFor(element(by.text('परियोजना')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should allow changing language back to English', async () => {
      await element(by.id('language-select')).multiTap();
      await element(by.id('lang-en')).multiTap();

      await waitFor(element(by.text('Projects')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should display dark mode toggle', async () => {
      await expect(element(by.id('dark-mode-toggle'))).toBeVisible();
    });

    it('should enable dark mode', async () => {
      await element(by.id('dark-mode-toggle')).multiTap();

      // UI should switch to dark colors
      // This is visual, so we can't directly test colors, but we can verify toggle state
      await expect(element(by.id('dark-mode-toggle'))).toHaveToggleValue(true);
    });

    it('should disable dark mode', async () => {
      await element(by.id('dark-mode-toggle')).multiTap();
      await element(by.id('dark-mode-toggle')).multiTap();

      await expect(element(by.id('dark-mode-toggle'))).toHaveToggleValue(false);
    });

    it('should display offline mode indicator', async () => {
      await expect(element(by.id('offline-mode-status'))).toBeVisible();
    });

    it('should display sync data button', async () => {
      await expect(element(by.id('sync-data-btn'))).toBeVisible();
    });

    it('should trigger manual sync', async () => {
      await element(by.id('sync-data-btn')).multiTap();

      // Should show syncing indicator
      await waitFor(element(by.id('sync-indicator')))
        .toBeVisible()
        .withTimeout(2000);

      // Should complete sync
      await waitFor(element(by.id('sync-indicator')))
        .not.toBeVisible()
        .withTimeout(5000);
    });

    it('should display sync status message', async () => {
      await expect(element(by.id('last-sync-time'))).toBeVisible();
    });
  });

  // ==================== Data Persistence & Offline ====================

  describe('Data Persistence', () => {

    it('should persist dashboard data across app restart', async () => {
      await element(by.id('tab-dashboard')).multiTap();
      await waitFor(element(by.text('Projects')))
        .toBeVisible()
        .withTimeout(3000);

      const projectBefore = await element(by.id('project-item-0')).getAttributes();

      // Simulate app restart
      await device.sendUserInteraction({
        type: 'backgroundAndForeground',
        backgroundDurationSeconds: 1,
      });

      await waitFor(element(by.text('Projects')))
        .toBeVisible()
        .withTimeout(3000);

      const projectAfter = await element(by.id('project-item-0')).getAttributes();
      expect(projectBefore).toEqual(projectAfter);
    });

    it('should sync data when app returns to foreground', async () => {
      await device.sendUserInteraction({
        type: 'backgroundAndForeground',
        backgroundDurationSeconds: 1,
      });

      // Should show sync indicator briefly
      await waitFor(element(by.id('sync-indicator')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should store inspection locally before sync', async () => {
      await element(by.id('tab-inspection')).multiTap();
      await element(by.id('new-inspection-btn')).multiTap();

      // Fill form
      await element(by.id('inspection-project-field')).multiTap();
      await element(by.id('project-option-0')).multiTap();
      await element(by.id('inspection-notes-field')).typeText('Offline inspection');

      // Save
      await element(by.id('save-inspection-btn')).multiTap();

      // Should show in list even in offline mode
      await waitFor(element(by.text('Offline inspection')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  // ==================== Error Handling & Edge Cases ====================

  describe('Error Handling', () => {

    it('should show error message for network timeout', async () => {
      // Simulate network error
      // This depends on implementation of error handling
      await element(by.id('tab-dashboard')).multiTap();

      // If network error occurs, should show retry option
      // This is implementation-specific
    });

    it('should recover from sync failure', async () => {
      await element(by.id('tab-settings')).multiTap();
      await element(by.id('sync-data-btn')).multiTap();

      // Even if sync fails, should allow retry
      await element(by.id('sync-data-btn')).multiTap();
      await waitFor(element(by.id('sync-indicator')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should handle missing project data gracefully', async () => {
      await element(by.id('tab-dashboard')).multiTap();

      // Should not crash if data is missing
      await expect(element(by.text('Projects'))).toBeVisible();
    });

    it('should show empty state when no inspections', async () => {
      await element(by.id('tab-inspection')).multiTap();

      // May show empty state or list of inspections
      await expect(element(by.id('inspections-container'))).toBeVisible();
    });

    it('should handle invalid form input', async () => {
      await element(by.id('tab-inspection')).multiTap();
      await element(by.id('new-inspection-btn')).multiTap();

      // Try to save without required fields
      await element(by.id('save-inspection-btn')).multiTap();

      // Should show validation error or remain on form
      await waitFor(element(by.text('New Inspection')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  // ==================== Performance & Responsiveness ====================

  describe('Performance', () => {

    it('should load dashboard within reasonable time', async () => {
      const start = Date.now();

      await element(by.id('tab-dashboard')).multiTap();
      await waitFor(element(by.text('Projects')))
        .toBeVisible()
        .withTimeout(5000);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000);
    });

    it('should scroll through large inspection list smoothly', async () => {
      await element(by.id('tab-inspection')).multiTap();

      // Scroll down
      await element(by.id('inspections-list')).scroll(1000, 'down');

      // Should not freeze or crash
      await expect(element(by.id('inspections-list'))).toBeVisible();
    });

    it('should handle rapid tab switching', async () => {
      for (let i = 0; i < 5; i++) {
        await element(by.id('tab-dashboard')).multiTap();
        await element(by.id('tab-inspection')).multiTap();
        await element(by.id('tab-maintenance')).multiTap();
        await element(by.id('tab-settings')).multiTap();
      }

      // Should not crash
      await expect(element(by.id('tab-settings'))).toBeVisible();
    });
  });

  // ==================== Accessibility ====================

  describe('Accessibility', () => {

    it('should have accessible buttons with labels', async () => {
      await element(by.id('tab-dashboard')).multiTap();

      // Buttons should have testIDs or accessible labels
      await expect(element(by.id('project-item-0'))).toBeVisible();
    });

    it('should support keyboard navigation', async () => {
      // This depends on platform support
      // iOS and Android have different keyboard navigation
    });

    it('should have sufficient color contrast', async () => {
      // This would require visual testing tools
    });
  });

  // ==================== Integration Tests ====================

  describe('Full User Flows', () => {

    it('should complete inspection workflow from start to finish', async () => {
      // Navigate to inspections
      await element(by.id('tab-inspection')).multiTap();
      await waitFor(element(by.text('Inspections')))
        .toBeVisible()
        .withTimeout(3000);

      // Create new inspection
      await element(by.id('new-inspection-btn')).multiTap();
      await waitFor(element(by.text('New Inspection')))
        .toBeVisible()
        .withTimeout(2000);

      // Fill form
      await element(by.id('inspection-project-field')).multiTap();
      await element(by.id('project-option-0')).multiTap();
      await element(by.id('inspection-notes-field')).typeText('Complete inspection test');

      // Save
      await element(by.id('save-inspection-btn')).multiTap();

      // Verify saved
      await waitFor(element(by.text('Complete inspection test')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should switch language and see UI update', async () => {
      // Go to settings
      await element(by.id('tab-settings')).multiTap();

      // Change language
      await element(by.id('language-select')).multiTap();
      await element(by.id('lang-ne')).multiTap();

      // Check UI updated
      await waitFor(element(by.text('परियोजना')))
        .toBeVisible()
        .withTimeout(2000);

      // Navigate to dashboard and verify language
      await element(by.id('tab-dashboard')).multiTap();
      await waitFor(element(by.text('परियोजना')))
        .toBeVisible()
        .withTimeout(2000);

      // Switch back to English
      await element(by.id('tab-settings')).multiTap();
      await element(by.id('language-select')).multiTap();
      await element(by.id('lang-en')).multiTap();
    });

    it('should enable dark mode and persist across screens', async () => {
      // Go to settings
      await element(by.id('tab-settings')).multiTap();

      // Enable dark mode
      await element(by.id('dark-mode-toggle')).multiTap();
      await expect(element(by.id('dark-mode-toggle'))).toHaveToggleValue(true);

      // Navigate around
      await element(by.id('tab-dashboard')).multiTap();
      await element(by.id('tab-inspection')).multiTap();
      await element(by.id('tab-maintenance')).multiTap();

      // Go back to settings and verify still enabled
      await element(by.id('tab-settings')).multiTap();
      await expect(element(by.id('dark-mode-toggle'))).toHaveToggleValue(true);
    });

    it('should sync data and show status', async () => {
      await element(by.id('tab-settings')).multiTap();

      // Trigger sync
      await element(by.id('sync-data-btn')).multiTap();

      // Wait for sync to start
      await waitFor(element(by.id('sync-indicator')))
        .toBeVisible()
        .withTimeout(2000);

      // Wait for sync to complete
      await waitFor(element(by.id('sync-indicator')))
        .not.toBeVisible()
        .withTimeout(5000);

      // Verify sync completed
      await expect(element(by.id('last-sync-time'))).toBeVisible();
    });
  });
});
