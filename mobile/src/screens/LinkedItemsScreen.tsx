/**
 * Linked Items Screen
 * Display and manage linked items for a specific record
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';

interface LinkedItem {
  id: string;
  name: string;
  type: string;
  status: string;
  strength: 'weak' | 'medium' | 'strong';
  linkedDate: string;
}

interface LinkStats {
  total: number;
  byStrength: { weak: number; medium: number; strong: number };
  lastUpdated: string;
}

export const LinkedItemsScreen: React.FC<{ recordId: string; recordName: string }> = ({
  recordId,
  recordName,
}) => {
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [linkStats, setLinkStats] = useState<LinkStats | null>(null);
  const [loading, setLoading] = useState(true);

  const tabs = ['All', 'Inspections', 'Work Orders', 'Compliance', 'Reports'];

  useEffect(() => {
    loadLinkedItems();
  }, []);

  const loadLinkedItems = useCallback(async () => {
    setLoading(true);
    try {
      const mockItems: LinkedItem[] = [
        {
          id: 'insp-1',
          name: 'Inspection #45',
          type: 'inspections',
          status: 'completed',
          strength: 'strong',
          linkedDate: '2026-09-28',
        },
        {
          id: 'wo-1',
          name: 'Work Order #78',
          type: 'workorders',
          status: 'in-progress',
          strength: 'strong',
          linkedDate: '2026-09-27',
        },
        {
          id: 'comp-1',
          name: 'Compliance #12',
          type: 'compliance',
          status: 'pending',
          strength: 'medium',
          linkedDate: '2026-09-26',
        },
      ];

      setLinkedItems(mockItems);
      setLinkStats({
        total: 12,
        byStrength: { weak: 3, medium: 4, strong: 5 },
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error loading linked items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeLink = (itemId: string) => {
    Alert.alert('Remove Link', 'Are you sure you want to unlink this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setLinkedItems(prev => prev.filter(i => i.id !== itemId));
        },
      },
    ]);
  };

  const getStrengthColor = (strength: string): string => {
    switch (strength) {
      case 'strong':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'weak':
        return '#999';
      default:
        return '#757575';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in-progress':
        return '#2196F3';
      case 'pending':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  const renderLinkedItem = ({ item }: { item: LinkedItem }) => (
    <View style={styles.itemRow} testID={`linked-item-${item.id}`}>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          <View
            style={[
              styles.strengthIndicator,
              { backgroundColor: getStrengthColor(item.strength) },
            ]}
          />
          <Text style={styles.linkedDate}>Linked {item.linkedDate}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeLink(item.id)}
        testID={`remove-link-${item.id}`}
      >
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="linked-items-screen">
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Linked Items</Text>
          <Text style={styles.recordName}>{recordName}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  selectedTab === tab.toLowerCase() && styles.tabActive,
                ]}
                onPress={() => setSelectedTab(tab.toLowerCase())}
                testID={`tab-${tab.toLowerCase()}`}
              >
                <Text
                  style={[
                    styles.tabText,
                    selectedTab === tab.toLowerCase() && styles.tabTextActive,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Link Statistics */}
        {linkStats && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionLabel}>Link Statistics</Text>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Links:</Text>
                <Text style={styles.statValue}>{linkStats.total}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Strong:</Text>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                  {linkStats.byStrength.strong}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Medium:</Text>
                <Text style={[styles.statValue, { color: '#FF9800' }]}>
                  {linkStats.byStrength.medium}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Weak:</Text>
                <Text style={[styles.statValue, { color: '#999' }]}>
                  {linkStats.byStrength.weak}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Linked Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionLabel}>Linked Items ({linkedItems.length})</Text>
          {linkedItems.length > 0 ? (
            <FlatList
              data={linkedItems}
              renderItem={renderLinkedItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              testID="linked-items-list"
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No linked items</Text>
            </View>
          )}
        </View>

        {/* Bulk Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton} testID="add-link-button">
            <Text style={styles.actionButtonText}>+ Add Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            testID="bulk-unlink-button"
          >
            <Text style={styles.actionButtonSecondaryText}>Unlink All</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  headerSection: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recordName: {
    fontSize: 14,
    color: '#666',
  },
  tabsSection: {
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tabActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  statsSection: {
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  itemsSection: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  strengthIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  linkedDate: {
    fontSize: 10,
    color: '#999',
  },
  removeButton: {
    padding: 8,
  },
  removeText: {
    fontSize: 16,
    color: '#f44336',
    fontWeight: 'bold',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonSecondaryText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
});
