# Task #20: Push Notifications for Real-Time Alerts - PLANNING ✅

**Date:** 2026-09-28  
**Status:** PLANNING PHASE  
**Target:** Complete in 2-3 days  

---

## Executive Summary

Task #20 establishes the push notification infrastructure for the HPMS mobile app. Enables real-time alerts for critical events across all features (inspections, maintenance, documents, analytics, covenants) with customizable alert rules and comprehensive notification management.

---

## Feature Scope

### 1. Real-Time Alert Events

**Inspection Alerts:**
- Inspection submitted
- Inspection approved/rejected
- Inspection assigned
- Photo upload completed
- Signature captured

**Maintenance Alerts:**
- Work order assigned
- Work order status changed
- Maintenance scheduled
- Work order completed
- Cost recorded

**Document Alerts:**
- Document uploaded
- Document shared
- Document approved
- Document expiring soon

**Analytics Alerts:**
- Metric threshold exceeded
- Forecast warning
- Report generated
- Efficiency drop detected

**Covenant Alerts:**
- Covenant breach detected
- Breach corrective action assigned
- Compliance score dropped
- Verification date approaching
- Covenant status changed

**System Alerts:**
- Low storage warning
- Sync failed
- Session expired
- App update available
- Maintenance scheduled

---

## Phase 1: Screens & Components

### Screen 1: Notification Center

**File:** `src/screens/NotificationCenter.tsx` (300+ LOC)

**Features:**
- List of all notifications (most recent first)
- Read/unread status indicator
- Notification badges by type
- Tap to view full notification
- Mark as read/unread
- Swipe to delete
- Notifications grouped by date
- Empty state

**Components Used:**
- Card (reused)
- Badge (reused)
- Button (reused)
- FlatList with virtualization

**Key Code Sections:**
- Notification list rendering
- Read/unread status toggle
- Delete notification handler
- Badge count calculation
- Swipe-to-delete gesture

### Screen 2: Notification Settings

**File:** `src/screens/NotificationSettings.tsx` (280+ LOC)

**Features:**
- Toggle notifications on/off (global)
- Per-feature notification preferences:
  - Inspections: All, Important only, None
  - Maintenance: All, Important only, None
  - Documents: All, Important only, None
  - Analytics: All, Important only, None
  - Covenants: All, Important only, None
- Alert sound preference
- Vibration preference
- Do Not Disturb schedule
- Badge display toggle
- Clear all notifications button

**Components Used:**
- Toggle (new or reused)
- Select/Picker (reused)
- TimeInput (time picker)
- Button (reused)

**Key Code Sections:**
- Preference save logic
- Picker selection handlers
- Time range validation
- Settings persistence

### Screen 3: Alert Rule Configuration (Modal)

**File:** `src/screens/AlertRuleModal.tsx` (250+ LOC)

**Features:**
- Modal overlay for creating/editing alert rules
- Rule name input
- Trigger selection (covenant breach, metric threshold, status change)
- Condition builder
- Notification type selection
- Frequency preference (every time, daily digest, weekly digest)
- Recipients selection
- Enable/disable toggle

**Components Used:**
- Modal (reused)
- TextInput (reused)
- Select (reused)
- MultiSelect (for recipients)
- Toggle (reused)
- Button (reused)

**Key Code Sections:**
- Rule builder logic
- Condition validation
- Save/update rule handler
- Delete rule confirmation

---

## Phase 2: API Integration & Services

### Notification Service

**File:** `src/services/notification.service.ts` (350+ LOC)

