# Feature: Pagination Handler

**Status:** ✅ Complete  
**Milestone:** V0.5 (Polish & Robustness)  
**Priority:** P1  
**Complexity:** Medium  
**Dependencies:** Action Registry ✅  
**Completed:** 2026-01-03

---

## 1. Overview

### 1.1 User Story

> As a developer, I want Waygate to handle API pagination transparently, so that I can retrieve complete datasets without managing pagination logic.

### 1.2 Problem Statement

Many APIs return paginated responses, requiring multiple requests to retrieve complete datasets. Currently, consuming apps must:

1. Understand each API's pagination strategy (cursor, offset, page number, Link header)
2. Extract pagination tokens from responses
3. Make multiple requests while handling rate limits
4. Aggregate results and detect when pagination is complete
5. Handle edge cases like circular pagination or inconsistent page sizes

This is repetitive, error-prone work that Waygate should handle automatically.

### 1.3 Solution Summary

Implement a Pagination Handler that:

1. **Detects** pagination patterns in API responses (auto-detection + manual configuration)
2. **Fetches** multiple pages automatically with smart, configurable limits
3. **Aggregates** results into a single response
4. **Respects** LLM-friendly limits (characters/tokens) alongside traditional limits (pages/items)
5. **Provides** safe defaults that prevent runaway fetches while remaining useful
6. **Exposes** full configurability in the UI with per-action defaults

### 1.4 Design Philosophy: LLM-First Safety

Since Waygate is designed for AI/LLM use cases, pagination limits should be **token-aware**:

- **Traditional limits** (maxPages, maxItems) are useful but don't account for response size
- **LLM-friendly limits** (maxCharacters, ~tokens) directly map to context window constraints
- **Conservative defaults** prevent accidental massive fetches that timeout, OOM, or blow through rate limits
- **Clear truncation signals** help consuming apps (and LLMs) understand when data is incomplete

---

## 2. Requirements

### 2.1 Functional Requirements

| ID    | Requirement                                          | Priority |
| ----- | ---------------------------------------------------- | -------- |
| FR-1  | Support cursor-based pagination                      | P0       |
| FR-2  | Support offset/limit pagination                      | P0       |
| FR-3  | Support page number pagination                       | P0       |
| FR-4  | Support Link header pagination (RFC 5988)            | P1       |
| FR-5  | Auto-detect pagination strategy from response        | P1       |
| FR-6  | Configurable max pages limit (safety guard)          | P0       |
| FR-7  | Configurable max items limit (safety guard)          | P0       |
| FR-8  | **Configurable max characters limit (LLM-friendly)** | P0       |
| FR-9  | **Estimated token count in response metadata**       | P1       |
| FR-10 | Option to stream pages vs. aggregate all results     | P2       |
| FR-11 | Respect rate limits during pagination                | P0       |
| FR-12 | Detect infinite loop (circular pagination)           | P0       |
| FR-13 | **UI configuration panel with sensible defaults**    | P0       |
| FR-14 | **Request-level limit overrides**                    | P0       |

### 2.2 Non-Functional Requirements

| ID    | Requirement          | Target                                         |
| ----- | -------------------- | ---------------------------------------------- |
| NFR-1 | Pagination overhead  | < 50ms per page (excluding external API time)  |
| NFR-2 | Memory efficiency    | Stream pages for > 100 items                   |
| NFR-3 | Max concurrent pages | 1 (sequential fetching to respect rate limits) |

### 2.3 Acceptance Criteria

1. **AC-1:** Given an action that returns paginated data, when invoked with `fetchAll: true`, pages are fetched until a limit is reached
2. **AC-2:** Given pagination with cursor, when iterating, then cursor is automatically extracted and used for next request
3. **AC-3:** Given max items limit reached, then iteration stops and returns partial results with continuation token
4. **AC-4:** Given max characters limit reached, then iteration stops and returns partial results with truncation flag
5. **AC-5:** Given an API with Link headers, when paginating, then next page URL is extracted from headers
6. **AC-6:** Given a circular pagination bug (same cursor returned), when detected, then pagination stops with error
7. **AC-7:** Given no explicit limits, then safe defaults are applied (5 pages, 500 items, 100K characters)
8. **AC-8:** Response metadata includes `estimatedTokens` based on character count (~4 chars/token)
9. **AC-9:** UI allows configuring pagination limits per action with clear defaults shown

---

## 3. Technical Design

### 3.1 Data Model Changes

#### Action Schema Extension

Add pagination configuration to the Action model:

