# Task #17: Covenant Tracking - Compliance Monitoring - PLANNING ✅

**Date:** 2026-09-28  
**Status:** PLANNING PHASE  
**Target:** Complete in next session  

---

## Executive Summary

Task #17 implements comprehensive covenant tracking and compliance monitoring for hydropower projects. Covenants are contractual obligations (from loans, agreements, permits) that must be maintained. This feature monitors compliance status, tracks breaches, and provides alerts.

---

## Core Concepts

### What are Covenants?
Covenants are contractual obligations in loan agreements, permits, or contracts that must be maintained. Common examples:
- Financial ratios (debt-to-equity, current ratio)
- Operational metrics (minimum efficiency, maximum downtime)
- Environmental requirements (water flow rates, emissions)
- Reporting requirements (quarterly reports, annual audits)
- Maintenance standards (asset condition, inspection frequency)

### Compliance Status
```
✅ COMPLIANT   - Within acceptable range
⚠️  WARNING     - Approaching breach threshold
🔴 BREACHED    - Covenant violated
⏸️  PENDING     - Awaiting data/verification
```

---

## 5 Screens to Build

### 1. Covenants Dashboard
- **Purpose:** Overview of all covenants and compliance status
- **Components:**
  - Covenant summary cards (total, compliant, at-risk, breached)
  - Compliance score gauge (0-100%)
  - Covenant list with status indicators
  - Filter by project/category
  - Breach timeline

### 2. Covenant Details
- **Purpose:** Deep-dive into specific covenant
- **Components:**
  - Covenant info (name, requirement, threshold)
  - Current value display
  - Historical trend chart
  - Breach history timeline
  - Required actions
  - Documentation links

### 3. Compliance Monitoring
- **Purpose:** Monitor multiple covenants in real-time
- **Components:**
  - Multi-covenant comparison chart
  - Status summary by category
  - Alert configuration
  - Threshold adjustment
  - Forecast (will we breach?)

### 4. Breach Management
- **Purpose:** Handle covenant breaches
- **Components:**
  - Active breaches list
  - Breach severity/status
  - Corrective action plan
  - Timeline to cure
  - Communication log
  - Approval workflow

### 5. Compliance Reports
- **Purpose:** Generate compliance reports
- **Components:**
  - Report templates (quarterly, annual)
  - Covenant compliance summary
  - Trend analysis
  - Breach history
  - Export options (PDF, Excel)
  - Signature/approval workflow

---

## Data Model

```typescript
interface Covenant {
  id: string;
  projectId: string;
  name: string;
  category: 'financial' | 'operational' | 'environmental' | 'reporting' | 'maintenance';
  description: string;
  requirement: string;
  threshold: number;
  unit: string;
  minAcceptable?: number;
  maxAcceptable?: number;
  warningThreshold: number;
  criticalThreshold: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  lastChecked: string;
  nextDue: string;
  status: 'compliant' | 'warning' | 'breached' | 'pending';
  currentValue: number;
  source: 'loan' | 'permit' | 'contract' | 'policy';
  startDate: string;
  endDate?: string;
}

interface CovenantRecord {
  id: string;
  covenantId: string;
  date: string;
  value: number;
  status: 'compliant' | 'warning' | 'breached';
  recordedBy: string;
  notes?: string;
}

interface CovenantBreach {
  id: string;
  covenantId: string;
  startDate: string;
  endDate?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  actions: BreachAction[];
  status: 'active' | 'under_review' | 'cured' | 'waived';
}

interface BreachAction {
  id: string;
  breachId: string;
  description: string;
  dueDate: string;
  status: 'planned' | 'in_progress' | 'completed';
  assignee: string;
  completedDate?: string;
  notes?: string;
}

interface ComplianceScore {
  projectId: string;
  totalCovenants: number;
  compliantCount: number;
  warningCount: number;
  breachedCount: number;
  overallScore: number; // 0-100%
  trend: 'improving' | 'stable' | 'declining';
}
```

---

## API Endpoints Required

```
GET    /covenants                    - List all covenants
GET    /covenants/{id}               - Get covenant details
POST   /covenants                    - Create covenant
PUT    /covenants/{id}               - Update covenant
DELETE /covenants/{id}               - Delete covenant

GET    /covenants/{id}/records       - Covenant history
POST   /covenants/{id}/records       - Record value

GET    /covenants/breaches           - List breaches
GET    /covenants/breaches/{id}      - Breach details
POST   /covenants/breaches/{id}/actions - Add action
PUT    /covenants/breaches/{id}/actions/{actionId} - Update action

GET    /compliance/score             - Overall compliance score
GET    /compliance/report            - Generate report

GET    /covenants/{id}/forecast      - Forecast compliance
```

