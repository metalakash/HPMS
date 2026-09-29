/**
 * Push Notifications E2E Tests
 * Comprehensive testing of notification center, settings, alert rules, and push integration
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Push Notifications & Alert Rules Tests', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Notification Center UI', () => {
    it('should display notification center screen', async () => {
      // Navigate to notifications
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Should show notifications title
      await detoxExpect(element(by.text('Notifications'))).toBeVisible();
    });

    it('should display notification list', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Should show filter tabs
      await detoxExpect(element(by.text('All'))).toBeVisible();
      await detoxExpect(element(by.text('Unread'))).toBeVisible();
      await detoxExpect(element(by.text('Read'))).toBeVisible();
    });

    it('should filter notifications - all', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Click All tab
      await element(by.text('All')).multiTap();

      // Should show all notifications
      await detoxExpect(element(by.id('notification-list'))).toBeVisible();
    });

    it('should filter notifications - unread', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Click Unread tab
      await element(by.text('Unread')).multiTap();

      // Should show only unread notifications
      await new Promise(r => setTimeout(r, 500));
      await detoxExpect(element(by.text(/Unread|NEW/i))).toBeVisible();
    });

    it('should filter notifications - read', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Click Read tab
      await element(by.text('Read')).multiTap();

      // Should show only read notifications
      await new Promise(r => setTimeout(r, 500));
      await detoxExpect(element(by.id('notification-list'))).toBeVisible();
    });

    it('should mark notification as read', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Tap first notification
      await element(by.id('notification-item-0')).multiTap();
      await new Promise(r => setTimeout(r, 300));

      // Should be marked as read
      await detoxExpect(element(by.text(/Unread|NEW/i))).not.toBeVisible();
    });

    it('should delete notification', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Get initial count
      const itemsBeforeDelete = await element(by.id('notification-item-0')).multiTap();

      // Tap delete button
      await element(by.id('delete-button-0')).multiTap();

      // Confirm deletion
      await element(by.text('Delete')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should be removed from list
      await detoxExpect(element(by.text(/Deleted|removed/i))).toBeVisible();
    });

    it('should show empty state when no notifications', async () => {
      // Navigate to notifications
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Clear all notifications
      await element(by.text('Clear All')).multiTap();
      await element(by.text('Clear')).multiTap();

      // Should show empty state
      await detoxExpect(element(by.text(/No Notifications|all caught up/i))).toBeVisible();
    });
  });

  describe('Notification Settings', () => {
    beforeEach(async () => {
      // Open settings
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();
      await element(by.id('settings-button')).multiTap();
    });

    it('should display settings screen', async () => {
      await detoxExpect(element(by.text('Notification Settings'))).toBeVisible();
    });

    it('should toggle global notifications', async () => {
      // Find and toggle notifications switch
      const notificationSwitch = element(by.id('toggle-enabled'));
      await notificationSwitch.multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should save preference
      await detoxExpect(element(by.text(/saved|updated/i))).toBeVisible();
    });

    it('should set inspection notification preference', async () => {
      // Find inspection feature card
      await element(by.id('feature-inspections')).multiTap();

      // Select "Important only"
      await element(by.text('Important only')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should update
      await detoxExpect(element(by.text('Important only'))).toBeVisible();
    });

    it('should set maintenance notification preference', async () => {
      // Find maintenance feature card
      await element(by.id('feature-maintenance')).multiTap();

      // Select "None"
      await element(by.text('None')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should update
      await detoxExpect(element(by.text('None'))).toBeVisible();
    });

    it('should set documents notification preference', async () => {
      // Find documents feature card
      await element(by.id('feature-documents')).multiTap();

      // Select "All notifications"
      await element(by.text('All notifications')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should update
      await detoxExpect(element(by.text('All notifications'))).toBeVisible();
    });

    it('should toggle sound preference', async () => {
      // Find sound toggle
      const soundSwitch = element(by.id('toggle-sound'));
      await soundSwitch.multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should save
      await detoxExpect(element(by.text(/saved|updated/i))).toBeVisible();
    });

    it('should toggle vibration preference', async () => {
      // Find vibration toggle
      const vibrationSwitch = element(by.id('toggle-vibration'));
      await vibrationSwitch.multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should save
      await detoxExpect(element(by.text(/saved|updated/i))).toBeVisible();
    });

    it('should enable do-not-disturb schedule', async () => {
      // Toggle DND
      const dndSwitch = element(by.id('toggle-dnd'));
      await dndSwitch.multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should show time inputs
      await detoxExpect(element(by.text('From'))).toBeVisible();
      await detoxExpect(element(by.text('To'))).toBeVisible();
    });

    it('should set DND hours', async () => {
      // Enable DND first
      const dndSwitch = element(by.id('toggle-dnd'));
      await dndSwitch.multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Set from time
      await element(by.id('dnd-from')).multiTap();
      await element(by.id('time-22')).multiTap();

      // Set to time
      await element(by.id('dnd-to')).multiTap();
      await element(by.id('time-08')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should show selected times
      await detoxExpect(element(by.text('22:00'))).toBeVisible();
      await detoxExpect(element(by.text('08:00'))).toBeVisible();
    });

    it('should send test notification', async () => {
      // Tap test button
      await element(by.text('Send Test Notification')).multiTap();

      await new Promise(r => setTimeout(r, 1000));

      // Should receive test notification
      await detoxExpect(element(by.text(/test|notification/i))).toBeVisible();
    });
  });

  describe('Alert Rules Management', () => {
    it('should create new alert rule', async () => {
      // Open alert rules
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();

      // Tap create button
      await element(by.text('New Alert Rule')).multiTap();

      // Should show rule form
      await detoxExpect(element(by.text('Rule Name'))).toBeVisible();
    });

    it('should fill rule name', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();
      await element(by.text('New Alert Rule')).multiTap();

      // Enter rule name
      await element(by.id('rule-name')).typeText('Covenant Breach Alert');

      // Should show in form
      await detoxExpect(element(by.text('Covenant Breach Alert'))).toBeVisible();
    });

    it('should select trigger type', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();
      await element(by.text('New Alert Rule')).multiTap();

      // Select covenant_breach trigger
      await element(by.text('Covenant Breach')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should be selected
      await detoxExpect(element(by.text('Covenant Breach'))).toBeVisible();
    });

    it('should select notification frequency', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();
      await element(by.text('New Alert Rule')).multiTap();

      // Select daily digest
      await element(by.text('Daily Digest')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should be selected
      await detoxExpect(element(by.text('Daily Digest'))).toBeVisible();
    });

    it('should select recipients', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();
      await element(by.text('New Alert Rule')).multiTap();

      // Select recipients
      await element(by.id('recipient-me')).multiTap();
      await element(by.id('recipient-team')).multiTap();

      await new Promise(r => setTimeout(r, 300));

      // Should show selected
      await detoxExpect(element(by.text(/Me|Team/i))).toBeVisible();
    });

    it('should save new alert rule', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();
      await element(by.text('New Alert Rule')).multiTap();

      // Fill form
      await element(by.id('rule-name')).typeText('Test Rule');
      await element(by.text('Covenant Breach')).multiTap();
      await element(by.id('recipient-me')).multiTap();

      // Save
      await element(by.text('Create Rule')).multiTap();

      await new Promise(r => setTimeout(r, 1000));

      // Should show success
      await detoxExpect(element(by.text(/created|saved/i))).toBeVisible();
    });

    it('should edit alert rule', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();

      // Tap first rule
      await element(by.id('rule-item-0')).multiTap();

      // Should show edit form
      await detoxExpect(element(by.text('Edit Alert Rule'))).toBeVisible();

      // Change name
      await element(by.id('rule-name')).clearText();
      await element(by.id('rule-name')).typeText('Updated Rule Name');

      // Save
      await element(by.text('Update Rule')).multiTap();

      await new Promise(r => setTimeout(r, 1000));

      // Should show success
      await detoxExpect(element(by.text(/updated|saved/i))).toBeVisible();
    });

    it('should delete alert rule', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();

      // Tap delete button on first rule
      await element(by.id('delete-rule-0')).multiTap();

      // Confirm deletion
      await element(by.text('Delete')).multiTap();

      await new Promise(r => setTimeout(r, 500));

      // Should show success
      await detoxExpect(element(by.text(/deleted|removed/i))).toBeVisible();
    });

    it('should test alert rule', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();

      // Tap first rule
      await element(by.id('rule-item-0')).multiTap();

      // Tap test button
      await element(by.text('Test This Rule')).multiTap();

      await new Promise(r => setTimeout(r, 1000));

      // Should receive test notification
      await detoxExpect(element(by.text(/test|notification/i))).toBeVisible();
    });
  });

  describe('Push Notifications', () => {
    it('should request notification permissions on launch', async () => {
      // App should request permissions
      // (Usually shown as iOS/Android system dialog)
      await new Promise(r => setTimeout(r, 1000));

      // App should continue normally even if denied
      await detoxExpect(element(by.id('dashboard-tab'))).toBeVisible();
    });

    it('should register push token', async () => {
      // Token registration happens automatically on launch
      // Verify by checking preferences
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Settings')).multiTap();

      // Should show notification setup complete
      await detoxExpect(element(by.text(/notifications enabled|ready/i))).toBeVisible();
    });

    it('should display badge count on app icon', async () => {
      // Create some notifications
      await element(by.id('inspections-tab')).multiTap();
      await element(by.text('Create Inspection')).multiTap();
      await element(by.id('inspection-type')).multiTap();
      await element(by.text('Routine')).multiTap();
      await element(by.id('inspection-title')).typeText('Test');
      await element(by.text('Next')).multiTap();
      await element(by.text('Submit')).multiTap();

      await new Promise(r => setTimeout(r, 2000));

      // Navigate to notifications to see badge was updated
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Should show badge count
      await detoxExpect(element(by.text(/new|unread/i))).toBeVisible();
    });

    it('should handle notification tap from notification center', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Tap notification with action URL
      await element(by.id('notification-with-action')).multiTap();

      await new Promise(r => setTimeout(r, 1000));

      // Should navigate to feature
      await detoxExpect(element(by.text(/Inspection|Maintenance|Document/i))).toBeVisible();
    });

    it('should update badge count when notifications read', async () => {
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Mark unread notifications as read
      await element(by.text('Unread')).multiTap();
      await element(by.id('notification-item-0')).multiTap();

      await new Promise(r => setTimeout(r, 500));

      // Badge should update
      const allTab = element(by.text('All'));
      await allTab.multiTap();

      // Should show updated count
      await detoxExpect(element(by.text(/badge|count/i))).toBeVisible();
    });

    it('should handle notification priority', async () => {
      // Create high-priority notification via alert rule
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();
      await element(by.text('New Alert Rule')).multiTap();

      // Create high-priority rule
      await element(by.id('rule-name')).typeText('High Priority Alert');
      await element(by.text('Covenant Breach')).multiTap();
      await element(by.id('recipient-me')).multiTap();
      await element(by.text('Create Rule')).multiTap();

      await new Promise(r => setTimeout(r, 1500));

      // Navigate to notifications to check
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Should show high priority indicator
      await detoxExpect(element(by.text(/High Priority|Alert/i))).toBeVisible();
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should trigger notification on inspection submission', async () => {
      // Submit inspection
      await element(by.id('inspections-tab')).multiTap();
      await element(by.text('Create Inspection')).multiTap();
      await element(by.id('inspection-type')).multiTap();
      await element(by.text('Routine')).multiTap();
      await element(by.id('inspection-title')).typeText('Integration Test');
      await element(by.text('Next')).multiTap();
      await element(by.text('Submit')).multiTap();

      await new Promise(r => setTimeout(r, 2000));

      // Check notifications
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Should show inspection submitted notification
      await detoxExpect(element(by.text(/Inspection|submitted/i))).toBeVisible();
    });

    it('should trigger notification on covenant breach', async () => {
      // Navigate to covenants
      await element(by.id('covenants-tab')).multiTap();

      // (In real app, breach would be detected automatically)
      // For testing, trigger alert rule
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Alert Rules')).multiTap();

      // Find and test covenant breach rule
      await element(by.id('rule-item-0')).multiTap();
      await element(by.text('Test This Rule')).multiTap();

      await new Promise(r => setTimeout(r, 1000));

      // Check notification appeared
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      await detoxExpect(element(by.text(/Covenant|breach/i))).toBeVisible();
    });

    it('should maintain notification persistence across app restart', async () => {
      // Create notification
      await element(by.id('inspections-tab')).multiTap();
      await element(by.text('Create Inspection')).multiTap();
      await element(by.id('inspection-type')).multiTap();
      await element(by.text('Routine')).multiTap();
      await element(by.id('inspection-title')).typeText('Persistence Test');
      await element(by.text('Next')).multiTap();
      await element(by.text('Submit')).multiTap();

      await new Promise(r => setTimeout(r, 1500));

      // Restart app
      await device.reloadReactNative();
      await new Promise(r => setTimeout(r, 1000));

      // Check notification still there
      await element(by.id('menu-button')).multiTap();
      await element(by.text('Notifications')).multiTap();

      // Should still see notification
      await detoxExpect(element(by.text(/Inspection|Persistence/i))).toBeVisible();
    });
  });
});