```typescript
// In Prisma schema - action.paginationConfig (existing JSONB column)
interface PaginationConfig {
  enabled: boolean;
  strategy: 'cursor' | 'offset' | 'page_number' | 'link_header' | 'auto';

  // Cursor-based
  cursorParam?: string; // Request param name (e.g., "cursor", "after")
  cursorPath?: string; // JSONPath to cursor in response (e.g., "$.meta.next_cursor")

  // Offset/Limit based
  offsetParam?: string; // Request param name (e.g., "offset", "skip")
  limitParam?: string; // Request param name (e.g., "limit", "take")
  totalPath?: string; // JSONPath to total count (e.g., "$.meta.total")

  // Page number based
  pageParam?: string; // Request param name (e.g., "page", "pageNumber")
  totalPagesPath?: string; // JSONPath to total pages (e.g., "$.meta.totalPages")

  // Common
  dataPath?: string; // JSONPath to data array (e.g., "$.data", "$.results")
  hasMorePath?: string; // JSONPath to hasMore boolean (e.g., "$.meta.hasMore")

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFETY LIMITS (all enforced - first limit reached stops pagination)
  // ═══════════════════════════════════════════════════════════════════════════

  // Traditional limits
  maxPages?: number; // Default: 5 (conservative)
  maxItems?: number; // Default: 500 (conservative)
  defaultPageSize?: number; // Default: 100

  // LLM-friendly limits (PRIMARY for AI use cases)
  maxCharacters?: number; // Default: 100,000 (~25K tokens)
  // Token estimation: ~4 characters per token (GPT-style approximation)
  // 100K chars ≈ 25K tokens, fits comfortably in most context windows

  // Time/resource limits
  maxDurationMs?: number; // Default: 30,000 (30 seconds total pagination time)
}
```

#### Why These Defaults?

| Limit           | Default | Rationale                                                   |
| --------------- | ------- | ----------------------------------------------------------- |
| `maxPages`      | 5       | Prevents runaway fetches; most use cases need 1-3 pages     |
| `maxItems`      | 500     | Reasonable dataset size; can be increased per-action        |
| `maxCharacters` | 100,000 | ~25K tokens - fits in GPT-4's context with room for prompts |
| `maxDurationMs` | 30,000  | 30 seconds prevents timeout on Vercel (60s limit)           |

**Important:** All limits are enforced simultaneously. Pagination stops when **any** limit is reached.

#### Zod Schema for Pagination Config

```typescript
// src/lib/modules/execution/pagination/pagination.schemas.ts
export const paginationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  strategy: z.enum(['cursor', 'offset', 'page_number', 'link_header', 'auto']).default('auto'),

  // Cursor-based
  cursorParam: z.string().optional(),
  cursorPath: z.string().optional(),

  // Offset/Limit based
  offsetParam: z.string().optional(),
  limitParam: z.string().optional(),
  totalPath: z.string().optional(),

  // Page number based
  pageParam: z.string().optional(),
  totalPagesPath: z.string().optional(),

  // Common
  dataPath: z.string().optional(),
  hasMorePath: z.string().optional(),

  // Safety limits (conservative defaults)
  maxPages: z.number().int().min(1).max(100).default(5),
  maxItems: z.number().int().min(1).max(10000).default(500),
  defaultPageSize: z.number().int().min(1).max(500).default(100),

  // LLM-friendly limits
  maxCharacters: z.number().int().min(1000).max(1_000_000).default(100_000),
  maxDurationMs: z.number().int().min(1000).max(300_000).default(30_000),
});

// Request-level overrides (can increase OR decrease action defaults)
export const paginationRequestSchema = z.object({
  fetchAll: z.boolean().default(false),
  maxPages: z.number().int().min(1).max(100).optional(),
  maxItems: z.number().int().min(1).max(10000).optional(),
  maxCharacters: z.number().int().min(1000).max(1_000_000).optional(),
  maxDurationMs: z.number().int().min(1000).max(300_000).optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
  continuationToken: z.string().optional(),
});
```

### 3.2 API Changes

#### Action Invocation Request Extension

```typescript
// POST /api/v1/actions/:integration/:action
interface ActionInvocationRequest {
  // Existing fields...
  input: Record<string, unknown>;

  // New pagination options (all optional - action defaults apply)
  pagination?: {
    fetchAll?: boolean; // Default: false - fetch single page only

    // Override action's default limits (can increase OR decrease)
    maxPages?: number; // Override maxPages
    maxItems?: number; // Override maxItems
    maxCharacters?: number; // Override maxCharacters (LLM-friendly)
    maxDurationMs?: number; // Override timeout

    pageSize?: number; // Override default page size
    continuationToken?: string; // Resume from previous partial fetch
  };
}
```

