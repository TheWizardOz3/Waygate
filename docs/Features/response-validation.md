# Feature: Response Validation

**Status:** ✅ Complete  
**Milestone:** V0.5 (Polish & Robustness)  
**Priority:** P1  
**Complexity:** Medium  
**Dependencies:** Action Registry ✅, Pagination Handler ✅  
**Started:** 2026-01-03  
**Completed:** 2026-01-03

---

## 1. Overview

### 1.1 User Story

> As a developer, I want API responses to be validated against expected schemas, so that malformed data doesn't crash my applications and I'm alerted to API changes before they cause problems.

### 1.2 Problem Statement

External APIs can return unexpected data at any time:

1. **Missing fields** - Required fields silently become null or omitted
2. **Type changes** - A field that was a string becomes a number, or vice versa
3. **Schema drift** - APIs evolve, adding new fields or deprecating old ones
4. **Null contamination** - Unexpected nulls propagate through consuming apps
5. **Malformed responses** - Errors, HTML error pages, or completely wrong shapes

Currently, Waygate passes through API responses without validation, meaning consuming apps (including LLM-powered ones) receive potentially invalid data that can cause:

- Runtime crashes from type mismatches
- Silent data corruption from missing fields
- Difficult-to-debug issues when LLMs receive unexpected schemas
- No visibility into when external APIs change

### 1.3 Solution Summary

Implement a Response Validation layer that:

1. **Validates** all responses against action output schemas using Zod
2. **Configurable modes** - strict (fail on any mismatch), warn (log but pass through), lenient (coerce when possible)
3. **Handles nulls gracefully** - Configurable null handling (reject, coerce to default, pass through)
4. **Preserves or strips extra fields** - Configurable handling of unexpected fields
5. **Reports validation issues** - Clear, structured validation error reports
6. **Detects schema drift** - Track validation failures over time to distinguish systematic issues from one-offs
7. **LLM-friendly errors** - Validation errors are structured for easy LLM consumption

### 1.4 Design Philosophy: Trust But Verify

External APIs are a trust boundary. Waygate should:

- **Never blindly trust** external API responses
- **Fail fast in strict mode** to prevent bad data from propagating
- **Degrade gracefully** in lenient mode for resilience
- **Provide visibility** into what's happening with validation metrics
- **Help LLMs** by providing clean, typed data they can rely on

---

## 2. Requirements

### 2.1 Functional Requirements

| ID    | Requirement                                               | Priority |
| ----- | --------------------------------------------------------- | -------- |
| FR-1  | Validate responses against action's output schema (Zod)   | P0       |
| FR-2  | Configurable validation modes: strict, warn, lenient      | P0       |
| FR-3  | Handle unexpected null values (reject/default/pass)       | P0       |
| FR-4  | Handle extra fields (strip/preserve/error)                | P0       |
| FR-5  | Detect and report type mismatches                         | P0       |
| FR-6  | Generate structured validation error reports              | P0       |
| FR-7  | Support schema evolution (ignore new optional fields)     | P1       |
| FR-8  | Track validation failures for drift detection             | P1       |
| FR-9  | Alert on systematic validation failures (drift threshold) | P1       |
| FR-10 | Per-action validation configuration in UI                 | P0       |
| FR-11 | Validation bypass option for debugging                    | P2       |
| FR-12 | Coercion in lenient mode (string→number, etc.)            | P1       |

### 2.2 Non-Functional Requirements

| ID    | Requirement              | Target                                     |
| ----- | ------------------------ | ------------------------------------------ |
| NFR-1 | Validation overhead      | < 10ms for responses up to 100KB           |
| NFR-2 | Schema compilation       | Cached compiled validators                 |
| NFR-3 | Memory efficiency        | Streaming validation for large responses   |
| NFR-4 | Drift detection accuracy | 5+ failures in 1 hour triggers drift alert |

### 2.3 Acceptance Criteria

1. **AC-1:** Given a response missing a required field, when in strict mode, then validation error is returned with field name and expected type
2. **AC-2:** Given a response missing a required field, when in warn mode, then warning is logged and response passes through
3. **AC-3:** Given a response missing a required field, when in lenient mode, then field is set to default value if configured
4. **AC-4:** Given a response with extra fields, when configured to preserve, then fields are included in output
5. **AC-5:** Given a response with extra fields, when configured to strip, then fields are removed from output
6. **AC-6:** Given a type mismatch, then clear error message identifies the field path and expected vs actual type
7. **AC-7:** Given 5+ validation failures for the same action within 1 hour, then schema drift alert is triggered
8. **AC-8:** Given lenient mode with coercion enabled, string "123" is coerced to number 123 when schema expects number
9. **AC-9:** UI allows configuring validation mode, null handling, and extra field handling per action
10. **AC-10:** Validation errors include `suggestedResolution` for LLM consumption