**API Methods:**
```typescript
// Notification management
getNotifications(page?: number): Promise<Notification[]>
getNotification(id: string): Promise<Notification>
markAsRead(id: string): Promise<void>
markAsUnread(id: string): Promise<void>
deleteNotification(id: string): Promise<void>
clearAllNotifications(): Promise<void>

// Token management (for push)
registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>
unregisterPushToken(): Promise<void>

// Preferences
getNotificationPreferences(): Promise<NotificationPreferences>
updateNotificationPreferences(prefs: NotificationPreferences): Promise<void>

// Alert rules
getAlertRules(): Promise<AlertRule[]>
getAlertRule(id: string): Promise<AlertRule>
createAlertRule(data: AlertRule): Promise<AlertRule>
updateAlertRule(id: string, data: AlertRule): Promise<AlertRule>
deleteAlertRule(id: string): Promise<void>
testAlertRule(id: string): Promise<void>
```

**Features:**
- Cache management (5-minute TTL)
- Error handling with retry
- Offline support (queue notifications)
- Batch operations
- Token refresh on app restart

### Push Notification Manager

**File:** `src/services/push-notification-manager.ts` (400+ LOC)

**Features:**
- Platform-specific initialization (iOS APNs, Android FCM)
- Local notification handling
- Notification routing to appropriate handlers
- Deep linking on notification tap
- Badge count management
- Notification sound/vibration

**Key Methods:**
```typescript
initialize(): Promise<void>
requestPermissions(): Promise<boolean>
handleNotification(notification: RemoteNotification): void
handleLocalNotification(notification: LocalNotification): void
updateBadgeCount(count: number): void
playSound(soundName: string): void
triggerVibration(pattern: number[]): void
```

### Alert Rule Manager

**File:** `src/services/alert-rule-manager.ts` (300+ LOC)

**Features:**
- Create/update/delete alert rules
- Evaluate rule conditions
- Trigger notifications based on rules
- Rule validation
- Frequency management (one-time, daily, weekly)

**Key Methods:**
```typescript
createRule(rule: AlertRule): Promise<AlertRule>
updateRule(id: string, rule: AlertRule): Promise<AlertRule>
deleteRule(id: string): Promise<void>
evaluateRules(event: AlertEvent): Promise<void>
testRule(id: string): Promise<void>
```

### Custom React Hooks

**File:** `src/hooks/useNotifications.ts` (350+ LOC)

**Hooks:**
```typescript
useNotifications()              // All notifications with pagination
useNotificationPreferences()    // User preferences, update handler
useAlertRules()                 // Rules list, CRUD operations
useNotificationSubscription()   // Handle incoming notifications
useNotificationBadge()          // Unread count, clear handler
useCreateAlertRule()            // Create rule mutation
useUpdateAlertRule()            // Update rule mutation
useDeleteAlertRule()            // Delete rule mutation
useTestAlertRule()              // Test rule mutation
```

**Features:**
- Auto-fetch on mount
- Real-time subscription
- Error handling
- Loading states
- Refetch capabilities

---

## Phase 3: E2E Tests

### Test Suite

**File:** `e2e/notifications.e2e.ts` (400+ LOC, 35+ tests)

**Test Categories:**

**Notification Center (8 tests):**
- Load and display notifications
- Mark notification as read
- Mark notification as unread
- Delete single notification
- Swipe to delete gesture
- Empty state display
- Tap notification to view details
- Navigation to feature from notification

**Notification Settings (8 tests):**
- Toggle global notifications
- Set inspection notification preference
- Set maintenance notification preference
- Set documents notification preference
- Set analytics notification preference
- Set covenants notification preference
- Set alert sound preference
- Set vibration preference
- Set DND schedule
- Save and persist preferences

**Alert Rules (10 tests):**
- Create alert rule modal opens
- Fill in rule details
- Select trigger type
- Set condition values
- Select notification type
- Set frequency preference
- Add recipients
- Save rule successfully
- Edit existing rule
- Delete rule with confirmation
- Test rule triggering
- Enable/disable rule
- List all rules
- Validate rule conditions

**Push Notifications (6 tests):**
- Request notification permissions
- Register push token on app launch
- Handle incoming notification when app active
- Handle notification tap from background
- Display badge count
- Update badge when notification received
- Clear badge when notifications cleared

