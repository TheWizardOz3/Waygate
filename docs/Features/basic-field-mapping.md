# Feature: Basic Field Mapping

**Status:** Completed  
**Milestone:** V0.5 (Polish & Robustness)  
**Priority:** P1  
**Complexity:** Medium  
**Dependencies:** Action Registry ✅, Pagination Handler ✅, Response Validation ✅

---

## 1. Overview

### 1.1 User Story

> As a developer, I want to configure field transformations between Waygate and my consuming app, so that I can work with a consistent data shape regardless of how external APIs structure their responses.

### 1.2 Problem Statement

External APIs return data in widely varying shapes:

1. **Inconsistent naming** - One API returns `user_email`, another `emailAddress`, another `email`
2. **Nested vs flat** - Some APIs deeply nest data (`user.contact.email`), others flatten it
3. **Type mismatches** - API returns strings that should be numbers (very common: `"123"` instead of `123`)
4. **Missing fields** - API sometimes omits fields that consuming app expects
5. **Extra cruft** - API returns metadata/wrapper fields that clutter responses

Currently, consuming apps must handle all these variations themselves, leading to:

- Scattered transformation logic across consuming apps
- Inconsistent handling of the same integration in different apps
- Brittle code that breaks when APIs change field names
- LLM-powered apps receiving unpredictable data shapes

### 1.3 Solution Summary

Implement a Field Mapping layer that:

1. **Maps field paths** - Rename `user.email` → `emailAddress`
2. **Basic type coercion** - Convert `"123"` → `123`, `"true"` → `true`
3. **Works bidirectionally** - Transform both request inputs and response outputs
4. **Fail-open by default** - Mapping errors don't break requests (passthrough mode)
5. **UI configuration** - Visual mapping builder in action editor
6. **LLM-friendly** - Consuming apps receive predictable, clean data shapes

### 1.4 Design Philosophy: Reliable by Default

Field mapping should be:

- **Fail-safe** - Mapping errors return original data + error metadata, not request failures
- **Transparent** - Users see exactly what transformations will happen
- **Predictable** - Same mapping always produces same output
- **Testable** - Users can preview mapping results before deploying
- **Bypassable** - Per-request bypass for debugging

---

## 2. Requirements

### 2.1 Functional Requirements

| ID    | Requirement                                         | Priority | V0.5 Scope |
| ----- | --------------------------------------------------- | -------- | ---------- |
| FR-1  | Map source field path to target field path          | P0       | ✅         |
| FR-2  | Support JSONPath notation for nested fields         | P0       | ✅         |
| FR-3  | Support input direction (transform request params)  | P0       | ✅         |
| FR-4  | Support output direction (transform response data)  | P0       | ✅         |
| FR-5  | Apply multiple mappings to same action              | P0       | ✅         |
| FR-6  | Preserve unmapped fields (configurable)             | P0       | ✅         |
| FR-7  | Basic type coercion (string↔number, string↔boolean) | P0       | ✅         |
| FR-8  | Default value if source field missing               | P1       | ✅         |
| FR-9  | Omit target field if source is null/empty           | P1       | ✅         |
| FR-10 | Fail-open mode (passthrough on error)               | P0       | ✅         |
| FR-11 | Per-request mapping bypass                          | P0       | ✅         |
| FR-12 | UI mapping builder in action editor                 | P0       | ✅         |
| FR-13 | Preview mapping result with sample data             | P1       | ✅         |
| FR-14 | Array item mapping (map each item in array)         | P1       | ✅ (basic) |
| FR-15 | String case transforms (upper/lower/camel/snake)    | P2       | ❌ V1      |
| FR-16 | Date parsing/formatting                             | P2       | ❌ V1      |
| FR-17 | Advanced array operations (filter, aggregate)       | P2       | ❌ V1      |
| FR-18 | Mapping templates (reusable across actions)         | P2       | ❌ V1      |

### 2.2 Non-Functional Requirements

