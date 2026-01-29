# Feature: Per-App Custom Mappings

**Status:** Planning  
**Milestone:** V0.75 (Multi-Tenancy & Expanded Capabilities)  
**Priority:** P2  
**Complexity:** Medium  
**Dependencies:** Basic Field Mapping ✅, Multi-App Connections ✅  
**Created:** 2026-01-25

---

## 1. Overview

### 1.1 User Stories

> As a developer with multiple consuming apps connected to the same integration, I want each app to have its own field mapping configuration, so that different apps can receive data in their preferred shapes without affecting each other.

> As a developer building LLM-powered applications, I want to configure a contextual preamble for API responses, so that my AI agent receives data with human-readable context (e.g., "The search results from Salesforce are: {...}").

### 1.2 Problem Statement

Currently, field mappings are defined at the action level and apply to all consumers. This creates problems:

1. **Different data shapes needed** - App A expects `{ email, fullName }` while App B expects `{ userEmail, name }`
2. **Breaking changes** - Updating a mapping affects all consuming apps simultaneously
3. **Legacy compatibility** - New apps can't adopt cleaner data shapes without breaking old apps
4. **LLM integration variance** - Different AI agents may need data structured differently for their tool schemas
5. **Raw JSON lacks context** - LLM-powered apps receive raw API responses without understanding what the data represents, making it harder for agents to interpret results

With Multi-App Connections now in place, we need per-connection customization so each consuming app can control both the **shape** of data (field mappings) and the **presentation** of data (response formatting for LLMs).

### 1.3 Solution Summary

Extend the existing Field Mapping system to support **Connection-level customization**:

1. **Default mappings** - Action-level mappings remain the baseline (existing behavior)
2. **Connection overrides** - Each Connection can define its own mappings that override or extend the defaults
3. **Merge strategy** - Connection mappings take precedence; defaults apply where no override exists
4. **UI management** - Configure per-connection mappings from the Connection detail panel
5. **Clear inheritance** - Indicate which mappings are inherited vs overridden
6. **LLM Response Preamble** - Optional contextual prefix for responses, helping AI agents understand what data they received

```
Action: slack.getUser
├── Default Mappings (Integration-level)
│   ├── $.real_name → $.displayName
│   └── $.profile.email → $.email
│
├── Connection: "App A - Production"
│   └── (uses defaults, no overrides)
│
├── Connection: "App B - Legacy"
│   └── Override: $.profile.email → $.user_email  ← Different target path
│
└── Connection: "AI Agent App"
    ├── (uses default mappings)
    └── Preamble: "The user profile from Slack is:"  ← LLM-friendly context
```

### 1.4 Design Philosophy

- **Inheritance-based** - Connections inherit action defaults; only overrides need configuration
- **Non-destructive** - Connection mappings don't affect the action defaults or other connections
- **Explicit over implicit** - Clear indicators when a mapping is overridden vs inherited
- **Backward compatible** - Existing mappings continue working unchanged
- **LLM-first optional** - Response preambles are opt-in; traditional apps get raw JSON by default

---

## 2. Requirements

### 2.1 Functional Requirements

| ID    | Requirement                                                                    | Priority |
| ----- | ------------------------------------------------------------------------------ | -------- |
| FR-1  | Add connectionId to FieldMapping for connection-level scope                    | P0       |
| FR-2  | Connection mappings override action-level defaults                             | P0       |
| FR-3  | Null connectionId = action-level default (existing behavior)                   | P0       |
| FR-4  | Merged mappings applied during action invocation                               | P0       |
| FR-5  | CRUD API for connection-level mappings                                         | P0       |
| FR-6  | UI to view inherited vs overridden mappings per connection                     | P0       |
| FR-7  | UI to add/edit/remove connection-specific overrides                            | P0       |
| FR-8  | Mapping preview respects connection context                                    | P1       |
| FR-9  | Copy mappings from defaults or another connection                              | P2       |
| FR-10 | Bulk reset connection to use defaults (remove all overrides)                   | P2       |
| FR-11 | Connection-level response preamble template configuration                      | P1       |
| FR-12 | Preamble supports template variables ({integration_name}, {action_name}, etc.) | P1       |
| FR-13 | Preamble wraps response in structured format (context + data)                  | P1       |
| FR-14 | Preamble is opt-in; disabled by default (raw JSON)                             | P0       |
| FR-15 | UI to configure preamble template per connection                               | P1       |

### 2.2 Non-Functional Requirements

