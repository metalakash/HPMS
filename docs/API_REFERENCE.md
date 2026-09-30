# HPMS Cross-Feature Integration API Reference

**Version:** 1.0  
**Last Updated:** 2026-09-30  
**Status:** Production

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.hpms.hydropower.dev` |
| Staging | `https://api-staging.hpms.hydropower.dev` |
| Local Dev | `http://localhost:8000/api` |

---

## Authentication

### Bearer Token
All endpoints require authorization with a Bearer token in the `Authorization` header:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Management
- **Lifespan:** 1 hour
- **Refresh Token:** 7 days
- **Renewal:** POST `/auth/refresh` with refresh token
- **Revocation:** DELETE `/auth/token` revokes current token

### Example Request
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.hpms.hydropower.dev/links
```

---

## Rate Limiting

| Tier | Requests/Min | Requests/Day |
|------|--------------|--------------|
| Free | 100 | 10,000 |
| Pro | 1,000 | 100,000 |
| Enterprise | Unlimited | Unlimited |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1696029600
```

**On Rate Limit (429):**
- Retry-After: 60 (seconds)
- Implement exponential backoff
- Batch requests when possible

---

## Response Format

### Success Response (200-201)
```json
{
  "data": {
    "id": "link-123",
    "from_id": "insp-45",
    "to_id": "wo-78",
    "strength": "strong",
    "created_at": "2026-09-30T12:00:00Z"
  },
  "status": "success",
  "timestamp": "2026-09-30T12:00:05Z"
}
```

### Error Response (4xx-5xx)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Link validation failed",
  "details": {
    "from_id": ["From record not found"],
    "to_id": ["Circular dependency detected"]
  },
  "status": "error",
  "timestamp": "2026-09-30T12:00:05Z"
}
```

### Error Codes
| Code | Status | Meaning |
|------|--------|---------|
| 400 | Bad Request | Invalid parameters or validation failure |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Circular dependency or duplicate |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |
| 503 | Unavailable | Service temporarily unavailable |

---

## Cross-Feature Links API

### Create Link
**POST** `/links`

Create a new cross-feature link between two records.

**Request:**
```json
{
  "from_id": "insp-45",
  "to_id": "wo-78",
  "from_feature": "inspections",
  "to_feature": "workorders",
  "strength": "strong"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "link-123",
    "from_id": "insp-45",
    "to_id": "wo-78",
    "from_feature": "inspections",
    "to_feature": "workorders",
    "strength": "strong",
    "created_by": "user-123",
    "created_at": "2026-09-30T12:00:00Z"
  }
}
```

**cURL:**
```bash
curl -X POST https://api.hpms.hydropower.dev/links \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_id": "insp-45",
    "to_id": "wo-78",
    "from_feature": "inspections",
    "to_feature": "workorders",
    "strength": "strong"
  }'
```

**Python:**
```python
import requests

response = requests.post(
  "https://api.hpms.hydropower.dev/links",
  headers={"Authorization": f"Bearer {token}"},
  json={
    "from_id": "insp-45",
    "to_id": "wo-78",
    "from_feature": "inspections",
    "to_feature": "workorders",
    "strength": "strong"
  }
)
```

### Get Links
**GET** `/links/{record_id}?feature={feature}`

Fetch all links for a specific record.

**Parameters:**
- `record_id` (path, required): Record identifier
- `feature` (query, required): Feature type (inspections, workorders, compliance, etc.)

**Response (200):**
```json
{
  "data": {
    "links": [
      {
        "id": "link-123",
        "from_id": "insp-45",
        "to_id": "wo-78",
        "strength": "strong",
        "from_feature": "inspections",
        "to_feature": "workorders"
      }
    ],
    "count": 1
  }
}
```

**cURL:**
```bash
curl "https://api.hpms.hydropower.dev/links/insp-45?feature=inspections" \
  -H "Authorization: Bearer TOKEN"