---

## 3. Technical Design

### 3.1 Data Model Changes

#### Action Schema Extension

Add validation configuration to the Action model:

```typescript
// In Prisma schema - action.validationConfig (new JSONB column or extend metadata)
interface ValidationConfig {
  enabled: boolean;

  // Validation mode
  mode: 'strict' | 'warn' | 'lenient';

  // Null handling
  nullHandling: 'reject' | 'default' | 'pass';

  // Extra fields handling
  extraFields: 'strip' | 'preserve' | 'error';

  // Coercion settings (for lenient mode)
  coercion: {
    stringToNumber: boolean; // "123" → 123
    numberToString: boolean; // 123 → "123"
    stringToBoolean: boolean; // "true"/"false" → true/false
    emptyStringToNull: boolean; // "" → null
    nullToDefault: boolean; // null → schema default
  };

  // Schema drift detection
  driftDetection: {
    enabled: boolean;
    windowMinutes: number; // Default: 60
    failureThreshold: number; // Default: 5
    alertOnDrift: boolean; // Default: true
  };

  // Bypass (debugging only)
  bypassValidation: boolean;
}
```

#### Validation Result Schema

```typescript
interface ValidationResult {
  valid: boolean;
  mode: 'strict' | 'warn' | 'lenient';

  // Validated/transformed data (if valid or lenient mode)
  data?: unknown;

  // Validation issues (present even in warn mode)
  issues?: ValidationIssue[];

  // Metadata
  meta: {
    validationDurationMs: number;
    fieldsValidated: number;
    fieldsCoerced: number;
    fieldsStripped: number;
    fieldsDefaulted: number;
  };
}

interface ValidationIssue {
  path: string; // JSONPath to field (e.g., "$.data[0].email")
  code: ValidationIssueCode; // Standardized error code
  message: string; // Human-readable message
  expected?: string; // Expected type/value
  received?: string; // Actual type/value
  severity: 'error' | 'warning'; // Based on mode

  // LLM-friendly resolution
  suggestedResolution?: {
    action: 'IGNORE' | 'USE_DEFAULT' | 'CONTACT_PROVIDER' | 'UPDATE_SCHEMA';
    description: string;
  };
}

type ValidationIssueCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'TYPE_MISMATCH'
  | 'INVALID_FORMAT'
  | 'UNEXPECTED_NULL'
  | 'UNKNOWN_FIELD'
  | 'VALUE_OUT_OF_RANGE'
  | 'INVALID_ENUM_VALUE'
  | 'ARRAY_TOO_SHORT'
  | 'ARRAY_TOO_LONG'
  | 'STRING_TOO_SHORT'
  | 'STRING_TOO_LONG'
  | 'COERCION_FAILED';
```

#### Schema Drift Tracking Table

```sql
-- New table for tracking validation failures (drift detection)
CREATE TABLE validation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Failure details
  issue_code VARCHAR(50) NOT NULL,
  field_path VARCHAR(255) NOT NULL,
  expected_type VARCHAR(50),
  received_type VARCHAR(50),

  -- Aggregation for drift detection
  failure_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Drift alert status
  drift_alert_sent BOOLEAN DEFAULT false,
  drift_alert_sent_at TIMESTAMPTZ,

  UNIQUE(action_id, issue_code, field_path)
);

CREATE INDEX idx_validation_failures_action ON validation_failures(action_id);
CREATE INDEX idx_validation_failures_tenant ON validation_failures(tenant_id);
CREATE INDEX idx_validation_failures_last_seen ON validation_failures(last_seen_at);
```

### 3.2 Zod Schemas