| ID    | Requirement                | Target                                             |
| ----- | -------------------------- | -------------------------------------------------- |
| NFR-1 | Mapping resolution latency | < 5ms for fetching merged mappings                 |
| NFR-2 | Cache efficiency           | Connection mappings cached, invalidated on CRUD    |
| NFR-3 | Database efficiency        | Single query to fetch action + connection mappings |

### 2.3 Acceptance Criteria

**Field Mapping Overrides:**

1. **AC-1:** Given action with default mapping `$.email → $.userEmail`, and connection override `$.email → $.contactEmail`, invoking with that connection returns `{ contactEmail: "..." }`
2. **AC-2:** Given action with default mapping and connection without overrides, connection receives default-mapped data
3. **AC-3:** Given connection with partial overrides, unoverridden defaults still apply
4. **AC-4:** Connection mappings don't affect other connections using the same action
5. **AC-5:** UI shows which mappings are inherited vs overridden
6. **AC-6:** Mapping preview with connectionId shows connection-specific results
7. **AC-7:** Deleting a connection override reverts to using the default
8. **AC-8:** Existing integrations without connections continue working unchanged

**LLM Response Preamble:**

9. **AC-9:** Given preamble template `"The {action_name} results from {integration_name}:"`, response includes interpolated context string
10. **AC-10:** Given preamble enabled, response format is `{ context: "...", data: {...}, meta: {...} }`
11. **AC-11:** Given no preamble configured (default), response is raw JSON (backward compatible)
12. **AC-12:** Template variables `{integration_name}`, `{action_name}`, `{connection_name}` interpolate correctly
13. **AC-13:** Preamble is applied after field mappings (describes final data shape)

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

### 3.8 LLM Response Preamble

#### Data Model

Add response formatting configuration to the Connection model:

```typescript
// Connection model extension (in metadata or dedicated field)
interface ConnectionResponseFormat {
  preambleTemplate?: string; // e.g., "The {action_name} results from {integration_name}:"
}

// Stored in Connection.metadata.responseFormat or as dedicated column
```

#### Template Variables

Available variables for preamble interpolation:

| Variable             | Description                | Example Value     |
| -------------------- | -------------------------- | ----------------- |
| `{integration_name}` | Integration display name   | "Salesforce"      |
| `{integration_slug}` | Integration slug           | "salesforce"      |
| `{action_name}`      | Action display name        | "Search Contacts" |
| `{action_slug}`      | Action slug                | "search-contacts" |
| `{connection_name}`  | Connection label           | "Production"      |
| `{result_count}`     | Number of items (if array) | "42"              |

#### Response Format

When preamble is configured, the response wraps data in a structured format:

```typescript
// Without preamble (default - raw JSON)
{
  "success": true,
  "data": { "contacts": [...] },
  "meta": { "requestId": "...", "timestamp": "..." }
}

// With preamble (LLM-friendly wrapped format)
{
  "success": true,
  "context": "The Search Contacts results from Salesforce are:",
  "data": { "contacts": [...] },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Processing Order

```
API Response → Validate → Apply Field Mappings → Apply Preamble → Return
                                                      ↑
                                         Preamble describes the FINAL
                                         (mapped) data shape
```

#### Zod Schema

```typescript
// Connection response format schema
export const connectionResponseFormatSchema = z.object({
  preambleTemplate: z
    .string()
    .max(500)
    .optional()
    .describe('Template for LLM-friendly response context'),
});

// Validation: ensure template only uses valid variables
const VALID_TEMPLATE_VARS = [
  'integration_name',
  'integration_slug',
  'action_name',
  'action_slug',
  'connection_name',
  'result_count',
];
```

#### Implementation

```typescript
// src/lib/modules/execution/preamble.ts

interface PreambleContext {
  integrationName: string;
  integrationSlug: string;
  actionName: string;
  actionSlug: string;
  connectionName: string;
  resultCount?: number;
}

function interpolatePreamble(template: string, context: PreambleContext): string {
  return template
    .replace(/{integration_name}/g, context.integrationName)
    .replace(/{integration_slug}/g, context.integrationSlug)
    .replace(/{action_name}/g, context.actionName)
    .replace(/{action_slug}/g, context.actionSlug)
    .replace(/{connection_name}/g, context.connectionName)
    .replace(/{result_count}/g, String(context.resultCount ?? 'N/A'));
}

