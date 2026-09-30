# Task #27: Cross-Feature Integration
## Complete 3-Phase Architecture Specification

**Status:** Phase 1 (UI Screens & Components)  
**Target LOC:** 1,800+ (Phase 1: 900+ | Phase 2: 650+ | Phase 3: 250+)  
**E2E Tests:** 30+ comprehensive tests  
**Delivery Timeline:** 3 phases, production-ready

---

## Overview
Cross-feature integration system enabling users to link features together (inspections→work orders→compliance) and create workflows across features. Support for bidirectional relationships, dependency tracking, and integrated dashboards showing linked data.

---

## PHASE 1: UI Screens & Components (900+ LOC)

### Screens (850 LOC)

#### 1. **CrossFeatureMapScreen.tsx** (280 LOC)
Visual map showing relationships between features.

```
Layout:
┌─ Feature Map Title
│  └─ "Inspect → Fix → Comply" workflow visualization
├─ Interactive Feature Graph
│  ├─ Nodes: [Projects] [Inspections] [Work Orders] [Compliance] [Reports]
│  ├─ Edges: Directional arrows showing relationships
│  ├─ Node styling: Colors by feature type
│  └─ Edge thickness: By number of linked items
├─ Relationship Summary Box
│  ├─ "Inspections linking to Work Orders: 45 active"
│  ├─ "Work Orders linking to Compliance: 23 active"
│  └─ "Total cross-feature links: 128"
├─ Filter by Relationship Type
│  ├─ All / Inspection→WO / WO→Compliance / Project→All
│  └─ Show/Hide inactive links toggle
└─ Workflow Templates
   ├─ "Standard Defect Workflow" (Inspection→WO→Compliance)
   ├─ "Emergency Response" (Project→Inspection→WO)
   └─ Custom workflow builder button
```

**State:**
- nodes: FeatureNode[]
- edges: FeatureLink[]
- selectedNode: FeatureNode | null
- selectedEdge: FeatureLink | null
- filteredType: string
- layoutType: 'hierarchical' | 'circular' | 'force'
- loading: boolean

**Key Methods:**
- loadFeatureMap(): Fetch relationships
- selectNode(nodeId): Show node details
- selectEdge(edgeId): Show edge details
- applyFilter(type): Filter relationships
- changeLayout(type): Switch graph layout
- exportMap(): Download as image/SVG

---

#### 2. **LinkedItemsScreen.tsx** (280 LOC)
Display and manage linked items for a specific record.

```
Layout:
┌─ Header: "Linked Items for [Record Name]"
├─ Feature Tabs
│  ├─ Inspections (active)
│  ├─ Work Orders
│  ├─ Compliance
│  └─ Reports
├─ Linked Items List
│  └─ For each linked item: [Type] [Name] [Status] [Link strength] [Remove]
│     - Link strength: visual indicator (weak/medium/strong)
│     - Status badge: color coded
│     - Open button: navigate to linked item
├─ Add Link Button
│  └─ Opens modal to link new items
├─ Link Statistics
│  ├─ Total links: 12
│  ├─ By strength: Strong 5, Medium 4, Weak 3
│  └─ Last updated: 2h ago
└─ Bulk Actions
   ├─ Unlink all button
   └─ Merge links button
```

**State:**
- recordId: string
- linkedItems: LinkedItem[]
- selectedTab: Feature
- showAddModal: boolean
- linkStats: LinkStats
- loading: boolean

**Key Methods:**
- loadLinkedItems(recordId, feature): Fetch links
- addLink(recordId, targetId, strength): Create link
- removeLink(recordId, targetId): Delete link
- updateLinkStrength(linkId, strength): Modify strength
- bulkUnlink(recordIds): Remove multiple links
- mergeLinks(linkIds): Combine links

---

#### 3. **WorkflowDesignerScreen.tsx** (220 LOC)
Design and customize cross-feature workflows.