```typescript
// src/lib/modules/execution/validation/validation.schemas.ts

export const validationModeSchema = z.enum(['strict', 'warn', 'lenient']);

export const nullHandlingSchema = z.enum(['reject', 'default', 'pass']);

export const extraFieldsHandlingSchema = z.enum(['strip', 'preserve', 'error']);

export const coercionConfigSchema = z.object({
  stringToNumber: z.boolean().default(true),
  numberToString: z.boolean().default(true),
  stringToBoolean: z.boolean().default(true),
  emptyStringToNull: z.boolean().default(false),
  nullToDefault: z.boolean().default(true),
});

export const driftDetectionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  windowMinutes: z.number().int().min(5).max(1440).default(60),
  failureThreshold: z.number().int().min(1).max(100).default(5),
  alertOnDrift: z.boolean().default(true),
});

export const validationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: validationModeSchema.default('warn'),
  nullHandling: nullHandlingSchema.default('pass'),
  extraFields: extraFieldsHandlingSchema.default('preserve'),
  coercion: coercionConfigSchema.default({}),
  driftDetection: driftDetectionConfigSchema.default({}),
  bypassValidation: z.boolean().default(false),
});

// Request-level overrides
export const validationRequestSchema = z.object({
  mode: validationModeSchema.optional(),
  bypassValidation: z.boolean().optional(),
});
```

### 3.3 API Changes

#### Action Invocation Request Extension

```typescript
// POST /api/v1/actions/:integration/:action
interface ActionInvocationRequest {
  // Existing fields...
  input: Record<string, unknown>;
  pagination?: PaginationOptions;

  // New validation options
  validation?: {
    mode?: 'strict' | 'warn' | 'lenient'; // Override action default
    bypassValidation?: boolean; // Skip validation (debug only)
  };
}
```

#### Action Response Extension

```typescript
interface ActionInvocationResponse {
  success: boolean;
  data: unknown;

  // Existing pagination metadata...
  pagination?: PaginationMetadata;

  // New validation metadata (always present when validation enabled)
  validation?: {
    valid: boolean;
    mode: 'strict' | 'warn' | 'lenient';

    // Issue summary
    issueCount: number;
    issues?: ValidationIssue[]; // Included if issues exist

    // Transformation summary
    fieldsCoerced: number;
    fieldsStripped: number;
    fieldsDefaulted: number;

    // Timing
    validationDurationMs: number;

    // Drift status (if detection enabled)
    driftStatus?: 'normal' | 'warning' | 'alert';
    driftMessage?: string;
  };

  meta: { requestId: string; timestamp: string };
}
```

#### Example Response with Validation Metadata

```json
{
  "success": true,
  "data": {
    "users": [{ "id": "123", "email": "user@example.com", "name": "John" }]
  },
  "validation": {
    "valid": true,
    "mode": "warn",
    "issueCount": 1,
    "issues": [
      {
        "path": "$.users[0].age",
        "code": "TYPE_MISMATCH",
        "message": "Expected number, received string",
        "expected": "number",
        "received": "string",
        "severity": "warning",
        "suggestedResolution": {
          "action": "UPDATE_SCHEMA",
          "description": "The 'age' field appears to now return strings. Consider updating the output schema."
        }
      }
    ],
    "fieldsCoerced": 1,
    "fieldsStripped": 0,
    "fieldsDefaulted": 0,
    "validationDurationMs": 3,
    "driftStatus": "normal"
  },
  "meta": { "requestId": "req_xxx", "timestamp": "2026-01-03T..." }
}
```

### 3.4 Module Structure

```
src/lib/modules/execution/
├── validation/
│   ├── index.ts                      # Module exports
│   ├── validation.service.ts         # Main validation orchestration
│   ├── validation.schemas.ts         # Zod schemas for validation config
│   ├── validators/
│   │   ├── zod-validator.ts          # Zod-based validation with mode support
│   │   └── coercion.ts               # Type coercion utilities
│   ├── drift/
│   │   ├── drift.service.ts          # Schema drift detection logic
│   │   └── drift.repository.ts       # Drift tracking persistence
│   └── reporter.ts                   # Validation issue reporting
```

