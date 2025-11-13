# Warp Dashboard API - Testing Guide

Complete guide for testing all Warp Dashboard API endpoints with curl examples.

## Base URL
```
http://localhost:3030
```

## Authentication
Most endpoints currently don't require authentication (development mode). Production deployment should implement JWT or session-based auth.

---

## Projects API

### List All Projects
```bash
curl -X GET "http://localhost:3030/api/projects"
```

### List Projects with Filters
```bash
# Search by name
curl -X GET "http://localhost:3030/api/projects?search=my-app"

# Filter by status
curl -X GET "http://localhost:3030/api/projects?status=active"

# Sort by name
curl -X GET "http://localhost:3030/api/projects?sort=name"
```

### Get Single Project
```bash
curl -X GET "http://localhost:3030/api/projects/{project-id}"
```

### Create New Project
```bash
curl -X POST "http://localhost:3030/api/projects/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-project",
    "template": "nextjs"
  }'
```

### Update Project
```bash
curl -X PUT "http://localhost:3030/api/projects/{project-id}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "updated-name",
    "status": "active"
  }'
```

### Delete Project
```bash
curl -X DELETE "http://localhost:3030/api/projects/{project-id}"
```

---

## Agents API

### List Agents and Skills
```bash
# Global agents
curl -X GET "http://localhost:3030/api/agents/list"

# Per-project agents
curl -X GET "http://localhost:3030/api/agents/list?projectPath=/path/to/project"
```

### Save Agents Configuration
```bash
curl -X POST "http://localhost:3030/api/agents/save" \
  -H "Content-Type: application/json" \
  -d '{
    "agents": [
      {
        "name": "test-agent",
        "role": "executor",
        "model": "claude-3",
        "skills": ["read-file", "write-file"]
      }
    ],
    "skills": [
      {
        "name": "read-file",
        "description": "Read file contents"
      }
    ],
    "reason": "Testing agent creation"
  }'
```

### Test Agent
```bash
curl -X POST "http://localhost:3030/api/agents/test" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "test-agent",
    "prompt": "Hello world",
    "input": {
      "test": "data"
    }
  }'
```

### Get Agent Status
```bash
curl -X GET "http://localhost:3030/api/agents/status?window=3600"
```

---

## Approvals Workflow API

### Get Approval Queue
```bash
curl -X GET "http://localhost:3030/api/approvals/queue"
```

### Create Approval Request
```bash
curl -X POST "http://localhost:3030/api/approvals/create" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deploy to Production",
    "description": "Request approval to deploy version 1.0.0 to production environment",
    "type": "deployment",
    "requester": "John Doe",
    "metadata": {
      "version": "1.0.0",
      "environment": "production"
    }
  }'
```

### Approve Request
```bash
curl -X POST "http://localhost:3030/api/approvals/{approval-id}/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Looks good, approved for deployment"
  }'
```

### Reject Request
```bash
curl -X POST "http://localhost:3030/api/approvals/{approval-id}/reject" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Missing required documentation"
  }'
```

### Get Audit Log
```bash
curl -X GET "http://localhost:3030/api/approvals/audit"
```

### Export Audit Log
```bash
curl -X GET "http://localhost:3030/api/approvals/audit/export" \
  -o audit-log.json
```

### Get User Role
```bash
curl -X GET "http://localhost:3030/api/approvals/role"
```

---

## Analytics API

### Get KPI Metrics
```bash
# Last 24 hours
curl -X GET "http://localhost:3030/api/analytics/kpi"

# Last 7 days
curl -X GET "http://localhost:3030/api/analytics/kpi?window=7d"

# Per-project analytics
curl -X GET "http://localhost:3030/api/analytics/kpi?projectId={project-id}"
```

### Get Agent Metrics
```bash
curl -X GET "http://localhost:3030/api/analytics/agents"
```

---

## Marketplace API

### List Marketplace Items
```bash
# All items
curl -X GET "http://localhost:3030/api/marketplace/items"

# Search
curl -X GET "http://localhost:3030/api/marketplace/items?search=deploy"

# Filter by type
curl -X GET "http://localhost:3030/api/marketplace/items?type=agent"

# Filter by tag
curl -X GET "http://localhost:3030/api/marketplace/items?tag=automation"
```

### Install Item
```bash
# Global install
curl -X POST "http://localhost:3030/api/marketplace/install" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "item-id"
  }'

# Install and attach to project
curl -X POST "http://localhost:3030/api/marketplace/install" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "item-id",
    "projectId": "project-id"
  }'
```