```

### Delete Link
**DELETE** `/links/{link_id}`

Remove a cross-feature link.

**Response (200):**
```json
{
  "data": {"success": true}
}
```

### Update Link Strength
**PUT** `/links/{link_id}/strength?strength={strength}`

Modify link strength (weak, medium, strong).

**Response (200):**
```json
{
  "data": {
    "id": "link-123",
    "strength": "medium",
    "updated_at": "2026-09-30T12:05:00Z"
  }
}
```

### Get Feature Map
**GET** `/map`

Fetch feature network for visualization.

**Response (200):**
```json
{
  "data": {
    "nodes": [
      {
        "id": "inspections",
        "name": "Inspections",
        "linkedCount": 78
      }
    ],
    "edges": [
      {
        "id": "link-1",
        "from": "inspections",
        "to": "workorders",
        "count": 78,
        "strength": "strong"
      }
    ],
    "stats": {
      "total_links": 212,
      "features_connected": 5,
      "avg_links_per_feature": 42.4
    }
  }
}
```

### Get Dependencies
**GET** `/dependencies?status={status}&blocked_by_count_gt={count}`

List dependencies with optional filtering.

**Parameters:**
- `status` (query, optional): Filter by status
- `blocked_by_count_gt` (query, optional): Blocked by count threshold

**Response (200):**
```json
{
  "data": {
    "dependencies": [
      {
        "from_id": "insp-45",
        "to_id": "wo-78",
        "status": "on-track"
      }
    ]
  }
}
```

### Get Critical Path
**GET** `/critical-path`

Get longest dependency chain.

**Response (200):**
```json
{
  "data": {
    "critical_path": ["insp-1", "wo-1", "comp-1"],
    "length": 3,
    "estimated_duration_days": 5
  }
}
```

### Get Blocking Issues
**GET** `/blocking-issues`

Find items blocking others.

**Response (200):**
```json
{
  "data": {
    "blocking_issues": [
      {
        "item_id": "wo-78",
        "item_name": "Work Order #78",
        "blocking_count": 1,
        "blocked_by_count": 1,
        "days_blocked": 3
      }
    ]
  }
}
```

### Get Dependency Health
**GET** `/health`

Get overall dependency health score.

**Response (200):**
```json
{
  "data": {
    "overall": 72,
    "on_time": 85,
    "blocked": 8,
    "overdue": 7,
    "strong_links": 45,
    "medium_links": 89,
    "weak_links": 78,
    "total_links": 212
  }
}
```

### Validate Link
**POST** `/validate-link?from_id={id}&to_id={id}`

Check if link would create circular dependency.

**Response (200):**
```json
{
  "data": {
    "valid": true,
    "error": null
  }
}
```

---

## Workflows API

### Create Workflow
**POST** `/workflows`

Design new workflow.

**Request:**
```json
{
  "name": "Standard Defect Workflow",
  "steps": [
    {
      "order": 1,
      "action": "create_inspection",
      "feature": "inspections",
      "condition": "Severity >= Medium"
    }
  ]
}
```

**Response (201):**
```json
{
  "data": {
    "id": "wf-123",
    "name": "Standard Defect Workflow",
    "is_published": false,
    "created_at": "2026-09-30T12:00:00Z"
  }
}
```

### Get Workflow
**GET** `/workflows/{workflow_id}`

Fetch workflow details.

**Response (200):**
```json
{
  "data": {
    "id": "wf-123",
    "name": "Standard Defect Workflow",
    "steps": [
      {
        "id": "step-1",
        "order": 1,
        "action": "create_inspection",
        "feature": "inspections"
      }
    ],
    "is_published": true
  }
}
```

### Update Workflow
**PUT** `/workflows/{workflow_id}`

Modify workflow.

**Request:**
```json
{
  "name": "Updated Name",
  "steps": [...]
}
```

### Publish Workflow
**POST** `/workflows/{workflow_id}/publish`

Make available to team.

**Response (200):**
```json
{
  "data": {
    "id": "wf-123",
    "is_published": true,
    "published_at": "2026-09-30T12:00:00Z"
  }
}
```

### Execute Workflow
**POST** `/workflows/{workflow_id}/execute`

Run workflow with trigger data.

**Request:**
```json
{
  "trigger_data": {
    "inspection_id": "insp-45",
    "severity": "high"
  }
}
```

**Response (200):**
```json
{
  "data": {
    "execution_id": "exec-123",
    "status": "completed",
    "completed_at": "2026-09-30T12:05:00Z"
  }
}
```

### Test Workflow
**POST** `/workflows/{workflow_id}/test`

Dry-run workflow preview.

**Response (200):**
```json
{
  "data": {
    "workflow_id": "wf-123",
    "test_mode": true,
    "steps_preview": [...],
    "estimated_duration": "2-3 seconds",
    "changes_would_be_made": 4
  }
}
```

### Get Templates
**GET** `/workflows/templates`

Standard workflow templates.

**Response (200):**
```json
{
  "data": {
    "templates": [
      {
        "name": "Standard Defect Workflow",
        "description": "Inspection → Work Order → Compliance"
      }
    ]
  }
}
```

### List User Workflows
**GET** `/workflows`

User's workflows.

**Response (200):**
```json
{
  "data": {
    "workflows": [...],
    "count": 5
  }
}
```

---

## Pagination

Use `limit` and `offset` parameters for pagination:

```bash
GET /links?limit=20&offset=0
```

**Response:**
```json
{
  "data": {
    "items": [...],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 156,
      "has_next": true
    }
  }
}
```

---

## Webhooks

Subscribe to events via webhook:

**POST** `/webhooks`

**Supported Events:**
- `link.created` — Cross-feature link created
- `link.deleted` — Link removed
- `workflow.executed` — Workflow completed
- `dependency.blocked` — Item blocking detected

**Webhook Payload:**
```json
{
  "event": "link.created",
  "timestamp": "2026-09-30T12:00:00Z",
  "data": {
    "id": "link-123",
    "from_id": "insp-45",
    "to_id": "wo-78"
  }
}
```

---

## Best Practices

### Batch Operations
For multiple links, use batch endpoint:

```bash
POST /links/batch
{
  "links": [...]
}
```

### Caching
- Cache feature map for 5 minutes
- Cache health scores for 1 hour
- Invalidate on link changes

### Error Handling
```python
try:
  response = requests.post(url, headers=headers, json=data)
  response.raise_for_status()
except requests.exceptions.HTTPError as e:
  # Handle specific error codes
  if e.response.status_code == 409:
    # Circular dependency
    pass
```

### Retry Strategy
- Use exponential backoff
- Max 3 retries for 5xx errors
- Don't retry on 4xx (except 429)

---

## Versioning

- **Current:** v1
- **Deprecated:** v0 (sunset 2026-12-31)
- **Beta:** v2 (available at `/v2/`)

---

## Support

- **Email:** support@hpms.dev
- **Slack:** #engineering
- **Docs:** https://docs.hpms.dev
- **Status:** https://status.hpms.dev
