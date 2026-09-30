/**
 * Audit Search Screen
 * Advanced search with filters, saved searches, and analytics
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  lastUsed: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  feature: string;
  recordId: string;
  summary: string;
}

export const AuditSearchScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<AuditLog[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');

  const [filters, setFilters] = useState({
    actionType: [],
    feature: [],
    user: '',
    changeType: [],
    severity: 'all',
  });

  const actionTypes = ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'ROLLBACK'];
  const features = ['Projects', 'Inspections', 'WorkOrders', 'Compliance', 'Reports'];
  const changeTypes = ['Field changes', 'Status changes', 'Data added', 'Data removed'];
  const severities = ['all', 'Info', 'Warning', 'Critical'];

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      const mockResults: AuditLog[] = [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          userId: 'user-1',
          userEmail: 'akash@example.com',
          action: 'UPDATE',
          feature: 'Projects',
          recordId: 'proj-123',
          summary: 'Updated project status',
        },
      ];
      setResults(mockResults);
    } catch (error) {
      console.error('Error performing search:', error);
      Alert.alert('Error', 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const applyQuickFilter = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      switch (type) {
        case 'last24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'last7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          return;
      }

      // Simulate API call with date filter
      const mockResults: AuditLog[] = [];
      setResults(mockResults);
      setSearchQuery(`date:>${startDate.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('Error applying quick filter:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleActionType = (action: string) => {
    setFilters(prev => ({
      ...prev,
      actionType: prev.actionType.includes(action)
        ? prev.actionType.filter(a => a !== action)
        : [...prev.actionType, action],
    }));
  };

  const toggleFeature = (feature: string) => {
    setFilters(prev => ({
      ...prev,
      feature: prev.feature.includes(feature)
        ? prev.feature.filter(f => f !== feature)
        : [...prev.feature, feature],
    }));
  };

  const toggleChangeType = (change: string) => {
    setFilters(prev => ({
      ...prev,
      changeType: prev.changeType.includes(change)
        ? prev.changeType.filter(c => c !== change)
        : [...prev.changeType, change],
    }));
  };

  const saveSearch = useCallback(() => {
    if (!searchName.trim()) {
      Alert.alert('Error', 'Please enter a search name');
      return;
    }

    const newSearch: SavedSearch = {
      id: `search-${Date.now()}`,
      name: searchName,
      query: searchQuery,
      lastUsed: new Date().toISOString(),
    };

    setSavedSearches(prev => [newSearch, ...prev]);
    setSearchName('');
    setShowSaveDialog(false);
    Alert.alert('Success', 'Search saved successfully');
  }, [searchName, searchQuery]);

  const applySavedSearch = useCallback(async (search: SavedSearch) => {
    setSearchQuery(search.query);
    setLoading(true);
    try {
      // Simulate API call with saved search query
      const mockResults: AuditLog[] = [];
      setResults(mockResults);

      // Update last used timestamp
      setSavedSearches(prev =>
        prev.map(s =>
          s.id === search.id ? { ...s, lastUsed: new Date().toISOString() } : s
        )
      );
    } catch (error) {
      console.error('Error applying saved search:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSavedSearch = useCallback((id: string) => {
    Alert.alert('Delete Search', 'Are you sure you want to delete this search?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSavedSearches(prev => prev.filter(s => s.id !== id));
        },
      },
    ]);
  }, []);

  const renderResult = ({ item }: { item: AuditLog }) => (
    <TouchableOpacity style={styles.resultRow} testID="search-result">
      <View style={styles.resultContent}>
        <Text style={styles.resultTimestamp}>{item.timestamp}</Text>
        <Text style={styles.resultAction}>{item.action}</Text>
        <Text style={styles.resultSummary}>{item.summary}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSavedSearch = ({ item }: { item: SavedSearch }) => (
    <TouchableOpacity
      style={styles.savedSearchRow}
      onPress={() => applySavedSearch(item)}
      testID="saved-search"
    >
      <View style={styles.savedSearchContent}>
        <Text style={styles.savedSearchName}>{item.name}</Text>
        <Text style={styles.savedSearchQuery}>{item.query}</Text>
        <Text style={styles.savedSearchLastUsed}>
          Last used: {new Date(item.lastUsed).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => deleteSavedSearch(item.id)}
        testID="delete-saved-search"
      >
        <Text style={styles.deleteButton}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} testID="audit-search-screen">
      <ScrollView style={styles.content}>
        {/* Search Header */}
        <View style={styles.searchHeader}>
          <Text style={styles.screenTitle}>Search Audit Logs</Text>
          <Text style={styles.helpText}>
            Use search syntax: user:email, action:UPDATE, feature:Projects
          </Text>
        </View>

        {/* Search Box */}
        <View style={styles.searchBoxContainer}>
          <TextInput
            style={styles.searchBox}
            placeholder="Search audit logs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            testID="search-input"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={performSearch}
            testID="search-button"
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Filters */}
        <View style={styles.quickFiltersContainer}>
          <Text style={styles.quickFilterLabel}>Quick Filters:</Text>
          <View style={styles.quickFiltersRow}>
            <TouchableOpacity
              style={styles.quickFilterButton}
              onPress={() => applyQuickFilter('last24h')}
              testID="quick-filter-24h"
            >
              <Text style={styles.quickFilterText}>Last 24h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickFilterButton}
              onPress={() => applyQuickFilter('last7d')}
              testID="quick-filter-7d"
            >
              <Text style={styles.quickFilterText}>Last 7d</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickFilterButton}
              onPress={() => applyQuickFilter('thisMonth')}
              testID="quick-filter-month"
            >
              <Text style={styles.quickFilterText}>This Month</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Advanced Filters */}
        <TouchableOpacity
          style={styles.advancedFilterToggle}
          onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
          testID="advanced-filter-toggle"
        >
          <Text style={styles.advancedFilterToggleText}>
            {showAdvancedFilters ? '▼' : '▶'} Advanced Filters
          </Text>
        </TouchableOpacity>

        {showAdvancedFilters && (
          <View style={styles.advancedFiltersPanel}>
            {/* Action Types */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Action Types</Text>
              {actionTypes.map(action => (
                <TouchableOpacity
                  key={action}
                  style={styles.checkboxRow}
                  onPress={() => toggleActionType(action)}
                  testID={`filter-action-${action}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      filters.actionType.includes(action) && styles.checkboxChecked,
                    ]}
                  >
                    {filters.actionType.includes(action) && (
                      <Text style={styles.checkboxMark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>{action}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Features */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Features</Text>
              {features.map(feature => (
                <TouchableOpacity
                  key={feature}
                  style={styles.checkboxRow}
                  onPress={() => toggleFeature(feature)}
                  testID={`filter-feature-${feature}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      filters.feature.includes(feature) && styles.checkboxChecked,
                    ]}
                  >
                    {filters.feature.includes(feature) && (
                      <Text style={styles.checkboxMark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>{feature}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Change Types */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Change Types</Text>
              {changeTypes.map(change => (
                <TouchableOpacity
                  key={change}
                  style={styles.checkboxRow}
                  onPress={() => toggleChangeType(change)}
                  testID={`filter-change-${change}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      filters.changeType.includes(change) && styles.checkboxChecked,
                    ]}
                  >
                    {filters.changeType.includes(change) && (
                      <Text style={styles.checkboxMark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>{change}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Severity</Text>
              <Picker
                selectedValue={filters.severity}
                style={styles.severityPicker}
                onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, severity: value }))
                }
                testID="filter-severity"
              >
                {severities.map(severity => (
                  <Picker.Item
                    key={severity}
                    label={severity}
                    value={severity}
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={styles.applyFiltersButton}
              onPress={performSearch}
              testID="apply-filters-button"
            >
              <Text style={styles.applyFiltersButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Saved Searches */}
        {savedSearches.length > 0 && (
          <View style={styles.savedSearchesContainer}>
            <View style={styles.savedSearchesHeader}>
              <Text style={styles.savedSearchesTitle}>Saved Searches</Text>
              <TouchableOpacity
                style={styles.saveSearchButton}
                onPress={() => setShowSaveDialog(true)}
                testID="save-search-button"
              >
                <Text style={styles.saveSearchButtonText}>+ Save Current</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={savedSearches}
              renderItem={renderSavedSearch}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              testID="saved-searches-list"
            />
          </View>
        )}

        {/* Search Results */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : results.length > 0 ? (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>
              Found {results.length} results
            </Text>
            <FlatList
              data={results}
              renderItem={renderResult}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              testID="search-results-list"
            />
          </View>
        ) : searchQuery && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No results found</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Save Search Dialog */}
      <Modal
        visible={showSaveDialog}
        transparent
        animationType="fade"
        testID="save-search-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Search</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter search name"
              value={searchName}
              onChangeText={setSearchName}
              testID="save-search-input"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSaveDialog(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveSearch}
                testID="save-search-confirm"
              >
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  searchHeader: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#999',
  },
  searchBoxContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  quickFiltersContainer: {
    marginBottom: 16,
  },
  quickFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  quickFiltersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickFilterButton: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickFilterText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
  },
  advancedFilterToggle: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  advancedFilterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  advancedFiltersPanel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#333',
  },
  severityPicker: {
    height: 40,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  applyFiltersButton: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  applyFiltersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  savedSearchesContainer: {
    marginBottom: 16,
  },
  savedSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savedSearchesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  saveSearchButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  saveSearchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  savedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  savedSearchContent: {
    flex: 1,
  },
  savedSearchName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  savedSearchQuery: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  savedSearchLastUsed: {
    fontSize: 11,
    color: '#999',
  },
  deleteButton: {
    fontSize: 16,
    color: '#f44336',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  resultRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  resultContent: {},
  resultTimestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  resultAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultSummary: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