**Integration (3 tests):**
- Notification from inspection submission
- Notification from covenant breach
- Alert rule triggers on metric threshold

---

## Data Models

### Notification

```typescript
interface Notification {
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
```

### NotificationPreferences

```typescript
interface NotificationPreferences {
  enabled: boolean;
  inspections: 'all' | 'important' | 'none';
  maintenance: 'all' | 'important' | 'none';
  documents: 'all' | 'important' | 'none';
  analytics: 'all' | 'important' | 'none';
  covenants: 'all' | 'important' | 'none';
  sound: boolean;
  vibration: boolean;
  dndStart?: string; // HH:mm format
  dndEnd?: string;   // HH:mm format
  showBadge: boolean;
  updatedAt: string;
}
```

### AlertRule

```typescript
interface AlertRule {
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
```

---

## API Endpoints

### Notifications

```
GET    /notifications              - List all notifications
GET    /notifications/{id}         - Get single notification
PUT    /notifications/{id}/read    - Mark as read
PUT    /notifications/{id}/unread  - Mark as unread
DELETE /notifications/{id}         - Delete notification
DELETE /notifications              - Clear all notifications
POST   /notifications/test         - Send test notification
```

### Tokens

```
POST   /push-tokens/register       - Register push token
DELETE /push-tokens/unregister     - Unregister push token
```

### Preferences

```
GET    /notification-preferences   - Get user preferences
PUT    /notification-preferences   - Update preferences
```

### Alert Rules

```
GET    /alert-rules                - List all rules
GET    /alert-rules/{id}           - Get single rule
POST   /alert-rules                - Create rule
PUT    /alert-rules/{id}           - Update rule
DELETE /alert-rules/{id}           - Delete rule
POST   /alert-rules/{id}/test      - Test rule
```

---

## Testing Strategy

### Unit Tests
- Notification service methods
- Alert rule evaluation
- Preference validation

### Integration Tests
- Notification + feature integration
- Alert rule + notification flow
- Settings persistence + notification behavior

### E2E Tests
- 35+ comprehensive tests covering:
  - Notification UI workflows
  - Settings management
  - Alert rule creation/management
  - Push notification handling
  - Integration scenarios

---

## Success Criteria

✅ All notification screens implemented  
✅ Notification service fully functional  
✅ Push notification integration (iOS + Android)  
✅ Alert rules working  
✅ 35+ E2E tests passing  
✅ Offline notification queuing  
✅ Settings persisted  
✅ Deep linking on notification tap  
✅ Badge count updating  
✅ Notification routing correct  

---

## Estimated LOC

| Component | LOC |
|-----------|-----|
| Screens (3) | 830 |
| Services (3) | 1,050 |
| Hooks (1) | 350 |
| E2E Tests | 400 |
| **Total** | **2,630** |

---

## Files to Create

**Screens:**
- src/screens/NotificationCenter.tsx (300 LOC)
- src/screens/NotificationSettings.tsx (280 LOC)
- src/screens/AlertRuleModal.tsx (250 LOC)

**Services:**
- src/services/notification.service.ts (350 LOC)
- src/services/push-notification-manager.ts (400 LOC)
- src/services/alert-rule-manager.ts (300 LOC)

**Hooks:**
- src/hooks/useNotifications.ts (350 LOC)

**Tests:**
- e2e/notifications.e2e.ts (400 LOC, 35+ tests)

---

## Timeline

**Phase 1 (Screens):** 2-3 hours
**Phase 2 (Services):** 3-4 hours
**Phase 3 (Tests):** 2-3 hours
**Total:** 7-10 hours (1-2 days)

---

## Next Steps

1. Create notification center screen
2. Create notification settings screen
3. Create alert rule modal
4. Implement notification service
5. Implement push notification manager
6. Implement alert rule manager
7. Create custom hooks
8. Write E2E tests
9. Test with mock notifications
10. Commit and document

---

**Task #20 is ready to build!**

