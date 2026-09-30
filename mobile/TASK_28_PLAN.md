# Task #28: Documentation & Deployment
## Complete 3-Phase Architecture Specification

**Status:** Phase 1 Planning (Documentation)  
**Target LOC:** 1,200+ (Phase 1: 400+ | Phase 2: 500+ | Phase 3: 300+)  
**Deployment:** Production-ready across mobile, backend, frontend  
**Delivery Timeline:** 3 phases, full stack deployment

---

## Overview
Comprehensive documentation of all Phase 7.3 features (Tasks #20-27) and deployment to production environments (Render backend, Vercel frontend, EAS mobile). Includes API documentation, component library reference, deployment guides, and runbooks.

---

## PHASE 1: API & Component Documentation (400+ LOC)

### API Documentation (200 LOC)

**File:** `API_REFERENCE.md`

```markdown
# Cross-Feature Integration API Reference

## Base URL
- Production: https://api.hpms.hydropower.dev
- Staging: https://api-staging.hpms.hydropower.dev
- Local: http://localhost:8000/api

## Authentication
- Bearer token in Authorization header
- Refresh token rotation every 7 days
- Rate limiting: 1000 req/min per user

## Endpoints

### Cross-Feature Links
- POST /links — Create link
- GET /links/{id} — Fetch by record
- DELETE /links/{id} — Remove link
- PUT /links/{id}/strength — Update strength
- GET /map — Feature network
- GET /dependencies — List dependencies
- GET /blocking-issues — Stuck items
- GET /critical-path — Longest chain
- GET /health — Health score

### Workflows
- POST /workflows — Create
- GET /workflows/{id} — Fetch
- PUT /workflows/{id} — Update
- DELETE /workflows/{id} — Remove
- POST /workflows/{id}/publish — Publish
- POST /workflows/{id}/execute — Run
- POST /workflows/{id}/test — Preview
- GET /workflows/templates — Templates

### Audit Logging
- GET /audits — Master log
- POST /audits/search — Advanced search
- GET /audits/stats — Statistics
- POST /audits/{id}/rollback — Rollback

### Multi-Project
- GET /projects — List projects
- POST /projects — Create
- GET /projects/{id} — Details
- PUT /projects/{id} — Update
- POST /projects/{id}/members — Add member
- DELETE /projects/{id}/members/{uid} — Remove
- GET /dashboards/cross-project — Aggregate
- POST /reports/generate — Report

## Response Formats

### Success (200-201)
```json
{
  "data": { /* resource */ },
  "status": "success",
  "timestamp": "2026-09-30T12:00:00Z"
}
```

### Error (4xx-5xx)
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": { /* validation errors */ },
  "status": "error",
  "timestamp": "2026-09-30T12:00:00Z"
}
```

## Pagination
- `limit`: Items per page (default 20, max 100)
- `offset`: Starting position (default 0)
- `total`: Total matching records
- `has_next`: Boolean

## Rate Limits
- Free tier: 100 req/min
- Pro tier: 1000 req/min
- Enterprise: Unlimited

## Versioning
- Current version: v1
- Deprecated: v0 (sunset 2026-12-31)
- Next: v2 (beta, 2026-Q4)

## Error Codes
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Rate Limited
- 500: Server Error

## Webhooks
- project.created
- inspection.completed
- workorder.assigned
- compliance.updated

## Examples
[Python, JavaScript, cURL examples for each endpoint]
```

### Component Library (200 LOC)

**File:** `COMPONENT_LIBRARY.md`

```markdown
# React Native Component Library

## Overview
Production-grade component library with 50+ reusable components. All components support dark mode, accessibility, and offline functionality.

## Installation
```bash
npm install @hpms/components
```

## Components

### Screens (6)
- CrossFeatureMapScreen — Feature network visualization
- LinkedItemsScreen — Link management
- WorkflowDesignerScreen — Workflow builder
- DependencyTrackerScreen — Dependency tracking
- ProjectSwitcherScreen — Multi-project selection
- SharedDashboardScreen — Cross-project dashboard

### Form Components (8)
- FormInput — Text input with validation
- FormSelect — Dropdown selector
- FormDatePicker — Date selection
- FormCheckbox — Toggle
- FormRadio — Option selection
- FormSlider — Range input
- FormTextArea — Multi-line text
- FormUpload — File upload

### Data Display (12)
- DataTable — Sortable/paginated table
- Card — Content container
- Badge — Status indicator
- Progress — Progress bar
- Timeline — Activity timeline
- Chart — Chart visualization
- Stats — Statistics grid
- Empty — Empty state
- Error — Error display
- Loading — Loading skeleton
- Breadcrumb — Navigation breadcrumb
- Pagination — Page navigation

### Navigation (6)
- NavBar — Top navigation
- Tab — Tab selector
- Drawer — Side menu
- BottomTab — Bottom tab bar
- Link — Navigation link
- Menu — Context menu

### Feedback (8)
- Toast — Notification
- Alert — Alert dialog
- Modal — Modal dialog
- Confirm — Confirmation dialog
- Tooltip — Hover tooltip
- Popover — Popover menu
- Loading — Loading overlay
- Skeleton — Skeleton loader

## Usage Examples
[Complete examples with props, states, callbacks]

## Styling
- All components use StyleSheet.create()
- Colors: CSS variables via theme context
- Dark mode support via Appearance API
- Responsive design for all screen sizes

## Testing
- Unit tests: Jest
- Integration tests: React Testing Library
- E2E tests: Detox
- Visual regression: Percy

## Performance
- Memoization: React.memo for pure components
- Lazy loading: Code splitting support
- Bundle size: < 500KB gzipped
```

---

## PHASE 2: Deployment Guides (500+ LOC)

### Backend Deployment (150 LOC)

**File:** `DEPLOY_BACKEND.md`

```markdown
# Backend Deployment Guide

## Prerequisites
- Python 3.9+
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose

## Environment Setup

### Local Development
```bash
git clone https://github.com/hpms/backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### Configuration
```env
DATABASE_URL=postgresql://user:pass@localhost/hpms
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your_secret_key_here
ENVIRONMENT=development
```

### Database Setup
```bash
alembic upgrade head
python scripts/seed.py
```

## Production Deployment (Render)

### Step 1: Configure Environment
- Set DATABASE_URL (Render PostgreSQL)
- Set REDIS_URL (Redis Cloud)
- Set JWT_SECRET_KEY (strong random)
- Set ENVIRONMENT=production

### Step 2: Deploy
```bash
git push origin main
# Render auto-deploys on push to main
```

### Step 3: Verify
```bash
curl https://api.hpms.hydropower.dev/health
# Should return: {"status": "healthy"}
```

### Step 4: Run Migrations
```bash
# In Render dashboard:
# 1. Go to Settings > Environment
# 2. Run command: alembic upgrade head
```

## Monitoring
- Health endpoint: /health
- Metrics: /metrics (Prometheus)
- Logs: Render dashboard
- Alerts: Email + Slack integration

## Rollback Procedure
```bash
# If deployment fails:
git revert <commit_hash>
git push origin main
# Render will automatically redeploy
```

## Database Backups
- Automatic daily backups
- 30-day retention
- Point-in-time recovery available

## Performance Tuning
- Connection pooling: 20 connections
- Query timeouts: 30 seconds
- Cache TTL: 5 minutes (inspections), 1 hour (reports)
- Rate limiting: 1000 req/min per user
```

### Frontend Deployment (150 LOC)

**File:** `DEPLOY_FRONTEND.md`

```markdown
# Frontend Deployment Guide

## Prerequisites
- Node.js 18+
- npm or yarn
- Vercel CLI

## Environment Setup

### Local Development
```bash
git clone https://github.com/hpms/frontend
cd frontend
npm install
npm run dev
```

### Configuration
```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_AUTH_DOMAIN=your-auth-domain
```

## Production Deployment (Vercel)

### Step 1: Connect Repository
- Go to vercel.com
- Import project from GitHub
- Select main branch

### Step 2: Configure Environment
```env
REACT_APP_API_URL=https://api.hpms.hydropower.dev
REACT_APP_AUTH_DOMAIN=hpms.auth0.com
```

### Step 3: Deploy
```bash
git push origin main
# Vercel auto-deploys on push
```

### Step 4: Verify
```bash
# Visit https://hpms.vercel.app
# Check network tab for API connectivity
```

## Performance
- Build size: < 1MB gzipped
- Lighthouse score: > 90
- Core Web Vitals: Green
- CDN distribution: Global

## Analytics
- Page views: Vercel Analytics
- Performance: Sentry
- User events: Mixpanel
- Errors: Sentry

## Deployment Strategy
- Zero-downtime deployments
- Gradual rollout: 25% → 50% → 100%
- Automatic rollback if error rate > 5%
- Feature flags for testing
```

### Mobile Deployment (200 LOC)

**File:** `DEPLOY_MOBILE.md`

```markdown
# Mobile Deployment Guide (EAS)

## Prerequisites
- Node.js 18+
- npm/yarn
- Expo CLI: npm install -g eas-cli
- EAS account

## Environment Setup

### Local Development
```bash
git clone https://github.com/hpms/mobile
cd mobile
npm install
expo start
```

### Configuration
```env
EXPO_PUBLIC_API_URL=http://localhost:8000/api
EXPO_PUBLIC_ENV=development
```

## Build Configuration

### eas.json
```json
{
  "build": {
    "production": {
      "ios": {
        "image": "default"
      },
      "android": {
        "image": "latest"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "certificateSource": "local"
      },
      "android": {
        "serviceAccount": "path/to/key.json"
      }
    }
  }
}
```

## Production Build & Submit

### Step 1: Create Build
```bash
eas build --platform all --auto-submit
```

### Step 2: Monitor Build
```bash
eas build:list
eas build:view <build_id>
```

### Step 3: Submit to Stores
- iOS: Automatically submitted to App Store
- Android: Automatically submitted to Google Play

### Step 4: Release
- iOS: Manual review in App Store Connect (24-48h)
- Android: Auto-published to Play Store

## Versioning
- Semantic versioning: MAJOR.MINOR.PATCH
- Update package.json version before build
- Tag releases: v1.2.3

## Over-the-Air Updates
```bash
# For JS changes only:
eas update --channel production
# Deploys to users within 1 hour
```

## Analytics
- Crash reports: Sentry
- Performance: Firebase Perf
- Usage: Firebase Analytics
- Errors: Sentry

## Testing Before Release
- Device testing: iOS + Android
- Network conditions: 3G, 4G, 5G
- Offline mode verification
- Dark mode testing
- Accessibility audit
```

---

## PHASE 3: Runbooks & Troubleshooting (300+ LOC)

### Operations Runbook (150 LOC)

**File:** `RUNBOOK.md`

```markdown
# Operations Runbook

## Incident Response

### Database Down
1. Check Render dashboard
2. Restart PostgreSQL instance
3. Verify connectivity: psql -c "SELECT 1"
4. Alert ops team if not recovered in 5 min

### API Down
1. Check Render logs
2. Restart FastAPI service
3. Monitor /health endpoint
4. Rollback if issue persists

### High Error Rate (> 5%)
1. Check error logs
2. Identify affected endpoints
3. Rollback last deployment if needed
4. Notify team on Slack

### Performance Degradation
1. Check database query performance
2. Review cache hit rates
3. Check Redis connection pool
4. Scale up if needed

## Monitoring Checklist

### Daily
- [ ] Error rate < 1%
- [ ] Response time < 500ms
- [ ] Uptime = 100%
- [ ] Database disk < 80%

### Weekly
- [ ] Database backups verified
- [ ] Log files rotation working
- [ ] Security patches applied
- [ ] Performance trends reviewed

### Monthly
- [ ] Capacity planning review
- [ ] Security audit
- [ ] Disaster recovery drill
- [ ] Documentation update

## Common Issues

### Slow Queries
```sql
SELECT query, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

### Connection Pool Exhaustion
- Check active connections
- Restart service
- Increase pool size if needed

### Memory Leak
- Check memory usage trends
- Restart service
- Review recent code changes

### Cache Misses
- Check Redis connectivity
- Verify cache keys
- Review TTL settings

## Escalation Path
1. Try resolution steps
2. Alert on-call engineer (5 min)
3. Escalate to engineering lead (15 min)
4. Escalate to director (30 min)
```

### Troubleshooting Guide (150 LOC)

**File:** `TROUBLESHOOTING.md`

```markdown
# Troubleshooting Guide

## Mobile App Issues

### App Won't Start
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Clear Expo cache
expo start --clear

# Reset simulator
xcrun simctl erase all
```

### Network Errors
- Check API_URL in .env
- Verify backend is running
- Check network connectivity: `ping api.hpms.dev`
- Review API logs

### Offline Sync Not Working
- Check WatermelonDB database
- Verify AsyncStorage
- Review sync queue
- Check user permissions

### Dark Mode Not Working
- Check React.useColorScheme()
- Verify StyleSheet colors
- Clear app cache
- Test on both iOS/Android

### Performance Issues
- Profile with React DevTools
- Check FlatList rendering
- Verify image optimization
- Review navigation stack

## Backend Issues

### Migration Failed
```bash
# Check status
alembic current

# Rollback
alembic downgrade -1

# Re-run
alembic upgrade head
```

### Database Connection Issues
```bash
# Test connection
psql postgresql://user:pass@host/db

# Check connection pool
SELECT count(*) FROM pg_stat_activity;

# Kill stale connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'hpms' AND pid != pg_backend_pid();
```

### Import/Export Fails
- Check file format (CSV/JSON/Excel)
- Verify data schema
- Check file size (< 100MB)
- Review error logs

### API Rate Limiting
- Reduce request rate
- Add exponential backoff
- Use batch endpoints
- Request higher quota

## Frontend Issues

### Build Fails
```bash
# Clear build artifacts
rm -rf build dist .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### API Connectivity
- Check CORS headers
- Verify API_URL env var
- Test with curl: `curl https://api.hpms.dev/health`
- Check browser console for errors

### State Management Issues
- Check Redux DevTools
- Verify Zustand store
- Review middleware
- Check persistence storage

### Deployment Issues
- Check Vercel logs
- Review environment variables
- Verify git push to main
- Check build output

## Getting Help

1. **Check logs**: Application logs in dashboard
2. **Search docs**: API Reference, Component Library
3. **Review examples**: GitHub examples folder
4. **Post to Slack**: #engineering channel
5. **Create issue**: GitHub issues with reproduction steps
```

---

## Success Criteria

### Phase 1 ✓
- [ ] API Reference (200 LOC) — Complete endpoint documentation
- [ ] Component Library (200 LOC) — All components documented
- [ ] Examples: cURL, Python, JavaScript for each endpoint
- [ ] SDK documentation for each platform

### Phase 2 ✓
- [ ] Backend Deployment Guide (150 LOC) — Render setup
- [ ] Frontend Deployment Guide (150 LOC) — Vercel setup
- [ ] Mobile Deployment Guide (200 LOC) — EAS/App Store/Play Store
- [ ] All steps tested and verified

### Phase 3 ✓
- [ ] Operations Runbook (150 LOC) — Incident response
- [ ] Troubleshooting Guide (150 LOC) — Common issues
- [ ] Monitoring checklist
- [ ] Escalation procedures

---

## Estimated Completion
- Phase 1: 3-4 hours (documentation)
- Phase 2: 4-5 hours (deployment setup & verification)
- Phase 3: 2-3 hours (runbooks & testing)
- **Total:** ~10 hours development

---

## Integration Points
- All Phase 7.3 features (Tasks #20-27) documented
- Integrates with existing CI/CD pipelines
- Deployed to production environments
- Monitoring and alerting configured
- Team onboarded and trained

---

## Notes for Implementation
- Document as you code (keep docs in sync)
- Include real API examples
- Test all deployment steps manually
- Record deployment videos for team
- Create monitoring dashboards
- Set up alerting before going live
