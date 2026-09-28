/**
 * Push Notification Manager
 * Handles iOS APNs and Android FCM integration with local notifications
 */

import { Platform, Alert, AppState } from 'react-native';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { notificationService } from './notification.service';

export interface RemoteNotification {
  messageId?: string;
  notification?: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  sentTime?: number;
  from?: string;
}

export interface LocalNotification {
  id?: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  fireDate?: number;
  soundName?: string;
  vibrate?: boolean;
  playSound?: boolean;
  importance?: 'min' | 'low' | 'default' | 'high' | 'max';
}

type NotificationHandler = (notification: RemoteNotification) => void;
type LocalNotificationHandler = (notification: LocalNotification) => void;

class PushNotificationManagerClass {
  private remoteNotificationHandlers: NotificationHandler[] = [];
  private localNotificationHandlers: LocalNotificationHandler[] = [];
  private badgeCount: number = 0;
  private isInitialized: boolean = false;
  private appState: any = AppState.currentState;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure local push notifications
      PushNotification.configure({
        onNotification: this.handleLocalNotification.bind(this),
        onRegistrationError: (error: any) => {
          console.error('Push notification registration error:', error);
        },
        requestPermissions: false, // Handle manually
        popInitialNotification: true,
        permissions: {
          alert: true,
          badge: true,
          sound: true,
        },
      });

      // iOS-specific setup
      if (Platform.OS === 'ios') {
        PushNotificationIOS.addEventListener('notification', this.handleRemoteNotification.bind(this));
        PushNotificationIOS.addEventListener('registrationError', (error: any) => {
          console.error('iOS notification registration error:', error);
        });
      }

