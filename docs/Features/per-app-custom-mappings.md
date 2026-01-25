# Feature: Per-App Custom Mappings

**Status:** Planning  
**Milestone:** V0.75 (Multi-Tenancy & Expanded Capabilities)  
**Priority:** P2  
**Complexity:** Medium  
**Dependencies:** Basic Field Mapping ✅, Multi-App Connections ✅  
**Created:** 2026-01-25

---

## 1. Overview

### 1.1 User Story

> As a developer with multiple consuming apps connected to the same integration, I want each app to have its own field mapping configuration, so that different apps can receive data in their preferred shapes without affecting each other.

### 1.2 Problem Statement

Currently, field mappings are defined at the action level and apply to all consumers. This creates problems:

1. **Different data shapes needed** - App A expects `{ email, fullName }` while App B expects `{ userEmail, name }`
2. **Breaking changes** - Updating a mapping affects all consuming apps simultaneously
3. **Legacy compatibility** - New apps can't adopt cleaner data shapes without breaking old apps
4. **LLM integration variance** - Different AI agents may need data structured differently for their tool schemas

With Multi-App Connections now in place, we need per-connection mapping overrides so each consuming app can customize how data flows to/from it.

### 1.3 Solution Summary

Extend the existing Field Mapping system to support **Connection-level overrides**:

1. **Default mappings** - Action-level mappings remain the baseline (existing behavior)
2. **Connection overrides** - Each Connection can define its own mappings that override or extend the defaults
3. **Merge strategy** - Connection mappings take precedence; defaults apply where no override exists
4. **UI management** - Configure per-connection mappings from the Connection detail panel
5. **Clear inheritance** - Indicate which mappings are inherited vs overridden

```
Action: slack.getUser
├── Default Mappings (Integration-level)
│   ├── $.real_name → $.displayName
│   └── $.profile.email → $.email
│
├── Connection: "App A - Production"
│   └── (uses defaults, no overrides)
│
└── Connection: "App B - Legacy"
    └── Override: $.profile.email → $.user_email  ← Different target path
```

### 1.4 Design Philosophy

- **Inheritance-based** - Connections inherit action defaults; only overrides need configuration
- **Non-destructive** - Connection mappings don't affect the action defaults or other connections
- **Explicit over implicit** - Clear indicators when a mapping is overridden vs inherited
- **Backward compatible** - Existing mappings continue working unchanged

---

## 2. Requirements

### 2.1 Functional Requirements

| ID    | Requirement                                                  | Priority |
| ----- | ------------------------------------------------------------ | -------- |
| FR-1  | Add connectionId to FieldMapping for connection-level scope  | P0       |
| FR-2  | Connection mappings override action-level defaults           | P0       |
| FR-3  | Null connectionId = action-level default (existing behavior) | P0       |
| FR-4  | Merged mappings applied during action invocation             | P0       |
| FR-5  | CRUD API for connection-level mappings                       | P0       |
| FR-6  | UI to view inherited vs overridden mappings per connection   | P0       |
| FR-7  | UI to add/edit/remove connection-specific overrides          | P0       |
| FR-8  | Mapping preview respects connection context                  | P1       |
| FR-9  | Copy mappings from defaults or another connection            | P2       |
| FR-10 | Bulk reset connection to use defaults (remove all overrides) | P2       |

### 2.2 Non-Functional Requirements

| ID    | Requirement                | Target                                             |
| ----- | -------------------------- | -------------------------------------------------- |
| NFR-1 | Mapping resolution latency | < 5ms for fetching merged mappings                 |
| NFR-2 | Cache efficiency           | Connection mappings cached, invalidated on CRUD    |
| NFR-3 | Database efficiency        | Single query to fetch action + connection mappings |

### 2.3 Acceptance Criteria

1. **AC-1:** Given action with default mapping `$.email → $.userEmail`, and connection override `$.email → $.contactEmail`, invoking with that connection returns `{ contactEmail: "..." }`
2. **AC-2:** Given action with default mapping and connection without overrides, connection receives default-mapped data
3. **AC-3:** Given connection with partial overrides, unoverridden defaults still apply
4. **AC-4:** Connection mappings don't affect other connections using the same action
5. **AC-5:** UI shows which mappings are inherited vs overridden
6. **AC-6:** Mapping preview with connectionId shows connection-specific results
7. **AC-7:** Deleting a connection override reverts to using the default
8. **AC-8:** Existing integrations without connections continue working unchanged

