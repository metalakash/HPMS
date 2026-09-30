# Task #26: Multi-Project Management
## Complete 3-Phase Architecture Specification

**Status:** Phase 1 (UI Screens & Components)  
**Target LOC:** 2,100+ (Phase 1: 1,100+ | Phase 2: 850+ | Phase 3: 350+)  
**E2E Tests:** 35+ comprehensive tests  
**Delivery Timeline:** 3 phases, production-ready

---

## Overview
Multi-project management system enabling users to switch between projects, view shared dashboards across projects, and generate cross-project reports. Support for project ownership, team collaboration, and permission-based access control.

---

## PHASE 1: UI Screens & Components (1,100+ LOC)

### Screens (1,050 LOC)

#### 1. **ProjectSwitcherScreen.tsx** (280 LOC)
Project selection and navigation screen.

```
Layout:
┌─ Current Project Display
│  ├─ Large project name + status badge
│  ├─ Project owner email
│  ├─ Team member count
│  └─ Switch Project button
├─ Projects List Section
│  ├─ "My Projects" subsection
│  │  └─ Filterable list: [Project Name] [Status] [Members] [Switch >]
│  ├─ "Shared With Me" subsection
│  │  └─ Projects shared by others
│  └─ "Archived Projects" subsection (collapsed by default)
├─ Search & Filter Bar
│  ├─ Search by project name
│  ├─ Filter by status (active/archived/all)
│  └─ Sort options (name/date/members)
├─ Quick Actions
│  ├─ "New Project" button
│  ├─ "My Projects" link
│  └─ "Shared Projects" link
└─ Project Stats Row
   ├─ Total projects: 12
   ├─ Active: 8
   └─ Shared: 4
```

**State:**
- currentProject: Project
- projects: Project[]
- sharedProjects: Project[]
- searchText: string
- filterStatus: 'all' | 'active' | 'archived'
- loading: boolean

**Key Methods:**
- switchProject(projectId): Change current project
- createProject(): Navigate to create project flow
- searchProjects(text): Filter by name
- filterByStatus(status): Show active/archived
- loadProjects(): Fetch user's projects
- sortProjects(sortBy): Order by name/date/members

---

#### 2. **SharedDashboardScreen.tsx** (320 LOC)
Cross-project unified dashboard showing data from multiple projects.

```
Layout:
┌─ Dashboard Header
│  ├─ "Cross-Project Dashboard" title
│  ├─ Project selector dropdown (multi-select or active projects)
│  └─ Date range picker
├─ Project Filter Bar
│  ├─ "All Projects" / "My Projects" / "Shared" toggle buttons
│  ├─ Individual project checkboxes (up to 5 can be selected)
│  └─ "Apply" button
├─ Summary Cards Row (4 columns)
│  ├─ Total Records: (sum across projects)
│  ├─ Total Inspections: (sum across projects)
│  ├─ Total Work Orders: (sum across projects)
│  └─ Total Compliance Issues: (sum across projects)
├─ Project Comparison Chart
│  └─ Horizontal bar chart: [Project Name] [Records] [Inspections] [WOs]
├─ Activity Timeline (across all selected projects)
│  ├─ Timeline sparkline showing activity over time
│  └─ Aggregated events from all projects
├─ Team Activity (across projects)
│  └─ Who modified what in which project (chronological)
├─ Project Health Overview (grid)
│  └─ [Project Name] [Health %] [Last Updated] [Status]
└─ Export Dashboard button
```

**State:**
- selectedProjects: Project[]
- dashboardData: {
    totalRecords, totalInspections, totalWorkOrders, totalCompliance
  }
- projectComparison: { projectId, name, records, inspections, workorders }[]
- activityTimeline: Activity[]
- teamActivity: TeamActivity[]
- projectHealth: { projectId, name, health %, lastUpdated, status }[]
- dateRange: { start, end }
- loading: boolean

