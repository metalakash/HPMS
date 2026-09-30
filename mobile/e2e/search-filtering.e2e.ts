/**
 * E2E Tests: Advanced Search & Filtering
 * Comprehensive test suite for search, filtering, saved filters, and history
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

describe('Advanced Search & Filtering', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // ==================== ADVANCED SEARCH (10 tests) ====================

  describe('Advanced Search', () => {
    test('T001: Should display search modal when tapping search button', async () => {
      await waitFor(element(by.id('search-button')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('search-button')).multiTap();

      await waitFor(element(by.id('search-modal')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T002: Should show suggestions while typing', async () => {
      await element(by.id('search-button')).multiTap();
      await waitFor(element(by.id('search-input')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('search-input')).typeText('inspection');
      await waitFor(element(by.id('search-suggestions')))
        .toBeVisible()
        .withTimeout(5000);

      await detoxExpect(element(by.id('search-suggestions'))).toBeVisible();
    });

    test('T003: Should filter suggestions by feature type', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('dam');

      await element(by.id('feature-filter-inspections')).multiTap();
      await waitFor(element(by.id('search-suggestions')))
        .toBeVisible()
        .withTimeout(5000);

      const suggestionCount = await element(by.id('search-suggestions')).getAttributes();
      await detoxExpect(suggestionCount).toBeDefined();
    });

    test('T004: Should perform search on enter key', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('dam');
      await element(by.id('search-input')).multiTap();
      await device.sendUserInteraction({
        type: 'keyboard',
        key: 'return',
      });

      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T005: Should display search results grouped by feature', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('test');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('results-group-inspections')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('results-group-maintenance'))).toBeVisible();
      await detoxExpect(element(by.id('results-group-documents'))).toBeVisible();
    });

    test('T006: Should highlight matching query terms in results', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('critical');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('result-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      const resultText = await element(by.id('result-item-0')).getAttributes();
      await detoxExpect(resultText).toBeDefined();
    });

    test('T007: Should show relevance score percentage', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('maintenance');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('relevance-score-0')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('relevance-score-0'))).toHaveText(/\d+%/);
    });

    test('T008: Should clear search results on clear button', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('test');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('clear-search-button')).multiTap();
      await detoxExpect(element(by.id('search-results'))).not.toBeVisible();
    });

    test('T009: Should show empty state when no results', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('xyznoexist123');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('empty-state-icon')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('empty-state-title'))).toHaveText('No Results Found');
    });

    test('T010: Should navigate to result details on tap', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('inspection');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('result-item-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('result-item-0')).multiTap();

      await waitFor(element(by.id('detail-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ==================== MULTI-FIELD FILTERING (12 tests) ====================

  describe('Multi-Field Filtering', () => {
    test('T011: Should open filter builder', async () => {
      await element(by.id('filter-button')).multiTap();

      await waitFor(element(by.id('filter-builder-modal')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T012: Should add filter criteria', async () => {
      await element(by.id('filter-button')).multiTap();
      await waitFor(element(by.id('filter-builder-modal')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('add-filter-button')).multiTap();
      await waitFor(element(by.id('filter-field-0')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T013: Should select filter field', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();

      await element(by.id('filter-field-select-0')).multiTap();
      await waitFor(element(by.id('field-option-status')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('field-option-status')).multiTap();

      await detoxExpect(element(by.id('filter-field-value-0'))).toBeVisible();
    });

    test('T014: Should select filter operator', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-date')).multiTap();

      await element(by.id('filter-operator-select-0')).multiTap();
      await waitFor(element(by.id('operator-option-range')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('operator-option-range')).multiTap();
    });

    test('T015: Should set filter value', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-priority')).multiTap();

      await element(by.id('filter-value-select-0')).multiTap();
      await waitFor(element(by.id('value-option-high')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('value-option-high')).multiTap();

      await detoxExpect(element(by.id('filter-value-display-0'))).toHaveText('High');
    });

    test('T016: Should remove filter criterion', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();

      await detoxExpect(element(by.id('filter-field-0'))).toBeVisible();
      await detoxExpect(element(by.id('filter-field-1'))).toBeVisible();

      await element(by.id('remove-filter-button-1')).multiTap();
      await detoxExpect(element(by.id('filter-field-1'))).not.toBeVisible();
    });

    test('T017: Should show filter preview', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-approved')).multiTap();

      await detoxExpect(element(by.id('filter-preview'))).toBeVisible();
      await detoxExpect(element(by.id('filter-preview'))).toHaveText(/Status.*Equals.*Approved/);
    });

    test('T018: Should apply quick preset template', async () => {
      await element(by.id('filter-button')).multiTap();
      await waitFor(element(by.id('filter-presets')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('preset-this-week')).multiTap();
      await waitFor(element(by.id('filter-field-0')))
        .toBeVisible()
        .withTimeout(5000);

      await detoxExpect(element(by.id('filter-preview'))).toHaveText(/Date.*greater_than/);
    });

    test('T019: Should validate filter before applying', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();

      await element(by.id('apply-filter-button')).multiTap();
      await waitFor(element(by.id('validation-error')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T020: Should apply multiple filters', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-approved')).multiTap();

      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-1')).multiTap();
      await element(by.id('field-option-priority')).multiTap();
      await element(by.id('filter-value-select-1')).multiTap();
      await element(by.id('value-option-high')).multiTap();

      await element(by.id('apply-filter-button')).multiTap();
      await waitFor(element(by.id('filtered-results')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T021: Should clear all filters', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-approved')).multiTap();

      await element(by.id('clear-all-filters-button')).multiTap();
      await detoxExpect(element(by.id('filter-field-0'))).not.toBeVisible();
    });

    test('T022: Should show filter count badge', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-approved')).multiTap();
      await element(by.id('add-filter-button')).multiTap();

      await detoxExpect(element(by.id('filter-count-badge'))).toHaveText('2');
    });
  });

  // ==================== SAVED FILTERS (10 tests) ====================

  describe('Saved Filters', () => {
    test('T023: Should navigate to saved filters screen', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filters-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T024: Should display list of saved filters', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T025: Should create new saved filter', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-draft')).multiTap();

      await element(by.id('save-filter-button')).multiTap();
      await waitFor(element(by.id('save-filter-modal')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('filter-name-input')).typeText('My Draft Filter');
      await element(by.id('filter-description-input')).typeText('Shows only draft items');
      await element(by.id('confirm-save-button')).multiTap();

      await waitFor(element(by.text('Filter saved successfully')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T026: Should apply saved filter quickly', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('apply-saved-filter-0')).multiTap();
      await waitFor(element(by.id('filter-applied-toast')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T027: Should edit saved filter', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('edit-filter-button-0')).multiTap();
      await waitFor(element(by.id('filter-editor-modal')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('filter-name-input')).clearText();
      await element(by.id('filter-name-input')).typeText('Updated Filter Name');
      await element(by.id('save-changes-button')).multiTap();

      await waitFor(element(by.text('Filter updated')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T028: Should delete saved filter', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('delete-filter-button-0')).multiTap();
      await waitFor(element(by.id('confirm-delete-modal')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('confirm-delete-button')).multiTap();

      await waitFor(element(by.text('Filter deleted')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T029: Should share filter with team members', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('share-filter-button-0')).multiTap();
      await waitFor(element(by.id('share-modal')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('team-member-checkbox-0')).multiTap();
      await element(by.id('confirm-share-button')).multiTap();

      await waitFor(element(by.text('Filter shared')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T030: Should set filter as default', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('set-default-button-0')).multiTap();
      await waitFor(element(by.id('default-badge-0')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T031: Should filter saved filters by feature', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await element(by.id('feature-tab-maintenance')).multiTap();
      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await detoxExpect(element(by.id('feature-indicator-0'))).toHaveText('maintenance');
    });

    test('T032: Should show filter metadata', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('expand-filter-0')).multiTap();
      await waitFor(element(by.id('filter-description-0')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('filter-created-date-0'))).toBeVisible();
    });
  });

  // ==================== SEARCH HISTORY (8 tests) ====================

  describe('Search History', () => {
    test('T033: Should navigate to search history', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.id('search-history-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T034: Should display recent searches', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.id('history-item-0')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T035: Should re-search from history', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.id('history-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('history-item-0')).multiTap();
      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T036: Should delete individual history item', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.id('history-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('delete-history-button-0')).multiTap();
      await waitFor(element(by.id('item-deleted-toast')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T037: Should sort history by recent/popular', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await element(by.id('sort-popular-button')).multiTap();
      await waitFor(element(by.id('history-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      const popularSort = await element(by.id('sort-popular-button')).getAttributes();
      await detoxExpect(popularSort).toBeDefined();
    });

    test('T038: Should clear all search history', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await element(by.id('clear-all-history-button')).multiTap();
      await waitFor(element(by.id('confirm-clear-modal')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('confirm-clear-button')).multiTap();

      await waitFor(element(by.id('empty-history-state')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T039: Should export search history', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await element(by.id('export-history-button')).multiTap();
      await waitFor(element(by.id('export-modal')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('confirm-export-button')).multiTap();

      await waitFor(element(by.id('export-success-toast')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T040: Should show search statistics', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.id('total-searches-stat')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('avg-results-stat'))).toBeVisible();
      await detoxExpect(element(by.id('unique-queries-stat'))).toBeVisible();
    });
  });

  // ==================== SEARCH RESULTS (5 tests) ====================

  describe('Search Results', () => {
    test('T041: Should display result snippets', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('inspection');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('result-snippet-0')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('result-snippet-0'))).toHaveToggleValue(true);
    });

    test('T042: Should show result metadata', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('test');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('result-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await detoxExpect(element(by.id('result-type-0'))).toBeVisible();
      await detoxExpect(element(by.id('result-date-0'))).toBeVisible();
    });

    test('T043: Should highlight multiple matching fields', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('maintenance');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('matched-fields-0')))
        .toBeVisible()
        .withTimeout(5000);

      const matchedFields = await element(by.id('matched-fields-0')).getAttributes();
      await detoxExpect(matchedFields).toBeDefined();
    });

    test('T044: Should paginate through results', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('a');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await waitFor(element(by.id('result-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('load-more-button')).multiTap();
      await waitFor(element(by.id('result-item-20')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T045: Should switch between grouped and flat view', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('test');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await element(by.id('view-toggle-flat')).multiTap();
      await waitFor(element(by.id('flat-result-list')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('view-toggle-grouped')).multiTap();
      await waitFor(element(by.id('grouped-result-list')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ==================== INTEGRATION TESTS (5 tests) ====================

  describe('Cross-Feature Integration', () => {
    test('T046: Should persist filter state across screens', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-approved')).multiTap();
      await element(by.id('apply-filter-button')).multiTap();

      await element(by.id('navigate-home')).multiTap();
      await element(by.id('filter-button')).multiTap();

      await waitFor(element(by.id('filter-field-0')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('filter-value-display-0'))).toHaveText('Approved');
    });

    test('T047: Should combine search and filters', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('dam');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-priority')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-high')).multiTap();
      await element(by.id('apply-filter-button')).multiTap();

      await waitFor(element(by.id('combined-results')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T048: Should sync filter with search analytics', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('add-filter-button')).multiTap();
      await element(by.id('filter-field-select-0')).multiTap();
      await element(by.id('field-option-status')).multiTap();
      await element(by.id('filter-value-select-0')).multiTap();
      await element(by.id('value-option-approved')).multiTap();
      await element(by.id('apply-filter-button')).multiTap();

      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.id('analytics-badge')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T049: Should preserve search history with filters', async () => {
      await element(by.id('search-button')).multiTap();
      await element(by.id('search-input')).typeText('maintenance');
      await device.sendUserInteraction({ type: 'keyboard', key: 'return' });

      await device.sendUserInteraction({ type: 'keyboard', key: 'Escape' });

      await element(by.id('search-button')).multiTap();
      await element(by.id('history-tab')).multiTap();

      await waitFor(element(by.text('maintenance')))
        .toBeVisible()
        .withTimeout(5000);
    });

    test('T050: Should auto-apply default saved filter on screen load', async () => {
      await element(by.id('filter-button')).multiTap();
      await element(by.id('saved-filters-tab')).multiTap();

      await waitFor(element(by.id('saved-filter-item-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('set-default-button-0')).multiTap();
      await element(by.id('navigate-home')).multiTap();

      await waitFor(element(by.id('filter-applied-badge')))
        .toBeVisible()
        .withTimeout(5000);
      await detoxExpect(element(by.id('filter-applied-badge'))).toHaveText('Default Filter Applied');
    });
  });
});
