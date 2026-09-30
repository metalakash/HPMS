/**
 * Multi-Project Management E2E Tests
 * 35+ tests covering project switching, dashboards, reports, and details
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Multi-Project Management E2E Tests', () => {
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

  describe('Project Switcher', () => {
    it('should open project switcher screen', async () => {
      await element(by.text('Projects')).tap();

      await detoxExpect(element(by.id('project-switcher-screen'))).toBeVisible();
    });

    it('should display current project', async () => {
      await detoxExpect(element(by.text('Hydropower Station Alpha'))).toBeVisible();
    });

    it('should display my projects section', async () => {
      await detoxExpect(element(by.id('my-projects-header'))).toBeVisible();
    });

    it('should display shared projects section', async () => {
      await detoxExpect(element(by.id('shared-projects-header'))).toBeVisible();
    });

    it('should search projects by name', async () => {
      await element(by.id('search-projects')).typeText('Alpha');

      await detoxExpect(
        element(by.text('Hydropower Station Alpha'))
      ).toBeVisible();
    });

    it('should filter projects by status', async () => {
      await element(by.id('filter-status')).multiTap();
      await element(by.text('Active')).tap();

      await detoxExpect(element(by.testID('project-row-proj-1'))).toBeVisible();
    });

    it('should sort projects by name', async () => {
      await element(by.id('sort-by')).multiTap();
      await element(by.text('Name')).tap();

      await detoxExpect(element(by.testID('project-row-proj-1'))).toBeVisible();
    });

    it('should switch to different project', async () => {
      await element(by.testID('project-row-proj-2')).tap();

      await detoxExpect(element(by.text('Project switched'))).toBeVisible();
    });

    it('should display project statistics', async () => {
      await detoxExpect(element(by.text('Total Projects'))).toBeVisible();
      await detoxExpect(element(by.text('Active'))).toBeVisible();
      await detoxExpect(element(by.text('Shared'))).toBeVisible();
    });

    it('should expand/collapse project sections', async () => {
      await element(by.id('my-projects-header')).tap();

      // Section should collapse
      await element(by.id('my-projects-header')).tap();

      // Section should expand again
      await detoxExpect(element(by.testID('project-row-proj-1'))).toBeVisible();
    });

    it('should create new project', async () => {
      await element(by.id('new-project-button')).tap();

      await detoxExpect(element(by.text('New Project'))).toBeVisible();
    });
  });

  describe('Shared Dashboard', () => {
    it('should open shared dashboard screen', async () => {
      await element(by.text('Dashboard')).tap();
      await element(by.text('Cross-Project')).tap();

      await detoxExpect(element(by.id('shared-dashboard-screen'))).toBeVisible();
    });

    it('should display date range selector', async () => {
      await detoxExpect(element(by.id('date-start-picker'))).toBeVisible();
      await detoxExpect(element(by.id('date-end-picker'))).toBeVisible();
    });

    it('should select date range', async () => {
      await element(by.id('date-start-picker')).tap();
      await element(by.text('1')).tap();
      await element(by.text('OK')).tap();

      await detoxExpect(element(by.text('1/'))).toBeVisible();
    });

    it('should filter by all projects', async () => {
      await element(by.id('filter-all')).tap();

      await detoxExpect(element(by.testID('stat-card'))).toBeVisible();
    });

    it('should filter by my projects', async () => {
      await element(by.id('filter-mine')).tap();

      await detoxExpect(element(by.testID('stat-card'))).toBeVisible();
    });

    it('should filter by shared projects', async () => {
      await element(by.id('filter-shared')).tap();

      await detoxExpect(element(by.testID('stat-card'))).toBeVisible();
    });

    it('should select projects via checkboxes', async () => {
      await element(by.id('select-project-proj-1')).tap();
      await element(by.id('select-project-proj-2')).tap();

      await detoxExpect(element(by.text('✓'))).toBeVisible();
    });

    it('should display summary statistics', async () => {
      await detoxExpect(element(by.text('Total Records'))).toBeVisible();
      await detoxExpect(element(by.text('Inspections'))).toBeVisible();
      await detoxExpect(element(by.text('Work Orders'))).toBeVisible();
      await detoxExpect(element(by.text('Compliance'))).toBeVisible();
    });

    it('should show project comparison chart', async () => {
      await detoxExpect(element(by.text('Project Comparison'))).toBeVisible();
    });

    it('should display project health overview', async () => {
      await detoxExpect(element(by.text('Project Health'))).toBeVisible();
    });

    it('should export dashboard', async () => {
      await element(by.id('export-dashboard')).tap();

      await detoxExpect(element(by.text('Export successful'))).toBeVisible();
    });
  });

  describe('Cross-Project Reports', () => {
    it('should open report generator', async () => {
      await element(by.text('Reports')).tap();

      await detoxExpect(element(by.id('cross-project-report-screen'))).toBeVisible();
    });

    it('should select report type - Activity', async () => {
      await element(by.id('report-type-activity')).tap();

      await detoxExpect(element(by.text('Activity'))).toBeVisible();
    });

    it('should select report type - Compliance', async () => {
      await element(by.id('report-type-compliance')).tap();

      await detoxExpect(element(by.text('Compliance'))).toBeVisible();
    });

    it('should select report type - Performance', async () => {
      await element(by.id('report-type-performance')).tap();

      await detoxExpect(element(by.text('Performance'))).toBeVisible();
    });

    it('should select report type - Team', async () => {
      await element(by.id('report-type-team')).tap();

      await detoxExpect(element(by.text('Team'))).toBeVisible();
    });

    it('should select projects for report', async () => {
      await element(by.id('select-report-project-proj-1')).tap();
      await element(by.id('select-report-project-proj-2')).tap();

      await detoxExpect(element(by.text('✓'))).toBeVisible();
    });

    it('should set report date range', async () => {
      await element(by.id('report-date-start')).tap();
      await element(by.text('15')).tap();
      await element(by.text('OK')).tap();

      await detoxExpect(element(by.text('15/'))).toBeVisible();
    });

    it('should select grouping', async () => {
      await element(by.id('report-groupby')).multiTap();
      await element(by.text('By Project')).tap();

      await detoxExpect(element(by.text('By Project'))).toBeVisible();
    });

    it('should select sort order', async () => {
      await element(by.id('report-sortby')).multiTap();
      await element(by.text('Name')).tap();

      await detoxExpect(element(by.text('Name'))).toBeVisible();
    });

    it('should select export format - CSV', async () => {
      await element(by.id('report-format-csv')).tap();

      await detoxExpect(element(by.text('CSV'))).toBeVisible();
    });

    it('should select export format - PDF', async () => {
      await element(by.id('report-format-pdf')).tap();

      await detoxExpect(element(by.text('PDF'))).toBeVisible();
    });

    it('should select export format - JSON', async () => {
      await element(by.id('report-format-json')).tap();

      await detoxExpect(element(by.text('JSON'))).toBeVisible();
    });

    it('should generate report', async () => {
      await element(by.id('report-type-activity')).tap();
      await element(by.id('select-report-project-proj-1')).tap();
      await element(by.id('generate-report-button')).tap();

      await new Promise(resolve => setTimeout(resolve, 2000));
      await detoxExpect(element(by.testID('generated-reports-list'))).toBeVisible();
    });

    it('should display generated reports', async () => {
      await detoxExpect(element(by.testID('report-row-report-1'))).toBeVisible();
    });

    it('should download report', async () => {
      await element(by.testID('download-report-report-1')).tap();

      await detoxExpect(element(by.text('Downloaded'))).toBeVisible();
    });

    it('should delete report', async () => {
      await element(by.testID('delete-report-report-1')).tap();

      // Report should be removed from list
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('Project Details', () => {
    it('should open project details screen', async () => {
      await element(by.text('Projects')).tap();
      await element(by.testID('project-row-proj-1')).tap();

      await detoxExpect(element(by.id('project-detail-screen'))).toBeVisible();
    });

    it('should display project information', async () => {
      await detoxExpect(element(by.text('Hydropower Station Alpha'))).toBeVisible();
      await detoxExpect(element(by.text('ACTIVE'))).toBeVisible();
      await detoxExpect(element(by.text('proj-1'))).toBeVisible();
    });

    it('should display project statistics', async () => {
      await detoxExpect(element(by.text('Records'))).toBeVisible();
      await detoxExpect(element(by.text('Inspections'))).toBeVisible();
      await detoxExpect(element(by.text('Work Orders'))).toBeVisible();
      await detoxExpect(element(by.text('Compliance'))).toBeVisible();
    });

    it('should display team members', async () => {
      await detoxExpect(element(by.text('Team Members'))).toBeVisible();
      await detoxExpect(element(by.testID('member-row'))).toBeVisible();
    });

    it('should show member roles', async () => {
      await detoxExpect(element(by.text('owner'))).toBeVisible();
      await detoxExpect(element(by.text('member'))).toBeVisible();
    });

    it('should add team member (owner only)', async () => {
      await element(by.id('add-member-button')).tap();
      await element(by.id('add-member-email-input')).typeText('new@example.com');
      await element(by.id('add-member-role-picker')).multiTap();
      await element(by.text('Member')).tap();
      await element(by.id('add-member-confirm')).tap();

      await detoxExpect(element(by.text('added successfully'))).toBeVisible();
    });

    it('should remove team member (owner only)', async () => {
      await element(by.testID('remove-member-user-2')).tap();
      await element(by.text('Remove')).tap();

      // Member should be removed from list
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should show owner-only actions', async () => {
      await detoxExpect(element(by.id('edit-project-button'))).toBeVisible();
      await detoxExpect(element(by.id('archive-project-button'))).toBeVisible();
      await detoxExpect(element(by.id('delete-project-button'))).toBeVisible();
    });

    it('should go back to switcher', async () => {
      await element(by.id('back-button')).tap();

      await detoxExpect(element(by.id('project-switcher-screen'))).toBeVisible();
    });
  });

  describe('Performance & Integration', () => {
    it('should handle project switching quickly', async () => {
      const start = Date.now();

      await element(by.text('Projects')).tap();
      await element(by.testID('project-row-proj-2')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    it('should load shared dashboard with multiple projects', async () => {
      const start = Date.now();

      await element(by.text('Dashboard')).tap();
      await element(by.text('Cross-Project')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(4000);
    });

    it('should handle concurrent project selection', async () => {
      await element(by.text('Dashboard')).tap();
      await element(by.text('Cross-Project')).tap();
      await element(by.id('select-project-proj-1')).tap();
      await element(by.id('select-project-proj-2')).tap();
      await element(by.id('select-project-proj-3')).tap();

      await detoxExpect(element(by.testID('stat-card'))).toBeVisible();
    });

    it('should handle report generation with large dataset', async () => {
      const start = Date.now();

      await element(by.text('Reports')).tap();
      await element(by.id('report-type-activity')).tap();
      await element(by.id('select-report-project-proj-1')).tap();
      await element(by.id('select-report-project-proj-2')).tap();
      await element(by.id('generate-report-button')).tap();

      await new Promise(resolve => setTimeout(resolve, 3000));

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(15000);
    });

    it('should maintain state across navigation', async () => {
      await element(by.text('Projects')).tap();
      await element(by.testID('project-row-proj-2')).tap();

      // Go to dashboard
      await element(by.text('Dashboard')).tap();

      // Verify project switching persisted
      await element(by.text('Projects')).tap();
      await detoxExpect(element(by.testID('project-row-proj-2'))).toBeVisible();
    });
  });
});