### 3.5 Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION FLOW                                      │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Receive    │───▶│   Check      │───▶│   Validate   │                  │
│  │   Response   │    │   Config     │    │   Against    │                  │
│  │   from API   │    │   Bypass?    │    │   Schema     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                             │                    │                          │
│                             │ bypass=true        │                          │
│                             ▼                    ▼                          │
│                      ┌──────────────┐    ┌──────────────┐                  │
│                      │   Return     │    │   Issues     │                  │
│                      │   Raw Data   │    │   Found?     │                  │
│                      └──────────────┘    └──────────────┘                  │
│                                                  │                          │
│                          ┌───────────────────────┼───────────────────────┐  │
│                          │                       │                       │  │
│                          ▼ No Issues             ▼ Has Issues            │  │
│                   ┌──────────────┐        ┌──────────────┐               │  │
│                   │   Return     │        │   Check      │               │  │
│                   │   Valid Data │        │   Mode       │               │  │
│                   └──────────────┘        └──────────────┘               │  │
│                                                  │                       │  │
│                          ┌───────────────────────┼───────────────────────┘  │
│                          │                       │                          │
│                          ▼ strict                ▼ warn                     │
│                   ┌──────────────┐        ┌──────────────┐                  │
│                   │   Return     │        │   Log Issue  │                  │
│                   │   Error      │        │   Return     │                  │
│                   │   Response   │        │   Data +     │                  │
│                   └──────────────┘        │   Warnings   │                  │
│                                           └──────────────┘                  │
│                          │                       │                          │
│                          │                       ▼ lenient                  │
│                          │                ┌──────────────┐                  │
│                          │                │   Coerce/    │                  │
│                          │                │   Default    │                  │
│                          │                │   Return     │                  │
│                          │                │   Fixed Data │                  │
│                          │                └──────────────┘                  │
│                          │                       │                          │
│                          └───────────────────────┼──────────────────────────│
│                                                  │                          │
│                                                  ▼                          │
│                                          ┌──────────────┐                  │
│                                          │   Track for  │                  │
│                                          │   Drift      │                  │
│                                          │   Detection  │                  │
│                                          └──────────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 UI Configuration

#### Validation Settings Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ RESPONSE VALIDATION                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ☑ Enable Validation                                             │
│                                                                  │
│  ─── Validation Mode ─────────────────────────────────────────   │
│                                                                  │
│  ( ) Strict   - Fail on any schema mismatch                      │
│  (●) Warn     - Log mismatches, pass data through                │
│  ( ) Lenient  - Coerce types, use defaults for missing fields    │
│                                                                  │
│  ─── Field Handling ──────────────────────────────────────────   │
│                                                                  │
│  Unexpected nulls:  [Pass through ▼]                             │
│                     ⓘ How to handle null values in required      │
│                       fields: Reject | Use default | Pass        │
│                                                                  │
│  Extra fields:      [Preserve      ▼]                            │
│                     ⓘ Fields not in schema: Strip | Preserve     │
│                                                                  │
│  ─── Type Coercion (Lenient mode only) ───────────────────────   │
│                                                                  │
│  ☑ String → Number     ("123" → 123)                             │
│  ☑ Number → String     (123 → "123")                             │
│  ☑ String → Boolean    ("true" → true)                           │
│  ☐ Empty string → Null ("" → null)                               │
│                                                                  │
│  ─── Drift Detection ─────────────────────────────────────────   │
│                                                                  │
│  ☑ Enable drift detection                                        │
│  Alert after: [5    ] failures within [60   ] minutes            │
│                                                                  │
│  [ Test Validation ] [ Reset Drift Tracking ]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Mode Presets

| Preset         | Mode    | Null Handling | Extra Fields | Use Case                        |
| -------------- | ------- | ------------- | ------------ | ------------------------------- |
| **Production** | strict  | reject        | strip        | Mission-critical data pipelines |
| **Resilient**  | warn    | pass          | preserve     | General use, monitoring enabled |
| **Flexible**   | lenient | default       | preserve     | Exploratory, prototyping        |

### 3.7 Mode Selection Guide

#### When to Use Each Mode

| Mode        | Choose When...                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| **Strict**  | Data integrity is critical (financial, auth, user records); you need to fail fast; development/testing |
| **Warn**    | Production with monitoring; API is generally reliable but you want visibility; general use             |
| **Lenient** | Prototyping; API is poorly documented; LLM consumption where minor type diffs don't matter             |

#### Decision Framework by Use Case

| Use Case                    | Recommended Mode | Rationale                                    |
| --------------------------- | ---------------- | -------------------------------------------- |
| Payment/financial data      | Strict           | Bad data = money problems                    |
| User authentication/profile | Strict           | Security-sensitive data must be correct      |
| Analytics/metrics           | Warn             | Partial data is better than no data          |
| Social media feeds          | Warn → Lenient   | High variance expected, resilience matters   |
| AI/LLM consumption          | Warn             | LLMs handle variance; visibility into issues |
| New integration setup       | Lenient          | Discover actual schema shape first           |
| Established integration     | Strict or Warn   | Once stable, tighten validation              |

