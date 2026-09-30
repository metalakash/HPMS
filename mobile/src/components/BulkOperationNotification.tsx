/**
 * Bulk Operation Notification
 * Toast-style notification for bulk operation start/completion
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NotificationType = 'started' | 'completed' | 'failed' | 'cancelled';

interface BulkOperationNotificationProps {
  visible: boolean;
  type: NotificationType;
  operationType: string;
  itemCount: number;
  successful?: number;
  failed?: number;
  onDismiss: () => void;
  onViewResults?: () => void;
  autoDismissAfter?: number;
}

export const BulkOperationNotification: React.FC<BulkOperationNotificationProps> = ({
  visible,
  type,
  operationType,
  itemCount,
  successful = 0,
  failed = 0,
  onDismiss,
  onViewResults,
  autoDismissAfter = 5000,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after timeout
      timeoutRef.current = setTimeout(() => {
        dismiss();
      }, autoDismissAfter);
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, autoDismissAfter, slideAnim]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  const getNotificationConfig = () => {
    switch (type) {
      case 'started':
        return {
          icon: '⏳',
          title: 'Operation Started',
          message: `Bulk ${operationType} started for ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
          backgroundColor: '#E3F2FD',
          borderColor: '#1976d2',
          textColor: '#1976d2',
        };
      case 'completed':
        return {
          icon: '✓',
          title: 'Operation Completed',
          message: `Successfully processed ${successful || itemCount} item${itemCount !== 1 ? 's' : ''}`,
          backgroundColor: '#f1f8e9',
          borderColor: '#388e3c',
          textColor: '#388e3c',
        };
      case 'failed':
        return {
          icon: '✗',
          title: 'Operation Failed',
          message: `${failed || itemCount} item${failed !== 1 ? 's' : ''} failed to process`,
          backgroundColor: '#ffebee',
          borderColor: '#d32f2f',
          textColor: '#d32f2f',
        };
      case 'cancelled':
        return {
          icon: '⊘',
          title: 'Operation Cancelled',
          message: `Bulk ${operationType} was cancelled`,
          backgroundColor: '#fff3e0',
          borderColor: '#f57c00',
          textColor: '#f57c00',
        };
    }
  };

  const config = getNotificationConfig();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <View
        style={[
          styles.notification,
          {
            backgroundColor: config.backgroundColor,
            borderColor: config.borderColor,
          },
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>{config.icon}</Text>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: config.textColor }]}>
              {config.title}
            </Text>
            <Text style={styles.message}>{config.message}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {type === 'completed' && onViewResults && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                dismiss();
                onViewResults();
              }}
            >
              <Text style={[styles.actionText, { color: config.textColor }]}>
                View Results →
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={dismiss}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  notification: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 24,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  closeIcon: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
});
