# Feature: Continuous Integration Testing

**Milestone:** V0.75
**Priority:** P1
**Status:** 🚧 Planning
**Created:** 2026-01-25

---

## Overview

Continuous Integration Testing provides scheduled health checks for all active connections, enabling early detection of API changes, credential issues, and integration failures. Instead of discovering problems when a consuming app tries to invoke an action, Waygate proactively tests connections and alerts users to issues before they impact production workflows.

### User Story

> As a developer, I want Waygate to automatically test my integrations on a regular schedule, so that I can detect and fix issues before they affect my applications.

> As a developer, I want to see the health history of my connections, so that I can identify patterns and proactively address reliability issues.

### Problem Statement

Currently, integration health is only checked on-demand when:

- A user manually triggers a health check from the dashboard
- A consuming app invokes an action and encounters an error
- A credential refresh fails

This reactive approach means:

- Users discover integration problems only when their applications break
- There's no visibility into the reliability of integrations over time
- Transient issues (rate limits, temporary outages) may go unnoticed and untracked
- API changes that break integrations aren't detected until production use

### Solution

Implement a scheduled health check system that:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTINUOUS INTEGRATION TESTING                        │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    SCHEDULED HEALTH CHECKS                       │   │
│   │                                                                  │   │
│   │   1. Cron job runs every 15 minutes (configurable per-tenant)   │   │
│   │   2. For each active connection:                                 │   │
│   │      a. Check credential status (valid, expiring, expired)       │   │
│   │      b. Execute a test action (e.g., GET /me, /ping, etc.)       │   │
│   │      c. Record latency and success/failure                       │   │
│   │   3. Store health check result                                   │   │
│   │   4. Update connection health status                             │   │
│   │   5. Alert on state changes (healthy → degraded → unhealthy)     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    HEALTH CHECK RESULTS                          │   │
│   │                                                                  │   │
│   │   • Historical health data for each connection                   │   │
│   │   • Uptime percentage calculation                                │   │
│   │   • Latency trends over time                                     │   │
│   │   • Failure pattern analysis                                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    ALERTING                                      │   │
│   │                                                                  │   │
│   │   • Dashboard notifications for health state changes             │   │
│   │   • Connection status badges (Healthy/Degraded/Unhealthy)        │   │
│   │   • Email alerts for persistent failures (future: V1.1)          │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Requirements

### Functional Requirements

- [ ] **FR-1**: Scheduled cron job executes health checks every 15 minutes
- [ ] **FR-2**: Health checks test each active connection's credentials and test action
- [ ] **FR-3**: Store health check results with timestamp, latency, status, and error details
- [ ] **FR-4**: Track connection health status (healthy, degraded, unhealthy)
- [ ] **FR-5**: Configurable test action per integration (defaults to first safe GET action)
- [ ] **FR-6**: Health check history viewable in dashboard (last 24 hours minimum)
- [ ] **FR-7**: Uptime percentage calculated from health check history
- [ ] **FR-8**: Connection list shows current health status badge
- [ ] **FR-9**: Manual trigger for health check from dashboard
- [ ] **FR-10**: Health checks respect rate limits and use minimal API calls

### Non-Functional Requirements

- [ ] **NFR-1**: Health check job completes within 5 minutes for 100 connections
- [ ] **NFR-2**: Health check results retained for 7 days (configurable)
- [ ] **NFR-3**: Health check overhead < 1 API call per connection per check
- [ ] **NFR-4**: No sensitive data (credentials, tokens) stored in health check results

---

## Data Model Changes

### New Entity: `HealthCheck`

```typescript
HealthCheck: {
  id: uuid,
  connectionId: uuid,               // FK → Connection
  tenantId: uuid,                   // FK → Tenant (denormalized for RLS)
  status: enum,                     // healthy, degraded, unhealthy
  checkType: enum,                  // scheduled, manual

  // Credential check results
  credentialStatus: enum,           // active, expiring, expired, missing
  credentialExpiresAt: timestamp?,  // Token expiration time (if applicable)

  // Test action results
  testActionId: uuid?,              // FK → Action (if test action executed)
  testActionSuccess: boolean?,      // Whether test action succeeded
  testActionLatencyMs: integer?,    // Test action latency
  testActionStatusCode: integer?,   // HTTP status code from test action
  testActionError: jsonb?,          // Error details if failed

  // Circuit breaker status
  circuitBreakerStatus: enum,       // closed, open, half_open

  // Overall results
  latencyMs: integer,               // Total health check duration
  error: jsonb?,                    // Overall error if check failed
  createdAt: timestamp,

  // Indexes for efficient queries
  @@index([connectionId, createdAt(sort: Desc)])
  @@index([tenantId, createdAt(sort: Desc)])
}
```

