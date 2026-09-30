# Operations Runbook

**Team:** DevOps & Engineering  
**Audience:** On-Call Engineers, SREs  
**Last Updated:** 2026-09-30  
**Status:** Production

---

## Table of Contents
1. [Incident Response](#incident-response)
2. [Monitoring Checklist](#monitoring-checklist)
3. [Common Incidents](#common-incidents)
4. [Escalation Path](#escalation-path)
5. [Contact Information](#contact-information)

---

## Incident Response

### Critical Severity (Page On-Call)

**Definition:** Service completely unavailable to users

**Response Time:** < 5 minutes

**Step 1: Acknowledge & Assess**
```
[ ] Check status page: status.hpms.dev
[ ] Check Sentry: errors.hpms.dev
[ ] Check Render dashboard: render.com
[ ] Check Google Cloud status
[ ] Notify team on Slack: #incidents
```

**Step 2: Identify Issue**
```bash
# Check backend health
curl https://api.hpms.hydropower.dev/health

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis
redis-cli -u $REDIS_URL ping

# Review recent deployments
git log --oneline -10

# Check logs
# Render Dashboard → Logs tab
```

**Step 3: Mitigation**
```bash
# Restart API service
# Render Dashboard → Web Service → Settings → Restart

# Restart database
# Render Dashboard → Database → Maintenance → Restart

# Roll back if recent deployment
git revert <commit_hash>
git push origin main
```

**Step 4: Resolution & Post-Incident**
```
[ ] Service restored
[ ] Root cause identified
[ ] Fix deployed and verified
[ ] Post-mortem scheduled within 24h
[ ] Slack notification sent
```

---

### High Severity (Alert)

**Definition:** Service degraded, most users impacted

**Response Time:** < 15 minutes

**Examples:**
- Response time > 5 seconds
- Error rate > 5%
- Database disk > 90%
- Memory usage > 85%

**Response:**
1. Acknowledge alert
2. Check metrics dashboard
3. Scale up resources if needed
4. Investigate root cause
5. Implement fix
6. Monitor metrics
7. Document in incident log

---

### Medium Severity (Alert)

**Definition:** Minor feature broken, small user impact

**Response Time:** < 1 hour

**Examples:**
- Single endpoint failing
- Feature flag misconfigured
- Cache invalidation issue
- Analytics not working

**Response:**
1. Create GitHub issue
2. Investigate during business hours
3. Deploy fix in next release
4. Update status page
5. Notify affected users

---

### Low Severity (Log)

**Definition:** Non-user-facing issues

**Response Time:** < 24 hours

**Examples:**
- Deprecated API warnings
- Slow non-critical queries
- Test failures
- Documentation issues

**Response:**
1. Log in system
2. Plan fix for next release
3. Track in backlog

---

## Monitoring Checklist

### Every 5 Minutes (Automated)

```markdown
## Health Checks
- [ ] Backend /health endpoint responds 2xx
- [ ] Database reachable
- [ ] Redis cache available
- [ ] All critical endpoints < 1s response

## Auto-Remediation
- [ ] Failed health check → Restart service
- [ ] High error rate → Scale up
- [ ] Database connection pool exhausted → Alert
- [ ] Disk space > 90% → Alert
```

### Every Hour (Automated)

```markdown
## Performance Metrics
- [ ] Average response time < 500ms
- [ ] 95th percentile < 2s
- [ ] Error rate < 1%
- [ ] Throughput stable

## Resource Metrics
- [ ] Memory usage < 70%
- [ ] CPU usage < 60%
- [ ] Database connections < 80
- [ ] Disk space < 80%
```

### Daily (Manual/Automated)

```markdown
## System Health
- [ ] All critical endpoints working
- [ ] Database query performance
- [ ] Cache hit rate > 80%
- [ ] No authentication errors

## Data Integrity
- [ ] Backup completed
- [ ] Backup verifiable
- [ ] Replication lag < 1s
- [ ] No data corruption

## Security
- [ ] Failed login attempts < 100
- [ ] No suspicious API patterns
- [ ] SSL certificate valid (>30 days)
- [ ] No security warnings
```

### Weekly (Manual)

```markdown
## Infrastructure Review
- [ ] Compute usage stable
- [ ] Storage usage trends
- [ ] Network bandwidth patterns
- [ ] Cost within budget

## Dependency Review
- [ ] Security patches available
- [ ] Library updates needed
- [ ] Breaking changes identified
- [ ] Upgrade path planned

## Team Review
- [ ] Incident summary
- [ ] Lessons learned
- [ ] Preventive measures
- [ ] Documentation updated
```

### Monthly (Manual)

```markdown
## Capacity Planning
- [ ] Growth trends analyzed
- [ ] Forecast next 3 months
- [ ] Identify bottlenecks
- [ ] Plan upgrades

## Disaster Recovery
- [ ] Database restore test
- [ ] Failover verification
- [ ] Recovery time measured
- [ ] Documentation current

## Security Audit
- [ ] Vulnerability scan
- [ ] Penetration testing
- [ ] Access logs reviewed
- [ ] Compliance verified
```

---

## Common Incidents

### Database Down

**Symptoms:**
- API returns 500 errors
- "Connection refused" errors
- Slow queries hang
- Deployment migrations stuck

**Diagnosis:**
```bash
# Check if database running
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
SELECT count(*) FROM pg_stat_activity;

# Check disk space
df -h /var/lib/postgresql

# Check logs
# Render Dashboard → Database → Logs
```

**Resolution:**
```bash
# Option 1: Restart database
# Render Dashboard → Database → Settings → Restart
# (causes ~30s downtime)

# Option 2: Kill stale connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'hpms' AND pid != pg_backend_pid();

# Option 3: Scale up resources
# Render Dashboard → Database → Settings → Upgrade Plan
```

**Prevention:**
- Monitor connection pool
- Set connection timeout
- Implement circuit breaker
- Add read replica

---

### API Service Down

**Symptoms:**
- Status page shows red
- All endpoints return 502/503
- Service unavailable
- Restart attempts fail

**Diagnosis:**
```bash
# Check service status
curl https://api.hpms.hydropower.dev/health

# Check Render logs
# Render Dashboard → Web Service → Logs

# Check recent deployments
git log --oneline -20

# Check resource usage
# Render Dashboard → Web Service → Metrics
```

**Resolution:**
```bash
# Immediate: Restart service
# Render Dashboard → Web Service → Settings → Restart

# If restart fails: Check logs for errors
# Look for:
# - Memory exhaustion
# - Port conflict
# - Missing environment variables
# - Dependency failure

# If still failing: Rollback
git revert <commit_hash>
git push origin main
```

**Prevention:**
- Staging deployment before prod
- Gradual rollout strategy
- Health check endpoints
- Automated alerts

---

### High Error Rate (> 5%)

**Symptoms:**
- Sentry error dashboard red
- User reports failures
- Incomplete operations
- Data inconsistency

**Diagnosis:**
```bash
# Get error breakdown
curl https://api.hpms.hydropower.dev/metrics | grep error_total

# Check error logs
# Sentry → Issues → Top errors

# Check affected endpoints
# Analytics → Errors by endpoint

# Check recent changes
git log --oneline -10
git diff <commit1>..<commit2>
```

**Resolution:**
```bash
# Identify root cause from errors:
# - Null pointer → Code bug
# - Database error → Connection issue
# - Timeout → Performance issue
# - Auth error → Credential issue

# Implement fix:
# - Code bug → Deploy fix
# - Connection issue → Restart service
# - Performance issue → Scale up
# - Credential issue → Update env vars
```

**Prevention:**
- Unit tests for critical paths
- Integration tests
- Staging environment
- Gradual rollout

---

### Slow Queries (Response > 2s)

**Symptoms:**
- User-facing timeouts
- High p95 latency
- Database CPU spike
- Resource exhaustion

**Diagnosis:**
```bash
# Check slow query log
SELECT query, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

# Check query plan
EXPLAIN ANALYZE SELECT * FROM ...

# Check missing indexes
SELECT schemaname, tablename, indexname FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

**Resolution:**
```bash
# Option 1: Add index
CREATE INDEX idx_name ON table(column);

# Option 2: Optimize query
# Rewrite query
# Use connection pooling
# Add caching

# Option 3: Scale up database
# Render → Database → Upgrade plan
```

**Prevention:**
- Monitor query performance
- Regular index analysis
- Query optimization reviews
- Performance testing

---

### High Memory Usage (> 85%)

**Symptoms:**
- Out of memory errors
- Service crashes
- Slow performance
- Deployments hang

**Diagnosis:**
```bash
# Check memory usage
free -h

# Check process memory
ps aux --sort=-%mem | head -10

# Check container limits
# Render Dashboard → Web Service → Instance

# Check memory leaks
# Node: node --inspect
# Python: tracemalloc
```

**Resolution:**
```bash
# Immediate: Restart service
# Render Dashboard → Web Service → Settings → Restart

# Identify memory leak:
# - Check recent code changes
# - Profile memory usage
# - Review dependency versions

# Fix memory leak:
# - Fix code bug
# - Update library
# - Reduce cache size

# Scale up if needed:
# - Render Dashboard → Web Service → Instance Type
```

**Prevention:**
- Memory profiling in CI
- Resource limits enforced
- Cache eviction policies
- Regular restarts

---

## Escalation Path

### On-Call Rotation

**Level 1: On-Call Engineer (First Response)**
- Monitor alerts (5 min response)
- Assess severity
- Attempt immediate fixes
- Escalate if needed

**Contact:** Check Slack #oncall  
**Pages:** PagerDuty  
**Response Time:** < 5 minutes

---

### Level 2: Engineering Lead (Investigation)

**Triggered When:**
- Issue not resolved in 15 minutes
- L1 unsure of root cause
- Requires code changes
- Multi-system issue

**Responsibilities:**
- Investigate root cause
- Coordinate fix development
- Code review changes
- Deploy if needed

**Contact:** Slack @engineering-lead  
**Pages:** PagerDuty escalation  
**Response Time:** < 15 minutes

---

### Level 3: Director (Coordination)

**Triggered When:**
- Issue not resolved in 30 minutes
- Critical data impact
- Customer communication needed
- Post-incident coordination

**Responsibilities:**
- Stakeholder coordination
- Customer communication
- Executive updates
- Post-incident review

**Contact:** Slack @director  
**Pages:** PagerDuty critical  
**Response Time:** < 30 minutes

---

### Escalation Example

```
12:00 - Alert fires (Database down)
12:01 - L1 (On-call) acknowledges, checks logs
12:05 - Cannot restart database
12:05 - Escalate to L2 (Engineering Lead)
12:07 - L2 investigates, identifies disk full
12:08 - L2 contacts cloud provider
12:15 - Disk space freed, database restarts
12:16 - Service recovered
12:30 - L1 creates incident report
13:00 - L2 & L3 discuss lessons learned
```

---

## Contact Information

### Team Contacts

| Role | Name | Slack | Phone | Email |
|------|------|-------|-------|-------|
| On-Call Lead | @oncall | - | [on-call] | oncall@hpms.dev |
| Engineering Lead | @eng-lead | Slack | 555-0123 | eng-lead@hpms.dev |
| Director | @director | Slack | 555-0124 | director@hpms.dev |
| DevOps | @devops | Slack | 555-0125 | devops@hpms.dev |

### External Contacts

| Service | Contact | Response Time |
|---------|---------|----------------|
| Render Support | support@render.com | < 1 hour |
| Google Cloud Support | support.google.com | < 4 hours |
| Datadog | support@datadoghq.com | < 1 hour |
| Sentry | support@sentry.io | < 2 hours |

### Escalation Channels

- **Slack:** #incidents (real-time)
- **Email:** incidents@hpms.dev
- **PagerDuty:** oncall dashboard
- **Status Page:** status.hpms.dev (customer-facing)

---

## Post-Incident Process

### Immediately (< 1 hour)

1. **Incident Report Created**
   - Title: Brief description
   - Start time, end time, duration
   - Severity level
   - Impact (users affected, data)
   - Root cause (preliminary)

2. **Status Page Updated**
   - Incident marked as resolved
   - Brief explanation
   - Next steps

3. **Team Notified**
   - Slack #incidents message
   - Email to stakeholders
   - Customer updates if needed

### Within 24 Hours

1. **Post-Mortem Meeting**
   - Participants: L1, L2, L3, affected teams
   - Review timeline
   - Root cause analysis
   - Preventive measures
   - Action items assigned

2. **Documentation Updated**
   - Runbook improved
   - Monitoring alerts enhanced
   - Procedures updated
   - Incident logged

### Within 1 Week

1. **Action Items Completed**
   - Code fixes deployed
   - Tests added
   - Documentation updated
   - Monitoring rules added

2. **Post-Mortem Published**
   - Shared with team
   - Customer communication if needed
   - Lessons documented
   - Archive for future reference

---

## Dashboard Access

- **Metrics:** https://app.datadoghq.com
- **Logs:** Render Dashboard → Logs
- **Errors:** https://sentry.io
- **API Status:** https://status.hpms.dev
- **Uptime:** https://pingdom.com

---

## Additional Resources

- **Incident Playbooks:** /docs/playbooks
- **Architecture Diagrams:** /docs/architecture
- **Runbook History:** /docs/incidents
- **Team Docs:** https://wiki.hpms.dev
