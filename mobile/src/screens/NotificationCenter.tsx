/**
 * Notification Center Screen
 * Displays all notifications with read/unread status, filtering, and actions
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SwipeableListView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../hooks/useNotifications';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

export const NotificationCenter = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { notifications, loading, unreadCount, markAsRead, deleteNotification, clearAll } =
    useNotifications();

  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const notificationTypes = [
    { label: 'Inspections', value: 'inspection', icon: '📋' },
    { label: 'Maintenance', value: 'maintenance', icon: '🔧' },
    { label: 'Documents', value: 'document', icon: '📄' },
    { label: 'Analytics', value: 'analytics', icon: '📊' },
    { label: 'Covenants', value: 'covenant', icon: '📑' },
    { label: 'System', value: 'system', icon: '⚙️' },
  ];

  const filteredNotifications = useMemo(() => {
    let result = notifications || [];

    if (filterType === 'unread') {
      result = result.filter(n => !n.read);
    } else if (filterType === 'read') {
      result = result.filter(n => n.read);
    }

    return result;
  }, [notifications, filterType]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  const handleNotificationPress = useCallback(
    (notification: any) => {
      if (!notification.read) {
        markAsRead(notification.id);
      }

      if (notification.actionUrl) {
        navigation.navigate(notification.actionUrl, {
          featureId: notification.featureId,
        });
      }
    },
    [markAsRead, navigation]
  );

  const handleDeletePress = useCallback(
    (notificationId: string) => {
      Alert.alert(
        'Delete Notification',
        'Are you sure you want to delete this notification?',
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Delete',
            onPress: () => deleteNotification(notificationId),
            style: 'destructive',
          },
        ]
      );
    },
    [deleteNotification]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Clear',
          onPress: () => clearAll(),
          style: 'destructive',
        },
      ]
    );
  }, [clearAll]);

  const getNotificationIcon = (type: string) => {
    const typeInfo = notificationTypes.find(t => t.value === type);
    return typeInfo?.icon || '🔔';
  };

  const getNotificationColor = (type: string) => {
    const colorMap: Record<string, string> = {
      inspection: '#4CAF50',
      maintenance: '#FF9800',
      document: '#2196F3',
      analytics: '#9C27B0',
      covenant: '#F44336',
      system: '#607D8B',
    };
    return colorMap[type] || '#607D8B';
  };

  const renderNotificationItem = ({ item: notification }: any) => (
    <TouchableOpacity
      key={notification.id}
      onPress={() => handleNotificationPress(notification)}
      style={styles.notificationContainer}
    >
      <Card style={[styles.notificationCard, !notification.read && styles.unreadCard]}>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[
                styles.notificationIcon,
                { color: getNotificationColor(notification.type) },
              ]}
            >
              {getNotificationIcon(notification.type)}
            </Text>
            <View style={styles.notificationMeta}>
              <Text
                style={[styles.notificationTitle, !notification.read && styles.unreadTitle]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              <Text style={styles.notificationTime}>
                {new Date(notification.createdAt).toLocaleString()}
              </Text>
            </View>
            {!notification.read && <Badge style={styles.unreadBadge} label="NEW" />}
          </View>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePress(notification.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyMessage}>You're all caught up!</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && <Badge label={unreadCount.toString()} style={styles.badge} />}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'unread', 'read'].map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterTab, filterType === type && styles.activeFilterTab]}
            onPress={() => setFilterType(type as any)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === type && styles.activeFilterTabText,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
      />
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
    paddingVertical: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  badge: {
    marginLeft: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d32f2f',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeFilterTab: {
    backgroundColor: '#1976d2',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeFilterTabText: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexGrow: 1,
  },
  notificationContainer: {
    marginHorizontal: 8,
    marginVertical: 4,
  },
  notificationCard: {
    marginBottom: 0,
  },
  unreadCard: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  notificationIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  notificationMeta: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  notificationBody: {
    fontSize: 13,
    color: '#666',
    marginLeft: 32,
    marginRight: 12,
    lineHeight: 18,
  },
  unreadBadge: {
    marginRight: 0,
  },
  deleteButton: {
    marginTop: 8,
    marginLeft: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffebee',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d32f2f',
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
});