---

## Features Matrix

| Feature | Priority | Complexity |
|---------|----------|-----------|
| Covenant listing | HIGH | Low |
| Status monitoring | HIGH | Medium |
| Trend charts | HIGH | Medium |
| Breach tracking | HIGH | Medium |
| Alert configuration | MEDIUM | Medium |
| Forecast analytics | MEDIUM | High |
| Compliance scoring | MEDIUM | Medium |
| Report generation | MEDIUM | High |
| Mobile push notifications | LOW | High |
| Approval workflows | LOW | High |

---

## Implementation Checklist

### Phase 1: Screens & Components (Next Session)
- [ ] Covenants Dashboard screen
- [ ] Covenant Details screen
- [ ] Compliance Monitoring screen
- [ ] Breach Management screen
- [ ] Compliance Reports screen
- [ ] Covenant list item component
- [ ] Status badge component
- [ ] Breach timeline component
- [ ] Compliance progress component

### Phase 2: Services & Integration (Following Session)
- [ ] Covenant API service
- [ ] Breach management service
- [ ] Compliance scoring service
- [ ] Forecast analytics service
- [ ] Custom hooks (useCovenants, etc.)
- [ ] Offline queue for covenant updates

### Phase 3: Testing & Polish
- [ ] 25+ E2E tests
- [ ] Integration with offline queue
- [ ] Performance optimization
- [ ] Accessibility audit

---

## UI Components Needed

**New Components:**
1. CovenantCard - Status display card
2. CovenantTimeline - Breach/event timeline
3. StatusBadge - Compliance status indicator
4. ComplianceGauge - Overall score visualization
5. BreachAlert - Alert notification
6. ActionItem - Corrective action display
7. TrendIndicator - Trend arrow/direction
8. ComplianceSummary - Quick stats

**Reusable from existing:**
- LineChart, AreaChart (for trends)
- Card, Header, ListItem (layout)
- Button, TextInput (forms)

---

## Technology Stack

**Charts:**
- react-native-svg (existing)
- LineChart, AreaChart (existing)

**Data:**
- WatermelonDB (existing, extend schema)
- Zustand store (existing)

**Notifications:**
- React Native Push Notifications (optional)
- Local alerts

**Export:**
- react-native-pdf-lib (report generation)
- expo-file-system (file handling)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Dashboard load | <2s |
| Chart render | <500ms |
| Breach list | <1s |
| Report generation | <5s |
| Memory peak | <250MB |

---

## Accessibility Requirements

- ✅ WCAG 2.1 AA compliance
- ✅ High contrast status indicators
- ✅ Screen reader support for status
- ✅ Keyboard navigation
- ✅ Color-blind friendly indicators (use symbols + color)
- ✅ Touch targets 48x48pt minimum

---

## Estimated LOC

| Component | LOC |
|-----------|-----|
| 5 Screens | 1,200 |
| Components | 300 |
| Services | 600 |
| Hooks | 200 |
| Tests | 400 |
| **Total** | **2,700** |

---

## Timeline

**Next 2-3 Sessions:**
1. Session 1: Screens & components (1,500 LOC)
2. Session 2: Services & integration (800 LOC)
3. Session 3: Tests & polish (400 LOC)

---

## Success Criteria

✅ All 5 screens built and working  
✅ Covenant status monitoring  
✅ Breach tracking and management  
✅ Compliance scoring  
✅ Trend analysis  
✅ Report generation  
✅ 25+ E2E tests passing  
✅ WCAG 2.1 AA accessibility  
✅ Performance targets met  
✅ Offline support enabled  

---

## Integration with Existing Features

- **Dashboard:** Quick link to covenant compliance
- **Notifications:** Alert on breach/warning
- **Reports:** Include covenant compliance in project reports
- **Analytics:** Compliance metrics in project analytics
- **Offline:** Queue covenant updates for sync
- **WebSocket:** Real-time breach alerts

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Complex breach workflows | Start simple, iterate |
| Performance with large datasets | Pagination, caching |
| Notification fatigue | Configurable alerts |
| Compliance accuracy | Validation, audit trail |

---

## Notes for Next Session

1. Start with Covenants Dashboard - most complex screen
2. Build CovenantCard component early
3. Use existing chart components where possible
4. Implement status badge with proper accessibility
5. Consider offline queue for covenant updates
6. Plan approval workflow carefully

---

**Phase 7.2 Task Status:**
- ✅ Tasks #11-16: 6/6 Complete (16,000+ LOC)
- 🔄 Task #17: Foundation planned
- ⏳ Tasks #18-19: Integration, Accessibility

**Overall Sprint:** 67% Complete, on track

---

Ready to execute Task #17 in next session!