```
Layout:
┌─ Workflow Title Input
│  └─ "Standard Defect Workflow"
├─ Workflow Steps (Drag & Drop)
│  ├─ Step 1: Create Inspection
│  ├─ Step 2: If issues found → Create Work Order
│  ├─ Step 3: Assign to team
│  └─ Step 4: Track compliance
├─ Conditional Logic Builder
│  ├─ "If inspection status = Critical"
│  ├─ "Then auto-create HIGH priority WO"
│  └─ "Notify compliance team"
├─ Trigger Configuration
│  ├─ Manual / Automatic trigger
│  ├─ On creation / On status change
│  └─ Delay options (immediate/24h/7d)
├─ Notification Rules
│  ├─ Notify when: [Condition dropdown]
│  ├─ Who to notify: [Team selector]
│  └─ Via: Email / In-app / SMS
└─ Action Buttons
   ├─ Save Workflow
   ├─ Test Workflow
   └─ Publish to Team
```

**State:**
- workflowId: string
- workflowName: string
- steps: WorkflowStep[]
- triggers: Trigger[]
- notifications: Notification[]
- isPublished: boolean
- loading: boolean

**Key Methods:**
- loadWorkflow(workflowId): Fetch workflow
- addStep(step): Add workflow step
- removeStep(stepId): Delete step
- reorderSteps(newOrder): Change step order
- saveWorkflow(): Persist workflow
- testWorkflow(testData): Run test
- publishWorkflow(): Make available to team
- previewWorkflow(): Show what will happen

---

#### 4. **DependencyTrackerScreen.tsx** (220 LOC)
Track dependencies between features and identify blocking issues.

```
Layout:
┌─ Dependency View Title
├─ Blocking Issues
│  └─ Rows: [Item Name] [Blocks] [Blocked By] [Status] [Days Blocked]
│     - "Inspection #45" blocks "WO #78" | Red status | 3 days
│     - "WO #78" blocks "Compliance #12" | Yellow | 1 day
├─ Critical Path Analysis
│  ├─ Longest chain: Inspection → WO → Compliance (5 items)
│  ├─ Bottleneck: Work Order approval (2 days avg)
│  └─ Risk: 3 items stuck in approval
├─ Dependency Health Score
│  ├─ Overall: 72% (Fair)
│  ├─ On-time: 85% (Good)
│  ├─ Blocked: 8% (Low)
│  └─ Overdue: 7% (Warning)
├─ Unblock Actions
│  ├─ "Escalate blocked items" button
│  ├─ "Create parallel WO" button
│  └─ "Override dependency" button (admin)
└─ Dependency Timeline
   └─ Gantt-like view showing item dependencies over time
```

**State:**
- dependencies: Dependency[]
- blockingIssues: BlockingIssue[]
- healthScore: HealthScore
- criticalPath: Item[]
- timelineView: boolean
- loading: boolean

**Key Methods:**
- loadDependencies(): Fetch all dependencies
- identifyBlockingIssues(): Find stuck items
- calculateCriticalPath(): Longest dependency chain
- calculateHealthScore(): Overall dependency health
- resolveBlockage(itemId): Take action
- overrideDependency(fromId, toId): Admin override
- getRecommendations(): Suggest optimizations

---

### Components (50 LOC)

#### 1. **FeatureLink.tsx** (25 LOC)
Reusable link badge component showing connection between features.

```typescript
Props:
- fromFeature: string (inspections)
- toFeature: string (workorders)
- linkCount: number (45)
- strength: 'weak' | 'medium' | 'strong'
- onClick: () => void

Renders:
- [Feature A icon] → [Feature B icon]
- "45 linked" badge
- Strength indicator (line thickness/opacity)
- Hover: shows preview of linked items
```

#### 2. **DependencyIndicator.tsx** (25 LOC)
Visual indicator showing dependency status and blocking status.

```typescript
Props:
- status: 'on-track' | 'at-risk' | 'blocked' | 'overdue'
- blockedByCount: number
- blocksCount: number
- daysBlocked: number

Renders:
- Status dot (green/yellow/red/red)
- "Blocks 2 items" / "Blocked by 1 item"
- "3 days blocked" (if applicable)
- Hover: shows blocking details
```

---

## PHASE 2: Services & API (650+ LOC)

### Services (350 LOC)

