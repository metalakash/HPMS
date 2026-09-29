/**
 * Advanced Search Modal
 * Full-text search across all features with suggestions and history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface AdvancedSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string, features?: string[]) => void;
  searchHistory: string[];
  onClearHistory: () => void;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  visible,
  onClose,
  onSearch,
  searchHistory,
  onClearHistory,
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [allFeatures, setAllFeatures] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const features = [
    { id: 'inspections', label: 'Inspections', icon: '📋' },
    { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'covenants', label: 'Covenants', icon: '📑' },
  ];

  // Fetch suggestions based on query
  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Simulate API call - in real app, call searchService.getSearchSuggestions()
      await new Promise(r => setTimeout(r, 300));

      // Mock suggestions
      const mockSuggestions = [
        `${text} - Inspections`,
        `${text} - Recent`,
        `${text} in maintenance`,
        `${text} - Documents`,
        `${text} - Covenants`,
      ];

      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    fetchSuggestions(text);
  }, [fetchSuggestions]);

  const handleToggleFeature = useCallback((featureId: string) => {
    setSelectedFeatures(prev => {
      if (prev.includes(featureId)) {
        return prev.filter(id => id !== featureId);
      } else {
        return [...prev, featureId];
      }
    });
  }, []);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      const searchFeatures = selectedFeatures.length > 0 ? selectedFeatures : undefined;
      onSearch(query, searchFeatures);
      onClose();
    }
  }, [query, selectedFeatures, onSearch, onClose]);

  const handleSearchHistory = useCallback((historyItem: string) => {
    setQuery(historyItem);
    onSearch(historyItem);
    onClose();
  }, [onSearch, onClose]);

  const renderSuggestionItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => {
        setQuery(item);
        fetchSuggestions(item);
      }}
    >
      <Text style={styles.suggestionText}>🔍 {item}</Text>
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleSearchHistory(item)}
    >
      <Text style={styles.historyText}>🕐 {item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Search</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
          {/* Search Input */}
          <Card style={styles.searchCard}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search inspections, work orders, documents..."
                value={query}
                onChangeText={handleQueryChange}
                placeholderTextColor="#999"
                autoFocus
              />
              {query && (
                <TouchableOpacity onPress={() => handleQueryChange('')}>
                  <Text style={styles.clearButton}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Feature Selection */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Search In</Text>
            <View style={styles.featureToggle}>
              <TouchableOpacity
                style={[styles.allFeaturesButton, allFeatures && styles.allFeaturesActive]}
                onPress={() => {
                  setAllFeatures(!allFeatures);
                  if (!allFeatures) {
                    setSelectedFeatures([]);
                  }
                }}
              >
                <Text
                  style={[
                    styles.allFeaturesText,
                    allFeatures && styles.allFeaturesTextActive,
                  ]}
                >
                  All Features
                </Text>
              </TouchableOpacity>
            </View>

            {!allFeatures && (
              <View style={styles.featureGrid}>
                {features.map(feature => (
                  <TouchableOpacity
                    key={feature.id}
                    style={[
                      styles.featureButton,
                      selectedFeatures.includes(feature.id) && styles.featureButtonActive,
                    ]}
                    onPress={() => handleToggleFeature(feature.id)}
                  >
                    <Text style={styles.featureIcon}>{feature.icon}</Text>
                    <Text
                      style={[
                        styles.featureLabel,
                        selectedFeatures.includes(feature.id) && styles.featureLabelActive,
                      ]}
                    >
                      {feature.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>

          {/* Suggestions */}
          {query && suggestions.length > 0 && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Suggestions</Text>
              {loading ? (
                <ActivityIndicator size="small" color="#1976d2" />
              ) : (
                <FlatList
                  data={suggestions}
                  renderItem={renderSuggestionItem}
                  keyExtractor={(item, index) => `suggestion-${index}`}
                  scrollEnabled={false}
                />
              )}
            </Card>
          )}

          {/* Search History */}
          {!query && searchHistory.length > 0 && (
            <Card style={styles.section}>
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={onClearHistory}>
                  <Text style={styles.clearHistoryButton}>Clear</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={searchHistory}
                renderItem={renderHistoryItem}
                keyExtractor={(item, index) => `history-${index}`}
                scrollEnabled={false}
              />
            </Card>
          )}

          {/* Quick Filters */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Filters</Text>
            <View style={styles.quickFilters}>
              <TouchableOpacity style={styles.quickFilter}>
                <Text style={styles.quickFilterText}>📅 This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickFilter}>
                <Text style={styles.quickFilterText}>⭐ Starred</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickFilter}>
                <Text style={styles.quickFilterText}>🔴 High Priority</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickFilter}>
                <Text style={styles.quickFilterText}>⏳ Pending</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Tips */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Search Tips</Text>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>• Use quotes for exact matches: "covenant breach"</Text>
              <Text style={styles.tipItem}>• Use - to exclude: inspection -draft</Text>
              <Text style={styles.tipItem}>• Search by date: after:2024-01-01</Text>
              <Text style={styles.tipItem}>• Use AND/OR: inspection AND pending</Text>
            </View>
          </Card>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Button
            label="Clear"
            onPress={() => {
              setQuery('');
              setSuggestions([]);
            }}
            style={styles.clearActionButton}
            disabled={!query}
          />
          <Button
            label="Search"
            onPress={handleSearch}
            disabled={!query.trim()}
            style={styles.searchButton}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  searchCard: {
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 16,
    color: '#212121',
  },
  clearButton: {
    fontSize: 18,
    color: '#999',
    padding: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  featureToggle: {
    marginBottom: 8,
  },
  allFeaturesButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  allFeaturesActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1565c0',
  },
  allFeaturesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  allFeaturesTextActive: {
    color: '#fff',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  featureButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  featureIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  featureLabelActive: {
    color: '#1976d2',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#212121',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyText: {
    fontSize: 14,
    color: '#666',
  },
  clearHistoryButton: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d32f2f',
  },
  quickFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFilter: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  clearActionButton: {
    flex: 1,
    marginBottom: 0,
  },
  searchButton: {
    flex: 1,
  },
});
