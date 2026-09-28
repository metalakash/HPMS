/**
 * Alert Rule Manager
 * Manages alert rules and evaluates conditions to trigger notifications
 */

import { notificationService, AlertRule } from './notification.service';
import { pushNotificationManager } from './push-notification-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AlertEvent {
  type: string;
  featureId: string;
  data: Record<string, any>;
  timestamp: string;
}

interface RuleEvaluationContext {
  rule: AlertRule;
  event: AlertEvent;
  previousValue?: any;
  currentValue?: any;
}

class AlertRuleManagerClass {
  private activeRules: Map<string, AlertRule> = new Map();
  private ruleTimestamps: Map<string, number> = new Map(); // For frequency throttling
  private lastDigestSent: Map<string, number> = new Map();

  async initialize(): Promise<void> {
    try {
      // Load active rules
      const rules = await notificationService.getAlertRules();
      const activeRules = rules.filter(r => r.enabled);

      activeRules.forEach(rule => {
        this.activeRules.set(rule.id, rule);
      });

      console.log(`Alert Rule Manager initialized with ${activeRules.length} active rules`);
    } catch (error) {
      console.error('Error initializing Alert Rule Manager:', error);
    }
  }

  async evaluateRules(event: AlertEvent): Promise<void> {
    try {
      const matchedRules = Array.from(this.activeRules.values()).filter(rule =>
        this.matchesTrigger(rule, event)
      );

      for (const rule of matchedRules) {
        await this.processRule(rule, event);
      }
    } catch (error) {
      console.error('Error evaluating alert rules:', error);
    }
  }

  private matchesTrigger(rule: AlertRule, event: AlertEvent): boolean {
    switch (rule.trigger) {
      case 'covenant_breach':
        return event.type === 'covenant' && event.data.status === 'breached';

      case 'metric_threshold':
        return event.type === 'analytics' && event.data.thresholdExceeded === true;

      case 'status_change':
        return event.data.previousStatus && event.data.previousStatus !== event.data.newStatus;

      case 'deadline_approaching':
        return event.type === 'deadline' && event.data.daysUntil !== undefined;

      case 'approval_needed':
        return event.type === 'approval' && event.data.status === 'pending';

      default:
        return false;
    }
  }

  private async processRule(rule: AlertRule, event: AlertEvent): Promise<void> {
    try {
      // Check if conditions are met
      if (!this.evaluateConditions(rule, event)) {
        return;
      }

      // Check frequency limits
      if (!this.canTrigger(rule)) {
        return;
      }

      // Record trigger
      this.recordTrigger(rule);

      // Handle notification type
      if (rule.notification.type === 'immediate') {
        await this.sendImmediateNotification(rule, event);
      } else if (rule.notification.type === 'digest') {
        await this.queueDigestNotification(rule, event);
      }
    } catch (error) {
      console.error(`Error processing rule ${rule.id}:`, error);
    }
  }

