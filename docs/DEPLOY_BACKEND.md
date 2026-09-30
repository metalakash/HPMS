# Backend Deployment Guide

**Platform:** Render  
**Environment:** Production  
**Database:** PostgreSQL 13+  
**Cache:** Redis  
**Runtime:** Python 3.9+

---

## Local Development Setup

### Prerequisites
```bash
# Check versions
python --version  # 3.9+
psql --version    # 13+
redis-cli --version
```

### Initial Setup
```bash
# Clone repository
git clone https://github.com/hpms/backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hpms_dev
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET_KEY=dev_secret_key_change_in_production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=1

# Environment
ENVIRONMENT=development
DEBUG=True
LOG_LEVEL=INFO

# API
API_HOST=localhost
API_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Email
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=app_specific_password
```

### Database Setup
```bash
# Run migrations
alembic upgrade head

# Seed sample data
python scripts/seed.py

# Verify setup
python -c "from app.database import engine; print('✓ Database connected')"
```

### Start Development Server
```bash
# Run server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Server available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

---

## Production Deployment (Render)

### Step 1: Create Render Account
1. Visit [render.com](https://render.com)
2. Sign up with GitHub account
3. Connect GitHub repository

### Step 2: Configure Environment Variables

In Render dashboard, set environment variables:

```env
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[db]
DATABASE_POOL_SIZE=25

# Redis
REDIS_URL=redis://:[password]@[host]:[port]

# Security
JWT_SECRET_KEY=[generate_strong_random_key]
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=1

# Environment
ENVIRONMENT=production
DEBUG=False
LOG_LEVEL=WARNING

# API
API_HOST=api.hpms.hydropower.dev
API_PORT=8000
CORS_ORIGINS=https://hpms.vercel.app,https://hpms.eas.app

# Email
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=[production_email]
SMTP_PASSWORD=[app_password]

# Monitoring
SENTRY_DSN=[your_sentry_dsn]
```

### Step 3: Create Web Service

**In Render Dashboard:**

1. Click "New +" → "Web Service"
2. Connect to GitHub repository
3. Configure:
   - **Name:** hpms-api
   - **Environment:** Python 3.9
   - **Build Command:** `pip install -r requirements.txt && alembic upgrade head`
   - **Start Command:** `gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000`
   - **Instance Type:** Standard ($7/month)

4. Set environment variables (see Step 2)
5. Click "Create Web Service"

### Step 4: Deploy
```bash
# Push to main branch
git push origin main

# Render automatically builds and deploys
# Check deployment status in Render dashboard
```

### Step 5: Verify Deployment
```bash
# Check health endpoint
curl https://api.hpms.hydropower.dev/health
# Response: {"status": "healthy", "timestamp": "..."}

# Check API docs
open https://api.hpms.hydropower.dev/docs
```

### Step 6: Database Migrations
```bash
# In Render Dashboard → Web Service → Shell
alembic upgrade head

# Seed production data (if needed)
python scripts/seed_production.py
```

---

## Database Setup on Render

### Create PostgreSQL Database

1. Render Dashboard → "New +" → "PostgreSQL"
2. Configure:
   - **Name:** hpms-postgres
   - **Database:** hpms
   - **User:** hpms_user
   - **Region:** Same as API
3. Note the connection string

### Database Backups
- Automatic daily backups (30-day retention)
- Point-in-time recovery available
- Manual backup: Render Dashboard → Database → Backups

### Connection Pool
- Max connections: 100
- Idle timeout: 900 seconds
- Queue timeout: 30 seconds

---

## Redis Setup

### Option 1: Redis Cloud (Recommended)

1. Visit [redis.com/try-free](https://redis.com/try-free)
2. Create free database
3. Get connection string
4. Add to Render environment variables: `REDIS_URL`

### Option 2: Render Redis

1. Render Dashboard → "New +" → "Redis"
2. Configure settings
3. Get connection string

---

## Monitoring & Logging

### Health Checks
```bash
# Automatic health checks every 30 seconds
# Endpoint: /health
# Must respond with 2xx status