### Uninstall Item
```bash
curl -X POST "http://localhost:3030/api/marketplace/uninstall" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "item-id"
  }'
```

### Get Installed Items
```bash
curl -X GET "http://localhost:3030/api/marketplace/installed"
```

---

## Server-Sent Events (SSE)

### Listen to Approval Updates
```bash
curl -N "http://localhost:3030/api/approvals/stream"
```

### Listen to Analytics Updates
```bash
curl -N "http://localhost:3030/api/analytics/stream"
```

### Listen to System Events
```bash
curl -N "http://localhost:3030/events"
```

---

## Skills API

### List Skills
```bash
curl -X GET "http://localhost:3030/api/skills"
```

### Get Skills Usage Stats
```bash
curl -X GET "http://localhost:3030/api/skills/usage"
```

### Import Skills from URL
```bash
curl -X POST "http://localhost:3030/api/skills/import-url" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/skills.json"
  }'
```

---

## Prompts API

### List Prompt Templates
```bash
curl -X GET "http://localhost:3030/api/prompts"
```

### Save Prompt Template
```bash
curl -X POST "http://localhost:3030/api/prompts" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "custom-prompt",
    "name": "Custom Task Prompt",
    "template": "You are an expert in {{domain}}. Please {{action}}.",
    "variables": ["domain", "action"],
    "tags": ["custom"]
  }'
```

### Delete Prompt Template
```bash
curl -X DELETE "http://localhost:3030/api/prompts/{prompt-id}"
```

---

## Health & Status

### Health Check
```bash
curl -X GET "http://localhost:3030/api/projects"
# 200 OK = healthy
```

### Server Info
```bash
curl -X GET "http://localhost:3030/"
# Should return dashboard HTML
```

---

## Testing Scripts

### Bash Test Suite

Save as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3030"

echo "Testing Warp Dashboard API..."

# Test Projects
echo -e "\n[TEST] List Projects"
curl -s "$BASE_URL/api/projects" | jq .

# Test Approvals
echo -e "\n[TEST] Get Approvals Queue"
curl -s "$BASE_URL/api/approvals/queue" | jq .

# Test Analytics
echo -e "\n[TEST] Get Analytics KPIs"
curl -s "$BASE_URL/api/analytics/kpi" | jq .

# Test Agents
echo -e "\n[TEST] List Agents"
curl -s "$BASE_URL/api/agents/list" | jq .

# Test Marketplace
echo -e "\n[TEST] List Marketplace Items"
curl -s "$BASE_URL/api/marketplace/items" | jq .

echo -e "\nAll tests complete!"
```

Run:
```bash
chmod +x test-api.sh
./test-api.sh
```

### Node.js Test Script

Save as `test-api.js`:

```javascript
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3030';

async function test() {
  console.log('Testing Warp Dashboard API...\n');

  try {
    // Test Projects
    const projects = await fetch(`${BASE_URL}/api/projects`);
    console.log('[PASS] Projects API:', (await projects.json()).total);

    // Test Approvals
    const approvals = await fetch(`${BASE_URL}/api/approvals/queue`);
    console.log('[PASS] Approvals API:', (await approvals.json()).approvals.length);

    // Test Analytics
    const analytics = await fetch(`${BASE_URL}/api/analytics/kpi`);
    console.log('[PASS] Analytics API:', await analytics.json());

    // Test Agents
    const agents = await fetch(`${BASE_URL}/api/agents/list`);
    console.log('[PASS] Agents API:', (await agents.json()).agents.length);

    console.log('\nAll tests passed!');
  } catch (error) {
    console.error('[FAIL] Test error:', error);
    process.exit(1);
  }
}

test();
```

Run:
```bash
node test-api.js
```

---

## Performance Testing

### Load Test with Apache Bench
```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:3030/api/projects
```

### Stress Test with Artillery
```yaml
# artillery.yml
config:
  target: 'http://localhost:3030'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
    - get:
        url: "/api/projects"
    - get:
        url: "/api/approvals/queue"
    - get:
        url: "/api/analytics/kpi"
```

Run:
```bash
artillery run artillery.yml
```

---

## Common Response Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Debugging

### Enable Verbose Output
```bash
curl -v "http://localhost:3030/api/projects"
```

### Show Headers Only
```bash
curl -I "http://localhost:3030/api/projects"
```

### Follow Redirects
```bash
curl -L "http://localhost:3030/api/projects"
```

### Save Response to File
```bash
curl -o response.json "http://localhost:3030/api/projects"
```

---

**Last Updated**: 2025-01-13