| ID    | Requirement       | Target                                       |
| ----- | ----------------- | -------------------------------------------- |
| NFR-1 | Mapping overhead  | < 5ms for responses up to 100KB              |
| NFR-2 | Memory efficiency | Hard limit: 5000 array items per mapping     |
| NFR-3 | Mapping caching   | Cache mappings in memory, invalidate on CRUD |

### 2.3 Acceptance Criteria

1. **AC-1:** Given output mapping `$.data.user_email` → `$.email`, response `{ data: { user_email: "a@b.com" } }` becomes `{ email: "a@b.com" }`
2. **AC-2:** Given input mapping `$.emailAddress` → `$.email`, request `{ emailAddress: "a@b.com" }` sends `{ email: "a@b.com" }` to API
3. **AC-3:** Given nested path mapping `$.user.contact.email` → `$.email`, nested data is correctly extracted
4. **AC-4:** Given array path `$.users[*].email` → `$.emails[*]`, array is correctly transformed
5. **AC-5:** Given type coercion `string → number`, "123" is transformed to 123
6. **AC-6:** Given mapping error in passthrough mode, original data returned with error in metadata
7. **AC-7:** Given `mapping.bypass: true` in request, mapping is skipped entirely
8. **AC-8:** Given invalid coercion ("abc" → number), mapping fails gracefully with warning
9. **AC-9:** UI allows adding, editing, removing mappings with live preview
10. **AC-10:** Mapping errors are reported clearly with field path and issue

---

## 3. Technical Design

### 3.1 Data Model

The `FieldMapping` model already exists in the schema. We'll define the `transformConfig` JSON field:

```typescript
// Existing FieldMapping model fields:
// - sourcePath: string (JSONPath)
// - targetPath: string (JSONPath)
// - direction: 'input' | 'output'
// - transformConfig: Json

// V0.5 Transform configuration (simplified for reliability)
interface TransformConfig {
  // Field behavior
  omitIfNull?: boolean; // Don't include target if source is null/undefined
  omitIfEmpty?: boolean; // Don't include target if source is empty string/array

  // Basic type coercion (safe, well-defined conversions only)
  coercion?: {
    type: 'string' | 'number' | 'boolean';
    // Note: 'date' and complex types deferred to V1
  };

  // Default value
  defaultValue?: unknown; // Value to use if source is missing/null

  // Array handling (basic only in V0.5)
  arrayMode?: 'all' | 'first' | 'last'; // 'all' maps each item
}

// V1+ additions (NOT in V0.5):
// - stringTransform: { case, trim, prefix, suffix }
// - dateFormat: { input, output }
// - arrayFilter, arraySort, arrayAggregate
// - computed fields / expressions
```

### 3.2 Action-Level Mapping Config

Add mapping configuration to Action model (in metadata or new field):

```typescript
interface ActionMappingConfig {
  enabled: boolean; // Default: false (opt-in)
  preserveUnmapped: boolean; // Default: true (keep fields not in mappings)

  // Failure handling - KEY FOR RELIABILITY
  failureMode: 'fail' | 'passthrough'; // Default: 'passthrough'
  // - 'fail': Request fails if any mapping fails
  // - 'passthrough': Return original data + error metadata (RECOMMENDED)
}
```

### 3.3 Zod Schemas

```typescript
// src/lib/modules/execution/mapping/mapping.schemas.ts

// V0.5 coercion - safe types only
export const coercionSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
});

export const transformConfigSchema = z.object({
  omitIfNull: z.boolean().default(false),
  omitIfEmpty: z.boolean().default(false),
  coercion: coercionSchema.optional(),
  defaultValue: z.unknown().optional(),
  arrayMode: z.enum(['all', 'first', 'last']).default('all'),
});

export const fieldMappingSchema = z.object({
  id: z.string().uuid().optional(),
  sourcePath: z.string().min(1), // JSONPath
  targetPath: z.string().min(1), // JSONPath
  direction: z.enum(['input', 'output']),
  transformConfig: transformConfigSchema.default({}),
});

export const mappingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  preserveUnmapped: z.boolean().default(true),
  failureMode: z.enum(['fail', 'passthrough']).default('passthrough'),
});

// Request-level options
export const mappingRequestSchema = z.object({
  bypass: z.boolean().optional(), // Skip mapping entirely (debugging)
});
```