**Key Methods:**
- selectProjects(projectIds): Update dashboard data for selected projects
- loadDashboardData(): Fetch aggregated data
- generateComparison(): Create project comparison chart
- aggregateActivity(): Combine activity from all selected projects
- getTeamActivity(): Cross-project user actions
- projectHealth(): Calculate health % for each project
- exportDashboard(): Download dashboard as PDF

---

#### 3. **CrossProjectReportScreen.tsx** (280 LOC)
Generate and view cross-project reports with filtering and export.

```
Layout:
┌─ Report Builder
│  ├─ "Generate Report" title
│  ├─ Report Type Selector (4 options)
│  │  ├─ "Activity Report" - all changes across projects
│  │  ├─ "Compliance Report" - compliance status by project
│  │  ├─ "Performance Report" - metrics comparison
│  │  └─ "Team Report" - user activity across projects
│  ├─ Projects Multi-Select
│  │  └─ Checkboxes: [All] [My Projects] + individual projects
│  ├─ Date Range
│  │  └─ From/To date pickers
│  ├─ Additional Filters
│  │  ├─ Grouping: [By Project] [By User] [By Feature]
│  │  ├─ Sort: [Name] [Date] [Value]
│  │  └─ Format: [CSV] [PDF] [JSON]
│  └─ "Generate" button
├─ Generated Reports List
│  └─ Rows: [Report Name] [Type] [Generated] [Projects Count] [Actions]
│     - View button
│     - Re-download button
│     - Delete button
├─ Report Preview (if report selected)
│  └─ Table/chart view of report data
│  └─ Export button
└─ Report History
   └─ Recently generated reports with timestamps
```

**State:**
- reportType: 'activity' | 'compliance' | 'performance' | 'team'
- selectedProjects: Project[]
- dateRange: { start, end }
- groupBy: 'project' | 'user' | 'feature'
- sortBy: 'name' | 'date' | 'value'
- format: 'csv' | 'pdf' | 'json'
- generatedReports: Report[]
- selectedReport: Report | null
- reportData: any[]
- loading: boolean

**Key Methods:**
- generateReport(): Create report based on selections
- loadReports(): Fetch user's saved reports
- previewReport(reportId): Load report data
- downloadReport(reportId, format): Export report
- deleteReport(reportId): Remove report
- scheduleReport(schedule): Set recurring report generation
- shareReport(reportId, recipients): Send report to team

---

#### 4. **ProjectDetailScreen.tsx** (220 LOC)
Detailed project view with members, settings, and statistics.

```
Layout:
┌─ Project Header
│  ├─ Project name + status badge (Active/Archived/Draft)
│  ├─ Project ID: proj-123
│  └─ Created: 2026-09-15 | Updated: 2026-09-29
├─ Project Stats Section
│  ├─ [Records] [Inspections] [Work Orders] [Compliance Issues]
│  ├─ Linked Features: 5/6
│  └─ Team Size: 8 members
├─ Team Members Section
│  └─ Rows: [Name] [Email] [Role] [Status]
│     - Owner, Member, Viewer roles
│     - Online/Offline status
│     - Remove member button (owner only)
├─ Project Actions (owner only)
│  ├─ "Edit Project" button
│  ├─ "Add Member" button
│  ├─ "Archive Project" button
│  └─ "Delete Project" button (with confirmation)
├─ Project Settings Preview
│  ├─ Description: (first 100 chars)
│  ├─ Permissions: (role-based access)
│  └─ Compliance Status: Green/Yellow/Red
└─ Recent Activity
   └─ Last 5 changes: [User] [Action] [When]
```

**State:**
- project: Project (full details)
- members: TeamMember[]
- stats: {
    recordCount, inspectionCount, workOrderCount, complianceIssues
  }
- recentActivity: Activity[]
- loading: boolean

**Key Methods:**
- loadProject(projectId): Fetch project details
- addMember(email, role): Invite user to project
- removeMember(userId): Remove from project
- updateProjectSettings(): Edit project details
- archiveProject(): Mark as archived
- deleteProject(): Remove project
- loadRecentActivity(): Get last N changes

---

### Components (50 LOC)

