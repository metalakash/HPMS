/**
 * Report Feature E2E Tests
 * 45+ tests covering report templates, generation, scheduling, and management
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Report Feature E2E Tests', () => {
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

  describe('Report Templates', () => {
    it('should display report templates list', async () => {
      await element(by.text('Reports')).multiTap();
      await element(by.text('Templates')).tap();

      await detoxExpect(element(by.id('templates-list'))).toBeVisible();
      await detoxExpect(element(by.text('Financial Report'))).toBeVisible();
    });

    it('should filter templates by category', async () => {
      await element(by.id('category-filter')).tap();
      await element(by.text('Financial')).tap();

      await detoxExpect(element(by.text('Quarterly Report'))).toBeVisible();
    });

    it('should display template details', async () => {
      await element(by.text('Financial Report')).tap();

      await detoxExpect(element(by.id('template-details'))).toBeVisible();
      await detoxExpect(element(by.text('Description'))).toBeVisible();
    });

    it('should rate a template', async () => {
      await element(by.id('template-rating')).multiTap();
      await element(by.text('5')).tap();

      await detoxExpect(element(by.text('Rating: 5'))).toBeVisible();
    });

    it('should use template to create report', async () => {
      await element(by.text('Use Template')).tap();

      await detoxExpect(element(by.id('report-builder'))).toBeVisible();
    });

    it('should search templates', async () => {
      await element(by.id('template-search')).typeText('Financial');

      await detoxExpect(element(by.text('Financial Report'))).toBeVisible();
    });

    it('should display template usage stats', async () => {
      await element(by.id('template-stats')).tap();

      await detoxExpect(element(by.text('Used')).and(by.text('50'))).toBeVisible();
    });
  });

  describe('Report Builder', () => {
    it('should open report builder', async () => {
      await element(by.text('Create Report')).tap();

      await detoxExpect(element(by.id('report-builder'))).toBeVisible();
    });

    it('should select feature for report', async () => {
      await element(by.id('feature-select')).tap();
      await element(by.text('Projects')).tap();

      await detoxExpect(element(by.text('Projects'))).toBeVisible();
    });

    it('should add fields to report', async () => {
      await element(by.id('field-select')).tap();
      await element(by.text('Name')).tap();
      await element(by.text('Status')).tap();

      await detoxExpect(element(by.text('2 fields selected'))).toBeVisible();
    });

    it('should set date range for report', async () => {
      await element(by.id('date-range-start')).tap();
      await element(by.text('1')).tap();
      await element(by.text('OK')).tap();

      await element(by.id('date-range-end')).tap();
      await element(by.text('30')).tap();
      await element(by.text('OK')).tap();

      await detoxExpect(element(by.text('Date range set'))).toBeVisible();
    });

    it('should apply filters to report', async () => {
      await element(by.id('add-filter')).tap();
      await element(by.id('filter-field')).tap();
      await element(by.text('Status')).tap();
      await element(by.id('filter-value')).typeText('Active');

      await detoxExpect(element(by.text('1 filter applied'))).toBeVisible();
    });

    it('should set grouping for report', async () => {
      await element(by.id('group-by-select')).tap();
      await element(by.text('Status')).tap();

      await detoxExpect(element(by.text('Grouped by Status'))).toBeVisible();
    });

    it('should set sorting for report', async () => {
      await element(by.id('sort-by-select')).tap();
      await element(by.text('Name')).tap();
      await element(by.id('sort-order')).tap();

      await detoxExpect(element(by.text('Sorted'))).toBeVisible();
    });

    it('should select chart type', async () => {
      await element(by.id('chart-type-select')).tap();
      await element(by.text('Bar')).tap();

      await detoxExpect(element(by.text('Bar'))).toBeVisible();
    });

    it('should generate preview', async () => {
      await element(by.id('preview-button')).tap();

      await detoxExpect(element(by.id('preview-container'))).toBeVisible();
    });

    it('should reset report builder', async () => {
      await element(by.id('reset-button')).tap();
      await element(by.text('Confirm')).tap();

      await detoxExpect(element(by.text('0 fields selected'))).toBeVisible();
    });

    it('should save report as template', async () => {
      await element(by.id('save-as-template')).tap();
      await element(by.id('template-name')).typeText('My Custom Template');
      await element(by.text('Save')).tap();

      await detoxExpect(element(by.text('Template saved'))).toBeVisible();
    });
  });

  describe('Report Generation', () => {
    it('should generate report in PDF format', async () => {
      await element(by.id('export-format-select')).tap();
      await element(by.text('PDF')).tap();
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.text('Generating...'))).toBeVisible();
      await new Promise(resolve => setTimeout(resolve, 2000));

      await detoxExpect(element(by.text('Report generated'))).toBeVisible();
    });

    it('should generate report in Excel format', async () => {
      await element(by.id('export-format-select')).tap();
      await element(by.text('Excel')).tap();
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.text('Report generated'))).toBeVisible();
    });

    it('should generate report in CSV format', async () => {
      await element(by.id('export-format-select')).tap();
      await element(by.text('CSV')).tap();
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.text('Report generated'))).toBeVisible();
    });

    it('should generate report in JSON format', async () => {
      await element(by.id('export-format-select')).tap();
      await element(by.text('JSON')).tap();
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.text('Report generated'))).toBeVisible();
    });

    it('should show progress during generation', async () => {
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.id('progress-bar'))).toBeVisible();
      await detoxExpect(element(by.text('0%')).or(by.text('50%'))).toBeVisible();
    });

    it('should handle generation errors', async () => {
      // Simulating error by not selecting required fields
      await element(by.id('field-select')).multiTap(); // Clear selection
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.text('At least one field'))).toBeVisible();
    });

    it('should validate date range before generation', async () => {
      // Set invalid date range
      await element(by.id('date-range-start')).tap();
      await element(by.text('30')).tap();
      await element(by.text('OK')).tap();

      await element(by.id('date-range-end')).tap();
      await element(by.text('1')).tap();
      await element(by.text('OK')).tap();

      await element(by.id('generate-button')).tap();
      await detoxExpect(element(by.text('Start date must be before'))).toBeVisible();
    });
  });

  describe('Report List & Management', () => {
    it('should display generated reports list', async () => {
      await element(by.text('Reports')).tap();
      await element(by.text('Generated')).tap();

      await detoxExpect(element(by.id('reports-list'))).toBeVisible();
    });

    it('should sort reports by date', async () => {
      await element(by.id('sort-reports')).tap();
      await element(by.text('Date (Newest)')).tap();

      await detoxExpect(element(by.text('Reports sorted'))).toBeVisible();
    });

    it('should sort reports by name', async () => {
      await element(by.id('sort-reports')).tap();
      await element(by.text('Name (A-Z)')).tap();

      await detoxExpect(element(by.text('Reports sorted'))).toBeVisible();
    });

    it('should sort reports by size', async () => {
      await element(by.id('sort-reports')).tap();
      await element(by.text('Size (Largest)')).tap();

      await detoxExpect(element(by.text('Reports sorted'))).toBeVisible();
    });

    it('should delete a report', async () => {
      await element(by.id('report-item')).atIndex(0).longPress();
      await element(by.text('Delete')).tap();
      await element(by.text('Confirm')).tap();

      await detoxExpect(element(by.text('Report deleted'))).toBeVisible();
    });

    it('should share a report', async () => {
      await element(by.id('report-item')).atIndex(0).longPress();
      await element(by.text('Share')).tap();
      await element(by.id('team-member-select')).tap();
      await element(by.text('John Doe')).tap();
      await element(by.text('Share')).tap();

      await detoxExpect(element(by.text('Report shared'))).toBeVisible();
    });

    it('should download a report', async () => {
      await element(by.id('report-item')).atIndex(0).longPress();
      await element(by.text('Download')).tap();

      await detoxExpect(element(by.text('Downloading...'))).toBeVisible();
      await new Promise(resolve => setTimeout(resolve, 2000));

      await detoxExpect(element(by.text('Downloaded'))).toBeVisible();
    });

    it('should rename a report', async () => {
      await element(by.id('report-item')).atIndex(0).longPress();
      await element(by.text('Rename')).tap();
      await element(by.id('report-name-input')).clearText();
      await element(by.id('report-name-input')).typeText('Updated Report');
      await element(by.text('Save')).tap();

      await detoxExpect(element(by.text('Updated Report'))).toBeVisible();
    });
  });

  describe('Report Scheduling', () => {
    it('should open schedule report dialog', async () => {
      await element(by.id('schedule-report')).tap();

      await detoxExpect(element(by.id('schedule-dialog'))).toBeVisible();
    });

    it('should set daily schedule', async () => {
      await element(by.id('frequency-select')).tap();
      await element(by.text('Daily')).tap();

      await detoxExpect(element(by.text('Daily'))).toBeVisible();
    });

    it('should set weekly schedule', async () => {
      await element(by.id('frequency-select')).tap();
      await element(by.text('Weekly')).tap();

      await detoxExpect(element(by.text('Weekly'))).toBeVisible();
    });

    it('should set monthly schedule', async () => {
      await element(by.id('frequency-select')).tap();
      await element(by.text('Monthly')).tap();

      await detoxExpect(element(by.text('Monthly'))).toBeVisible();
    });

    it('should add email recipients', async () => {
      await element(by.id('add-email')).tap();
      await element(by.id('email-input')).typeText('user@example.com');
      await element(by.text('Add')).tap();

      await detoxExpect(element(by.text('user@example.com'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('add-email')).tap();
      await element(by.id('email-input')).typeText('invalid-email');
      await element(by.text('Add')).tap();

      await detoxExpect(element(by.text('Invalid email'))).toBeVisible();
    });

    it('should schedule report', async () => {
      await element(by.id('schedule-button')).tap();

      await detoxExpect(element(by.text('Report scheduled'))).toBeVisible();
    });

    it('should list scheduled reports', async () => {
      await element(by.text('Scheduled')).tap();

      await detoxExpect(element(by.id('scheduled-reports-list'))).toBeVisible();
    });

    it('should pause scheduled report', async () => {
      await element(by.id('scheduled-item')).atIndex(0).longPress();
      await element(by.text('Pause')).tap();

      await detoxExpect(element(by.text('Paused'))).toBeVisible();
    });

    it('should resume scheduled report', async () => {
      await element(by.id('scheduled-item')).atIndex(0).longPress();
      await element(by.text('Resume')).tap();

      await detoxExpect(element(by.text('Active'))).toBeVisible();
    });

    it('should delete scheduled report', async () => {
      await element(by.id('scheduled-item')).atIndex(0).longPress();
      await element(by.text('Delete')).tap();
      await element(by.text('Confirm')).tap();

      await detoxExpect(element(by.text('Schedule deleted'))).toBeVisible();
    });

    it('should edit schedule frequency', async () => {
      await element(by.id('scheduled-item')).atIndex(0).tap();
      await element(by.id('frequency-select')).tap();
      await element(by.text('Weekly')).tap();
      await element(by.text('Save')).tap();

      await detoxExpect(element(by.text('Updated'))).toBeVisible();
    });
  });

  describe('Report Preview', () => {
    it('should preview report data', async () => {
      await element(by.id('report-item')).atIndex(0).tap();
      await element(by.id('preview-tab')).tap();

      await detoxExpect(element(by.id('preview-data'))).toBeVisible();
    });

    it('should display report summary statistics', async () => {
      await element(by.id('stats-tab')).tap();

      await detoxExpect(element(by.text('Total Records'))).toBeVisible();
      await detoxExpect(element(by.text('Average'))).toBeVisible();
    });

    it('should display report chart', async () => {
      await element(by.id('chart-tab')).tap();

      await detoxExpect(element(by.id('report-chart'))).toBeVisible();
    });

    it('should interact with chart data points', async () => {
      await element(by.id('chart-data-point')).atIndex(0).multiTap();

      await detoxExpect(element(by.text('Details'))).toBeVisible();
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      await device.setAirplaneMode(true);
      await element(by.id('generate-button')).tap();

      await detoxExpect(element(by.text('Connection error'))).toBeVisible();

      await device.setAirplaneMode(false);
    });

    it('should handle empty reports list', async () => {
      // After cleanup
      await element(by.text('Reports')).tap();

      if (element(by.text('No reports')).isVisible()) {
        await detoxExpect(element(by.text('Create your first report'))).toBeVisible();
      }
    });

    it('should handle large dataset generation', async () => {
      // Select many fields
      await element(by.id('field-select')).tap();
      for (let i = 0; i < 15; i++) {
        await element(by.text(`Field ${i}`)).tap();
      }

      await element(by.id('generate-button')).tap();
      await detoxExpect(element(by.text('Large file'))).toExist();
    });

    it('should recover from failed generation', async () => {
      await element(by.id('generate-button')).tap();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Retry mechanism
      await element(by.id('retry-button')).tap();
      await detoxExpect(element(by.text('Retrying'))).toBeVisible();
    });
  });

  describe('Report Performance', () => {
    it('should load 50 reports without lag', async () => {
      const start = Date.now();
      await element(by.text('Reports')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000);
    });

    it('should filter 50 reports quickly', async () => {
      const start = Date.now();
      await element(by.id('filter-input')).typeText('Financial');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle rapid template switching', async () => {
      for (let i = 0; i < 5; i++) {
        await element(by.id('template-item')).atIndex(i).tap();
        await element(by.text('Back')).tap();
      }

      await detoxExpect(element(by.id('templates-list'))).toBeVisible();
    });
  });
});