#### Action Response Extension

```typescript
interface ActionInvocationResponse {
  success: boolean;
  data: unknown;

  // New pagination metadata (always present when pagination enabled)
  pagination?: {
    // What was fetched
    fetchedItems: number;
    pagesFetched: number;
    totalItems?: number; // If API provides total count

    // LLM-friendly metrics
    fetchedCharacters: number; // Total characters in aggregated response
    estimatedTokens: number; // ~fetchedCharacters / 4 (GPT-style estimate)

    // Continuation info
    hasMore: boolean; // True if more data exists
    truncated: boolean; // True if stopped due to ANY limit
    truncationReason?: 'maxPages' | 'maxItems' | 'maxCharacters' | 'maxDuration' | 'error';
    continuationToken?: string; // For resuming if truncated

    // Timing
    durationMs: number; // Total pagination time
  };

  meta: { requestId: string; timestamp: string };
}
```

#### Example Response with Pagination Metadata

```json
{
  "success": true,
  "data": [
    /* aggregated items */
  ],
  "pagination": {
    "fetchedItems": 487,
    "pagesFetched": 5,
    "totalItems": 2341,
    "fetchedCharacters": 98234,
    "estimatedTokens": 24558,
    "hasMore": true,
    "truncated": true,
    "truncationReason": "maxPages",
    "continuationToken": "eyJjdXJzb3IiOiJhYmMxMjMifQ==",
    "durationMs": 4521
  },
  "meta": { "requestId": "req_xxx", "timestamp": "2026-01-03T..." }
}
```

This response tells an LLM-powered app: "You got ~25K tokens of data, there's more available, and here's how to continue if needed."

### 3.3 Module Structure

```
src/lib/modules/execution/
├── pagination/
│   ├── index.ts                     # Module exports
│   ├── pagination.service.ts        # Main pagination orchestration
│   ├── pagination.schemas.ts        # Zod schemas for pagination config
│   ├── strategies/
│   │   ├── base.strategy.ts         # Abstract base class
│   │   ├── cursor.strategy.ts       # Cursor-based pagination
│   │   ├── offset.strategy.ts       # Offset/limit pagination
│   │   ├── page-number.strategy.ts  # Page number pagination
│   │   └── link-header.strategy.ts  # RFC 5988 Link header pagination
│   ├── detector.ts                  # Auto-detect pagination strategy
│   └── aggregator.ts                # Aggregate paginated results
```

### 3.4 Pagination Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PAGINATION FLOW                                      │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Invoke     │───▶│   Detect     │───▶│   Execute    │                  │
│  │   Action     │    │   Strategy   │    │   First Page │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                                        │                          │
│         │ fetchAll: false                        │                          │
│         ▼                                        ▼                          │
│  ┌──────────────┐                        ┌──────────────┐                  │
│  │   Return     │◀───────────────────────│   Return     │                  │
│  │   Single     │     (no pagination)    │   Results    │                  │
│  │   Page       │                        │   + Meta     │                  │
│  └──────────────┘                        └──────────────┘                  │
│                                                  │                          │
│                                                  │ fetchAll: true           │
│                                                  │ && hasMore               │
│                                                  ▼                          │
│                                          ┌──────────────┐                  │
│                                          │   Check      │                  │
│                                          │   Limits     │                  │
│                                          └──────────────┘                  │
│                                                  │                          │
│                          ┌───────────────────────┼───────────────────────┐  │
│                          │                       │                       │  │
│                          ▼                       ▼                       ▼  │
│                   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│                   │   Exceeded   │        │   Rate       │        │   Fetch      │
│                   │   Limits     │        │   Limited    │        │   Next Page  │
│                   │   → Return   │        │   → Wait     │        │              │
│                   │   Partial    │        │   → Retry    │        │              │
│                   └──────────────┘        └──────────────┘        └──────────────┘
│                                                  │                       │  │
│                                                  └───────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Auto-Detection Algorithm

The auto-detector analyzes the first response to infer pagination strategy:

1. **Check Link headers** → RFC 5988 pagination
2. **Look for common cursor patterns** → `next_cursor`, `cursor`, `after`, `pageToken`
3. **Look for offset/total patterns** → `offset`, `skip`, `total`, `count`
4. **Look for page number patterns** → `page`, `pageNumber`, `totalPages`
5. **Check for hasMore/nextPage flags** → Generic indicator

### 3.6 UI Configuration

The pagination settings will be configurable per-action in the Action Editor with:

