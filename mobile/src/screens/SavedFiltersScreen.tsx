/**
 * Saved Filters Screen
 * Manage saved filter collections with quick-apply and sharing
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  feature: string;
  filterCount: number;
  isDefault: boolean;
  sharedWith: string[];
  createdAt: string;
}

interface SavedFiltersScreenProps {
  filters: SavedFilter[];
  loading: boolean;
  onApplyFilter: (filterId: string) => void;
  onEditFilter: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onCreateFilter: () => void;
  onShareFilter: (filterId: string) => void;
}

export const SavedFiltersScreen: React.FC<SavedFiltersScreenProps> = ({
  filters,
  loading,
  onApplyFilter,
  onEditFilter,
  onDeleteFilter,
  onCreateFilter,
  onShareFilter,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const features = [
    { id: 'all', label: 'All Features' },
    { id: 'inspections', label: 'Inspections' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'documents', label: 'Documents' },
    { id: 'covenants', label: 'Covenants' },
  ];

  const featureIcons: Record<string, string> = {
    inspections: '📋',
    maintenance: '🔧',
    documents: '📄',
    covenants: '📑',
    all: '🔍',
  };

  const filteredFilters = selectedFeature && selectedFeature !== 'all'
    ? filters.filter(f => f.feature === selectedFeature)
    : filters;

  const handleDeleteFilter = useCallback((filterId: string, filterName: string) => {
    Alert.alert(
      'Delete Filter',
      `Delete "${filterName}"?`,
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: () => onDeleteFilter(filterId),
          style: 'destructive',
        },
      ]
    );
  }, [onDeleteFilter]);

  const handleSetDefault = useCallback((filterId: string) => {
    Alert.alert('Set as Default', 'Use this filter by default when searching?', [
      { text: 'Cancel', onPress: () => {} },
      { text: 'Set', onPress: () => {
        // In real app, call setDefaultFilter API
        Alert.alert('Success', 'Filter set as default');
      }},
    ]);
  }, []);

  const renderFilterItem = ({ item }: { item: SavedFilter }) => (
    <Card key={item.id} style={styles.filterCard}>
      <TouchableOpacity
        style={styles.filterHeader}
        onPress={() => setExpandedFilter(expandedFilter === item.id ? null : item.id)}
      >
        <View style={styles.filterInfo}>
          <Text style={styles.featureIcon}>{featureIcons[item.feature]}</Text>
          <View style={styles.filterText}>
            <Text style={styles.filterName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.filterDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
          <Text style={styles.filterCount}>{item.filterCount}</Text>
        </View>
        <Text style={styles.expandIcon}>
          {expandedFilter === item.id ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expandedFilter === item.id && (
        <View style={styles.filterDetails}>
          <View style={styles.detailsRow}>
            <Text style={styles.detailLabel}>Feature:</Text>
            <Text style={styles.detailValue}>{item.feature}</Text>
          </View>

          {item.sharedWith.length > 0 && (
            <View style={styles.detailsRow}>
              <Text style={styles.detailLabel}>Shared with:</Text>
              <View style={styles.sharedList}>
                {item.sharedWith.map(person => (
                  <Badge key={person} label={person} />
                ))}
              </View>
            </View>
          )}

          <View style={styles.detailsRow}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>⭐ Default Filter</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              label="Apply"
              onPress={() => onApplyFilter(item.id)}
              style={styles.actionButton}
            />
            <Button
              label="Edit"
              onPress={() => onEditFilter(item.id)}
              style={styles.actionButton}
            />
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => {
                Alert.alert('Options', '', [
                  {
                    text: item.isDefault ? 'Unset Default' : 'Set as Default',
                    onPress: () => handleSetDefault(item.id),
                  },
                  {
                    text: 'Share',
                    onPress: () => onShareFilter(item.id),
                  },
                  {
                    text: 'Delete',
                    onPress: () => handleDeleteFilter(item.id, item.name),
                    style: 'destructive',
                  },
                  { text: 'Cancel', onPress: () => {} },
                ]);
              }}
            >
              <Text style={styles.moreButtonText}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎯</Text>
      <Text style={styles.emptyTitle}>No Saved Filters</Text>
      <Text style={styles.emptyMessage}>
        Create filters to save your search preferences
      </Text>
      <Button label="Create Filter" onPress={onCreateFilter} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Saved Filters</Text>
        <TouchableOpacity onPress={onCreateFilter} style={styles.createButton}>
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Feature Filter */}
      <ScrollView
        horizontal
        style={styles.featureScroll}
        contentContainerStyle={styles.featureScrollContent}
        showsHorizontalScrollIndicator={false}
      >
        {features.map(feature => (
          <TouchableOpacity
            key={feature.id}
            style={[
              styles.featureTab,
              (!selectedFeature && feature.id === 'all') || selectedFeature === feature.id
                ? styles.featureTabActive
                : null,
            ]}
            onPress={() =>
              setSelectedFeature(feature.id === 'all' ? null : feature.id)
            }
          >
            <Text style={styles.featureTabText}>{feature.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filters List */}
      {filteredFilters.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredFilters}
          renderItem={renderFilterItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  createButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1976d2',
    borderRadius: 6,
  },
  createButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  featureScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  featureScrollContent: {
    paddingHorizontal: 8,
    gap: 4,
  },
  featureTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  featureTabActive: {
    backgroundColor: '#1976d2',
  },
  featureTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  filterCard: {
    marginBottom: 0,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 18,
  },
  filterText: {
    flex: 1,
  },
  filterName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  filterDescription: {
    fontSize: 12,
    color: '#999',
  },
  filterCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
  },
  expandIcon: {
    fontSize: 20,
    color: '#666',
    width: 30,
    textAlign: 'right',
  },
  filterDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 12,
    color: '#212121',
    fontWeight: '500',
  },
  sharedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  defaultBadge: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
    marginBottom: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#856404',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    marginBottom: 0,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButtonText: {
    fontSize: 18,
    color: '#666',
  },
  separator: {
    height: 4,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
});