#### Progressive Tightening Pattern (Recommended Workflow)

For new integrations, we recommend this progression:

```
1. LENIENT MODE (Setup Phase)
   └── Use during initial integration setup
   └── Observe actual response shapes
   └── Refine output schema based on real data
              │
              ▼
2. WARN MODE (Stabilization Phase)
   └── Switch once schema is defined
   └── Run for a few days in production
   └── Monitor validation metadata for issues
   └── Investigate any drift alerts
              │
              ▼
3. STRICT MODE (Production Phase)
   └── Switch for critical data flows
   └── Fail fast on any schema deviation
   └── Ensures consuming apps get guaranteed shapes
```

#### AI-Assisted Mode Suggestion (Future Enhancement)

The action generator could auto-suggest validation modes based on:

- **API category detection** — Payment/auth APIs → suggest strict; Social APIs → suggest warn
- **Schema precision** — Detailed output schema → suggest strict; Loose schema → suggest lenient
- **Data sensitivity keywords** — "payment", "credential", "balance", "password" → suggest strict
- **Historical stability** — If drift detection shows frequent issues → suggest warn over strict

> **Note:** This AI suggestion feature is tracked as a future enhancement (Phase 6.2).

---

## 4. Implementation Tasks

> ✅ **All tasks completed on 2026-01-03**

### Phase 1: Core Validation Infrastructure ✅

| #   | Task                                                              | Status |
| --- | ----------------------------------------------------------------- | ------ |
| 1.1 | Create validation Zod schemas (`validation.schemas.ts`)           | ✅     |
| 1.2 | Add `validationConfig` field to Action model (Prisma migration)   | ✅     |
| 1.3 | Create Zod-based validator with mode support (`zod-validator.ts`) | ✅     |
| 1.4 | Implement type coercion utilities (`coercion.ts`)                 | ✅     |
| 1.5 | Create validation issue reporter (`reporter.ts`)                  | ✅     |

### Phase 2: Validation Service ✅

| #   | Task                                                       | Status |
| --- | ---------------------------------------------------------- | ------ |
| 2.1 | Create main validation service (`validation.service.ts`)   | ✅     |
| 2.2 | Integrate validation into execution pipeline               | ✅     |
| 2.3 | Add validation metadata to action response                 | ✅     |
| 2.4 | Handle validation in different modes (strict/warn/lenient) | ✅     |

### Phase 3: Drift Detection ✅

| #   | Task                                                   | Status |
| --- | ------------------------------------------------------ | ------ |
| 3.1 | Create validation_failures table (Prisma migration)    | ✅     |
| 3.2 | Create drift repository (`drift.repository.ts`)        | ✅     |
| 3.3 | Implement drift detection service (`drift.service.ts`) | ✅     |
| 3.4 | Add drift status to validation response                | ✅     |
| 3.5 | Implement drift alert logic (log-based for MVP)        | ✅     |

### Phase 4: API Layer ✅

| #   | Task                                                        | Status |
| --- | ----------------------------------------------------------- | ------ |
| 4.1 | Update action invocation endpoint to accept validation opts | ✅     |
| 4.2 | Add validation bypass option for debugging                  | ✅     |
| 4.3 | Update action CRUD endpoints for validationConfig           | ✅     |
| 4.4 | Add validation metrics to logs                              | ✅     |

### Phase 5: UI Components ✅

| #   | Task                                                      | Status |
| --- | --------------------------------------------------------- | ------ |
| 5.1 | Create validation config panel for action editor          | ✅     |
| 5.2 | Add mode selector (strict/warn/lenient) with descriptions | ✅     |
| 5.3 | Add coercion toggles (lenient mode section)               | ✅     |
| 5.4 | Add drift detection config section                        | ✅     |
| 5.5 | Display validation results in action tester               | ✅     |
| 5.6 | Add drift status indicator to action list                 | ✅     |

### Phase 6: AI Enhancement ✅

| #   | Task                                                             | Status |
| --- | ---------------------------------------------------------------- | ------ |
| 6.1 | Update action generator to set sensible validation defaults      | ✅     |
| 6.2 | Enhance AI prompts to infer stricter schemas when docs are clear | ✅     |