#### 1. **ProjectCard.tsx** (25 LOC)
Reusable project card component.

```typescript
Props:
- project: Project
- onSelect: (project: Project) => void
- isSelected: boolean
- canSwitch: boolean

Renders:
- [Project Name] [Status Badge]
- Description (2 lines)
- Members: 8 | Last Updated: 2h ago
- Chevron indicator
- Hover: background highlight
```

#### 2. **ProjectStats.tsx** (25 LOC)
Displays project statistics in grid format.

```typescript
Props:
- stats: {
    records: number,
    inspections: number,
    workOrders: number,
    complianceIssues: number
  }
- isCompact: boolean

Renders:
- 4-column grid or 2-column grid (compact)
- Large numbers with labels
- Up/down trend indicators
- Optional: percentage change from last period
```

---

## PHASE 2: Services & API (850+ LOC)

### Services (450 LOC)

#### 1. **project.service.ts** (250 LOC)
Core project management service.

```typescript
Interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  ownerEmail: string
  status: 'active' | 'archived' | 'draft'
  members: TeamMember[]
  createdAt: string
  updatedAt: string
  lastModifiedBy: string
  features: { projectid, inspectionid, workorderid, complianceid }[]
  metadata?: Record<string, any>
}

Interface TeamMember {
  userId: string
  email: string
  name: string
  role: 'owner' | 'member' | 'viewer'
  joinedAt: string
  lastActive: string
  permissions: Permission[]
}

Interface Permission {
  feature: 'projects' | 'inspections' | 'workorders' | 'compliance' | 'reports'
  actions: ('read' | 'create' | 'update' | 'delete' | 'export')[]
}

Methods:

• getCurrentProject(): Promise<Project>
  - Fetch currently active project

• switchProject(projectId: string): Promise<Project>
  - Change active project, validate access

• createProject(name, description, members?): Promise<Project>
  - Create new project with owner = current user

• getProject(projectId: string): Promise<Project>
  - Fetch full project details including members

• updateProject(projectId: string, updates): Promise<Project>
  - Modify project details (owner only)

• listUserProjects(): Promise<Project[]>
  - All projects owned or shared with user

• listSharedProjects(userId?: string): Promise<Project[]>
  - Projects shared with user

• archiveProject(projectId: string): Promise<void>
  - Mark project as archived (owner only)

• deleteProject(projectId: string): Promise<void>
  - Remove project entirely (owner only, no data)

• addMember(projectId: string, email: string, role: Role): Promise<TeamMember>
  - Invite user to project

• removeMember(projectId: string, userId: string): Promise<void>
  - Remove user from project (owner only)

• updateMemberRole(projectId: string, userId: string, role: Role): Promise<TeamMember>
  - Change user's role (owner only)

• shareProject(projectId: string, recipients: string[]): Promise<void>
  - Grant project access to users

• getProjectStats(projectId: string): Promise<ProjectStats>
  - Count records, inspections, work orders, compliance issues

• getProjectHealth(projectId: string): Promise<number>
  - Calculate health score (0-100%) based on compliance/status

• getProjectActivity(projectId: string, limit?: number): Promise<Activity[]>
  - Recent changes in project
```

#### 2. **dashboard.service.ts** (200 LOC)
Cross-project dashboard aggregation.

```typescript
Methods:

• generateDashboard(projectIds: string[], dateRange: DateRange): Promise<DashboardData>
  - Aggregate data across multiple projects
  - Returns: { totalRecords, totalInspections, totalWorkOrders, totalCompliance }

• getProjectComparison(projectIds: string[]): Promise<ComparisonData[]>
  - Metrics for each project (records, inspections, work orders)

• aggregateActivity(projectIds: string[], dateRange?: DateRange): Promise<Activity[]>
  - Combine activity events from multiple projects, ordered by timestamp

• getTeamActivity(projectIds: string[], dateRange?: DateRange): Promise<TeamActivity[]>
  - User actions across selected projects

• calculateProjectHealth(projectIds: string[]): Promise<HealthData[]>
  - Health % and status for each project

• exportDashboard(projectIds: string[], format: 'pdf' | 'json'): Promise<Blob>
  - Generate exportable dashboard
```