#### 1. **cross_feature.service.ts** (200 LOC)
Core cross-feature linking service.

```typescript
Interface FeatureLink {
  id: string
  from_feature: Feature
  from_id: string
  to_feature: Feature
  to_id: string
  strength: 'weak' | 'medium' | 'strong'
  created_at: datetime
  created_by: string
  metadata?: Dict
}

Interface Dependency {
  id: string
  from_id: string
  from_type: string
  to_id: string
  to_type: string
  relationship: 'blocks' | 'requires' | 'related_to'
  status: 'active' | 'resolved' | 'overridden'
  created_at: datetime
}

Methods:

• createLink(fromId, toId, fromFeature, toFeature, strength): Promise<FeatureLink>
  - Create new cross-feature link
  - Validate both items exist
  - Check for circular dependencies

• getLinks(recordId, feature): Promise<FeatureLink[]>
  - Fetch all links for a record
  - Include link metadata and strength

• getLinksByFeature(fromFeature, toFeature): Promise<FeatureLink[]>
  - Get all links between two features
  - Used for feature map

• removeLink(linkId): Promise<void>
  - Delete link
  - Log removal

• updateLinkStrength(linkId, strength): Promise<FeatureLink>
  - Modify link strength

• bulkCreateLinks(links): Promise<FeatureLink[]>
  - Create multiple links at once

• identifyBlockingIssues(): Promise<BlockingIssue[]>
  - Find items blocking others
  - Calculate days blocked

• calculateDependencyHealth(): Promise<HealthScore>
  - Overall health score
  - On-time percentage
  - Blocked percentage
  - Overdue percentage

• getCriticalPath(): Promise<Item[]>
  - Longest dependency chain
  - Shows critical items

• findCircularDependencies(fromId, toId): Promise<bool>
  - Check if link would create cycle
```

#### 2. **workflow.service.ts** (150 LOC)
Workflow design and execution service.

```typescript
Interface WorkflowStep {
  id: string
  order: number
  action: string
  feature: string
  conditions?: Condition[]
  notifications?: Notification[]
}

Interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
  triggers: Trigger[]
  is_published: bool
  created_by: string
  created_at: datetime
}

Methods:

• createWorkflow(name, steps): Promise<Workflow>
  - Create new workflow
  - Validate step order

• updateWorkflow(workflowId, updates): Promise<Workflow>
  - Modify workflow

• deleteWorkflow(workflowId): Promise<void>
  - Remove workflow

• publishWorkflow(workflowId): Promise<Workflow>
  - Make available to team

• executeWorkflow(workflowId, triggerData): Promise<WorkflowExecution>
  - Run workflow steps
  - Create items in proper order
  - Send notifications

• testWorkflow(workflowId, testData): Promise<WorkflowExecution>
  - Dry-run workflow
  - Show what would be created

• getWorkflowTemplates(): Promise<Workflow[]>
  - Standard workflow templates

• listUserWorkflows(): Promise<Workflow[]>
  - User's workflows
```

---

### API Services (300 LOC)

#### 1. **cross_feature_api.ts** (200 LOC)
API endpoints for cross-feature linking.

```typescript
API Endpoints:

POST /links
  Body: { from_id, to_id, from_feature, to_feature, strength }
  Returns: FeatureLink

GET /links/{from_id}
  Query: { feature }
  Returns: FeatureLink[]

DELETE /links/{link_id}
  Returns: { success }

PUT /links/{link_id}/strength
  Body: { strength }
  Returns: FeatureLink

GET /map
  Returns: { nodes, edges, stats }

GET /dependencies
  Query: { status, blocked_by_count_gt }
  Returns: Dependency[]

GET /critical-path
  Returns: Item[]

GET /blocking-issues
  Returns: BlockingIssue[]

GET /health
  Returns: HealthScore

POST /validate-link
  Body: { from_id, to_id }
  Returns: { valid, error }
```

#### 2. **workflow_api.ts** (100 LOC)
API endpoints for workflow management.

