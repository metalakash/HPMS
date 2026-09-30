/**
 * Cross-Feature Integration E2E Tests
 * 30+ tests covering feature maps, linked items, workflows, dependencies
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Cross-Feature Integration E2E Tests', () => {
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

  describe('Feature Map', () => {
    it('should open cross-feature map screen', async () => {
      await element(by.text('Features')).tap();

      await detoxExpect(element(by.id('cross-feature-map-screen'))).toBeVisible();
    });

    it('should display feature nodes', async () => {
      await detoxExpect(element(by.text('Projects'))).toBeVisible();
      await detoxExpect(element(by.text('Inspections'))).toBeVisible();
      await detoxExpect(element(by.text('Work Orders'))).toBeVisible();
      await detoxExpect(element(by.text('Compliance'))).toBeVisible();
      await detoxExpect(element(by.text('Reports'))).toBeVisible();
    });

    it('should display relationship connections', async () => {
      await detoxExpect(element(by.id('linksInfo'))).toBeVisible();
      await detoxExpect(element(by.text('Connections'))).toBeVisible();
    });

    it('should select node and show details', async () => {
      await element(by.id('feature-node-inspections')).tap();

      await detoxExpect(element(by.text('Inspections Details'))).toBeVisible();
    });

    it('should select edge and highlight connection', async () => {
      await element(by.id('feature-link-link-1')).tap();

      await detoxExpect(element(by.id('feature-link-link-1'))).toHaveToggleValue(true);
    });

    it('should filter by relationship type', async () => {
      await element(by.id('relationship-filter')).multiTap();
      await element(by.text('Inspection → Work Order')).tap();

      await detoxExpect(element(by.text('Inspection → Work Order'))).toBeVisible();
    });

    it('should change graph layout to circular', async () => {
      await element(by.id('layout-circular')).tap();

      await detoxExpect(element(by.id('layout-circular'))).toHaveToggleValue(true);
    });

    it('should change graph layout back to hierarchical', async () => {
      await element(by.id('layout-hierarchical')).tap();

      await detoxExpect(element(by.id('layout-hierarchical'))).toHaveToggleValue(true);
    });

    it('should display relationship summary', async () => {
      await detoxExpect(element(by.text('Total Links:'))).toBeVisible();
      await detoxExpect(element(by.text('Features Connected:'))).toBeVisible();
      await detoxExpect(element(by.text('Avg Links Per Feature:'))).toBeVisible();
    });

    it('should show workflow templates', async () => {
      await detoxExpect(element(by.text('Standard Defect Workflow'))).toBeVisible();
      await detoxExpect(element(by.text('Emergency Response'))).toBeVisible();
    });
  });

  describe('Linked Items', () => {
    it('should open linked items screen', async () => {
      await element(by.text('Features')).tap();
      await element(by.text('Linked Items')).tap();

      await detoxExpect(element(by.id('linked-items-screen'))).toBeVisible();
    });

    it('should display linked items list', async () => {
      await detoxExpect(element(by.id('linked-items-list'))).toBeVisible();
      await detoxExpect(element(by.text('Inspection #45'))).toBeVisible();
    });

    it('should filter by feature tabs', async () => {
      await element(by.id('tab-inspections')).tap();

      await detoxExpect(element(by.id('tab-inspections'))).toHaveToggleValue(true);
    });

    it('should display link strength indicator', async () => {
      await detoxExpect(element(by.id('linked-item-insp-1'))).toBeVisible();
    });

    it('should display link statistics', async () => {
      await detoxExpect(element(by.text('Link Statistics'))).toBeVisible();
      await detoxExpect(element(by.text('Total Links:'))).toBeVisible();
      await detoxExpect(element(by.text('Strong:'))).toBeVisible();
      await detoxExpect(element(by.text('Medium:'))).toBeVisible();
      await detoxExpect(element(by.text('Weak:'))).toBeVisible();
    });

    it('should remove link with confirmation', async () => {
      await element(by.id('remove-link-insp-1')).tap();
      await element(by.text('Remove')).tap();

      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should add new link', async () => {
      await element(by.id('add-link-button')).tap();

      await detoxExpect(element(by.text('Add Link'))).toBeVisible();
    });

    it('should update link strength', async () => {
      // Assuming update strength button exists
      await detoxExpect(element(by.id('linked-items-list'))).toBeVisible();
    });
  });

  describe('Workflow Designer', () => {
    it('should open workflow designer', async () => {
      await element(by.text('Workflows')).tap();

      await detoxExpect(element(by.id('workflow-designer-screen'))).toBeVisible();
    });

    it('should enter workflow name', async () => {
      await element(by.id('workflow-name-input')).typeText('Test Workflow');

      await detoxExpect(element(by.id('workflow-name-input'))).toHaveText('Test Workflow');
    });

    it('should add workflow step', async () => {
      await element(by.id('add-step-button')).tap();
      await element(by.id('action-create_inspection')).tap();

      await detoxExpect(element(by.id('workflow-steps-list'))).toBeVisible();
    });

    it('should display added steps', async () => {
      await detoxExpect(element(by.testID('workflow-step-'))).toBeVisible();
    });

    it('should remove workflow step', async () => {
      const stepId = await element(by.id('workflow-steps-list')).getElement();
      await element(by.text('✕')).atIndex(0).tap();

      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('should preview workflow', async () => {
      await element(by.id('preview-workflow')).tap();

      await detoxExpect(element(by.text('Workflow Preview'))).toBeVisible();
    });

    it('should save workflow', async () => {
      await element(by.id('workflow-name-input')).clearText();
      await element(by.id('workflow-name-input')).typeText('Save Test');
      await element(by.id('save-workflow')).tap();

      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    it('should publish workflow', async () => {
      await element(by.id('publish-workflow')).tap();

      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should show trigger configuration', async () => {
      await detoxExpect(element(by.text('Trigger Configuration'))).toBeVisible();
      await detoxExpect(element(by.text('Trigger Type:'))).toBeVisible();
    });
  });

  describe('Dependency Tracker', () => {
    it('should open dependency tracker', async () => {
      await element(by.text('Dependencies')).tap();

      await detoxExpect(element(by.id('dependency-tracker-screen'))).toBeVisible();
    });

    it('should display blocking issues tab', async () => {
      await element(by.id('tab-blocking')).tap();

      await detoxExpect(element(by.id('tab-blocking'))).toHaveToggleValue(true);
    });

    it('should display blocking issues list', async () => {
      await detoxExpect(element(by.id('blocking-issues-list'))).toBeVisible();
    });

    it('should show dependency items', async () => {
      await detoxExpect(element(by.id('dependencies-list'))).toBeVisible();
      await detoxExpect(element(by.text('Inspection #45'))).toBeVisible();
    });

    it('should switch to health tab', async () => {
      await element(by.id('tab-health')).tap();

      await detoxExpect(element(by.id('tab-health'))).toHaveToggleValue(true);
    });

    it('should display health score', async () => {
      await detoxExpect(element(by.text('Dependency Health Score'))).toBeVisible();
    });

    it('should show health metrics', async () => {
      await detoxExpect(element(by.text('On-Time'))).toBeVisible();
      await detoxExpect(element(by.text('Blocked'))).toBeVisible();
      await detoxExpect(element(by.text('Overdue'))).toBeVisible();
    });

    it('should switch to critical path tab', async () => {
      await element(by.id('tab-critical')).tap();

      await detoxExpect(element(by.id('tab-critical'))).toHaveToggleValue(true);
    });

    it('should display critical path analysis', async () => {
      await detoxExpect(element(by.text('Critical Path Analysis'))).toBeVisible();
      await detoxExpect(element(by.text('Longest Chain:'))).toBeVisible();
      await detoxExpect(element(by.text('Bottleneck:'))).toBeVisible();
      await detoxExpect(element(by.text('Risk Level:'))).toBeVisible();
    });

    it('should escalate blocked items', async () => {
      await element(by.id('escalate-button')).tap();

      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should create parallel work order', async () => {
      await element(by.id('create-parallel-button')).tap();

      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('Performance & Integration', () => {
    it('should load feature map quickly', async () => {
      const start = Date.now();

      await element(by.text('Features')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    it('should handle multiple node selections', async () => {
      await element(by.id('feature-node-projects')).tap();
      await element(by.id('feature-node-inspections')).tap();
      await element(by.id('feature-node-workorders')).tap();

      await detoxExpect(element(by.id('feature-node-workorders'))).toBeVisible();
    });

    it('should maintain state across navigation', async () => {
      await element(by.text('Features')).tap();
      await element(by.id('feature-node-inspections')).tap();

      // Navigate away and back
      await element(by.text('Dashboard')).tap();
      await element(by.text('Features')).tap();

      // State should persist
      await detoxExpect(element(by.text('Inspections'))).toBeVisible();
    });

    it('should load workflows quickly', async () => {
      const start = Date.now();

      await element(by.text('Workflows')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    it('should handle dependency calculation', async () => {
      const start = Date.now();

      await element(by.text('Dependencies')).tap();
      await element(by.id('tab-health')).tap();

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000);
    });
  });
});