---

### API Services (400 LOC)

#### 1. **project-api.ts** (250 LOC)
API endpoints for project management.

```typescript
API Endpoints:

GET /projects
  Returns: Project[] (user's projects)
  Query: { limit=50, archived=false }

POST /projects
  Body: { name, description, members?: [] }
  Returns: Project

GET /projects/{id}
  Returns: Project (full details)

PUT /projects/{id}
  Body: { name?, description?, status? }
  Returns: Project

DELETE /projects/{id}
  Permissions: owner only

GET /projects/{id}/members
  Returns: TeamMember[]

POST /projects/{id}/members
  Body: { email, role }
  Returns: TeamMember

DELETE /projects/{id}/members/{userId}
  Permissions: owner only

PATCH /projects/{id}/members/{userId}
  Body: { role }
  Returns: TeamMember

GET /projects/{id}/stats
  Returns: { records, inspections, workOrders, complianceIssues, ... }

GET /projects/{id}/health
  Returns: { health: 0-100, status, lastUpdated }

GET /projects/{id}/activity
  Query: { limit=50, dateStart?, dateEnd? }
  Returns: Activity[]

POST /projects/{id}/share
  Body: { recipients: email[] }
  Returns: { success, sharedWith }

GET /projects/shared
  Returns: Project[] (shared with user)

GET /projects/current
  Returns: Project (currently active project)

POST /projects/{id}/switch
  Returns: Project

GET /projects/{id}/export
  Query: { format='json' }
  Returns: Blob
```

#### 2. **dashboard-api.ts** (150 LOC)
Cross-project dashboard endpoints.

```typescript
API Endpoints:

POST /dashboards/generate
  Body: { projectIds: [], dateRange: { start, end } }
  Returns: DashboardData

GET /dashboards/comparison
  Query: { projects: 'proj1,proj2,proj3' }
  Returns: ComparisonData[]

GET /dashboards/activity
  Query: { projects: 'proj1,proj2', dateStart?, dateEnd? }
  Returns: Activity[]

GET /dashboards/team-activity
  Query: { projects: 'proj1,proj2', dateStart?, dateEnd? }
  Returns: TeamActivity[]

GET /dashboards/health
  Query: { projects: 'proj1,proj2,proj3' }
  Returns: HealthData[]

GET /reports/generate
  Query: { type, projects, dateStart, dateEnd, format }
  Returns: Blob (PDF/CSV/JSON report)

GET /reports
  Query: { limit=50 }
  Returns: Report[]

GET /reports/{id}
  Returns: Report (with data)

DELETE /reports/{id}
  Permissions: creator or admin

POST /reports/{id}/share
  Body: { recipients: email[] }
  Returns: { success, sharedWith }

POST /reports/{id}/schedule
  Body: { frequency, recipients }
  Returns: ScheduledReport
```

---

## PHASE 3: Hooks & E2E Tests (350+ LOC, 35+ tests)

### Hooks (150 LOC)

#### **useProject.ts** (150 LOC)
Project management state and operations.

```typescript
Interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  sharedProjects: Project[]
  selectedProjects: Project[]
  dashboardData: DashboardData | null
  reports: Report[]
  loading: boolean
  error: string | null
}

Methods:

• switchProject(projectId: string): Promise<Project>
  - Change active project

• createProject(name, description): Promise<Project>
  - Create new project

• loadProjects(): Promise<Project[]>
  - Fetch user's projects

• loadSharedProjects(): Promise<Project[]>
  - Fetch projects shared with user

• getProjectDetails(projectId): Promise<Project>
  - Full project info + members

• addProjectMember(projectId, email, role): Promise<TeamMember>
  - Invite user

• removeProjectMember(projectId, userId): Promise<void>
  - Remove user from project

• updateProjectSettings(projectId, updates): Promise<Project>
  - Modify project details

• archiveProject(projectId): Promise<void>
  - Archive project

• selectProjects(projectIds): Promise<void>
  - Select multiple projects for dashboard

• generateDashboard(projectIds, dateRange): Promise<DashboardData>
  - Create cross-project dashboard

• generateReport(reportType, projectIds, dateRange): Promise<Report>
  - Generate cross-project report

• loadReports(): Promise<Report[]>
  - Fetch user's saved reports

• downloadReport(reportId, format): Promise<Blob>
  - Export report

• shareProject(projectId, recipients): Promise<void>
  - Share project with team

• getProjectStats(projectId): Promise<ProjectStats>
  - Project metrics
```

