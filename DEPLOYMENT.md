# HPMS Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-09-23  
**Status:** Production Ready  

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Architecture](#system-architecture)
3. [Backend Deployment](#backend-deployment)
4. [Database Setup](#database-setup)
5. [Redis Configuration](#redis-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Mobile App Deployment](#mobile-app-deployment)
8. [Docker Deployment](#docker-deployment)
9. [Monitoring & Logging](#monitoring--logging)
10. [Security Hardening](#security-hardening)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Server (Backend):**
- OS: Linux (Ubuntu 20.04+), macOS, or Windows Server
- CPU: 2+ cores
- RAM: 4GB minimum (8GB recommended)
- Disk: 20GB SSD
- Python: 3.10+

**Database:**
- PostgreSQL 12+ or compatible
- 10GB+ storage

**Cache:**
- Redis 6.0+ (separate instance recommended)
- 2GB+ memory

**Development Machine:**
- Node.js 16+ (for mobile builds)
- Xcode 13+ (iOS) or Android Studio 2021+ (Android)
- Git 2.30+

### Required Software

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y python3.10 python3.10-venv postgresql redis-server git

# macOS
brew install python@3.10 postgresql redis git

# Windows (via Chocolatey)
choco install python postgresql redis git
```

### Network Requirements

- **Port 5432:** PostgreSQL (internal only)
- **Port 6379:** Redis (internal only)
- **Port 8000:** FastAPI Backend (production: 443 HTTPS)
- **Port 3000:** Optional: Frontend dev server

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
├──────────────────────────┬──────────────────────────────────┤
│   Web Browser            │   Mobile Apps (iOS/Android)      │
│   (React/Vue/etc)        │   (React Native)                 │
└──────────────────────────┴──────────────────────────────────┘
                           │
                    HTTPS/WebSocket
                           │
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (uvicorn)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication • API Routes • WebSocket Handler    │  │
│  │  Compliance Engine • Analytics • Exports            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                          │
          │                          │
    ┌─────▼──────┐          ┌───────▼────────┐
    │ PostgreSQL │          │  Redis         │
    │ Database   │          │  Pub/Sub &     │
    │            │          │  Caching       │
    └────────────┘          └────────────────┘
```

---

## Backend Deployment

### 1. Clone Repository

```bash
git clone https://github.com/your-org/hpms.git
cd hpms
```

### 2. Create Virtual Environment

```bash
# Create venv
python3.10 -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
.\venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 4. Configure Environment

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hpms_prod
SQLALCHEMY_ECHO=false

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=true

# FastAPI
DEBUG=false
HOST=0.0.0.0
PORT=8000
WORKERS=4

# Security
SECRET_KEY=your-secret-key-here-use-python-secrets
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=["https://yourdomain.com"]

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/hpms/backend.log

# Email (optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# PDF Security
PDF_WATERMARK_ENABLED=true
PDF_WATERMARK_TEXT=CONFIDENTIAL
PDF_ENCRYPTION_ENABLED=true

# i18n
ENABLE_TENANT_TRANSLATIONS=true
I18N_CALENDAR_SYSTEM=bs
```

### 5. Initialize Database

```bash
# Create database
createdb hpms_prod

# Run migrations
alembic upgrade head

# Seed data (optional)
python -m backend.scripts.seed_data
```

### 6. Run Backend Server

**Development:**
```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production (with Gunicorn):**
```bash
pip install gunicorn
gunicorn backend.app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

### 7. Health Check

```bash
# Check backend health
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy", "timestamp": "2026-09-23T..."}
```

---

## Database Setup

### PostgreSQL Installation & Configuration

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Connect as postgres user
sudo -u postgres psql
```

**macOS:**
```bash
brew install postgresql@14

# Start service
brew services start postgresql@14

# Connect
psql postgres
```

### Database Creation

```sql
-- Create database
CREATE DATABASE hpms_prod;

-- Create user
CREATE USER hpms_user WITH PASSWORD 'strong_password_here';

-- Grant privileges
ALTER ROLE hpms_user SET client_encoding TO 'utf8';
ALTER ROLE hpms_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE hpms_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE hpms_prod TO hpms_user;

-- Connect to database
\c hpms_prod

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO hpms_user;
```

### Backup Strategy

**Daily Backup:**
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/hpms"
DB_NAME="hpms_prod"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Full backup
pg_dump $DB_NAME | gzip > $BACKUP_DIR/hpms_$DATE.sql.gz

# Keep last 7 days
find $BACKUP_DIR -name "hpms_*.sql.gz" -mtime +7 -delete
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## Redis Configuration

### Installation & Setup

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server

# Start and enable
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS:**
```bash
brew install redis

# Start
brew services start redis
```

### Configuration

Edit `/etc/redis/redis.conf` (Linux) or `/usr/local/etc/redis.conf` (macOS):

```conf
# Network
bind 127.0.0.1
port 6379

# Persistence
save 900 1
save 300 10
save 60 10000

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile "/var/log/redis/redis-server.log"

# Replication (for HA)
# slaveof master-ip master-port
```

### Verify Installation

```bash
redis-cli ping
# Expected: PONG

redis-cli info
# Expected: Server info output
```

---

## Environment Configuration

### Development (.env.development)

```env
DEBUG=true
DATABASE_URL=postgresql://hpms_user:password@localhost:5432/hpms_dev
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=dev-secret-key
LOG_LEVEL=DEBUG
CORS_ORIGINS=["http://localhost:3000", "http://localhost:3001"]
```

### Staging (.env.staging)

```env
DEBUG=false
DATABASE_URL=postgresql://hpms_user:password@staging-db:5432/hpms_staging
REDIS_URL=redis://staging-redis:6379/0
SECRET_KEY=staging-secret-key
LOG_LEVEL=INFO
CORS_ORIGINS=["https://staging.yourdomain.com"]
```

### Production (.env.production)

```env
DEBUG=false
DATABASE_URL=postgresql://hpms_user:complex_password@prod-db.internal:5432/hpms_prod
REDIS_URL=redis://prod-redis.internal:6379/0
SECRET_KEY=production-secret-key
LOG_LEVEL=WARNING
CORS_ORIGINS=["https://yourdomain.com", "https://www.yourdomain.com"]
ENVIRONMENT=production
```

### Generate Secure Secret Key

```python
import secrets
secret_key = secrets.token_urlsafe(32)
print(secret_key)
```

---

## Mobile App Deployment

### iOS Deployment

**Prerequisites:**
- Apple Developer Account ($99/year)
- Xcode 13+
- Provisioning profiles and certificates

**Build & Deploy:**

```bash
cd mobile

# Install dependencies
npm install

# Build for iOS
npm run build:ios

# Open Xcode
open ios/HPMS.xcworkspace

# In Xcode:
# 1. Select "Product" > "Scheme" > "HPMS"
# 2. Select "Product" > "Destination" > "Generic iOS Device"
# 3. Select "Product" > "Archive"
# 4. Click "Distribute App" > "App Store"
# 5. Follow prompts for signing and upload
```

**TestFlight (Beta):**

```bash
# After archiving in Xcode
# 1. In Xcode: "Distribute App"
# 2. Select "TestFlight"
# 3. Add testers in App Store Connect
# 4. Testers receive invite link via email
```

### Android Deployment

**Prerequisites:**
- Google Play Developer Account ($25 one-time)
- Android Studio
- Keystore file (signing key)

**Build & Deploy:**

```bash
cd mobile

# Install dependencies
npm install

# Build release APK
npm run build:android:release

# Build for Google Play (AAB)
cd android
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
```

**Upload to Play Store:**

1. Open [Google Play Console](https://play.google.com/console)
2. Create new app
3. Upload AAB (app-release.aab)
4. Set up app info (screenshots, description, privacy policy)
5. Set pricing and distribution
6. Submit for review

**Internal Testing Track:**

```bash
# Upload to internal testing first
# In Play Console:
# 1. Select app > Testing > Internal testing
# 2. Upload AAB
# 3. Add testers via email
# 4. Testers get link to install
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run app
CMD ["gunicorn", "backend.app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: hpms_prod
      POSTGRES_USER: hpms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hpms_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://hpms_user:${DB_PASSWORD}@db:5432/hpms_prod
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: ${DEBUG:-false}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app/backend
    command: >
      sh -c "alembic upgrade head &&
             gunicorn backend.app.main:app
             --workers 4
             --worker-class uvicorn.workers.UvicornWorker
             --bind 0.0.0.0:8000"

volumes:
  postgres_data:
  redis_data:
```

**Deploy:**

```bash
# Set environment
export DB_PASSWORD=strong_password
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")

# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend alembic upgrade head

# Health check
curl http://localhost:8000/health
```

---

## Monitoring & Logging

### Application Logging

**Configure in `backend/app/config.py`:**

```python
import logging
from logging.handlers import RotatingFileHandler

# Create logger
logger = logging.getLogger("hpms")
logger.setLevel(logging.INFO)

# File handler (rotating)
fh = RotatingFileHandler(
    "/var/log/hpms/backend.log",
    maxBytes=10*1024*1024,  # 10MB
    backupCount=10
)
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
fh.setFormatter(formatter)
logger.addHandler(fh)
```

### Health Monitoring

**Health Check Endpoint:**

```bash
# Check every 30 seconds
while true; do
  curl -s http://localhost:8000/health | jq .
  sleep 30
done
```

### Performance Monitoring

**Prometheus Integration (Optional):**

```bash
pip install prometheus-client
```

```python
# backend/app/metrics.py
from prometheus_client import Counter, Histogram, start_http_server
import time

REQUEST_COUNT = Counter(
    'hpms_requests_total',
    'Total requests',
    ['method', 'endpoint', 'status']
)

REQUEST_TIME = Histogram(
    'hpms_request_duration_seconds',
    'Request duration',
    ['method', 'endpoint']
)

# Start metrics server
start_http_server(8001)
```

### Log Aggregation (ELK Stack)

**Docker Compose addition:**

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
  environment:
    - discovery.type=single-node
  ports:
    - "9200:9200"

kibana:
  image: docker.elastic.co/kibana/kibana:7.17.0
  ports:
    - "5601:5601"

logstash:
  image: docker.elastic.co/logstash/logstash:7.17.0
  volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

---

## Security Hardening

### 1. HTTPS/SSL Certificates

**Using Let's Encrypt with Certbot:**

```bash
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### 2. Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/hpms
upstream backend {
    server localhost:8000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable and start:
```bash
sudo ln -s /etc/nginx/sites-available/hpms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 3. Database Security

```sql
-- Restrict user permissions
ALTER USER hpms_user WITH PASSWORD 'very_strong_password_32_chars!';

-- Create read-only role for backups
CREATE ROLE hpms_readonly;
GRANT CONNECT ON DATABASE hpms_prod TO hpms_readonly;
GRANT USAGE ON SCHEMA public TO hpms_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO hpms_readonly;
```

### 4. Redis Security

```conf
# /etc/redis/redis.conf
requirepass your_redis_password_here

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 5. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # PostgreSQL (internal only)
sudo ufw deny 6379/tcp   # Redis (internal only)
```

---

## Troubleshooting

### Backend Connection Issues

```bash
# Check if backend is running
curl http://localhost:8000/health

# View logs
tail -f /var/log/hpms/backend.log

# Check port binding
lsof -i :8000

# Restart backend
systemctl restart hpms-backend
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U hpms_user -d hpms_prod -c "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql.log
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check Redis status
sudo systemctl status redis-server

# View Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Clear Redis cache (careful!)
redis-cli FLUSHALL
```

### Memory Issues

```bash
# Check system memory
free -h

# Check process memory
ps aux | grep gunicorn

# Increase swap if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### High Disk Usage

```bash
# Find large files
du -sh /* | sort -rh

# Check log size
du -sh /var/log/hpms/*

# Rotate logs
logrotate -f /etc/logrotate.d/hpms
```

---

## Deployment Checklist

- [ ] Prerequisites installed and verified
- [ ] PostgreSQL database created and configured
- [ ] Redis server installed and running
- [ ] Environment variables configured
- [ ] Database migrations run successfully
- [ ] Backend server starts without errors
- [ ] Health check endpoint responds
- [ ] HTTPS/SSL certificates installed
- [ ] Nginx reverse proxy configured
- [ ] Firewall rules applied
- [ ] Database backups configured
- [ ] Monitoring/logging setup complete
- [ ] Mobile apps built for iOS and Android
- [ ] API endpoints documented
- [ ] Load testing completed
- [ ] Security audit passed

---

## Performance Tuning

### Backend
```ini
# gunicorn config
workers = (2 * cpu_count) + 1
worker_connections = 1000
worker_class = uvicorn.workers.UvicornWorker
```

### Database
```sql
-- Connection pooling
-- Use pgBouncer for production
-- Max connections: (cores * 2) + 1
```

### Redis
```conf
# Memory optimization
maxmemory-policy allkeys-lru
# TCP settings
tcp-backlog 511
tcp-keepalive 300
```

---

## Support & Maintenance

**Regular Tasks:**
- Database backups (daily)
- Log rotation (weekly)
- Security updates (monthly)
- Performance review (weekly)
- Capacity planning (quarterly)

**Contact:**
- Issues: support@yourdomain.com
- Documentation: docs.yourdomain.com
- Status Page: status.yourdomain.com

---

**HPMS Deployment Guide - Version 1.0**  
**Last Updated:** 2026-09-23  
**Status:** Production Ready ✅