      // Monitor app state for background/foreground transitions
      AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      this.isInitialized = true;
      console.log('Push Notification Manager initialized');
    } catch (error) {
      console.error('Error initializing Push Notification Manager:', error);
      throw error;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        return await this.requestIOSPermissions();
      } else {
        return await this.requestAndroidPermissions();
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  private async requestIOSPermissions(): Promise<boolean> {
    try {
      const permissions = await PushNotificationIOS.requestPermissions(['alert', 'badge', 'sound']);
      const hasPermission = !!(
        permissions.alert ||
        permissions.badge ||
        permissions.sound
      );
      return hasPermission;
    } catch (error) {
      console.error('Error requesting iOS permissions:', error);
      return false;
    }
  }

  private async requestAndroidPermissions(): Promise<boolean> {
    // Android 13+ requires permission, earlier versions use in-app prompts
    try {
      // Check and request POST_NOTIFICATIONS permission for Android 13+
      return true; // Simplified for now
    } catch (error) {
      console.error('Error requesting Android permissions:', error);
      return false;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'ios') {
        // Get iOS APNs token
        return await this.getIOSToken();
      } else {
        // Get Android FCM token
        return await this.getAndroidToken();
      }
    } catch (error) {
      console.error('Error getting notification token:', error);
      return null;
    }
  }

  private async getIOSToken(): Promise<string | null> {
    try {
      const token = await PushNotificationIOS.getDeviceToken();
      return token || null;
    } catch (error) {
      console.error('Error getting iOS token:', error);
      return null;
    }
  }

  private async getAndroidToken(): Promise<string | null> {
    try {
      // For Android, token is provided via FCM initialization
      // This is a placeholder - actual implementation depends on FCM setup
      return PushNotification.getChannels(
        (channels: string[]) => {
          return channels[0] || null;
        }
      );
    } catch (error) {
      console.error('Error getting Android token:', error);
      return null;
    }
  }

  private handleRemoteNotification(notification: any): void {
    console.log('Remote notification received:', notification);

    // Handle notification when app is in foreground
    if (Platform.OS === 'ios') {
      // Process iOS notification
      const remoteNotif: RemoteNotification = {
        messageId: notification.getMessage?.(),
        notification: {
          title: notification.getAlert?.()?.title || 'Notification',
          body: notification.getAlert?.()?.body || '',
        },
        data: notification.getData?.() || {},
      };

      this.notifyRemoteHandlers(remoteNotif);
    }

    // Complete notification handling
    notification.finish(PushNotificationIOS.FetchResult.NoData);
  }

  private handleLocalNotification(notification: any): void {
    console.log('Local notification received:', notification);

    const localNotif: LocalNotification = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      data: notification.data,
    };

    this.notifyLocalHandlers(localNotif);

    // Complete notification
    if (Platform.OS === 'ios') {
      notification.finish(PushNotificationIOS.FetchResult.NoData);
    }
  }

  private handleAppStateChange(nextAppState: any): void {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground
      this.updateBadgeCount();
    }

    this.appState = nextAppState;
  }

  // ==================== Local Notifications ====================

  localNotify(notification: LocalNotification): void {
    try {
      const id = notification.id || Math.random().toString();

      PushNotification.localNotification({
        channelId: 'default-channel',
        autoCancel: true,
        largeIcon: undefined,
        smallIcon: 'ic_notification',
        vibrate: notification.vibrate ?? true,
        vibration: notification.vibrate ? 300 : 0,
        playSound: notification.playSound ?? true,
        soundName: notification.soundName ?? 'default',
        title: notification.title,
        message: notification.message,
        userInteraction: false,
        importance: notification.importance ?? 'high',
        data: notification.data || {},
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  localNotifyScheduled(notification: LocalNotification, delayMs: number): void {
    try {
      const fireDate = new Date(Date.now() + delayMs);

      PushNotification.localNotificationSchedule({
        channelId: 'default-channel',
        autoCancel: true,
        title: notification.title,
        message: notification.message,
        fireDate: fireDate.toISOString(),
        vibrate: notification.vibrate ?? true,
        playSound: notification.playSound ?? true,
        soundName: notification.soundName ?? 'default',
        userInteraction: false,
        importance: notification.importance ?? 'default',
        data: notification.data || {},
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  // ==================== Badge Management ====================

  updateBadgeCount(count?: number): void {
    try {
      if (count !== undefined) {
        this.badgeCount = count;
      }

      if (Platform.OS === 'ios') {
        PushNotificationIOS.setApplicationIconBadgeNumber(this.badgeCount);
      } else {
        // Android notification badge handled differently per launcher
        PushNotification.setApplicationIconBadgeNumber(this.badgeCount);
      }
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  incrementBadgeCount(): void {
    this.updateBadgeCount(this.badgeCount + 1);
  }

  decrementBadgeCount(): void {
    this.updateBadgeCount(Math.max(0, this.badgeCount - 1));
  }

  clearBadge(): void {
    this.updateBadgeCount(0);
  }

  // ==================== Sound & Vibration ====================

  playSound(soundName: string): void {
    try {
      PushNotification.playSound(soundName);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  triggerVibration(pattern: number[]): void {
    try {
      if (Platform.OS === 'android') {
        PushNotification.vibrate(pattern);
      } else {
        // iOS doesn't support vibration patterns, just trigger
        PushNotification.vibrate();
      }
    } catch (error) {
      console.error('Error triggering vibration:', error);
    }
  }

  // ==================== Handlers ====================

  onRemoteNotification(handler: NotificationHandler): () => void {
    this.remoteNotificationHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      this.remoteNotificationHandlers = this.remoteNotificationHandlers.filter(
        h => h !== handler
      );
    };
  }

  onLocalNotification(handler: LocalNotificationHandler): () => void {
    this.localNotificationHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      this.localNotificationHandlers = this.localNotificationHandlers.filter(
        h => h !== handler
      );
    };
  }

  private notifyRemoteHandlers(notification: RemoteNotification): void {
    this.remoteNotificationHandlers.forEach(handler => {
      try {
        handler(notification);
      } catch (error) {
        console.error('Error in remote notification handler:', error);
      }
    });
  }

  private notifyLocalHandlers(notification: LocalNotification): void {
    this.localNotificationHandlers.forEach(handler => {
      try {
        handler(notification);
      } catch (error) {
        console.error('Error in local notification handler:', error);
      }
    });
  }

  // ==================== Cleanup ====================

  destroy(): void {
    try {
      if (Platform.OS === 'ios') {
        PushNotificationIOS.removeEventListener('notification');
        PushNotificationIOS.removeEventListener('registrationError');
      }

      AppState.removeEventListener('change', this.handleAppStateChange.bind(this));

      this.remoteNotificationHandlers = [];
      this.localNotificationHandlers = [];
      this.isInitialized = false;
    } catch (error) {
      console.error('Error destroying Push Notification Manager:', error);
    }
  }
}

export const pushNotificationManager = new PushNotificationManagerClass();