### New Enum: `HealthCheckStatus`

```typescript
enum HealthCheckStatus {
  healthy    // All checks passed
  degraded   // Some issues (e.g., expiring credentials, elevated latency)
  unhealthy  // Critical issues (e.g., expired credentials, test action failed)
}
```

### New Enum: `HealthCheckType`

```typescript
enum HealthCheckType {
  scheduled  // Triggered by cron job
  manual     // Triggered by user from dashboard
}
```

### Modified Entity: `Connection`

Add new fields to track health status:

```typescript
Connection: {
  ...existing fields...

  // Health tracking
  healthStatus: HealthCheckStatus,    // Current health status (default: healthy)
  lastHealthCheckAt: timestamp?,      // Last health check timestamp
  lastHealthCheckId: uuid?,           // FK → HealthCheck (most recent)
  healthCheckTestActionId: uuid?,     // FK → Action (configurable test action)
}
```

### Modified Entity: `Integration`

Add health configuration:

```typescript
Integration: {
  ...existing fields...

  // Health check configuration
  healthCheckConfig: jsonb,           // { enabled: boolean, intervalMinutes: number, testActionId: string? }
}
```

### Database Migration Strategy

1. Create `HealthCheckStatus` and `HealthCheckType` enums
2. Create `health_checks` table with all fields and indexes
3. Add `health_status`, `last_health_check_at`, `last_health_check_id`, `health_check_test_action_id` to `connections`
4. Add `health_check_config` to `integrations` (default: `{ enabled: true, intervalMinutes: 15 }`)
5. Set initial `health_status` to 'healthy' for existing connections

---

## API Design

### New Endpoints

| Method | Endpoint                                       | Purpose                                  |
| ------ | ---------------------------------------------- | ---------------------------------------- |
| GET    | `/api/v1/connections/:id/health-checks`        | List health check history for connection |
| POST   | `/api/v1/connections/:id/health-checks`        | Trigger manual health check              |
| GET    | `/api/v1/connections/:id/health-checks/latest` | Get most recent health check             |
| GET    | `/api/v1/health-checks/summary`                | Get tenant-wide health summary           |
| POST   | `/api/v1/internal/health-checks`               | Internal: Cron job endpoint              |

### Modified Endpoints

| Endpoint                         | Change                                              |
| -------------------------------- | --------------------------------------------------- |
| `GET /api/v1/connections`        | Include `healthStatus` in response                  |
| `GET /api/v1/connections/:id`    | Include health check summary and last check details |
| `PATCH /api/v1/integrations/:id` | Accept `healthCheckConfig` updates                  |

### Request/Response Examples

**Get Health Check History:**

```json
GET /api/v1/connections/conn_abc123/health-checks?limit=10

{
  "success": true,
  "data": [
    {
      "id": "hc_xyz789",
      "status": "healthy",
      "checkType": "scheduled",
      "credentialStatus": "active",
      "testActionSuccess": true,
      "testActionLatencyMs": 145,
      "latencyMs": 156,
      "createdAt": "2026-01-25T10:15:00Z"
    },
    {
      "id": "hc_xyz788",
      "status": "degraded",
      "checkType": "scheduled",
      "credentialStatus": "expiring",
      "credentialExpiresAt": "2026-01-25T11:00:00Z",
      "testActionSuccess": true,
      "testActionLatencyMs": 890,
      "latencyMs": 912,
      "createdAt": "2026-01-25T10:00:00Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "cursor": "eyJpZCI6ImhjX3h5ejc4NyJ9"
  }
}
```

**Trigger Manual Health Check:**

```json
POST /api/v1/connections/conn_abc123/health-checks

{
  "success": true,
  "data": {
    "id": "hc_xyz790",
    "status": "healthy",
    "checkType": "manual",
    "credentialStatus": "active",
    "testActionSuccess": true,
    "testActionLatencyMs": 132,
    "circuitBreakerStatus": "closed",
    "latencyMs": 148,
    "createdAt": "2026-01-25T10:20:00Z"
  }
}
```

