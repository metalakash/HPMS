/**
 * Custom React Hooks for Notifications
 * Provides notifications, preferences, and alert rule management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  notificationService,
  Notification,
  NotificationPreferences,
  AlertRule,
} from '../services/notification.service';
import { pushNotificationManager } from '../services/push-notification-manager';
import { alertRuleManager, AlertEvent } from '../services/alert-rule-manager';

// ==================== useNotifications ====================

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMounted = useRef(true);

  // Calculate unread count
  const calculateUnreadCount = useCallback((notifs: Notification[]) => {
    return notifs.filter(n => !n.read).length;
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const data = await notificationService.getNotifications();
      if (isMounted.current) {
        setNotifications(data);
        setUnreadCount(calculateUnreadCount(data));
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err as Error).message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [calculateUnreadCount]);

  // Initial fetch on mount
  useEffect(() => {
    fetchNotifications();

    return () => {
      isMounted.current = false;
    };
  }, [fetchNotifications]);

  // Refetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  // Mark as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await notificationService.markAsRead(notificationId);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },
    []
  );

  // Mark as unread
  const markAsUnread = useCallback(
    async (notificationId: string) => {
      try {
        await notificationService.markAsUnread(notificationId);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, read: false } : n
          )
        );
        setUnreadCount(prev => prev + 1);
      } catch (err) {
        console.error('Error marking notification as unread:', err);
      }
    },
    []
  );

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        const wasUnread = !notifications.find(n => n.id === notificationId)?.read;
        await notificationService.deleteNotification(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Error deleting notification:', err);
      }
    },
    [notifications]
  );

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await notificationService.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  }, []);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAsUnread,
    deleteNotification,
    clearAll,
    refetch: fetchNotifications,
  };
};

// ==================== useNotificationPreferences ====================

export const useNotificationPreferences = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const data = await notificationService.getNotificationPreferences();
      if (isMounted.current) {
        setPreferences(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err as Error).message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchPreferences();

    return () => {
      isMounted.current = false;
    };
  }, [fetchPreferences]);

  // Update preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      try {
        const updated = await notificationService.updateNotificationPreferences(updates);
        if (isMounted.current) {
          setPreferences(updated);
        }
      } catch (err) {
        console.error('Error updating preferences:', err);
        throw err;
      }
    },
    []
  );

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refetch: fetchPreferences,
  };
};

// ==================== useAlertRules ====================

export const useAlertRules = () => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const data = await notificationService.getAlertRules();
      if (isMounted.current) {
        setRules(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err as Error).message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchRules();

    return () => {
      isMounted.current = false;
    };
  }, [fetchRules]);

  // Create rule
  const createRule = useCallback(
    async (ruleData: Partial<AlertRule>) => {
      try {
        const newRule = await notificationService.createAlertRule(ruleData);
        if (isMounted.current) {
          setRules(prev => [...prev, newRule]);
          await alertRuleManager.addRule(newRule);
        }
        return newRule;
      } catch (err) {
        console.error('Error creating rule:', err);
        throw err;
      }
    },
    []
  );

  // Update rule
  const updateRule = useCallback(
    async (ruleId: string, ruleData: Partial<AlertRule>) => {
      try {
        const updated = await notificationService.updateAlertRule(ruleId, ruleData);
        if (isMounted.current) {
          setRules(prev => prev.map(r => (r.id === ruleId ? updated : r)));
        }
        return updated;
      } catch (err) {
        console.error('Error updating rule:', err);
        throw err;
      }
    },
    []
  );

  // Delete rule
  const deleteRule = useCallback(
    async (ruleId: string) => {
      try {
        await notificationService.deleteAlertRule(ruleId);
        if (isMounted.current) {
          setRules(prev => prev.filter(r => r.id !== ruleId));
          await alertRuleManager.removeRule(ruleId);
        }
      } catch (err) {
        console.error('Error deleting rule:', err);
        throw err;
      }
    },
    []
  );

  // Test rule
  const testRule = useCallback(async (ruleId: string) => {
    try {
      await alertRuleManager.testRule(ruleId);
    } catch (err) {
      console.error('Error testing rule:', err);
      throw err;
    }
  }, []);

  return {
    rules,
    loading,
    error,
    createRule,
    updateRule,
    deleteRule,
    testRule,
    refetch: fetchRules,
  };
};

// ==================== useNotificationSubscription ====================

export const useNotificationSubscription = (onNotification: (event: AlertEvent) => void) => {
  useEffect(() => {
    const unsubscribe = pushNotificationManager.onRemoteNotification((notification: any) => {
      const event: AlertEvent = {
        type: notification.data?.eventType || 'notification',
        featureId: notification.data?.featureId || 'unknown',
        data: notification.data || {},
        timestamp: new Date().toISOString(),
      };

      onNotification(event);
    });

    return unsubscribe;
  }, [onNotification]);
};

// ==================== useNotificationBadge ====================

export const useNotificationBadge = () => {
  const { unreadCount } = useNotifications();
  const [badgeVisible, setBadgeVisible] = useState(false);

  useEffect(() => {
    setBadgeVisible(unreadCount > 0);
    pushNotificationManager.updateBadgeCount(unreadCount);
  }, [unreadCount]);

  const clearBadge = useCallback(() => {
    pushNotificationManager.clearBadge();
  }, []);

  return {
    badgeCount: unreadCount,
    badgeVisible,
    clearBadge,
  };
};

// ==================== useCreateAlertRule ====================

export const useCreateAlertRule = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rules, refetch } = useAlertRules();

  const create = useCallback(
    async (ruleData: Partial<AlertRule>) => {
      setLoading(true);
      setError(null);

      try {
        const newRule = await notificationService.createAlertRule(ruleData);
        await alertRuleManager.addRule(newRule);
        await refetch();
        return newRule;
      } catch (err) {
        const errorMsg = (err as Error).message;
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refetch]
  );

  return {
    create,
    loading,
    error,
  };
};

// ==================== useUpdateAlertRule ====================

export const useUpdateAlertRule = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetch } = useAlertRules();

  const update = useCallback(
    async (ruleId: string, ruleData: Partial<AlertRule>) => {
      setLoading(true);
      setError(null);

      try {
        const updated = await notificationService.updateAlertRule(ruleId, ruleData);
        await refetch();
        return updated;
      } catch (err) {
        const errorMsg = (err as Error).message;
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refetch]
  );

  return {
    update,
    loading,
    error,
  };
};

// ==================== useDeleteAlertRule ====================

export const useDeleteAlertRule = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetch } = useAlertRules();

  const delete_ = useCallback(
    async (ruleId: string) => {
      setLoading(true);
      setError(null);

      try {
        await notificationService.deleteAlertRule(ruleId);
        await alertRuleManager.removeRule(ruleId);
        await refetch();
      } catch (err) {
        const errorMsg = (err as Error).message;
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refetch]
  );

  return {
    delete: delete_,
    loading,
    error,
  };
};

// ==================== useTestAlertRule ====================

export const useTestAlertRule = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const test = useCallback(async (ruleId: string) => {
    setLoading(true);
    setError(null);

    try {
      await alertRuleManager.testRule(ruleId);
    } catch (err) {
      const errorMsg = (err as Error).message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    test,
    loading,
    error,
  };
};