  private evaluateConditions(rule: AlertRule, event: AlertEvent): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true; // No conditions means always trigger
    }

    return rule.conditions.every(condition => this.evaluateCondition(condition, event));
  }

  private evaluateCondition(condition: any, event: AlertEvent): boolean {
    const value = this.getValueFromEvent(condition.field, event);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'greater_than':
        return Number(value) > Number(condition.value);

      case 'less_than':
        return Number(value) < Number(condition.value);

      case 'contains':
        return String(value).includes(String(condition.value));

      default:
        return false;
    }
  }

  private getValueFromEvent(field: string, event: AlertEvent): any {
    const parts = field.split('.');
    let value: any = event.data;

    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return undefined;
    }

    return value;
  }

  private canTrigger(rule: AlertRule): boolean {
    const lastTrigger = this.ruleTimestamps.get(rule.id) || 0;
    const now = Date.now();

    // Apply frequency limits
    const minInterval = this.getMinIntervalMs(rule);
    return now - lastTrigger >= minInterval;
  }

  private getMinIntervalMs(rule: AlertRule): number {
    switch (rule.notification.frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return 0; // Immediate
    }
  }

  private recordTrigger(rule: AlertRule): void {
    this.ruleTimestamps.set(rule.id, Date.now());
  }

  private async sendImmediateNotification(rule: AlertRule, event: AlertEvent): Promise<void> {
    try {
      // Create notification
      const notification = {
        title: rule.name,
        message: this.buildMessage(rule, event),
        data: {
          ruleId: rule.id,
          eventType: event.type,
          featureId: event.featureId,
          ...event.data,
        },
        playSound: true,
        vibrate: true,
      };

      // Send local notification immediately
      pushNotificationManager.localNotify(notification);

      // Log notification
      console.log(`Sent immediate notification for rule: ${rule.name}`);
    } catch (error) {
      console.error('Error sending immediate notification:', error);
    }
  }

  private async queueDigestNotification(rule: AlertRule, event: AlertEvent): Promise<void> {
    try {
      const digestKey = `digest_${rule.id}`;
      const queue: AlertEvent[] = [];

      // Load existing queue
      const cached = await AsyncStorage.getItem(digestKey);
      if (cached) {
        queue.push(...JSON.parse(cached));
      }

      // Add new event
      queue.push(event);

      // Save queue
      await AsyncStorage.setItem(digestKey, JSON.stringify(queue));

      // Check if we should send digest now
      const lastSent = this.lastDigestSent.get(rule.id) || 0;
      const now = Date.now();
      const shouldSend = now - lastSent >= this.getMinIntervalMs(rule);

      if (shouldSend && queue.length > 0) {
        await this.sendDigestNotification(rule, queue);
        await AsyncStorage.removeItem(digestKey);
        this.lastDigestSent.set(rule.id, now);
      }
    } catch (error) {
      console.error('Error queueing digest notification:', error);
    }
  }

  private async sendDigestNotification(rule: AlertRule, events: AlertEvent[]): Promise<void> {
    try {
      const notification = {
        title: `${rule.name} - Digest (${events.length} items)`,
        message: this.buildDigestMessage(rule, events),
        data: {
          ruleId: rule.id,
          eventCount: events.length,
          events: events.map(e => e.type).join(', '),
        },
        playSound: true,
        vibrate: true,
      };

      pushNotificationManager.localNotify(notification);

      console.log(`Sent digest notification for rule: ${rule.name} (${events.length} events)`);
    } catch (error) {
      console.error('Error sending digest notification:', error);
    }
  }

  private buildMessage(rule: AlertRule, event: AlertEvent): string {
    const typeLabel = event.type.charAt(0).toUpperCase() + event.type.slice(1);

    switch (rule.trigger) {
      case 'covenant_breach':
        return `Covenant breach detected: ${event.data.covenantName || 'Unknown'}`;

      case 'metric_threshold':
        return `${event.data.metricName || 'Metric'} exceeded threshold`;

      case 'status_change':
        return `Status changed from ${event.data.previousStatus} to ${event.data.newStatus}`;

      case 'deadline_approaching':
        return `Deadline approaching in ${event.data.daysUntil} days`;

      case 'approval_needed':
        return `Approval needed for ${typeLabel}`;

      default:
        return `Alert: ${rule.name}`;
    }
  }

  private buildDigestMessage(rule: AlertRule, events: AlertEvent[]): string {
    return `You have ${events.length} ${rule.name.toLowerCase()} notification(s) waiting for review.`;
  }

  // ==================== Rule Management ====================

  async reloadRules(): Promise<void> {
    try {
      const rules = await notificationService.getAlertRules();
      const activeRules = rules.filter(r => r.enabled);

      this.activeRules.clear();
      activeRules.forEach(rule => {
        this.activeRules.set(rule.id, rule);
      });

      console.log(`Reloaded ${activeRules.length} active rules`);
    } catch (error) {
      console.error('Error reloading rules:', error);
    }
  }

  async addRule(rule: AlertRule): Promise<void> {
    if (rule.enabled) {
      this.activeRules.set(rule.id, rule);
    }
  }

  async removeRule(ruleId: string): Promise<void> {
    this.activeRules.delete(ruleId);
    this.ruleTimestamps.delete(ruleId);
    this.lastDigestSent.delete(ruleId);
  }

  async testRule(ruleId: string): Promise<void> {
    try {
      const rule = this.activeRules.get(ruleId);
      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      // Send test notification
      const testEvent: AlertEvent = {
        type: 'test',
        featureId: 'test',
        data: {
          isTest: true,
          testMessage: 'This is a test notification',
        },
        timestamp: new Date().toISOString(),
      };

      await this.sendImmediateNotification(rule, testEvent);
    } catch (error) {
      console.error('Error testing rule:', error);
      throw error;
    }
  }

  getActiveRuleCount(): number {
    return this.activeRules.size;
  }

  // ==================== Cleanup ====================

  destroy(): void {
    this.activeRules.clear();
    this.ruleTimestamps.clear();
    this.lastDigestSent.clear();
  }
}

export const alertRuleManager = new AlertRuleManagerClass();
