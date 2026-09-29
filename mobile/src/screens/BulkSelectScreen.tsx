/**
 * Bulk Select Screen
 * Multi-select interface for choosing items to bulk operate on
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  CheckBox,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

interface Item {
  id: string;
  title: string;
  type: 'inspection' | 'maintenance' | 'document' | 'covenant' | 'analytics';
  status: string;
  date?: string;
}

interface BulkSelectScreenProps {
  items: Item[];
  loading?: boolean;
  onSelectionChange: (selected: string[]) => void;
  onBulkActionStart: (selectedIds: string[]) => void;
  maxSelectable?: number;
}

export const BulkSelectScreen: React.FC<BulkSelectScreenProps> = ({
  items,
  loading = false,
  onSelectionChange,
  onBulkActionStart,
  maxSelectable = 1000,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [featureFilter, setFeatureFilter] = useState<string | null>(null);

  const featureIcons: Record<string, string> = {
    inspection: '📋',
    maintenance: '🔧',
    document: '📄',
    covenant: '📑',
    analytics: '📊',
  };

  // Filter items based on search and feature filter
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFeature = !featureFilter || item.type === featureFilter;
      return matchesSearch && matchesFeature;
    });
  }, [items, searchQuery, featureFilter]);

  const handleToggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        if (newSet.size < maxSelectable) {
          newSet.add(id);
        }
      }
      onSelectionChange(Array.from(newSet));
      return newSet;
    });
  }, [maxSelectable, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(filteredItems.slice(0, maxSelectable).map(i => i.id));
    setSelectedIds(allIds);
    onSelectionChange(Array.from(allIds));
  }, [filteredItems, maxSelectable, onSelectionChange]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionChange([]);
  }, [onSelectionChange]);

  const isMaxReached = selectedIds.size >= maxSelectable;
  const allFiltered = filteredItems.length > 0 &&
    selectedIds.size === filteredItems.length;

  const renderItem = ({ item }: { item: Item }) => (
    <Card key={item.id} style={styles.itemCard}>
      <TouchableOpacity
        style={[
          styles.itemContent,
          selectedIds.has(item.id) && styles.itemSelected,
        ]}
        onPress={() => handleToggleItem(item.id)}
        disabled={isMaxReached && !selectedIds.has(item.id)}
      >
        <CheckBox
          value={selectedIds.has(item.id)}
          onValueChange={() => handleToggleItem(item.id)}
          disabled={isMaxReached && !selectedIds.has(item.id)}
        />
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Badge label={featureIcons[item.type]} />
          </View>
          <View style={styles.itemMeta}>
            <Text style={styles.status}>{item.status}</Text>
            {item.date && (
              <>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.date}>{item.date}</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No Items Found</Text>
      <Text style={styles.emptyMessage}>
        {searchQuery ? 'Try a different search' : 'No items available'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Select Items</Text>
        {selectedIds.size > 0 && (
          <Badge
            label={`${selectedIds.size} Selected`}
            style={styles.selectedBadge}
          />
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Feature Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterTabs}
        contentContainerStyle={styles.filterTabsContent}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            !featureFilter && styles.filterTabActive,
          ]}
          onPress={() => setFeatureFilter(null)}
        >
          <Text style={[
            styles.filterTabText,
            !featureFilter && styles.filterTabTextActive,
          ]}>
            All
          </Text>
        </TouchableOpacity>
        {(['inspection', 'maintenance', 'document', 'covenant'] as const).map(feature => (
          <TouchableOpacity
            key={feature}
            style={[
              styles.filterTab,
              featureFilter === feature && styles.filterTabActive,
            ]}
            onPress={() => setFeatureFilter(feature)}
          >
            <Text style={[
              styles.filterTabText,
              featureFilter === feature && styles.filterTabTextActive,
            ]}>
              {featureIcons[feature]} {feature.charAt(0).toUpperCase() + feature.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Selection Actions */}
      {filteredItems.length > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            onPress={handleSelectAll}
            disabled={allFiltered}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Select All</Text>
          </TouchableOpacity>
          {selectedIds.size > 0 && (
            <TouchableOpacity
              onPress={handleClearSelection}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Items List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : filteredItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Footer Actions */}
      {selectedIds.size > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            label={`Bulk Action (${selectedIds.size})`}
            onPress={() => onBulkActionStart(Array.from(selectedIds))}
            style={styles.proceedButton}
          />
          <Button
            label="Cancel"
            onPress={handleClearSelection}
            style={[styles.proceedButton, styles.cancelButton]}
          />
        </View>
      )}

      {/* Max Selection Warning */}
      {isMaxReached && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            Maximum {maxSelectable} items can be selected
          </Text>
        </View>
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
  selectedBadge: {
    backgroundColor: '#1976d2',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    fontSize: 14,
    color: '#212121',
  },
  filterTabs: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#1976d2',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  itemCard: {
    marginBottom: 0,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingVertical: 8,
  },
  itemSelected: {
    backgroundColor: '#E3F2FD',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  status: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  separator: {
    fontSize: 8,
    color: '#ccc',
  },
  date: {
    fontSize: 11,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  proceedButton: {
    flex: 1,
    marginBottom: 0,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  warningContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff3e0',
    borderTopWidth: 1,
    borderTopColor: '#ffe0b2',
  },
  warningText: {
    fontSize: 12,
    color: '#e65100',
    fontWeight: '500',
  },
});