#### Configuration Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ PAGINATION SETTINGS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ☑ Enable Pagination                                             │
│                                                                  │
│  Strategy: [Auto-detect ▼]                                       │
│                                                                  │
│  ─── Data Extraction ───────────────────────────────────────     │
│  Data Path:    [$.data           ]  (JSONPath to results array)  │
│  Cursor Path:  [$.meta.next_cursor]  (JSONPath to next cursor)   │
│                                                                  │
│  ─── Safety Limits ─────────────────────────────────────────     │
│                                                                  │
│  Max Pages:      [5    ] ⓘ Default: 5 (prevents runaway fetches) │
│  Max Items:      [500  ] ⓘ Default: 500 items                    │
│  Max Characters: [100K ▼] ⓘ ~25K tokens (fits most LLM contexts) │
│  Max Duration:   [30s  ▼] ⓘ Total time for all pages             │
│                                                                  │
│  ─── Presets ───────────────────────────────────────────────     │
│  [ 🤖 LLM-Optimized ] [ 📊 Full Dataset ] [ ⚡ Quick Sample ]    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Limit Presets (Quick Configuration)

| Preset                         | maxPages | maxItems | maxCharacters      | Use Case              |
| ------------------------------ | -------- | -------- | ------------------ | --------------------- |
| **🤖 LLM-Optimized** (default) | 5        | 500      | 100K (~25K tokens) | AI/LLM consuming apps |
| **📊 Full Dataset**            | 50       | 5000     | 1M (~250K tokens)  | Data sync, exports    |
| **⚡ Quick Sample**            | 1        | 50       | 10K (~2.5K tokens) | Testing, previews     |

#### UI Behaviors

1. **Defaults shown clearly** - Each field shows "Default: X" hint
2. **Token estimation** - Character limit shows approximate token count
3. **Warning on high limits** - Show warning icon when limits exceed 10 pages or 500K characters
4. **Test button** - "Test Pagination" button to preview with current settings

---

## 4. Implementation Tasks

### Phase 1: Core Infrastructure (~2-3 hours)

| #   | Task                                                                             | Est.   | Dependencies |
| --- | -------------------------------------------------------------------------------- | ------ | ------------ |
| 1.1 | Create pagination Zod schemas with LLM-friendly limits (`pagination.schemas.ts`) | 45 min | None         |
| 1.2 | Create base pagination strategy interface (`base.strategy.ts`)                   | 30 min | 1.1          |
| 1.3 | Implement pagination detector (`detector.ts`)                                    | 45 min | 1.2          |
| 1.4 | Implement result aggregator with character counting (`aggregator.ts`)            | 45 min | 1.2          |

### Phase 2: Pagination Strategies (~2-3 hours)

| #   | Task                                                 | Est.   | Dependencies |
| --- | ---------------------------------------------------- | ------ | ------------ |
| 2.1 | Implement cursor-based pagination strategy           | 45 min | 1.2          |
| 2.2 | Implement offset/limit pagination strategy           | 45 min | 1.2          |
| 2.3 | Implement page number pagination strategy            | 30 min | 1.2          |
| 2.4 | Implement Link header pagination strategy (RFC 5988) | 45 min | 1.2          |

### Phase 3: Service Layer Integration (~2.5 hours)

| #   | Task                                                                | Est.   | Dependencies |
| --- | ------------------------------------------------------------------- | ------ | ------------ |
| 3.1 | Create pagination service orchestrator with multi-limit enforcement | 60 min | 2.1-2.4      |
| 3.2 | Integrate pagination into execution service                         | 45 min | 3.1          |
| 3.3 | Add rate limit handling during pagination                           | 30 min | 3.2          |
| 3.4 | Implement token estimation helper (~4 chars/token)                  | 15 min | 3.1          |

### Phase 4: API Layer (~2 hours)

| #   | Task                                                                | Est.   | Dependencies |
| --- | ------------------------------------------------------------------- | ------ | ------------ |
| 4.1 | Update action invocation endpoint to accept pagination options      | 30 min | 3.2          |
| 4.2 | Update action response format with LLM-friendly pagination metadata | 45 min | 4.1          |
| 4.3 | Implement continuation token for resumable pagination               | 30 min | 4.2          |
| 4.4 | Add truncation reason to response                                   | 15 min | 4.2          |

### Phase 5: UI Components (~3 hours)