---

## 3. Technical Design

### 3.1 Data Model Changes

Extend the existing `FieldMapping` model with a `connectionId` field:

```typescript
// Updated FieldMapping model
FieldMapping: {
  id: uuid,
  actionId: uuid -> Action,
  tenantId: uuid -> Tenant,
  connectionId: uuid | null -> Connection,  // NEW: null = action-level default
  sourcePath: string,          // JSONPath
  targetPath: string,          // JSONPath
  direction: 'input' | 'output',
  transformConfig: jsonb,
  createdAt: timestamp,
  updatedAt: timestamp,

  // Constraints
  UNIQUE(actionId, connectionId, sourcePath, direction)  // One mapping per path per connection per direction
}
```

**Migration Strategy:**

1. Add `connectionId` column (nullable) to `field_mappings`
2. Add foreign key constraint to `connections` table
3. Add unique constraint for path/connection/direction
4. Existing rows with `null` connectionId are action defaults (no data migration needed)

### 3.2 Mapping Resolution Logic

When invoking an action with a specific connection:

```typescript
interface MergedMapping {
  mapping: FieldMapping;
  source: 'default' | 'connection'; // Where it came from
}

function resolveMappings(actionId: string, connectionId: string | null): MergedMapping[] {
  // 1. Fetch action-level defaults (connectionId = null)
  const defaults = await getMappings(actionId, null);

  if (!connectionId) {
    return defaults.map((m) => ({ mapping: m, source: 'default' }));
  }

  // 2. Fetch connection-level overrides
  const overrides = await getMappings(actionId, connectionId);

  // 3. Merge: connection overrides win, keyed by (sourcePath, direction)
  const merged = new Map<string, MergedMapping>();

  for (const mapping of defaults) {
    const key = `${mapping.sourcePath}:${mapping.direction}`;
    merged.set(key, { mapping, source: 'default' });
  }

  for (const mapping of overrides) {
    const key = `${mapping.sourcePath}:${mapping.direction}`;
    merged.set(key, { mapping, source: 'connection' }); // Override
  }

  return Array.from(merged.values());
}
```

### 3.3 API Design

#### New Endpoints

| Method | Endpoint                                               | Purpose                             |
| ------ | ------------------------------------------------------ | ----------------------------------- |
| GET    | `/api/v1/connections/:id/mappings`                     | List connection's mapping state     |
| POST   | `/api/v1/connections/:id/mappings`                     | Create connection-level override    |
| PATCH  | `/api/v1/connections/:id/mappings/:mappingId`          | Update connection mapping           |
| DELETE | `/api/v1/connections/:id/mappings/:mappingId`          | Delete override (revert to default) |
| POST   | `/api/v1/connections/:id/mappings/preview`             | Preview mapping with sample data    |
| POST   | `/api/v1/connections/:id/mappings/copy-from/:sourceId` | Copy mappings from another source   |
| DELETE | `/api/v1/connections/:id/mappings/all`                 | Reset all to defaults               |

#### Modified Endpoints

| Endpoint                                    | Change                                                |
| ------------------------------------------- | ----------------------------------------------------- |
| `GET /api/v1/actions/:actionId/mappings`    | Add query param `?connectionId=` for resolved view    |
| `POST /api/v1/actions/:integration/:action` | Mapping resolution uses connection context (implicit) |

#### Response Format for Connection Mappings

```typescript
// GET /api/v1/connections/:id/mappings?actionId=xxx
{
  "success": true,
  "data": {
    "actionId": "action-uuid",
    "connectionId": "connection-uuid",
    "mappings": [
      {
        "id": "mapping-uuid",
        "sourcePath": "$.profile.email",
        "targetPath": "$.email",
        "direction": "output",
        "transformConfig": { "coercion": { "type": "string" } },
        "source": "default",        // inherited from action
        "overridden": false
      },
      {
        "id": "override-mapping-uuid",
        "sourcePath": "$.real_name",
        "targetPath": "$.userName",  // Different from default's $.displayName
        "direction": "output",
        "transformConfig": {},
        "source": "connection",      // connection-specific
        "overridden": true,
        "defaultMapping": {          // What this overrides
          "id": "default-mapping-uuid",
          "targetPath": "$.displayName"
        }
      }
    ],
    "config": {
      "enabled": true,
      "preserveUnmapped": true,
      "failureMode": "passthrough"
    }
  }
}
```