```typescript
API Endpoints:

POST /workflows
  Body: { name, steps, triggers }
  Returns: Workflow

GET /workflows/{id}
  Returns: Workflow

PUT /workflows/{id}
  Body: updates
  Returns: Workflow

DELETE /workflows/{id}
  Returns: { success }

POST /workflows/{id}/publish
  Returns: Workflow

POST /workflows/{id}/execute
  Body: { trigger_data }
  Returns: WorkflowExecution

POST /workflows/{id}/test
  Body: { test_data }
  Returns: WorkflowExecution (dry-run)

GET /workflows/templates
  Returns: Workflow[]

GET /workflows
  Returns: Workflow[] (user's workflows)
```

---

## PHASE 3: Hooks & E2E Tests (250+ LOC, 30+ tests)

### Hooks (120 LOC)

#### **useCrossFeature.ts** (120 LOC)
State management for cross-feature integration.

```typescript
Methods:

• loadFeatureMap(): Fetch feature graph
• selectNode(nodeId): Show node details
• selectEdge(edgeId): Show edge details
• applyFilter(type): Filter relationships
• createLink(fromId, toId, strength): Create link
• removeLink(linkId): Delete link
• updateLinkStrength(linkId, strength): Modify strength
• loadLinkedItems(recordId, feature): Fetch linked items
• identifyBlockingIssues(): Find stuck items
• calculateHealthScore(): Overall health
• getCriticalPath(): Longest chain
• loadWorkflows(): Fetch workflows
• createWorkflow(name, steps): New workflow
• publishWorkflow(workflowId): Make available
• executeWorkflow(workflowId, data): Run workflow
• testWorkflow(workflowId, data): Dry-run
```

---

### E2E Tests (130+ LOC, 30+ tests)

**File:** cross-feature.e2e.ts

#### Feature Map Tests (8 tests)
- Open feature map
- Display all features as nodes
- Show directional edges
- Filter by relationship type
- Change graph layout
- Select node for details
- Select edge for details
- Export map

#### Linked Items Tests (8 tests)
- Display linked items
- Switch between feature tabs
- Add new link
- Remove link
- Update link strength
- View link statistics
- Bulk unlink
- Link strength indicators

#### Workflow Designer Tests (8 tests)
- Open workflow designer
- Create new workflow
- Add workflow steps
- Reorder steps
- Set conditions
- Configure notifications
- Test workflow
- Publish workflow

#### Dependency Tracking Tests (6 tests)
- Display blocking issues
- Calculate critical path
- Show dependency health
- Identify overdue items
- Escalate blocked items
- Override dependency (admin)

---

## Success Criteria

### Phase 1 ✓
- [ ] 4 screens (CrossFeatureMap, LinkedItems, WorkflowDesigner, DependencyTracker)
- [ ] 2 components (FeatureLink, DependencyIndicator)
- [ ] Feature graph visualization
- [ ] Workflow builder UI
- [ ] Dependency tracking UI

### Phase 2 ✓
- [ ] cross_feature.service.ts with linking logic
- [ ] workflow.service.ts for workflow execution
- [ ] cross_feature_api.ts (9 endpoints)
- [ ] workflow_api.ts (8 endpoints)
- [ ] Circular dependency detection
- [ ] Blocking issue detection
- [ ] Health score calculation

### Phase 3 ✓
- [ ] useCrossFeature hook
- [ ] 30+ E2E tests
- [ ] Feature map tests
- [ ] Linked items tests
- [ ] Workflow tests
- [ ] Dependency tests

---

## Estimated Completion
- Phase 1: 4-5 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- **Total:** ~9 hours development + testing

---

## Dependencies & Integration Points
- Integrates with all feature APIs (projects, inspections, workorders, compliance, reports)
- Requires graph visualization library (Cytoscape or D3.js)
- Uses existing project context from Task #26
- Builds on audit logging from Task #25
- Storage: PostgreSQL links/dependencies/workflows tables
- Caching: Redis for feature map, critical path

---

## Notes for Implementation
- Follow established 3-phase pattern
- Maintain TypeScript strict mode
- Use Zustand for state management
- E2E tests use Detox framework
- Circular dependency detection critical for data integrity
- All code production-ready