**Tenant Health Summary:**

```json
GET /api/v1/health-checks/summary

{
  "success": true,
  "data": {
    "totalConnections": 15,
    "healthy": 12,
    "degraded": 2,
    "unhealthy": 1,
    "lastCheckAt": "2026-01-25T10:15:00Z",
    "uptimeLast24h": 98.5,
    "connections": [
      {
        "id": "conn_abc123",
        "name": "Production Slack",
        "integrationName": "Slack",
        "healthStatus": "healthy",
        "lastCheckAt": "2026-01-25T10:15:00Z"
      },
      {
        "id": "conn_def456",
        "name": "Staging GitHub",
        "integrationName": "GitHub",
        "healthStatus": "unhealthy",
        "lastCheckAt": "2026-01-25T10:15:00Z",
        "error": "Credentials expired"
      }
    ]
  }
}
```

---

## UI Design

### Connection List Updates

- Add health status badge to each connection card/row
- Color coding: Green (healthy), Yellow (degraded), Red (unhealthy)
- Show "Last checked: X minutes ago" timestamp
- Quick action button to trigger manual health check

### Connection Detail Page

- New "Health" tab or section showing:
  - Current health status with detailed breakdown
  - Uptime percentage (last 24h, 7d)
  - Health check history timeline
  - Latency chart over time
  - Test action configuration

### Dashboard Overview

- Health summary widget showing:
  - Total connections by health status
  - Recent health state changes
  - Connections needing attention

### Health Check History View

- Table/timeline of recent health checks
- Filterable by status, date range
- Expandable rows showing full details
- Error messages with suggested resolutions

---

## Implementation Tasks

### Task 1: Database Schema & Migration (45 min)

**Files:** `prisma/schema.prisma`, new migration file

- [ ] Define `HealthCheckStatus` and `HealthCheckType` enums
- [ ] Define `HealthCheck` model with all fields and indexes
- [ ] Add health tracking fields to `Connection` model
- [ ] Add `healthCheckConfig` to `Integration` model
- [ ] Create migration with appropriate defaults
- [ ] Update TypeScript types

### Task 2: HealthCheck Repository & Schemas (45 min)

**Files:** `src/lib/modules/health-checks/`

- [ ] Create `health-check.repository.ts` with CRUD operations
- [ ] Create `health-check.schemas.ts` with Zod validation
- [ ] Implement `findByConnectionId` with pagination
- [ ] Implement `getLatestByConnectionId`
- [ ] Implement `createHealthCheck`
- [ ] Export module via index.ts

### Task 3: HealthCheck Service Core Logic (60 min)

**Files:** `src/lib/modules/health-checks/health-check.service.ts`

- [ ] Implement `runHealthCheck(connectionId)` - single connection check
- [ ] Check credential status (active, expiring, expired, missing)
- [ ] Execute test action if configured
- [ ] Calculate overall health status
- [ ] Store health check result
- [ ] Update connection health status

### Task 4: Test Action Selection & Execution (45 min)

**Files:** `src/lib/modules/health-checks/test-action.service.ts`

- [ ] Implement logic to select default test action (first safe GET action)
- [ ] Support custom test action configuration per integration
- [ ] Execute test action with minimal payload
- [ ] Handle test action failures gracefully
- [ ] Timeout handling for slow test actions

### Task 5: Scheduled Health Check Cron Job (45 min)

**Files:** `src/app/api/v1/internal/health-checks/route.ts`

- [ ] Create internal cron endpoint (protected by CRON_SECRET)
- [ ] Query all active connections needing health check
- [ ] Respect check interval per integration
- [ ] Run health checks in batches (avoid overwhelming external APIs)
- [ ] Log batch summary
- [ ] Add to vercel.json cron configuration

### Task 6: HealthCheck API Routes (45 min)

**Files:** `src/app/api/v1/connections/[id]/health-checks/`

- [ ] Implement GET for health check history
- [ ] Implement POST for manual health check trigger
- [ ] Implement GET `/latest` for most recent check
- [ ] Implement GET `/api/v1/health-checks/summary` for tenant summary
- [ ] Proper error handling and auth

### Task 7: Connection API Updates (30 min)

**Files:** `src/app/api/v1/connections/`

- [ ] Include `healthStatus` in connection list response
- [ ] Include health summary in connection detail response
- [ ] Include last health check details
- [ ] Update Connection service to track health