function wrapResponseWithPreamble(
  data: unknown,
  preambleTemplate: string | undefined,
  context: PreambleContext
): { context?: string; data: unknown } {
  if (!preambleTemplate) {
    return { data }; // No wrapping, return raw
  }

  return {
    context: interpolatePreamble(preambleTemplate, context),
    data,
  };
}
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
│  ─── LLM Response Format ───────────────────────────────────────────────    │
│                                                                             │
│  Response Preamble (optional - for LLM-powered apps):                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ The {action_name} results from {integration_name}:                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ⓘ Available: {integration_name}, {action_name}, {connection_name},        │
│    {result_count}                                                           │
│                                                                             │
│  Preview: "The Get User results from Slack:"                                │
│                                                                             │
│  ─── Field Mapping Configuration ───────────────────────────────────────    │
│                                                                             │
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

### 4.4 Schema Field Pre-population (Auto-Suggested Mappings)

When configuring mappings for an action, the UI automatically extracts fields from the action's input/output schemas and displays them as suggested mappings. This makes it easy to configure mappings without needing to know the API schema beforehand.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✨ Available Fields from Schema                            [12 fields]     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  These fields are available in the action schema. Add a target path to      │
│  create a mapping.                                                          │
│                                                                             │
│  ▼ Output Fields (API → App)                                    [8]        │
│                                                                             │
│    $.user.email           →  [____________]  [+ Add]                        │
│    $.user.name            →  [____________]  [+ Add]                        │
│    $.user.id              →  [____________]  [+ Add]                        │
│    $.user.profile.avatar  →  [____________]  [+ Add]                        │
│    ...                                                                      │
│                                                                             │
│  ▶ Input Fields (App → API)                                     [4]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- **Schema extraction**: Parses the action's JSON Schema to identify available fields
- **Nested field support**: Handles nested objects (e.g., `$.user.profile.email`)
- **Array support**: Shows array item paths with wildcard syntax (e.g., `$.items[*].id`)
- **Quick add**: Type a target path and press Enter or click Add to create the mapping
- **Collapsible sections**: Output and input fields are in separate, collapsible sections
- **Tooltips**: Hover on source paths to see field type, description, and required status

**Implementation:**

- Uses `getSchemaFieldPaths()` utility from `@/lib/modules/execution/mapping`
- Full action schema data passed from `ConnectionDetail` to `ConnectionMappingList`
- Unconfigured fields filtered out as mappings are added

---

## 5. Implementation Tasks

### Task 1: Database Schema Update (30 min) ✅ COMPLETE

**Files:** `prisma/schema.prisma`, new migration file

- [x] Add `connectionId` column to `FieldMapping` model (nullable)
- [x] Add foreign key constraint to `Connection`
- [x] Add unique constraint on (actionId, connectionId, sourcePath, direction)
- [x] Add `preambleTemplate` column to `Connection` model for LLM preamble
- [x] Create and run migration

### Task 2: Mapping Repository Updates (45 min) ✅ COMPLETE

**Files:** `src/lib/modules/execution/mapping/mapping.repository.ts`, `mapping.schemas.ts`

- [x] Update `getMappingsForAction()` to accept optional connectionId filter
- [x] Add `getMappingsByConnection()` for connection-specific queries
- [x] Add `getResolvedMappings()` that fetches defaults + connection overrides with merge logic
- [x] Add `createConnectionMapping()` for creating connection-specific overrides
- [x] Add `resetConnectionMappings()` to delete all connection overrides (revert to defaults)
- [x] Add `copyDefaultsToConnection()` to copy action defaults as connection overrides
- [x] Add `countConnectionsWithOverrides()` for UI indicator
- [x] Update cache key structure: `actionId` for defaults, `actionId:connectionId` for connection-specific
- [x] Update cache invalidation logic with `invalidateConnectionCache()`
- [x] Export new types: `ResolvedMapping`, `FieldMappingWithConnection`, `ConnectionMappingState`, etc.

### Task 3: Mapping Service Updates (45 min) ✅ COMPLETE

**Files:** `src/lib/modules/execution/mapping/mapping.service.ts`

- [x] Add `resolveMappings(actionId, connectionId)` - Returns merged defaults + connection overrides
- [x] Add `getConnectionMappingState()` - Full state with inheritance info, counts
- [x] Add `createConnectionOverride()` - Create connection-specific mapping with validation
- [x] Add `deleteConnectionOverride()` - Delete single override (revert to default)
- [x] Add `resetConnectionMappings()` - Bulk delete all connection overrides
- [x] Add `copyMappingsToConnection()` - Copy action defaults as starting point
- [x] Add `getConnectionMappingStats()` - Stats on override vs default counts
- [x] Add `getConnectionOverrides()` - Get only the overrides, not merged
- [x] Add `previewWithConnection()` - Preview mapping with connection context
- [x] Update `applyInputMapping()` / `applyOutputMapping()` to use connection context
- [x] Add `invalidateConnectionCaches()` for connection-specific cache clearing