### 3.4 API Changes

#### Action Invocation Request Extension

```typescript
// POST /api/v1/actions/:integration/:action
interface ActionInvocationRequest {
  // Existing fields...
  input: Record<string, unknown>;
  pagination?: PaginationOptions;
  validation?: ValidationOptions;

  // NEW: Mapping options
  mapping?: {
    bypass?: boolean; // Skip mapping entirely (debugging)
  };
}
```

#### Action Invocation Response Extension

```typescript
interface ActionInvocationResponse {
  success: boolean;
  data: unknown; // Mapped data (or original if bypass/error)

  // Existing metadata...
  pagination?: PaginationMetadata;
  validation?: ValidationMetadata;

  // NEW: Mapping metadata
  mapping?: {
    applied: boolean; // Was mapping applied?
    bypassed: boolean; // Was mapping bypassed?
    inputMappingsApplied: number;
    outputMappingsApplied: number;
    fieldsTransformed: number;
    fieldsCoerced: number;
    fieldsDefaulted: number;
    mappingDurationMs: number;

    // Error info (passthrough mode)
    errors?: MappingError[];
    failureMode: 'fail' | 'passthrough';
  };

  meta: { requestId: string; timestamp: string };
}

interface MappingError {
  path: string; // Source path that failed
  code: 'PATH_NOT_FOUND' | 'COERCION_FAILED' | 'INVALID_PATH';
  message: string;
  originalValue?: unknown; // What was there before
}
```

#### Mapping CRUD Endpoints

| Method | Endpoint                                        | Purpose                     |
| ------ | ----------------------------------------------- | --------------------------- |
| GET    | `/api/v1/actions/:actionId/mappings`            | List action's mappings      |
| POST   | `/api/v1/actions/:actionId/mappings`            | Create mapping              |
| PATCH  | `/api/v1/actions/:actionId/mappings/:mappingId` | Update mapping              |
| DELETE | `/api/v1/actions/:actionId/mappings/:mappingId` | Delete mapping              |
| POST   | `/api/v1/actions/:actionId/mappings/preview`    | Preview mapping with sample |
| POST   | `/api/v1/actions/:actionId/mappings/bulk`       | Bulk create/update mappings |

### 3.5 Module Structure

```
src/lib/modules/execution/
├── mapping/
│   ├── index.ts                      # Module exports
│   ├── mapping.service.ts            # Main mapping orchestration
│   ├── mapping.repository.ts         # FieldMapping CRUD + caching
│   ├── mapping.schemas.ts            # Zod schemas
│   ├── mapper.ts                     # Core mapping engine
│   ├── coercion.ts                   # Type coercion (reuse from validation)
│   └── path-utils.ts                 # JSONPath parsing/evaluation
```

### 3.6 Caching Strategy

```typescript
// Mappings are cached in memory to avoid DB queries on every request

class MappingCache {
  private cache: Map<string, CachedMappings> = new Map();

  // Cache key: actionId
  // Cache value: { inputMappings, outputMappings, config, loadedAt }

  get(actionId: string): CachedMappings | undefined;
  set(actionId: string, mappings: CachedMappings): void;
  invalidate(actionId: string): void; // Called on mapping CRUD

  // TTL: 5 minutes (reload from DB periodically for multi-instance)
  // Immediate invalidation on CRUD operations
}
```

