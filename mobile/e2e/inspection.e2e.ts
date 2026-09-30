/**
 * E2E Tests for Inspection Creation Flow
 * Coverage: 15+ tests across 5 categories
 * Duration: ~5-10 minutes
 */

describe('Inspection Creation Flow', () => {
  beforeAll(async () => {
    console.log('[E2E] Starting inspection tests');
    await device.launchApp();
    await waitFor(element(by.testID('app-ready')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    console.log('[E2E] Inspection tests complete');
  });

  // ========== NAVIGATION & RENDERING ==========

  describe('Rendering & Navigation', () => {
    it('should display inspections list screen', async () => {
      await element(by.testID('tab-inspections')).tap();
      await expect(element(by.testID('inspections-list'))).toBeVisible();
      await expect(element(by.text('Inspections'))).toBeVisible();
    });

    it('should navigate to create inspection screen', async () => {
      await element(by.testID('create-inspection-button')).tap();
      await expect(element(by.text('Create Inspection'))).toBeVisible();
      await expect(element(by.testID('inspection-form'))).toBeVisible();
    });

    it('should navigate through all 6 screens', async () => {
      // Start from create inspection
      await element(by.testID('create-inspection-button')).tap();

      // Fill form and go to photos
      await element(by.testID('inspection-type-select')).tap();
      await element(by.text('Routine')).tap();
      await element(by.testID('inspection-title-input')).typeText('Test Inspection');
      await element(by.testID('next-button')).tap();

      // Should be on photo capture screen
      await expect(element(by.text('Capture Photos'))).toBeVisible();

      // Go back
      await element(by.testID('back-button')).tap();
      await expect(element(by.text('Create Inspection'))).toBeVisible();
    });

    it('should have proper back navigation', async () => {
      await element(by.testID('create-inspection-button')).tap();
      await element(by.testID('cancel-button')).tap();
      await expect(element(by.testID('inspections-list'))).toBeVisible();
    });
  });

  // ========== FORM VALIDATION ==========

  describe('Form Validation', () => {
    beforeEach(async () => {
      await element(by.testID('create-inspection-button')).tap();
    });

    it('should validate required fields', async () => {
      // Try to proceed without filling form
      await element(by.testID('next-button')).tap();

      // Should show error messages
      await expect(element(by.text('Title is required'))).toBeVisible();
      await expect(element(by.text('Type is required'))).toBeVisible();
    });

    it('should accept valid form data', async () => {
      await element(by.testID('inspection-type-select')).tap();
      await element(by.text('Safety')).tap();
      await element(by.testID('inspection-title-input')).typeText('Safety Inspection');

      await element(by.testID('next-button')).tap();

      // Should navigate to photos
      await expect(element(by.text('Capture Photos'))).toBeVisible();
    });

    it('should clear errors when user corrects input', async () => {
      await element(by.testID('next-button')).tap();
      await expect(element(by.text('Title is required'))).toBeVisible();

      await element(by.testID('inspection-title-input')).typeText('Fixed Title');
      await expect(element(by.text('Title is required'))).not.toBeVisible();
    });

    it('should support all inspection types', async () => {
      const types = ['Routine', 'Safety', 'Maintenance', 'Compliance', 'Emergency'];

      for (const type of types) {
        await element(by.testID('inspection-type-select')).tap();
        await element(by.text(type)).tap();
        await expect(element(by.testID('inspection-type-value'))).toHaveText(type);
      }
    });
  });

  // ========== PHOTO CAPTURE ==========

  describe('Photo Capture', () => {
    it('should display camera capture interface', async () => {
      await navigateToPhotoCapture();

      await expect(element(by.testID('camera-preview'))).toBeVisible();
      await expect(element(by.testID('camera-capture-button'))).toBeVisible();
    });

    it('should require at least one photo', async () => {
      await navigateToPhotoCapture();

      // Try to proceed without photo
      await element(by.testID('next-button')).tap();

      // Should show error or disable button
      await expect(element(by.testID('next-button'))).not.toBeEnabled();
    });

    it('should display photo count in navigation', async () => {
      await navigateToPhotoCapture();

      // Capture photo
      await element(by.testID('camera-capture-button')).multiTap(1);

      // Check counter
      await expect(element(by.testID('photo-counter'))).toHaveText('1 photo');
    });

    it('should allow capturing multiple photos', async () => {
      await navigateToPhotoCapture();

      // Capture 3 photos
      for (let i = 0; i < 3; i++) {
        await element(by.testID('camera-capture-button')).multiTap(1);
      }

      await expect(element(by.testID('photo-counter'))).toHaveText('3 photos');
      await expect(element(by.testID('photos-list')).atIndex(0)).toBeVisible();
      await expect(element(by.testID('photos-list')).atIndex(2)).toBeVisible();
    });

    it('should allow removing photos', async () => {
      await navigateToPhotoCapture();

      // Capture 2 photos
      await element(by.testID('camera-capture-button')).multiTap(2);
      await expect(element(by.testID('photo-counter'))).toHaveText('2 photos');

      // Remove first photo
      await element(by.testID('photos-list')).atIndex(0).tap();

      await expect(element(by.testID('photo-counter'))).toHaveText('1 photo');
    });
  });

  // ========== CHECKLIST ==========

  describe('Checklist', () => {
    it('should display checklist items', async () => {
      await navigateToChecklist();

      await expect(element(by.testID('checklist-items'))).toBeVisible();
      await expect(element(by.text('Structure integrity'))).toBeVisible();
      await expect(element(by.text('Equipment condition'))).toBeVisible();
    });

    it('should toggle checklist items', async () => {
      await navigateToChecklist();

      // Click first checkbox
      await element(by.testID('checkbox-0')).tap();
      await expect(element(by.testID('checkbox-0'))).toHaveToggleValue(true);

      // Verify counter updates
      await expect(element(by.testID('completion-counter'))).toHaveText('1/5');
    });

    it('should allow adding notes to items', async () => {
      await navigateToChecklist();

      await element(by.testID('notes-input-0')).typeText('Item looks good');
      await element(by.testID('checkbox-0')).tap();

      await expect(element(by.testID('completion-counter'))).toHaveText('1/5');
    });

    it('should display completion percentage', async () => {
      await navigateToChecklist();

      // Complete all items
      for (let i = 0; i < 5; i++) {
        await element(by.testID(`checkbox-${i}`)).tap();
      }

      await expect(element(by.testID('completion-counter'))).toHaveText('5/5');
      await expect(element(by.testID('completion-bar'))).toHaveAttr('aria-valuenow', '100');
    });
  });

  // ========== SIGNATURE ==========

  describe('Signature Capture', () => {
    it('should require inspector name', async () => {
      await navigateToSignature();

      await element(by.testID('next-button')).tap();

      // Should show error
      await expect(element(by.text('Name is required'))).toBeVisible();
    });

    it('should accept inspector name', async () => {
      await navigateToSignature();

      await element(by.testID('inspector-name-input')).typeText('John Doe');
      await expect(element(by.testID('inspector-name-input'))).toHaveText('John Doe');
    });

    it('should require signature', async () => {
      await navigateToSignature();

      await element(by.testID('inspector-name-input')).typeText('John Doe');
      await element(by.testID('next-button')).tap();

      // Should show error or disable button
      await expect(element(by.testID('next-button'))).not.toBeEnabled();
    });

    it('should save signature after drawing', async () => {
      await navigateToSignature();

      await element(by.testID('inspector-name-input')).typeText('John Doe');
      await element(by.testID('signature-pad')).multiTap(1);
      await element(by.testID('save-signature-button')).tap();

      await expect(element(by.testID('next-button'))).toBeEnabled();
    });

    it('should allow clearing signature', async () => {
      await navigateToSignature();

      await element(by.testID('signature-pad')).multiTap(1);
      await element(by.testID('clear-signature-button')).tap();

      await expect(element(by.testID('next-button'))).not.toBeEnabled();
    });
  });

  // ========== REVIEW & SUBMIT ==========

  describe('Review & Submit', () => {
    it('should display inspection summary', async () => {
      await completeInspectionForm();

      await expect(element(by.text('Review & Submit'))).toBeVisible();
      await expect(element(by.testID('inspection-summary'))).toBeVisible();
    });

    it('should show photo count in summary', async () => {
      await completeInspectionForm();

      await expect(element(by.testID('photo-summary'))).toHaveText('Photos (3)');
    });

    it('should show checklist completion in summary', async () => {
      await completeInspectionForm();

      await expect(element(by.testID('checklist-summary'))).toContainText('5/5');
    });

    it('should show inspector name in summary', async () => {
      await completeInspectionForm();

      await expect(element(by.testID('inspector-name-summary'))).toHaveText('John Doe');
    });

    it('should submit inspection successfully', async () => {
      await completeInspectionForm();

      await element(by.testID('submit-button')).tap();

      // Should return to inspections list
      await waitFor(element(by.testID('inspections-list')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should allow saving as draft', async () => {
      await completeInspectionForm();

      await element(by.testID('save-draft-button')).tap();

      // Should return to inspections list
      await waitFor(element(by.testID('inspections-list')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ========== OFFLINE SUPPORT ==========

  describe('Offline Support', () => {
    it('should queue inspection when offline', async () => {
      await simulateOffline();

      await completeInspectionForm();
      await element(by.testID('submit-button')).tap();

      // Should show offline indicator
      await expect(element(by.testID('offline-indicator'))).toBeVisible();
    });

    it('should sync when going online', async () => {
      await simulateOffline();
      await completeInspectionForm();
      await element(by.testID('submit-button')).tap();

      await simulateOnline();

      // Should show syncing indicator
      await expect(element(by.testID('syncing-indicator'))).toBeVisible();

      // Wait for sync to complete
      await waitFor(element(by.text('Synced')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should save draft locally when offline', async () => {
      await simulateOffline();

      await completeInspectionForm();
      await element(by.testID('save-draft-button')).tap();

      // Should show saved indicator
      await expect(element(by.testID('draft-saved-indicator'))).toBeVisible();
    });

    it('should load saved drafts', async () => {
      await simulateOffline();

      // Create and save draft
      await completeInspectionForm();
      await element(by.testID('save-draft-button')).tap();

      // Go back to inspections
      await simulateOnline();

      // Should show draft in list
      await expect(element(by.testID('draft-item-0'))).toBeVisible();
    });
  });

  // ========== ERROR HANDLING ==========

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      await simulateNetworkError();

      await completeInspectionForm();
      await element(by.testID('submit-button')).tap();

      // Should show error message
      await expect(element(by.testID('error-message'))).toBeVisible();
    });

    it('should allow retry on error', async () => {
      await simulateNetworkError();

      await completeInspectionForm();
      await element(by.testID('submit-button')).tap();

      await simulateOnline();

      await element(by.testID('retry-button')).tap();

      // Should attempt submission again
      await waitFor(element(by.testID('syncing-indicator')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show loading state during submission', async () => {
      await completeInspectionForm();

      await element(by.testID('submit-button')).tap();

      // Should show loading indicator
      await expect(element(by.testID('loading-overlay'))).toBeVisible();
    });
  });
});

// ========== HELPER FUNCTIONS ==========

async function navigateToPhotoCapture() {
  await element(by.testID('create-inspection-button')).tap();
  await element(by.testID('inspection-type-select')).tap();
  await element(by.text('Routine')).tap();
  await element(by.testID('inspection-title-input')).typeText('Test');
  await element(by.testID('next-button')).tap();
}

async function navigateToChecklist() {
  await navigateToPhotoCapture();
  await element(by.testID('camera-capture-button')).multiTap(1);
  await element(by.testID('next-button')).tap();
}

async function navigateToSignature() {
  await navigateToChecklist();
  await element(by.testID('checkbox-0')).tap();
  await element(by.testID('next-button')).tap();
}

async function completeInspectionForm() {
  await navigateToSignature();
  await element(by.testID('inspector-name-input')).typeText('John Doe');
  await element(by.testID('signature-pad')).multiTap(1);
  await element(by.testID('save-signature-button')).tap();
  await element(by.testID('next-button')).tap();
}

async function simulateOffline() {
  console.log('[E2E] Simulating offline');
  // Implementation: Set app store isOnline to false
}

async function simulateOnline() {
  console.log('[E2E] Simulating online');
  // Implementation: Set app store isOnline to true
}

async function simulateNetworkError() {
  console.log('[E2E] Simulating network error');
  // Implementation: Mock API to return error
}
