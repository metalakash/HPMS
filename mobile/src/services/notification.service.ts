/**
 * Notification Service
 * API integration for notifications, preferences, and alert rules
 */

import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'notifications_cache';
const PREFERENCES_KEY = 'notification_preferences';
const RULES_CACHE_KEY = 'alert_rules_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface Notification {
  id: string;
  type: 'inspection' | 'maintenance' | 'document' | 'analytics' | 'covenant' | 'system';
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  featureId?: string;
  priority: 'high' | 'medium' | 'low';
  userId: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  inspections: 'all' | 'important' | 'none';
  maintenance: 'all' | 'important' | 'none';
  documents: 'all' | 'important' | 'none';
  analytics: 'all' | 'important' | 'none';
  covenants: 'all' | 'important' | 'none';
  sound: boolean;
  vibration: boolean;
  dndStart?: string;
  dndEnd?: string;
  showBadge: boolean;
  updatedAt: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AlertTrigger;
  conditions: AlertCondition[];
  notification: {
    type: 'immediate' | 'digest';
    frequency?: 'daily' | 'weekly';
    recipients: string[];
  };
  createdAt: string;
  updatedAt: string;
}

type AlertTrigger =
  | 'covenant_breach'
  | 'metric_threshold'
  | 'status_change'
  | 'deadline_approaching'
  | 'approval_needed';

interface AlertCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class NotificationServiceClass {
  private notificationsCache: CacheEntry<Notification[]> | null = null;
  private preferencesCache: CacheEntry<NotificationPreferences> | null = null;
  private rulesCache: CacheEntry<AlertRule[]> | null = null;