### Task 8: Health Status Badges & UI Components (45 min)

**Files:** `src/components/features/connections/`, `src/components/features/health/`

- [ ] Create `HealthStatusBadge` component
- [ ] Create `HealthCheckTimeline` component
- [ ] Create `HealthSummaryCard` component
- [ ] Add `useHealthChecks` hook
- [ ] Add badge to ConnectionCard and ConnectionList

### Task 9: Connection Detail Health Section (45 min)

**Files:** `src/app/(dashboard)/integrations/[id]/connections/[connectionId]/`

- [ ] Add Health section/tab to connection detail page
- [ ] Display current health status breakdown
- [ ] Show health check history timeline
- [ ] Add "Check Now" button for manual trigger
- [ ] Show test action configuration

---

## Test Plan

### Unit Tests

- HealthCheck service: `runHealthCheck` returns correct status for various scenarios
- Test action selection: Selects safe GET action by default
- Health status calculation: Correct status for different conditions
- Repository: CRUD operations, pagination

### Integration Tests

- API: List health checks with pagination
- API: Trigger manual health check
- API: Get tenant health summary
- Cron: Processes connections correctly
- Connection health status updates after check

### E2E Tests

- Dashboard shows health status badges
- Manual health check from UI
- Health history displays correctly

---

## Acceptance Criteria

- [ ] Scheduled health checks run every 15 minutes for active connections
- [ ] Health check results are stored and viewable in dashboard
- [ ] Connection list shows current health status badge
- [ ] Manual health check can be triggered from connection detail page
- [ ] Health check tests credentials and executes a test action
- [ ] Unhealthy connections are clearly highlighted
- [ ] Health check history is retained for at least 7 days
- [ ] Cron job handles 100+ connections without timeout

---

## Technical Notes

### Health Status Determination

```
HEALTHY:
- Credential status = active
- Test action succeeded (if configured)
- Circuit breaker = closed
- Latency within acceptable range

DEGRADED:
- Credential status = expiring (< 1 hour)
- Test action latency > 2000ms
- Circuit breaker = half_open
- Recent failures < 3

UNHEALTHY:
- Credential status = expired/missing/needs_reauth
- Test action failed
- Circuit breaker = open
- Recent failures >= 3
```

### Rate Limit Considerations

- Health checks use minimal API calls (1 test action per connection)
- Batch processing with delays between connections
- Skip connections with recent manual checks (within 5 minutes)
- Respect external API rate limits

### Test Action Selection

Default test action selection priority:

1. Explicitly configured `healthCheckTestActionId` on connection
2. Action tagged with `health-check` tag
3. First GET action with no required parameters
4. First GET action (will be skipped if has required params)
5. No test action (credential check only)

### Data Retention

Health check results are retained for 7 days by default. A cleanup job (deferred to V1.1) will archive/delete older records. Aggregate uptime metrics can be computed and stored separately for longer-term retention.

### Security

- Health check results never contain sensitive data
- Test action responses are not stored (only success/failure, latency, status code)
- Cron endpoint protected by CRON_SECRET
- All health check APIs require tenant authentication

---

## Dependencies

- Multi-App Connections (V0.75 Feature #1) ✅ - Connection entity exists
- Hybrid Auth Model (V0.75 Feature #2) ✅ - Platform/custom credentials

## Blocks

- Per-App Custom Mappings (V0.75 Feature #4) - unrelated, can proceed in parallel

---

## Open Questions

| Question                                         | Decision                     | Date       |
| ------------------------------------------------ | ---------------------------- | ---------- |
| Should health checks run for draft integrations? | No, only active integrations | 2026-01-25 |
| What's the default health check interval?        | 15 minutes                   | 2026-01-25 |
| Should users be able to disable health checks?   | Yes, per-integration config  | 2026-01-25 |
| How long to retain health check history?         | 7 days (cleanup job in V1.1) | 2026-01-25 |
| Email alerts for unhealthy connections?          | Defer to V1.1                | 2026-01-25 |

---

## References

- Product Spec: Section 3.2 - Continuous Integration Testing feature
- Architecture Doc: Section 2.4 - Token Refresh Flow (similar pattern)
- Existing: `/api/v1/integrations/:id/health` endpoint (current health check logic)
- Existing: `/api/v1/internal/token-refresh` (cron job pattern)
