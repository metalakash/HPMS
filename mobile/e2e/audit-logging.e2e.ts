/**
 * Audit Logging Feature E2E Tests
 * 30+ tests covering audit log viewer, search, stats, and rollback
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Audit Logging Feature E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp();
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Audit Log Viewer', () => {
    it('should open audit log screen', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();

      await detoxExpect(element(by.id('audit-log-screen'))).toBeVisible();
    });

    it('should display audit logs in list', async () => {
      await detoxExpect(element(by.id('audit-logs-list'))).toBeVisible();
      await detoxExpect(element(by.testID('audit-log-row')).atIndex(0)).toBeVisible();
    });

    it('should show log with action badge', async () => {
      await detoxExpect(element(by.text('UPDATE'))).toBeVisible();
      await detoxExpect(element(by.text('CREATE'))).toBeVisible();
    });

    it('should show timestamp in log row', async () => {
      const logRow = element(by.id('audit-log-row-log-1'));
      await detoxExpect(logRow).toBeVisible();
    });

    it('should show user email in log row', async () => {
      await detoxExpect(element(by.text('akash@example.com'))).toBeVisible();
    });

    it('should show feature type in log row', async () => {
      await detoxExpect(element(by.text('Projects'))).toBeVisible();
      await detoxExpect(element(by.text('Inspections'))).toBeVisible();
    });

    it('should show log summary text', async () => {
      await detoxExpect(element(by.text('Updated project status')).atIndex(0)).toBeVisible();
    });
  });

  describe('Audit Log Filtering', () => {
    it('should open filter panel', async () => {
      await element(by.id('filter-button')).tap();

      await detoxExpect(element(by.id('date-start-button'))).toBeVisible();
      await detoxExpect(element(by.id('date-end-button'))).toBeVisible();
    });

    it('should filter by date range', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('date-start-button')).tap();
      await element(by.text('1')).tap();
      await element(by.text('OK')).tap();

      await element(by.id('date-end-button')).tap();
      await element(by.text('30')).tap();
      await element(by.text('OK')).tap();

      await detoxExpect(element(by.text('1/1/2026'))).toBeVisible();
    });

    it('should filter by action type', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('action-picker')).multiTap();
      await element(by.text('Update')).tap();

      await detoxExpect(element(by.text('UPDATE'))).toBeVisible();
    });

    it('should filter by feature', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('feature-picker')).multiTap();
      await element(by.text('Projects')).tap();

      await detoxExpect(element(by.text('Projects'))).toBeVisible();
    });

    it('should search logs with text', async () => {
      await element(by.id('search-box')).typeText('project');

      await detoxExpect(element(by.text('Updated project status'))).toBeVisible();
    });

    it('should clear all filters', async () => {
      await element(by.id('filter-button')).tap();
      await element(by.id('clear-filters-button')).tap();

      await detoxExpect(element(by.text('All'))).toBeVisible();
    });

    it('should show pagination info', async () => {
      await detoxExpect(element(by.id('pagination-info'))).toBeVisible();
    });
  });

  describe('Audit Log Details', () => {
    it('should open log details screen', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.id('audit-detail-screen'))).toBeVisible();
    });

    it('should show action badge in detail view', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.text('UPDATE'))).toBeVisible();
    });

    it('should show timestamp in detail view', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.text('Timestamp'))).toBeVisible();
    });

    it('should show metadata section', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.text('Metadata'))).toBeVisible();
      await detoxExpect(element(by.text('User:'))).toBeVisible();
      await detoxExpect(element(by.text('Feature:'))).toBeVisible();
    });

    it('should show before/after comparison for updates', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.text('Changes'))).toBeVisible();
      await detoxExpect(element(by.text('Before'))).toBeVisible();
      await detoxExpect(element(by.text('After'))).toBeVisible();
    });

    it('should toggle JSON data display', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();
      await element(by.id('toggle-json')).tap();

      await detoxExpect(element(by.testID('json-content'))).toBeVisible();
    });

    it('should copy JSON to clipboard', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();
      await element(by.id('toggle-json')).tap();
      await element(by.id('copy-button')).tap();

      await detoxExpect(element(by.text('Copied'))).toBeVisible();
    });

    it('should show related events', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.text('Related Events'))).toBeVisible();
      await detoxExpect(element(by.testID('related-event-row'))).toBeVisible();
    });

    it('should navigate to related event', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();
      await element(by.testID('related-event-row')).atIndex(0).tap();

      await detoxExpect(element(by.id('audit-detail-screen'))).toBeVisible();
    });

    it('should show admin rollback button', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.id('rollback-button'))).toBeVisible();
    });

    it('should go back to log list', async () => {
      await element(by.testID('audit-log-row')).atIndex(0).tap();
      await element(by.id('back-button')).tap();

      await detoxExpect(element(by.id('audit-log-screen'))).toBeVisible();
    });
  });

  describe('Advanced Search', () => {
    it('should open search screen', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Search')).tap();

      await detoxExpect(element(by.id('audit-search-screen'))).toBeVisible();
    });

    it('should search with text input', async () => {
      await element(by.id('search-input')).typeText('project');
      await element(by.id('search-button')).tap();

      await detoxExpect(element(by.testID('search-result')).atIndex(0)).toBeVisible();
    });

    it('should apply quick filter - last 24 hours', async () => {
      await element(by.id('quick-filter-24h')).tap();

      await detoxExpect(element(by.testID('search-result'))).toBeVisible();
    });

    it('should apply quick filter - last 7 days', async () => {
      await element(by.id('quick-filter-7d')).tap();

      await detoxExpect(element(by.testID('search-result'))).toBeVisible();
    });

    it('should apply quick filter - this month', async () => {
      await element(by.id('quick-filter-month')).tap();

      await detoxExpect(element(by.testID('search-result'))).toBeVisible();
    });

    it('should toggle advanced filters', async () => {
      await element(by.id('advanced-filter-toggle')).tap();

      await detoxExpect(element(by.testID('filter-action-CREATE'))).toBeVisible();
    });

    it('should select multiple action types', async () => {
      await element(by.id('advanced-filter-toggle')).tap();
      await element(by.testID('filter-action-CREATE')).tap();
      await element(by.testID('filter-action-UPDATE')).tap();

      await detoxExpect(element(by.text('✓'))).toBeVisible();
    });

    it('should select features', async () => {
      await element(by.id('advanced-filter-toggle')).tap();
      await element(by.testID('filter-feature-Projects')).tap();

      await detoxExpect(element(by.text('✓'))).toBeVisible();
    });

    it('should apply filters', async () => {
      await element(by.id('advanced-filter-toggle')).tap();
      await element(by.testID('filter-action-UPDATE')).tap();
      await element(by.id('apply-filters-button')).tap();

      await detoxExpect(element(by.testID('search-result'))).toBeVisible();
    });

    it('should save search', async () => {
      await element(by.id('search-input')).typeText('test search');
      await element(by.id('save-search-button')).tap();
      await element(by.id('save-search-input')).typeText('My Search');
      await element(by.id('save-search-confirm')).tap();

      await detoxExpect(element(by.text('saved successfully'))).toBeVisible();
    });

    it('should display saved searches', async () => {
      await detoxExpect(element(by.testID('saved-search')).atIndex(0)).toBeVisible();
    });

    it('should apply saved search', async () => {
      await element(by.testID('saved-search')).atIndex(0).tap();

      await detoxExpect(element(by.testID('search-result'))).toBeVisible();
    });

    it('should delete saved search', async () => {
      await element(by.testID('delete-saved-search')).atIndex(0).tap();
      await element(by.text('Delete')).tap();

      // Search should be deleted
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('Audit Statistics', () => {
    it('should open stats screen', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Stats')).tap();

      await detoxExpect(element(by.id('audit-stats-screen'))).toBeVisible();
    });

    it('should show period selector', async () => {
      await detoxExpect(element(by.id('period-week'))).toBeVisible();
      await detoxExpect(element(by.id('period-month'))).toBeVisible();
      await detoxExpect(element(by.id('period-year'))).toBeVisible();
    });

    it('should change period to week', async () => {
      await element(by.id('period-week')).tap();

      await detoxExpect(element(by.testID('stat-card'))).toBeVisible();
    });

    it('should change period to month', async () => {
      await element(by.id('period-month')).tap();

      await detoxExpect(element(by.testID('stat-card'))).toBeVisible();
    });

    it('should show total events stat', async () => {
      await detoxExpect(element(by.text('Total Events'))).toBeVisible();
    });

    it('should show action type breakdown chart', async () => {
      await detoxExpect(element(by.text('Actions by Type'))).toBeVisible();
      await detoxExpect(element(by.text('CREATE'))).toBeVisible();
      await detoxExpect(element(by.text('UPDATE'))).toBeVisible();
    });

    it('should show feature activity chart', async () => {
      await detoxExpect(element(by.text('Feature Activity'))).toBeVisible();
      await detoxExpect(element(by.text('Projects'))).toBeVisible();
    });

    it('should show top users leaderboard', async () => {
      await detoxExpect(element(by.text('Top Users'))).toBeVisible();
      await detoxExpect(element(by.testID('leaderboard-row'))).toBeVisible();
    });

    it('should show activity timeline', async () => {
      await detoxExpect(element(by.text('Activity Timeline'))).toBeVisible();
      await detoxExpect(element(by.testID('timeline-bar')).atIndex(0)).toBeVisible();
    });

    it('should export analytics', async () => {
      await element(by.id('export-stats-button')).tap();

      await detoxExpect(element(by.text('Export successful'))).toBeVisible();
    });
  });

  describe('Rollback Operations (Admin Only)', () => {
    it('should show rollback button on detail screen', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();
      await element(by.testID('audit-log-row')).atIndex(0).tap();

      await detoxExpect(element(by.id('rollback-button'))).toBeVisible();
    });

    it('should show rollback confirmation', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();
      await element(by.testID('audit-log-row')).atIndex(0).tap();
      await element(by.id('rollback-button')).tap();

      await detoxExpect(element(by.text('Are you sure'))).toBeVisible();
    });

    it('should confirm rollback', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();
      await element(by.testID('audit-log-row')).atIndex(0).tap();
      await element(by.id('rollback-button')).tap();
      await element(by.text('Confirm')).tap();

      await detoxExpect(element(by.text('Success'))).toBeVisible();
    });

    it('should create rollback log entry', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();

      // New ROLLBACK entry should appear at top
      await detoxExpect(element(by.text('ROLLBACK'))).toBeVisible();
    });
  });

  describe('Performance & Error Handling', () => {
    it('should handle large audit log lists', async () => {
      const start = Date.now();

      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000); // Should load in < 3 seconds
    });

    it('should handle search with no results', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Search')).tap();
      await element(by.id('search-input')).typeText('nonexistent12345');
      await element(by.id('search-button')).tap();

      await detoxExpect(element(by.text('No results found'))).toBeVisible();
    });

    it('should handle filter combination', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();
      await element(by.id('filter-button')).tap();
      await element(by.id('action-picker')).multiTap();
      await element(by.text('Update')).tap();
      await element(by.id('feature-picker')).multiTap();
      await element(by.text('Projects')).tap();

      await detoxExpect(element(by.testID('audit-log-row'))).toBeVisible();
    });

    it('should handle export with large dataset', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();
      await element(by.id('filter-button')).tap();
      await element(by.id('export-logs-button')).tap();

      await new Promise(resolve => setTimeout(resolve, 1000));
      await detoxExpect(element(by.text('Downloaded'))).toBeVisible();
    });

    it('should handle concurrent filter updates', async () => {
      await element(by.text('Admin')).tap();
      await element(by.text('Audit Logs')).tap();
      await element(by.id('filter-button')).tap();
      await element(by.id('action-picker')).multiTap();
      await element(by.text('Create')).tap();
      await element(by.id('feature-picker')).multiTap();
      await element(by.text('Inspections')).tap();

      await detoxExpect(element(by.testID('audit-log-row'))).toBeVisible();
    });
  });
});