curl https://api.hpms.hydropower.dev/health
```

### Logs
Access logs in Render Dashboard:
- **Logs tab** → View build and runtime logs
- Search for errors, warnings
- Real-time streaming

### Metrics
```bash
# Prometheus metrics at /metrics
curl https://api.hpms.hydropower.dev/metrics
```

### Error Tracking (Sentry)
```python
# Configured in main.py
import sentry_sdk

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment="production"
)
```

### Performance Monitoring
- Response times tracked
- Query performance logged
- Database connection pool monitored

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally: `pytest`
- [ ] Code review approved
- [ ] Environment variables configured
- [ ] Database backups verified
- [ ] API documentation up-to-date

### Deployment
- [ ] Push to main branch
- [ ] Monitor Render build process
- [ ] Verify health endpoint
- [ ] Check error logs
- [ ] Run smoke tests

### Post-Deployment
- [ ] Database migrations completed
- [ ] API responding normally
- [ ] No increase in error rate
- [ ] Performance metrics stable
- [ ] Email notifications working

---

## Scaling

### Horizontal Scaling
- Increase workers in gunicorn config
- Add more web service instances

### Vertical Scaling
- Render Dashboard → Web Service → Settings
- Change instance type (Standard → Standard+)
- No downtime required

### Database Scaling
- Monitor connection usage
- Increase max connections if needed
- Consider read replicas for heavy read loads

---

## Rollback Procedure

### If Deployment Fails

```bash
# Identify last working commit
git log --oneline

# Revert to previous commit
git revert <commit_hash>
git push origin main

# Render automatically redeploys
```

### Database Rollback

```bash
# If migration failed
# In Render Shell:
alembic downgrade -1
alembic current

# Verify database state
psql $DATABASE_URL -c "SELECT * FROM alembic_version;"
```

---

## Common Issues & Solutions

### Build Fails
```bash
# Clear dependencies
rm -rf .venv
pip install -r requirements.txt

# Check Python version
python --version  # Should be 3.9+

# Check for syntax errors
python -m py_compile app/main.py
```

### Database Connection Fails
```bash
# Test connection string
psql $DATABASE_URL -c "SELECT 1;"

# Check network access
ping -c 1 [db_host]

# Verify credentials
echo $DATABASE_URL | grep -o "[^:]*@[^/]*"
```

### High Memory Usage
```bash
# Reduce worker count in gunicorn
# Render Dashboard → Environment Variables
# WORKERS=2  # Reduce from default

# Profile memory usage
python -m memory_profiler app/main.py
```

### Slow Queries
```bash
# Enable query logging
LOG_SQL_QUERIES=True

# Check slow query log
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## Performance Tuning

### Connection Pooling
```env
DATABASE_POOL_SIZE=20
DATABASE_POOL_TIMEOUT=30
```

### Query Caching
```env
REDIS_CACHE_TTL_MINUTES=5  # Cache for 5 minutes
CACHE_ENABLED=True
```

### Worker Configuration
```bash
# gunicorn workers = (2 * CPU cores) + 1
# For 2 cores: 5 workers
# Render calculates automatically
```

### Timeout Settings
```env
REQUEST_TIMEOUT_SECONDS=30
DB_QUERY_TIMEOUT_SECONDS=30
```

---

## Security Checklist

- [ ] JWT secret is strong (32+ characters)
- [ ] CORS origins restricted to known domains
- [ ] Database backups encrypted
- [ ] Logs don't contain sensitive data
- [ ] Rate limiting enabled
- [ ] HTTPS enforced (automatic on Render)
- [ ] Dependencies updated regularly

---

## Support & Documentation

- **Render Docs:** https://render.com/docs
- **API Docs:** https://api.hpms.hydropower.dev/docs
- **Status Page:** https://status.hpms.dev
- **Support Email:** support@hpms.dev