### Task 4: Connection Mapping API Endpoints (45 min) ✅ COMPLETE

**Files:** `src/app/api/v1/connections/[id]/mappings/`

- [x] GET `/connections/:id/mappings?actionId=...` - List with inheritance state, stats
- [x] POST `/connections/:id/mappings` - Create override (requires actionId in body)
- [x] PATCH `/connections/:id/mappings/:mappingId` - Update override
- [x] DELETE `/connections/:id/mappings/:mappingId?actionId=...` - Delete override
- [x] POST `/connections/:id/mappings/preview` - Preview with connection context
- [x] DELETE `/connections/:id/mappings?actionId=...` - Reset all overrides to defaults
- [x] POST `/connections/:id/mappings/copy` - Copy action defaults to connection

### Task 5: Execution Pipeline Integration (30 min) ✅ COMPLETE

**Files:** `src/lib/modules/gateway/gateway.service.ts`, `gateway.schemas.ts`

- [x] Update `applyInputMapping()` call to pass `connectionId` from resolved connection
- [x] Update `applyOutputMapping()` call to pass `connectionId` from resolved connection
- [x] Connection already resolved at step 1b, ID passed through context
- [x] Add `MappingSourceStatsSchema` to response metadata for connection resolution stats
- [x] Add `connectionResolution` optional field to `MappingMetadataSchema`
- [x] Cache invalidation propagates via existing `invalidateConnectionCache()` in mapping service

### Task 6: React Hooks for Connection Mappings (30 min) ✅ COMPLETE

**Files:** `src/hooks/useConnectionMappings.ts`, `src/hooks/index.ts`

- [x] Add `useConnectionMappings(connectionId, actionId)` - Fetch resolved mappings with inheritance info
- [x] Add `useCreateConnectionOverride()` - Create connection-specific override
- [x] Add `useUpdateConnectionOverride()` - Update existing override
- [x] Add `useDeleteConnectionOverride()` - Delete override (revert to default)
- [x] Add `useResetConnectionMappings()` - Reset all overrides for an action
- [x] Add `useCopyDefaultsToConnection()` - Copy action defaults as starting overrides
- [x] Add `usePreviewConnectionMapping()` - Preview with connection context
- [x] Add `useConnectionOverrideCount()` - For UI indicator (placeholder)
- [x] Add query invalidation on all mutations (both connection and action-level caches)
- [x] Export from `src/hooks/index.ts`

### Task 7: Connection Mappings UI Components (60 min) ✅

**Files:** `src/components/features/connections/mappings/`

- [x] Create `ConnectionMappingList` component
- [x] Create `ConnectionMappingCard` with inheritance indicator
- [x] Create `OverrideMappingDialog` for add/edit
- [x] Create `MappingInheritanceBadge` (inherited/overridden state)
- [x] Add action selector dropdown
- [x] Create `ResetMappingsDialog` for resetting to defaults
- [x] Export components from `src/components/features/connections/index.ts`

### Task 8: Integration into Connection Detail Panel (30 min) ✅

**Files:** `src/components/features/connections/ConnectionDetail.tsx`

- [x] Add Field Mappings section to connection detail panel
- [x] Wire up ConnectionMappingList component with action data
- [x] Reset to Defaults dialog already integrated in ConnectionMappingList
- [x] Copy Mappings flow already integrated in ConnectionMappingList

### Task 9: Action Mapping Panel - Connection Indicator (15 min) ✅

**Files:** `src/components/features/actions/editor/MappingsTab.tsx`

- [x] Enhanced mappings API endpoint with `includeStats` query param
- [x] Updated `useMappings` hook to support stats option
- [x] Updated `useConnectionOverrideCount` hook to use new API
- [x] Added connection override indicator badge in MappingsTab header
- [x] Badge shows count of connections with custom overrides
- [x] Tooltip provides guidance to view connection details for per-app mappings

### Task 10: LLM Response Preamble (45 min) ✅

**Files:** `src/lib/modules/execution/preamble/`, `src/lib/modules/connections/`, `src/lib/modules/gateway/`

- [x] Create preamble interpolation utility (`src/lib/modules/execution/preamble/preamble.ts`)
  - `PreambleContext` interface with integration/action/connection names + result_count
  - `interpolatePreamble()` function for template variable substitution
  - `validatePreambleTemplate()` to check for invalid variables
  - `applyPreamble()` main API to process and apply preambles
  - `calculateResultCount()` to auto-detect array lengths
