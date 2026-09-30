# Frontend Deployment Guide

**Platform:** Vercel  
**Framework:** React 19 + TypeScript 5.1  
**Build Tool:** Vite  
**Node:** 18+

---

## Local Development Setup

### Prerequisites
```bash
# Check versions
node --version      # 18+
npm --version       # 9+
npm install -g vercel  # Vercel CLI
```

### Initial Setup
```bash
# Clone repository
git clone https://github.com/hpms/frontend
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

### Environment Variables
```env
# API
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_API_TIMEOUT=30000

# Authentication
REACT_APP_AUTH_DOMAIN=localhost:8000
REACT_APP_AUTH_CLIENT_ID=dev_client_id

# Environment
REACT_APP_ENV=development

# Analytics
REACT_APP_SENTRY_DSN=
REACT_APP_MIXPANEL_TOKEN=

# Feature Flags
REACT_APP_FEATURES_CROSS_FEATURE=true
REACT_APP_FEATURES_WORKFLOWS=true
```

### Start Development Server
```bash
# Run dev server
npm run dev

# Vite server at http://localhost:5173
# HMR enabled for fast refresh
```

### Build Locally
```bash
# Production build
npm run build

# Analyze bundle size
npm run build -- --stats

# Preview production build
npm run preview
```

---

## Production Deployment (Vercel)

### Step 1: Connect to Vercel

**Option A: CLI**
```bash
# Login to Vercel
vercel login

# Deploy from project directory
vercel --prod
```

**Option B: Web Dashboard**
1. Visit [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Select repository: `hpms/frontend`
5. Configure project settings
6. Click "Deploy"

### Step 2: Configure Environment Variables

**In Vercel Dashboard → Settings → Environment Variables:**

**Production:**
```env
REACT_APP_API_URL=https://api.hpms.hydropower.dev
REACT_APP_API_TIMEOUT=30000
REACT_APP_AUTH_DOMAIN=hpms.auth0.com
REACT_APP_AUTH_CLIENT_ID=[your_client_id]
REACT_APP_ENV=production
REACT_APP_SENTRY_DSN=[your_sentry_dsn]
REACT_APP_MIXPANEL_TOKEN=[your_token]
REACT_APP_FEATURES_CROSS_FEATURE=true
REACT_APP_FEATURES_WORKFLOWS=true
```

**Preview (Staging):**
```env
REACT_APP_API_URL=https://api-staging.hpms.hydropower.dev
REACT_APP_AUTH_DOMAIN=hpms-staging.auth0.com
REACT_APP_ENV=staging
```

**Development:**
```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_ENV=development
```

### Step 3: Deploy

**Automatic Deployment:**
- Push to `main` branch
- Vercel automatically builds and deploys
- Deployment URL: `https://hpms.vercel.app`

**Manual Deployment:**
```bash
vercel --prod
```

### Step 4: Verify Deployment

```bash
# Check deployment status
curl -I https://hpms.vercel.app

# Check Lighthouse score
open https://hpms.vercel.app

# View deployment logs
vercel logs
```

### Step 5: Configure Custom Domain

**In Vercel Dashboard → Settings → Domains:**

1. Add custom domain: `hpms.hydropower.dev`
2. Update DNS records (provided by Vercel)
3. Wait for SSL certificate (24-48 hours)
4. Verify HTTPS working

---

## Build Configuration

### Build Settings

**In Vercel Dashboard → Settings → Build & Development Settings:**

- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Node Version:** 18.x (LTS)

### Performance Optimization

**vite.config.ts:**
```typescript
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react': ['react', 'react-dom'],
          'components': ['@hpms/components']
        }
      }
    },
    cssCodeSplit: true,
    minify: 'terser'
  }
}
```

### Code Splitting
```typescript
// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));

// Suspense boundary
<Suspense fallback={<Loading />}>
  <Outlet />
</Suspense>
```

---

## Monitoring & Analytics

### Vercel Analytics

**In Vercel Dashboard → Analytics:**
- Page views and unique visitors
- Core Web Vitals (LCP, FID, CLS)
- Performance metrics by page
- Traffic patterns

### Sentry Error Tracking

**Setup in App:**
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_ENV,
  tracesSampleRate: 1.0
});
```

**Monitor:**
- JavaScript errors
- Performance issues
- User sessions
- Release tracking

### Mixpanel Events

**Track user actions:**
```typescript
import mixpanel from 'mixpanel-browser';

mixpanel.track('feature_map_opened', {
  feature_count: 5,
  timestamp: new Date()
});
```

**Analyze:**
- User flows
- Feature adoption
- Funnel analysis
- Cohort retention

---

## Performance Targets

### Lighthouse Scores
- **Performance:** > 90
- **Accessibility:** > 95
- **Best Practices:** > 95
- **SEO:** > 95

### Core Web Vitals
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

### Bundle Size
- **Total:** < 500KB (gzipped)
- **React:** < 100KB
- **App code:** < 200KB
- **Vendor:** < 200KB

### Speed Index
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Environment variables set
- [ ] API connectivity tested

### Deployment
- [ ] Push to main branch
- [ ] Monitor Vercel build
- [ ] Check deployment preview
- [ ] Verify custom domain
- [ ] Test with production API

### Post-Deployment
- [ ] No JavaScript errors
- [ ] API calls working
- [ ] Authentication functioning
- [ ] Mobile responsive
- [ ] Dark mode working
- [ ] Performance metrics good

---

## Rollback Procedure

### Quick Rollback
```bash
# Vercel Dashboard → Deployments
# Click previous deployment → Promote to Production
```

### Git Rollback
```bash
# Identify previous commit
git log --oneline

# Revert
git revert <commit_hash>
git push origin main

# Vercel auto-redeploys
```

---

## Common Issues & Solutions

### Build Fails
```bash
# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 18+

# Try build locally first
npm run build
```

### Slow Build Times
- Split large components
- Use lazy loading
- Optimize images
- Remove unused dependencies

### API Connectivity Issues
```bash
# Test API connection
curl https://api.hpms.hydropower.dev/health

# Check CORS headers
curl -H "Origin: https://hpms.vercel.app" \
  https://api.hpms.hydropower.dev/health

# Verify API_URL in .env
echo $REACT_APP_API_URL
```

### High Memory Usage
- Check bundle analysis
- Remove console.log statements
- Optimize images
- Review dependencies

---

## Security Checklist

- [ ] No secrets in code or .env files
- [ ] API_URL uses HTTPS
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] Dependencies up-to-date
- [ ] No console errors in production
- [ ] Rate limiting on API

---

## Advanced Configuration

### Edge Middleware (Vercel)

**middleware.ts:**
```typescript
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}
```

### Preview Deployments

- Automatic for pull requests
- Staging environment for testing
- Share preview URL with team
- Merge to main after approval

### Analytics & Insights

**Dashboard → Analytics:**
- Real-time traffic
- Performance metrics
- Error rates
- Geographic data

---

## Cost Optimization

### Bandwidth
- Enable image optimization
- Use CDN effectively
- Compress assets
- Monitor usage

### Build Time
- Cache dependencies
- Optimize build process
- Parallel builds
- Skip unnecessary steps

### Serverless Functions
- Use only when needed
- Keep functions lightweight
- Monitor cold start times

---

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Vite Guide:** https://vitejs.dev/guide/
- **React Docs:** https://react.dev
- **Support Email:** support@hpms.dev