### 3.4 Zod Schemas

```typescript
// src/lib/modules/execution/mapping/mapping.schemas.ts - Extensions

export const connectionMappingCreateSchema = z.object({
  actionId: z.string().uuid(),
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
  direction: z.enum(['input', 'output']),
  transformConfig: transformConfigSchema.default({}),
});

export const connectionMappingUpdateSchema = z.object({
  targetPath: z.string().min(1).optional(),
  transformConfig: transformConfigSchema.optional(),
});

export const copyMappingsSchema = z.object({
  sourceType: z.enum(['defaults', 'connection']),
  sourceConnectionId: z.string().uuid().optional(), // Required if sourceType = 'connection'
  overwriteExisting: z.boolean().default(false),
});
```

### 3.5 Module Structure Updates

```
src/lib/modules/
├── execution/
│   └── mapping/
│       ├── mapping.repository.ts   # Update: Add connectionId support
│       ├── mapping.service.ts      # Update: Add resolution logic
│       └── mapping.schemas.ts      # Update: Add connection schemas
│
└── connections/
    └── connection-mappings.service.ts  # NEW: Connection mapping operations
```

### 3.6 Cache Updates

Extend the existing mapping cache to include connection context:

```typescript
// Cache key structure
type CacheKey = `mappings:${actionId}:${connectionId | 'default'}`;

// Cache invalidation triggers:
// - Action-level mapping CRUD → invalidate action's default + all connection caches
// - Connection-level mapping CRUD → invalidate only that connection's cache
```

### 3.7 Execution Pipeline Integration

The existing pipeline already resolves mappings. Update it to:

1. Accept connectionId from request context
2. Call `resolveMappings(actionId, connectionId)` instead of `getMappings(actionId)`
3. Include mapping source in response metadata

```typescript
// In execution pipeline
const mappings = await mappingService.resolveMappings(action.id, connection?.id ?? null);

// Response metadata includes resolution info
response.mapping = {
  ...existingMappingMetadata,
  connectionId: connection?.id,
  defaultsApplied: mappings.filter((m) => m.source === 'default').length,
  overridesApplied: mappings.filter((m) => m.source === 'connection').length,
};
```

---

## 4. UI Design

### 4.1 Connection Detail - Mappings Tab

Add a "Mappings" section to the Connection detail slide-out panel:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONNECTION: App A - Production                                       [Edit] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Overview] [Credentials] [Mappings] [Logs]                                 │
│                          ─────────                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Action: slack.getUser                                          [▼]  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Mapping Configuration                                                      │
│  ☑ Enable Field Mapping                                                     │
│  ☑ Preserve unmapped fields                                                 │
│  Failure Mode: (●) Passthrough  ( ) Fail                                    │
│                                                                             │
│  ─── Output Mappings ───────────────────────────────────────────────────    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔵 $.profile.email  →  $.email                         [Inherited]  │   │
│  │    coercion: string                                         [⚙] [↻] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🟠 $.real_name  →  $.userName                          [Overridden] │   │
│  │    (default: $.displayName)                             [⚙] [🗑] [↻]│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [ + Add Override ]  [ Copy from Defaults ]  [ Reset All to Defaults ]      │
│                                                                             │
│  ─── Input Mappings ────────────────────────────────────────────────────    │
│                                                                             │
│  (No input mappings - using action defaults)                                │
│                                                                             │
│  [ + Add Override ]                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
  🔵 [Inherited] - Using action default
  🟠 [Overridden] - Connection-specific override
  [⚙] - Edit mapping
  [🗑] - Delete override (revert to default)
  [↻] - Revert to default (for overrides)