### 3.7 Pipeline Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXECUTION PIPELINE WITH MAPPING                           │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Receive    │───▶│   Apply      │───▶│   Validate   │                  │
│  │   Request    │    │   INPUT      │    │   Mapped     │                  │
│  │   Params     │    │   Mappings   │    │   Request    │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                 │                           │
│                                                 ▼                           │
│                                          ┌──────────────┐                  │
│                                          │   Execute    │                  │
│                                          │   External   │                  │
│                                          │   API Call   │                  │
│                                          └──────────────┘                  │
│                                                 │                           │
│                                                 ▼                           │
│                                          ┌──────────────┐                  │
│                                          │   Validate   │                  │
│                                          │   RAW API    │◄── Validate BEFORE│
│                                          │   Response   │    mapping        │
│                                          └──────────────┘                  │
│                                                 │                           │
│                                                 ▼                           │
│                                          ┌──────────────┐                  │
│                                          │   Apply      │                  │
│                                          │   OUTPUT     │◄── Map AFTER     │
│                                          │   Mappings   │    validation    │
│                                          └──────────────┘                  │
│                                                 │                           │
│                                                 ▼                           │
│                                          ┌──────────────┐                  │
│                                          │   Return     │                  │
│                                          │   Mapped     │                  │
│                                          │   Response   │                  │
│                                          └──────────────┘                  │
│                                                                              │
│  NOTE: Validation happens on RAW response, then mapping transforms it.      │
│  This ensures validation errors point to actual API issues, not mapping.    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.8 JSONPath Support

We'll support a subset of JSONPath for simplicity and reliability:

| Pattern             | Description      | Example                   |
| ------------------- | ---------------- | ------------------------- |
| `$.field`           | Root-level field | `$.email`                 |
| `$.nested.field`    | Nested field     | `$.user.contact.email`    |
| `$[0]`              | Array index      | `$.users[0]`              |
| `$[*]`              | All array items  | `$.users[*].email`        |
| `$.field[*].nested` | Nested in array  | `$.items[*].product.name` |

**Library choice:** Use `jsonpath-plus` (proven, well-maintained) or implement minimal subset ourselves for control.

**Limits:**

- Max nesting depth: 10 levels
- Max array items for `[*]` mapping: 5000 (hard limit, fail with clear error)

### 3.9 Coercion Rules

Safe, well-defined coercions only:

| From    | To      | Rule                                            | Failure Handling           |
| ------- | ------- | ----------------------------------------------- | -------------------------- |
| string  | number  | `parseFloat()`, must be valid number            | Keep original, log warning |
| string  | boolean | `"true"`→`true`, `"false"`→`false`, `"1"`/`"0"` | Keep original, log warning |
| number  | string  | `String(value)`                                 | Always succeeds            |
| number  | boolean | `0`→`false`, non-zero→`true`                    | Always succeeds            |
| boolean | string  | `"true"` or `"false"`                           | Always succeeds            |
| boolean | number  | `1` or `0`                                      | Always succeeds            |

**Key principle:** Coercion failures in passthrough mode keep the original value and report in metadata. Never silently corrupt data.

### 3.10 UI Configuration

#### Mapping Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ FIELD MAPPINGS                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ☑ Enable Field Mapping                                          │
│  ☑ Preserve unmapped fields                                      │
│  Failure Mode: (●) Passthrough (safe)  ( ) Fail (strict)         │
│                                                                  │
│  ─── Output Mappings (Response → Your App) ─────────────────     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ $.data.user_email    →    $.email           [⚙] [🗑]    │    │
│  │ coercion: none                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ $.data.count         →    $.totalCount      [⚙] [🗑]    │    │
│  │ coercion: string → number                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [ + Add Output Mapping ]                                        │
│                                                                  │
│  ─── Input Mappings (Your App → Request) ───────────────────     │
│                                                                  │
│  (No input mappings configured)                                  │
│                                                                  │
│  [ + Add Input Mapping ]                                         │
│                                                                  │
│  ─── Preview ───────────────────────────────────────────────     │
│                                                                  │
│  [ Test Mappings with Sample Data ]                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Mapping Editor Modal (Simplified for V0.5)

