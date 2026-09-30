/**
 * Search History Screen
 * View and manage search history with quick re-search and analytics
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

interface SearchHistoryItem {
  id: string;
  query: string;
  resultCount: number;
  timestamp: string;
  features: string[];
}

interface SearchHistoryScreenProps {
  items: SearchHistoryItem[];
  loading: boolean;
  onSearch: (query: string) => void;
  onDeleteItem: (id: string) => void;
  onClearHistory: () => void;
  onExport: () => void;
}

export const SearchHistoryScreen: React.FC<SearchHistoryScreenProps> = ({
  items,
  loading,
  onSearch,
  onDeleteItem,
  onClearHistory,
  onExport,
}) => {
  const insets = useSafeAreaInsets();
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  const featureIcons: Record<string, string> = {
    inspections: '📋',
    maintenance: '🔧',
    documents: '📄',
    covenants: '📑',
    analytics: '📊',
  };

  // Sort items
  const sortedItems = sortBy === 'recent'
    ? items
    : [...items].sort((a, b) => b.resultCount - a.resultCount);

  const handleDeleteItem = useCallback(
    (id: string, query: string) => {
      Alert.alert(
        'Delete Search',
        `Delete "${query}" from history?`,
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Delete',
            onPress: () => onDeleteItem(id),
            style: 'destructive',
          },
        ]
      );
    },
    [onDeleteItem]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear History',
      'Delete all search history?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Clear',
          onPress: () => onClearHistory(),
          style: 'destructive',
        },
      ]
    );
  }, [onClearHistory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const renderHistoryItem = ({ item }: { item: SearchHistoryItem }) => (
    <Card key={item.id} style={styles.historyItem}>
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => onSearch(item.query)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.queryText}>{item.query}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.resultCount}>
              {item.resultCount} result{item.resultCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
          </View>
          {item.features.length > 0 && (
            <View style={styles.features}>
              {item.features.map(feature => (
                <Badge
                  key={feature}
                  label={featureIcons[feature]}
                  style={styles.featureBadge}
                />
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteItem(item.id, item.query)}
        >
          <Text style={styles.deleteButtonText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🕐</Text>
      <Text style={styles.emptyTitle}>No Search History</Text>
      <Text style={styles.emptyMessage}>Your searches will appear here</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search History</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearAllButton}>
            <Text style={styles.clearAllButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sort Options */}
      {items.length > 0 && (
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={[styles.sortOption, sortBy === 'recent' && styles.sortOptionActive]}
            onPress={() => setSortBy('recent')}
          >
            <Text
              style={[
                styles.sortOptionText,
                sortBy === 'recent' && styles.sortOptionTextActive,
              ]}
            >
              Recent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortOption, sortBy === 'popular' && styles.sortOptionActive]}
            onPress={() => setSortBy('popular')}
          >
            <Text
              style={[
                styles.sortOptionText,
                sortBy === 'popular' && styles.sortOptionTextActive,
              ]}
            >
              Popular
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* History List */}
      {items.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={sortedItems}
          renderItem={renderHistoryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Footer Actions */}
      {items.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Button
            label="📊 Export"
            onPress={onExport}
            style={styles.footerButton}
          />
          <Button
            label="🔍 Advanced Search"
            onPress={() => {}}
            style={styles.footerButton}
          />
        </View>
      )}

      {/* Stats */}
      {items.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Searches</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {Math.round(items.reduce((sum, item) => sum + item.resultCount, 0) / items.length)}
            </Text>
            <Text style={styles.statLabel}>Avg Results</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {new Set(items.map(item => item.query)).size}
            </Text>
            <Text style={styles.statLabel}>Unique</Text>
          </View>
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
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  clearAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d32f2f',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 4,
  },
  sortOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  sortOptionActive: {
    backgroundColor: '#1976d2',
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  sortOptionTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  historyItem: {
    marginBottom: 0,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
  },
  queryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  resultCount: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '600',
  },
  separator: {
    fontSize: 8,
    color: '#ccc',
  },
  dateText: {
    fontSize: 11,
    color: '#999',
  },
  features: {
    flexDirection: 'row',
    gap: 4,
  },
  featureBadge: {
    marginBottom: 0,
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#999',
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
  footerButton: {
    flex: 1,
    marginBottom: 0,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
});