```

### 4.2 Mapping Override Editor

When adding or editing a connection-specific override:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ OVERRIDE MAPPING                                                       [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Action: slack.getUser                                                      │
│  Connection: App A - Production                                             │
│                                                                             │
│  ─── Current Default ───────────────────────────────────────────────────    │
│  Source: $.real_name  →  Target: $.displayName                              │
│                                                                             │
│  ─── Your Override ─────────────────────────────────────────────────────    │
│                                                                             │
│  Source Path:  [$.real_name        ]  (matches default, not editable)       │
│                                                                             │
│  Target Path:  [$.userName         ]  ← Your custom target                  │
│                                                                             │
│  Type Coercion:  [None ▼]                                                   │
│                                                                             │
│  ☐ Omit if source is null                                                   │
│  ☐ Omit if source is empty                                                  │
│                                                                             │
│  Default Value:  [                 ]                                        │
│                                                                             │
│                                        [ Cancel ]  [ Save Override ]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Action Detail - Mapping Connections Indicator

On the action's mapping panel, show if any connections have overrides:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FIELD MAPPINGS (Action Defaults)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⓘ 2 connections have custom overrides for this action                     │
│    [View Connection Mappings]                                               │
│                                                                             │
│  ... (existing mapping configuration) ...                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Tasks

### Task 1: Database Schema Update (30 min)

**Files:** `prisma/schema.prisma`, new migration file

- [ ] Add `connectionId` column to `FieldMapping` model (nullable)
- [ ] Add foreign key constraint to `Connection`
- [ ] Add unique constraint on (actionId, connectionId, sourcePath, direction)
- [ ] Create and run migration

### Task 2: Mapping Repository Updates (45 min)

**Files:** `src/lib/modules/execution/mapping/mapping.repository.ts`

- [ ] Update `getMappings()` to accept optional connectionId filter
- [ ] Add `getMappingsByConnection()` for connection-specific queries
- [ ] Add `getResolvedMappings()` that fetches defaults + connection overrides
- [ ] Update create/update/delete to handle connectionId
- [ ] Update cache key structure for connection awareness
- [ ] Update cache invalidation logic

### Task 3: Mapping Service Updates (45 min)

**Files:** `src/lib/modules/execution/mapping/mapping.service.ts`

- [ ] Add `resolveMappings(actionId, connectionId)` with merge logic
- [ ] Add `getConnectionMappingState()` returning inheritance info
- [ ] Add `createConnectionOverride()`
- [ ] Add `deleteConnectionOverride()` (revert to default)
- [ ] Add `resetConnectionMappings()` (bulk reset)
- [ ] Add `copyMappingsToConnection()` helper

### Task 4: Connection Mapping API Endpoints (45 min)

**Files:** `src/app/api/v1/connections/[id]/mappings/`

- [ ] GET `/connections/:id/mappings` - List with inheritance state
- [ ] POST `/connections/:id/mappings` - Create override
- [ ] PATCH `/connections/:id/mappings/:mappingId` - Update override
- [ ] DELETE `/connections/:id/mappings/:mappingId` - Delete override
- [ ] POST `/connections/:id/mappings/preview` - Preview with connection context
- [ ] DELETE `/connections/:id/mappings/all` - Reset to defaults

### Task 5: Execution Pipeline Integration (30 min)

**Files:** `src/lib/modules/execution/request-pipeline.ts`

- [ ] Update mapping resolution to use connection context
- [ ] Pass connectionId through pipeline context
- [ ] Update response metadata with resolution stats
- [ ] Ensure cache invalidation propagates correctly

### Task 6: React Hooks for Connection Mappings (30 min)

**Files:** `src/hooks/useConnectionMappings.ts`

- [ ] Add `useConnectionMappings(connectionId, actionId)` hook
- [ ] Add `useCreateConnectionOverride()` mutation
- [ ] Add `useDeleteConnectionOverride()` mutation
- [ ] Add `useResetConnectionMappings()` mutation
- [ ] Add query invalidation on mutations

### Task 7: Connection Mappings UI Components (60 min)

**Files:** `src/components/features/connections/mappings/`

- [ ] Create `ConnectionMappingList` component
- [ ] Create `ConnectionMappingCard` with inheritance indicator
- [ ] Create `OverrideMappingDialog` for add/edit
- [ ] Create `MappingInheritanceBadge` (inherited/overridden state)
- [ ] Add action selector dropdown

### Task 8: Integration into Connection Detail Panel (30 min)

**Files:** `src/components/features/connections/ConnectionDetail.tsx`

- [ ] Add "Mappings" tab to connection detail panel
- [ ] Wire up ConnectionMappingList component
- [ ] Add "Reset to Defaults" confirmation dialog
- [ ] Add "Copy Mappings" flow

### Task 9: Action Mapping Panel - Connection Indicator (15 min)

**Files:** `src/components/features/actions/ActionMappingPanel.tsx`

- [ ] Add indicator showing how many connections have overrides
- [ ] Add link to view/manage connection-specific mappings

---

## 6. Test Plan

### Unit Tests

**Mapping Resolution:**

- [ ] Returns only defaults when connectionId is null
- [ ] Merges defaults with connection overrides correctly
- [ ] Connection override takes precedence over default with same sourcePath
- [ ] Unoverridden defaults are preserved in merge
- [ ] Empty connection overrides returns all defaults

**Cache Behavior:**

- [ ] Default mapping CRUD invalidates all connection caches for that action
- [ ] Connection mapping CRUD only invalidates that connection's cache

**API Validation:**

- [ ] Cannot create duplicate override (same sourcePath/direction for connection)
- [ ] Connection must belong to same tenant

### Integration Tests

- [ ] Create connection override → resolves correctly in action invocation
- [ ] Delete connection override → reverts to default in action invocation
- [ ] Multiple connections with different overrides → each gets correct mappings
- [ ] Mapping preview with connectionId shows connection-specific results
- [ ] Reset all overrides → connection uses all defaults

### Manual Testing

- [ ] UI shows inherited vs overridden badges correctly
- [ ] Override editor shows current default for reference
- [ ] Reset confirmation works and refreshes list
- [ ] Action invocation with different connections returns different shapes

---

## 7. Edge Cases & Error Handling

| Edge Case                                       | Handling                                           |
| ----------------------------------------------- | -------------------------------------------------- |
| Connection deleted with overrides               | CASCADE delete mappings with connectionId          |
| Action default deleted that had overrides       | Overrides remain (now standalone, no default ref)  |
| Override same path as default but different dir | Allow - input/output are separate override targets |
| Connection has override, action has no default  | Override still applies (no merge, just override)   |
| Copy mappings to self                           | No-op, return success                              |
| Reset when no overrides exist                   | No-op, return success                              |

---

## 8. Migration & Rollout

### 8.1 Database Migration

1. Add nullable `connectionId` column
2. Add foreign key constraint
3. Add unique constraint
4. No data migration needed - existing rows are already action defaults (null connectionId)

### 8.2 API Compatibility

- All existing endpoints work unchanged
- New `connectionId` in responses is additive
- Actions without connections continue using defaults

### 8.3 Feature Flag

Consider feature flag `ENABLE_CONNECTION_MAPPINGS` for gradual rollout:

- Off: Connection mapping endpoints return 404, UI tab hidden
- On: Full functionality available

---

## 9. Dependencies

| Dependency            | Status | Notes                            |
| --------------------- | ------ | -------------------------------- |
| Basic Field Mapping   | ✅     | Core mapping infrastructure      |
| Multi-App Connections | ✅     | Connection entity and API        |
| Hybrid Auth Model     | ✅     | Platform connectors (orthogonal) |

---

## 10. Future Enhancements (Out of Scope)

- **Mapping inheritance chains** - Connection groups with cascading overrides
- **Mapping templates** - Reusable mapping sets across connections
- **Mapping versions** - Track changes over time, rollback
- **Mapping validation** - Warn if override would break expected schema
- **Bulk mapping operations** - Import/export mappings as JSON/YAML

---

## 11. Related Documentation

- [Basic Field Mapping](./basic-field-mapping.md)
- [Multi-App Connections](./multi-app-connections.md)
- [Product Spec - Per-App Custom Mappings](../product_spec.md)
- [Architecture - Data Model](../architecture.md#4-database-design)

---

## 12. Revision History

| Date       | Author       | Changes                       |
| ---------- | ------------ | ----------------------------- |
| 2026-01-25 | AI Assistant | Initial feature specification |