  private isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < CACHE_TTL;
  }

  // ==================== Notifications ====================

  async getNotifications(page: number = 1): Promise<Notification[]> {
    try {
      // Check cache
      if (this.isCacheValid(this.notificationsCache)) {
        return this.notificationsCache!.data;
      }

      const response = await api.get(`/notifications?page=${page}&limit=50`);
      const notifications = response.data || [];

      // Update cache
      this.notificationsCache = {
        data: notifications,
        timestamp: Date.now(),
      };

      // Persist to AsyncStorage
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(notifications));

      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Fallback to AsyncStorage
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    }
  }

  async getNotification(id: string): Promise<Notification> {
    try {
      const response = await api.get(`/notifications/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching notification ${id}:`, error);
      throw error;
    }
  }

  async markAsRead(id: string): Promise<void> {
    try {
      await api.put(`/notifications/${id}/read`, {});

      // Update local cache
      if (this.notificationsCache) {
        this.notificationsCache.data = this.notificationsCache.data.map(n =>
          n.id === id ? { ...n, read: true } : n
        );
      }

      // Invalidate cache to sync
      await this.getNotifications();
    } catch (error) {
      console.error(`Error marking notification ${id} as read:`, error);
      throw error;
    }
  }

  async markAsUnread(id: string): Promise<void> {
    try {
      await api.put(`/notifications/${id}/unread`, {});

      // Update local cache
      if (this.notificationsCache) {
        this.notificationsCache.data = this.notificationsCache.data.map(n =>
          n.id === id ? { ...n, read: false } : n
        );
      }

      // Invalidate cache to sync
      await this.getNotifications();
    } catch (error) {
      console.error(`Error marking notification ${id} as unread:`, error);
      throw error;
    }
  }

  async deleteNotification(id: string): Promise<void> {
    try {
      await api.delete(`/notifications/${id}`);

      // Update local cache
      if (this.notificationsCache) {
        this.notificationsCache.data = this.notificationsCache.data.filter(n => n.id !== id);
      }
    } catch (error) {
      console.error(`Error deleting notification ${id}:`, error);
      throw error;
    }
  }

  async clearAllNotifications(): Promise<void> {
    try {
      await api.delete(`/notifications`);

      // Clear cache
      this.notificationsCache = null;
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing notifications:', error);
      throw error;
    }
  }

  // ==================== Push Tokens ====================

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    try {
      await api.post('/push-tokens/register', {
        token,
        platform,
      });

      // Store locally
      await AsyncStorage.setItem(`push_token_${platform}`, token);
    } catch (error) {
      console.error('Error registering push token:', error);
      throw error;
    }
  }

  async unregisterPushToken(): Promise<void> {
    try {
      await api.delete('/push-tokens/unregister');

      // Clear stored tokens
      await AsyncStorage.removeItem('push_token_ios');
      await AsyncStorage.removeItem('push_token_android');
    } catch (error) {
      console.error('Error unregistering push token:', error);
      throw error;
    }
  }

  // ==================== Preferences ====================

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      // Check cache
      if (this.isCacheValid(this.preferencesCache)) {
        return this.preferencesCache!.data;
      }

      const response = await api.get('/notification-preferences');
      const preferences = response.data;

      // Update cache
      this.preferencesCache = {
        data: preferences,
        timestamp: Date.now(),
      };

      // Persist to AsyncStorage
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));

      return preferences;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      // Fallback to AsyncStorage
      try {
        const cached = await AsyncStorage.getItem(PREFERENCES_KEY);
        return cached
          ? JSON.parse(cached)
          : this.getDefaultPreferences();
      } catch {
        return this.getDefaultPreferences();
      }
    }
  }

  async updateNotificationPreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const response = await api.put('/notification-preferences', preferences);
      const updated = response.data;

      // Update cache
      this.preferencesCache = {
        data: updated,
        timestamp: Date.now(),
      };

      // Persist to AsyncStorage
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));

      return updated;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      inspections: 'all',
      maintenance: 'all',
      documents: 'all',
      analytics: 'all',
      covenants: 'all',
      sound: true,
      vibration: true,
      showBadge: true,
      updatedAt: new Date().toISOString(),
    };
  }

  // ==================== Alert Rules ====================

  async getAlertRules(): Promise<AlertRule[]> {
    try {
      // Check cache
      if (this.isCacheValid(this.rulesCache)) {
        return this.rulesCache!.data;
      }

      const response = await api.get('/alert-rules');
      const rules = response.data || [];

      // Update cache
      this.rulesCache = {
        data: rules,
        timestamp: Date.now(),
      };

      return rules;
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      return [];
    }
  }

  async getAlertRule(id: string): Promise<AlertRule> {
    try {
      const response = await api.get(`/alert-rules/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching alert rule ${id}:`, error);
      throw error;
    }
  }

  async createAlertRule(data: Partial<AlertRule>): Promise<AlertRule> {
    try {
      const response = await api.post('/alert-rules', data);
      const newRule = response.data;

      // Invalidate cache
      this.rulesCache = null;

      return newRule;
    } catch (error) {
      console.error('Error creating alert rule:', error);
      throw error;
    }
  }

  async updateAlertRule(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
    try {
      const response = await api.put(`/alert-rules/${id}`, data);
      const updated = response.data;

      // Invalidate cache
      this.rulesCache = null;

      return updated;
    } catch (error) {
      console.error(`Error updating alert rule ${id}:`, error);
      throw error;
    }
  }

  async deleteAlertRule(id: string): Promise<void> {
    try {
      await api.delete(`/alert-rules/${id}`);

      // Invalidate cache
      this.rulesCache = null;
    } catch (error) {
      console.error(`Error deleting alert rule ${id}:`, error);
      throw error;
    }
  }

  async testAlertRule(id: string): Promise<void> {
    try {
      await api.post(`/alert-rules/${id}/test`, {});
    } catch (error) {
      console.error(`Error testing alert rule ${id}:`, error);
      throw error;
    }
  }

  // ==================== Cache Management ====================

  invalidateCache(): void {
    this.notificationsCache = null;
    this.preferencesCache = null;
    this.rulesCache = null;
  }

  async clearCache(): Promise<void> {
    this.invalidateCache();
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(PREFERENCES_KEY);
  }
}

export const notificationService = new NotificationServiceClass();