| #   | Task                                                                 | Est.   | Dependencies |
| --- | -------------------------------------------------------------------- | ------ | ------------ |
| 5.1 | Create pagination config panel for action editor with presets        | 60 min | 4.4          |
| 5.2 | Add limit preset buttons (LLM-Optimized, Full Dataset, Quick Sample) | 30 min | 5.1          |
| 5.3 | Update action tester to support pagination options                   | 45 min | 5.1          |
| 5.4 | Add pagination metadata display with token estimates in test results | 30 min | 5.3          |
| 5.5 | Add warnings for high-limit configurations                           | 15 min | 5.1          |

### Phase 6: AI Enhancement (~1 hour)

| #   | Task                                                   | Est.   | Dependencies |
| --- | ------------------------------------------------------ | ------ | ------------ |
| 6.1 | Enhance action generator to detect pagination patterns | 45 min | 5.5          |
| 6.2 | Update AI prompts to infer pagination config from docs | 15 min | 6.1          |

### Total Estimated Time: ~14 hours

---

## 5. Test Plan

### 5.1 Unit Tests

- [ ] Pagination detector correctly identifies each strategy type
- [ ] Cursor strategy extracts cursor from various JSON paths
- [ ] Offset strategy calculates correct offset for each page
- [ ] Page number strategy increments page correctly
- [ ] Link header parser handles various Link header formats
- [ ] Aggregator correctly merges paginated results
- [ ] Character counting is accurate across pages
- [ ] Token estimation (~4 chars/token) is calculated correctly
- [ ] Safety limits stop pagination at maxPages/maxItems
- [ ] **Character limit stops pagination when maxCharacters exceeded**
- [ ] **Duration limit stops pagination when maxDurationMs exceeded**
- [ ] **Truncation reason is set correctly for each limit type**
- [ ] Circular pagination detection triggers error

### 5.2 Integration Tests

- [ ] Full pagination flow with mock cursor API
- [ ] Full pagination flow with mock offset API
- [ ] Full pagination flow with mock Link header API
- [ ] Rate limit handling during pagination
- [ ] Continuation token resume functionality
- [ ] Auto-detection with various API response shapes
- [ ] **Character limit truncation with correct metadata**
- [ ] **Request-level limit overrides work correctly**
- [ ] **Default limits applied when no overrides specified**

### 5.3 Manual Testing

- [ ] Test against real APIs with pagination (use https://sampleapis.com as base)
- [ ] Test UI configuration panel with all limit fields
- [ ] Test preset buttons apply correct values
- [ ] Test action tester with `fetchAll` option
- [ ] **Verify pagination metadata shows estimatedTokens**
- [ ] **Verify warnings appear for high-limit configurations**

---

## 6. Edge Cases & Error Handling

| Edge Case                                  | Handling                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| Empty first page                           | Return empty array, no pagination                       |
| Inconsistent page sizes                    | Track actual items fetched, not page count              |
| Deleted items during pagination            | Document limitation, return what's fetched              |
| Circular pagination (same cursor)          | Detect repeated cursors, stop with error                |
| API returns error mid-pagination           | Return partial results + error                          |
| Rate limited during pagination             | Respect Retry-After, resume fetching                    |
| No clear hasMore indicator                 | Stop when page is empty or < pageSize                   |
| Deeply nested data path                    | Support JSONPath for extraction                         |
| **Character limit hit mid-page**           | Include current page, set truncated=true                |
| **Duration limit hit mid-fetch**           | Return what's fetched, set truncated=true               |
| **Multiple limits hit simultaneously**     | Report first limit reached as truncationReason          |
| **Very large single-page response**        | Allow if within limits, warn if >80% of maxCharacters   |
| **Request overrides exceed action limits** | Allow override (action limits are defaults, not caps)   |
| **Continuation token expired/invalid**     | Return error with clear message, suggest starting fresh |

---

## 7. Future Enhancements (Out of Scope)

- **Streaming mode**: Yield pages as they're fetched (WebSocket/SSE)
- **Parallel fetching**: Fetch multiple pages simultaneously for offset-based APIs
- **Pagination caching**: Cache pagination tokens for resumable fetches
- **Custom pagination strategies**: Allow users to define custom extraction logic

---

## 8. Related Documentation

- [Product Spec - Pagination Handler](../product_spec.md#feature-pagination-handler)
- [Architecture - Execution Engine](../architecture.md#23-service-boundaries--responsibilities)
- [Action Registry Schema](./action-registry-schema.md)

---

## 9. Revision History

| Date       | Author       | Changes                                                                                                                                    |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-01-03 | AI Assistant | Initial feature specification                                                                                                              |
| 2026-01-03 | AI Assistant | Added LLM-friendly limits (maxCharacters, estimatedTokens), UI configuration panel with presets, conservative defaults, truncation reasons |