```
┌─────────────────────────────────────────────────────────────────┐
│ ADD FIELD MAPPING                                          [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Direction:  (●) Output (response)  ( ) Input (request)          │
│                                                                  │
│  Source Path:  [$.data.user_email     ]                         │
│                ⓘ JSONPath to field in API response               │
│                                                                  │
│  Target Path:  [$.email               ]                         │
│                ⓘ Path in your application's data shape           │
│                                                                  │
│  ─── Options ───────────────────────────────────────────────     │
│                                                                  │
│  Type Coercion:  [None ▼]                                        │
│                  None | String | Number | Boolean                │
│                                                                  │
│  ☐ Omit if source is null                                        │
│  ☐ Omit if source is empty string/array                          │
│                                                                  │
│  Default Value:  [                    ]  (optional)              │
│                                                                  │
│                              [ Cancel ]  [ Save Mapping ]        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Tasks

### Phase 1: Core Infrastructure (~2 hours)

| #   | Task                                                             | Est.   | Dependencies |
| --- | ---------------------------------------------------------------- | ------ | ------------ |
| 1.1 | Create mapping Zod schemas (`mapping.schemas.ts`)                | 30 min | None         |
| 1.2 | Create JSONPath utilities (`path-utils.ts`)                      | 45 min | None         |
| 1.3 | Create mapping repository with caching (`mapping.repository.ts`) | 30 min | 1.1          |
| 1.4 | Create type coercion utilities (reuse from validation)           | 15 min | None         |

### Phase 2: Mapping Engine (~2 hours)

| #   | Task                                          | Est.   | Dependencies |
| --- | --------------------------------------------- | ------ | ------------ |
| 2.1 | Create core mapper engine (`mapper.ts`)       | 60 min | 1.2, 1.4     |
| 2.2 | Implement fail-open passthrough mode          | 30 min | 2.1          |
| 2.3 | Create mapping service (`mapping.service.ts`) | 30 min | 2.1, 1.3     |

### Phase 3: Execution Integration (~2 hours)

| #   | Task                                               | Est.   | Dependencies |
| --- | -------------------------------------------------- | ------ | ------------ |
| 3.1 | Integrate input mapping into request pipeline      | 45 min | 2.3          |
| 3.2 | Integrate output mapping into response pipeline    | 45 min | 2.3          |
| 3.3 | Add mapping metadata to action invocation response | 20 min | 3.2          |
| 3.4 | Add per-request bypass option                      | 10 min | 3.2          |

### Phase 4: API Layer (~1.5 hours)

| #   | Task                                   | Est.   | Dependencies |
| --- | -------------------------------------- | ------ | ------------ |
| 4.1 | Create mapping CRUD endpoints          | 45 min | 2.3          |
| 4.2 | Create mapping preview endpoint        | 30 min | 2.3          |
| 4.3 | Add mapping config to action responses | 15 min | 4.1          |

### Phase 5: UI Components (~3 hours)

| #   | Task                                         | Est.   | Dependencies |
| --- | -------------------------------------------- | ------ | ------------ |
| 5.1 | Create MappingList component                 | 45 min | 4.1          |
| 5.2 | Create MappingEditor modal (simplified)      | 45 min | 5.1          |
| 5.3 | Create MappingPreview component              | 45 min | 4.2          |
| 5.4 | Integrate mapping panel into ActionEditor    | 30 min | 5.1-5.3      |
| 5.5 | Add mapping results display to action tester | 15 min | 3.3          |

### Total Estimated Time: ~10.5 hours

---

## 5. Test Plan

### 5.1 Unit Tests

**Path Handling:**

- [ ] JSONPath parser handles all supported patterns
- [ ] Mapper correctly extracts value at source path
- [ ] Mapper correctly sets value at target path
- [ ] Nested path extraction works for arbitrary depth (up to 10)
- [ ] Array wildcard `[*]` maps all items
- [ ] Array limit (5000) is enforced with clear error

**Coercion:**

- [ ] Type coercion: string → number works for valid numbers
- [ ] Type coercion: number → string works
- [ ] Type coercion: string → boolean works ("true"/"false"/"1"/"0")
- [ ] Type coercion: invalid input keeps original value in passthrough mode
- [ ] Type coercion: invalid input fails request in fail mode

**Failure Handling:**

- [ ] Passthrough mode returns original data on mapping error
- [ ] Passthrough mode includes error details in metadata
- [ ] Fail mode returns error response on mapping error
- [ ] Missing source path handles gracefully (default value or omit)

**Config:**

- [ ] Default value applied when source missing
- [ ] Omit if null/empty works correctly
- [ ] Multiple mappings applied in order
- [ ] Unmapped fields preserved when configured
- [ ] Unmapped fields omitted when configured (if preserveUnmapped: false)

### 5.2 Integration Tests

- [ ] Input mapping transforms request before sending to API
- [ ] Output mapping transforms response before returning
- [ ] Mapping integrates with pagination (each page mapped)
- [ ] Validation runs on RAW response, mapping runs after
- [ ] Mapping CRUD endpoints work correctly
- [ ] Cache invalidation works on mapping CRUD
- [ ] Preview endpoint returns correctly mapped sample
- [ ] Action invocation includes mapping metadata
- [ ] Per-request bypass (`mapping.bypass: true`) skips mapping

### 5.3 Manual Testing

- [ ] Test mapping UI in action editor
- [ ] Test mapping preview with sample data
- [ ] Test against real APIs with varying response shapes
- [ ] Verify mapping results in action tester
- [ ] Test passthrough mode with intentionally broken mapping
- [ ] Verify performance with large responses (>100KB)

---

## 6. Edge Cases & Error Handling

| Edge Case                          | Handling                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| Source path doesn't exist          | Apply default value if configured, else omit target      |
| Invalid JSONPath syntax            | Validation error on mapping save, clear message          |
| Coercion fails ("abc" → number)    | Passthrough: keep original + warning; Fail: error        |
| Array > 5000 items                 | Error with clear message, suggest pagination             |
| Very deep nesting (>10 levels)     | Error with clear message                                 |
| Conflicting mappings (same target) | Last mapping wins, log warning                           |
| Empty source/target path           | Validation error on save                                 |
| Mapping to root (`$`)              | Supported but logged as warning (replaces entire object) |
| Source is object, target primitive | Coercion fails, handled by failure mode                  |
| Circular reference (unlikely)      | Detect and error at save time                            |

---

## 7. Migration & Rollout

### 7.1 Default Behavior

For existing actions:

- `enabled`: false (no change to current behavior)
- Adding first mapping enables mapping automatically
- Default `failureMode`: 'passthrough' (safe)

### 7.2 Database

The `FieldMapping` table already exists. No schema changes required.

### 7.3 API Compatibility

- Actions without mappings continue to work unchanged
- Mapping is opt-in per action
- New `mapping` field in response is additive (non-breaking)
- New `mapping` option in request is optional (non-breaking)

---

## 8. Future Enhancements (Out of Scope for V0.5)

Deferred to V1 for reduced scope and risk:

- **String transforms** - Case conversion (upper/lower/camel/snake), trim, prefix/suffix
- **Date parsing** - Parse dates from various formats, output in ISO8601
- **Advanced array operations** - Filter, sort, aggregate, flatten nested arrays
- **Computed fields** - Create new fields from expressions
- **Conditional mapping** - Apply mapping based on field values
- **Mapping templates** - Reusable mapping configurations across actions
- **Tenant-level overrides** - Same action, different mappings per consuming app
- **JSONata/JMESPath** - More powerful query languages

---

## 9. Related Documentation

- [Product Spec - Basic Field Mapping](../product_spec.md#feature-basic-field-mapping)
- [Architecture - Execution Engine](../architecture.md#23-service-boundaries--responsibilities)
- [Action Registry Schema](./action-registry-schema.md)
- [Response Validation](./response-validation.md)

---

## 10. Revision History

| Date       | Author       | Changes                                                                 |
| ---------- | ------------ | ----------------------------------------------------------------------- |
| 2026-01-03 | AI Assistant | Initial feature specification                                           |
| 2026-01-03 | AI Assistant | Revised for reliability: fail-open mode, bypass, caching, reduced scope |
| 2026-01-03 | AI Assistant | Implementation complete: core engine, API endpoints, UI components      |
| 2026-01-04 | AI Assistant | 60 unit tests added covering path utils, coercion, mapper, schemas      |