- [x] Add `preambleTemplate` field to Connection model (`prisma/schema.prisma`)
- [x] Created migration (`20260125300000_add_preamble_template_to_connections`)
- [x] Update `ConnectionResponse` schema to include `preambleTemplate`
- [x] Update `UpdateConnectionInput` schema to accept `preambleTemplate`
- [x] Update connection repository to handle `preambleTemplate` in updates
- [x] Add preamble template validation to PATCH `/connections/:id` endpoint
- [x] Integrate preamble wrapping into execution pipeline (gateway.service.ts)
  - Applied AFTER output mapping, BEFORE response formatting
  - Added `context` field to `GatewaySuccessResponse` schema
- [x] Generated Prisma client with new field

### Task 11: Preamble UI Components (30 min) ✅

**Files:** `src/components/features/connections/mappings/`

- [x] Create `PreambleTemplateInput` component with:
  - Template textarea with placeholder example
  - Real-time validation showing invalid variables
  - Clickable variable badges to insert into template
  - Live preview with sample interpolated data
  - Save/Clear buttons with loading states
  - Unsaved changes indicator
- [x] Integrate into Connection Detail panel (after Field Mappings section)
- [x] Export from connections component index

---

## 6. Test Plan

### Unit Tests

**Mapping Resolution:** (tests/unit/execution/connection-mappings.test.ts - 11 tests)

- [x] Returns only defaults when connectionId is null
- [x] Merges defaults with connection overrides correctly
- [x] Connection override takes precedence over default with same sourcePath
- [x] Unoverridden defaults are preserved in merge
- [x] Empty connection overrides returns all defaults

**Cache Behavior:**

- [x] Default mapping CRUD invalidates all connection caches for that action (implementation verified)
- [x] Connection mapping CRUD only invalidates that connection's cache (implementation verified)

**API Validation:**

- [x] Cannot create duplicate override (same sourcePath/direction for connection) - enforced by unique constraint
- [x] Connection must belong to same tenant - enforced by API middleware

**Preamble Interpolation:** (tests/unit/execution/preamble.test.ts - 40 tests)

- [x] All template variables interpolate correctly
- [x] Unknown variables are left as-is (or stripped)
- [x] Empty template returns no context wrapper
- [x] `{result_count}` calculates array length correctly
- [x] Non-array responses show "N/A" for result_count

### Integration Tests

_Note: Integration tests require full database/API setup. Gateway pipeline integration verified via code review._

- [ ] Create connection override → resolves correctly in action invocation
- [ ] Delete connection override → reverts to default in action invocation
- [ ] Multiple connections with different overrides → each gets correct mappings
- [ ] Mapping preview with connectionId shows connection-specific results
- [ ] Reset all overrides → connection uses all defaults
- [ ] Connection with preamble → response includes `context` field
- [ ] Connection without preamble → response is raw JSON (no `context` field)
- [ ] Preamble applied after field mappings (describes mapped data)

### Manual Testing

_Note: Requires running application with database and seed data._

- [ ] UI shows inherited vs overridden badges correctly
- [ ] Override editor shows current default for reference
- [ ] Reset confirmation works and refreshes list
- [ ] Action invocation with different connections returns different shapes
- [ ] Preamble template input shows available variables
- [ ] Preamble preview updates live as template is edited
- [ ] LLM-powered app receives contextual response format

---

## 7. Edge Cases & Error Handling

**Field Mapping Edge Cases:**

| Edge Case                                       | Handling                                           |
| ----------------------------------------------- | -------------------------------------------------- |
| Connection deleted with overrides               | CASCADE delete mappings with connectionId          |
| Action default deleted that had overrides       | Overrides remain (now standalone, no default ref)  |
| Override same path as default but different dir | Allow - input/output are separate override targets |
| Connection has override, action has no default  | Override still applies (no merge, just override)   |
| Copy mappings to self                           | No-op, return success                              |
| Reset when no overrides exist                   | No-op, return success                              |

**Preamble Edge Cases:**

| Edge Case                                      | Handling                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| Template with invalid variable (e.g., `{foo}`) | Leave as literal text `{foo}` in output           |
| Template is empty string                       | Treat as no preamble (raw JSON response)          |
| Template is only whitespace                    | Treat as no preamble (raw JSON response)          |
| Response is error (not success)                | No preamble wrapping - errors use standard format |
| `{result_count}` on non-array response         | Interpolate as "1" (single item) or "N/A"         |
| Very long template (>500 chars)                | Validation error on save                          |

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

| Date       | Author       | Changes                                                              |
| ---------- | ------------ | -------------------------------------------------------------------- |
| 2026-01-25 | AI Assistant | Initial feature specification                                        |
| 2026-01-25 | AI Assistant | Added LLM Response Preamble capability (FR-11 to FR-15, Tasks 10-11) |