---

### E2E Tests (200+ LOC, 35+ tests)

**File:** multi-project.e2e.ts

#### Project Switcher Tests (8 tests)
- Open project switcher
- Display current project
- Display my projects list
- Display shared projects
- Search projects by name
- Filter by status (active/archived)
- Sort projects (name/date/members)
- Switch to different project

#### Shared Dashboard Tests (10 tests)
- Open shared dashboard
- Display summary cards (total records, inspections, etc.)
- Show project comparison chart
- Select multiple projects
- Update dashboard with new selection
- Show activity timeline
- Show team activity
- Show project health overview
- Export dashboard (PDF/JSON)
- Handle single vs multiple project views

#### Cross-Project Reports Tests (8 tests)
- Open report generator
- Select report type (activity/compliance/performance/team)
- Multi-select projects
- Set date range
- Choose grouping (project/user/feature)
- Choose sort order
- Choose export format
- Generate report
- Preview report
- Download report
- View report history

#### Project Detail Tests (7 tests)
- Open project details
- Display project stats
- Show team members
- Add new member
- Remove member (owner only)
- Change member role
- Edit project settings (owner only)
- Archive project (owner only)

#### Error Handling & Permissions (2 tests)
- Non-owner cannot modify project
- Viewer cannot add/remove members
- Handle large multi-project selection

**Total:** 35+ comprehensive E2E tests

---

## Success Criteria

### Phase 1 ✓
- [ ] 4 screens (ProjectSwitcher, SharedDashboard, CrossProjectReport, ProjectDetail)
- [ ] 2 components (ProjectCard, ProjectStats)
- [ ] Multi-project selection and filtering
- [ ] Cross-project dashboard visualization
- [ ] Report builder UI
- [ ] Clean, consistent UI matching previous tasks

### Phase 2 ✓
- [ ] project.service.ts with all methods
- [ ] dashboard.service.ts for aggregation
- [ ] project-api.ts with 14 endpoints
- [ ] dashboard-api.ts with 11 endpoints
- [ ] Full-featured project management
- [ ] Cross-project data aggregation
- [ ] Permissioning and access control

### Phase 3 ✓
- [ ] useProject hook with state management
- [ ] 35+ E2E tests (switcher, dashboard, reports, details, permissions)
- [ ] All tests passing
- [ ] Error handling validated
- [ ] Performance tested (multi-project load < 4s)

---

## Estimated Completion
- Phase 1: 5-6 hours
- Phase 2: 4-5 hours
- Phase 3: 3-4 hours
- **Total:** ~13 hours development + testing

---

## Dependencies & Integration Points
- Builds on project infrastructure from Tasks #1-19
- Integrates with all feature APIs (projects, inspections, workorders, compliance, reports)
- Requires user/team context from authentication layer
- Uses Zustand for state management (consistent with existing app)
- Storage: PostgreSQL projects/members/permissions tables with indexes
- Caching: Redis cache for dashboards (2-minute TTL) and reports (1-hour TTL)

---

## Notes for Implementation
- Follow established 3-phase pattern from Tasks #20-25
- Maintain TypeScript strict mode + React Native best practices
- Use Zustand for state management
- E2E tests use Detox framework
- Permission checks: owner, member, viewer roles
- Soft delete for projects (archive status) unless explicitly deleted
- All code must be production-ready with error handling
- Comprehensive jsdoc comments on services