---

## 5. Test Plan

### 5.1 Unit Tests

- [ ] Zod validator correctly validates against various schema types
- [ ] Strict mode returns error on first validation failure
- [ ] Warn mode logs issues but returns data
- [ ] Lenient mode coerces types when possible
- [ ] Coercion: string to number works ("123" → 123)
- [ ] Coercion: number to string works (123 → "123")
- [ ] Coercion: string to boolean works ("true" → true, "false" → false)
- [ ] Coercion fails gracefully for invalid values ("abc" → number)
- [ ] Null handling: reject mode fails on unexpected null
- [ ] Null handling: default mode applies schema default
- [ ] Null handling: pass mode preserves null
- [ ] Extra fields: strip mode removes unknown fields
- [ ] Extra fields: preserve mode keeps unknown fields
- [ ] Extra fields: error mode fails on unknown fields
- [ ] Validation issue reporter generates correct error codes
- [ ] Issue paths use JSONPath notation correctly
- [ ] suggestedResolution is populated appropriately

### 5.2 Integration Tests

- [ ] Full validation flow with real API response shapes
- [ ] Validation integrates correctly with execution pipeline
- [ ] Pagination + validation work together
- [ ] Request-level validation overrides work
- [ ] Bypass validation option skips validation
- [ ] Drift detection records failures correctly
- [ ] Drift alert triggers after threshold reached
- [ ] Validation config persists via action CRUD
- [ ] Validation metadata included in response

### 5.3 Manual Testing

- [ ] Test against real APIs with varying response shapes
- [ ] Test UI validation config panel
- [ ] Test mode switching in action editor
- [ ] Test validation results display in action tester
- [ ] Verify drift indicator appears after repeated failures
- [ ] Test preset buttons apply correct values

---

## 6. Edge Cases & Error Handling

| Edge Case                              | Handling                                             |
| -------------------------------------- | ---------------------------------------------------- |
| No output schema defined               | Skip validation, log warning                         |
| Empty response body                    | Validate as empty object/array per schema            |
| Non-JSON response                      | Fail validation with INVALID_FORMAT                  |
| Very large response (>1MB)             | Stream validation, limit depth                       |
| Nested arrays with mixed types         | Validate each element, collect all issues            |
| Circular references in response        | Detect and fail with CIRCULAR_REFERENCE              |
| Schema uses `z.any()` or `z.unknown()` | Skip validation for those fields                     |
| Coercion fails (e.g., "abc" to number) | Report issue, use null in lenient mode               |
| API returns HTML error page            | Detect non-JSON, fail with clear error               |
| Drift threshold reached                | Log alert, set driftStatus to 'alert'                |
| Multiple issues in same field          | Report all issues for that path                      |
| Validation timeout (>5s)               | Abort validation, return partial result with warning |

---

## 7. Migration & Rollout

### 7.1 Default Behavior

For existing actions without `validationConfig`:

- `enabled`: true
- `mode`: 'warn' (non-breaking - logs issues but passes data)
- `extraFields`: 'preserve' (non-breaking - doesn't strip data)
- `nullHandling`: 'pass' (non-breaking)

This ensures existing integrations continue working while gaining visibility.

### 7.2 Schema Requirements

Response validation requires actions to have an `outputSchema` defined. Actions generated by AI already have output schemas. For manually created actions without output schemas, validation will be skipped with a warning.

---

## 8. Future Enhancements (Out of Scope)

- **AI-assisted mode suggestion**: Auto-suggest validation mode based on API category, data sensitivity, and schema precision
- **Schema diff viewer**: Visual diff when API schema drifts
- **Auto-schema update**: Suggest schema updates based on observed responses
- **Validation metrics dashboard**: Aggregated validation stats across all actions
- **Custom validators**: User-defined validation rules beyond Zod
- **Response transformation**: Transform responses to match expected schema

---

## 9. Related Documentation

- [Product Spec - Response Validation](../product_spec.md#feature-response-validation)
- [Architecture - Execution Engine](../architecture.md#23-service-boundaries--responsibilities)
- [Action Registry Schema](./action-registry-schema.md)
- [Pagination Handler](./pagination-handler.md)

---

## 10. Revision History

| Date       | Author       | Changes                       |
| ---------- | ------------ | ----------------------------- |
| 2026-01-03 | AI Assistant | Initial feature specification |
