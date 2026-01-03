# Feature: Action Registry & Schema

**Status:** ✅ Complete  
**Priority:** P0  
**Complexity:** HIGH  
**Milestone:** MVP  
**Dependencies:** #5 AI Documentation Scraper (✅ Complete)  
**Completion Date:** 2026-01-02

---

## Overview

The Action Registry is the core data layer that normalizes diverse APIs into a consistent schema. Each integration exposes typed "Actions" (e.g., `slack.sendMessage`, `github.createIssue`) with defined inputs, outputs, and metadata. This feature connects the AI scraper output to persistent storage and provides APIs for action discovery and schema retrieval.

### User Story

> As a developer, I want each integration to expose a consistent, typed set of actions, so that I can interact with any API through a unified interface.

### Key Value

- **Unified Interface**: Every action, regardless of source API, follows the same schema pattern
- **Type Safety**: JSON Schema validation ensures inputs are valid before making external calls
- **Discoverability**: Actions are searchable and browsable with full documentation
- **AI-Generated**: Actions are created automatically from parsed API documentation

---

## Requirements

### Functional Requirements

- [ ] Define Action schema: `{ id, name, description, inputSchema, outputSchema, metadata }`
- [ ] Input/Output schemas use JSON Schema for type definitions
- [ ] Support required vs optional parameters
- [ ] Support parameter validation rules (min/max, patterns, enums)
- [ ] Include metadata: rate limits, idempotency, side effects, cacheability
- [ ] Auto-generate action IDs following convention: `{integration}.{actionName}`
- [ ] Support action grouping/categorization via tags
- [ ] Expose action discovery endpoint for consuming apps
- [ ] Validate action inputs against schemas before execution
- [ ] Batch persist actions from AI scraper output

### Non-Functional Requirements

- Actions should be retrievable in < 50ms
- Schema validation should complete in < 10ms
- Support up to 100 actions per integration

---

## Technical Design

### Existing Infrastructure

The following already exists and will be leveraged:

| Component         | Location                                 | Description                                   |
| ----------------- | ---------------------------------------- | --------------------------------------------- |
| Database Schema   | `prisma/schema.prisma`                   | Full `Action` model with all fields           |
| Action Generator  | `src/lib/modules/ai/action-generator.ts` | Generates `ActionDefinition` from parsed docs |
| JSON Schema Types | `src/lib/modules/ai/action-generator.ts` | `JsonSchema`, `JsonSchemaProperty` types      |
| Actions Module    | `src/lib/modules/actions/index.ts`       | Empty placeholder (to be implemented)         |

### New Components

| Component             | Path                                                            | Purpose                     |
| --------------------- | --------------------------------------------------------------- | --------------------------- |
| Action Schemas        | `src/lib/modules/actions/action.schemas.ts`                     | Zod schemas for validation  |
| Action Repository     | `src/lib/modules/actions/action.repository.ts`                  | Database operations         |
| Action Service        | `src/lib/modules/actions/action.service.ts`                     | Business logic              |
| JSON Schema Validator | `src/lib/utils/json-schema-validator.ts`                        | Runtime input validation    |
| List Actions API      | `src/app/api/v1/integrations/[id]/actions/route.ts`             | GET actions for integration |
| Action Schema API     | `src/app/api/v1/actions/[integration]/[action]/schema/route.ts` | GET action schema           |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ACTION REGISTRY FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

CREATION FLOW (from AI Scraper):
┌──────────────┐    ┌────────────────┐    ┌──────────────┐    ┌──────────┐
│ ScrapeJob    │───▶│ Action         │───▶│ Action       │───▶│ Database │
│ (result)     │    │ Generator      │    │ Service      │    │ (actions)│
└──────────────┘    └────────────────┘    └──────────────┘    └──────────┘

DISCOVERY FLOW (API Consumers):
┌──────────────┐    ┌────────────────┐    ┌──────────────┐    ┌──────────┐
│ API Request  │───▶│ Actions API    │───▶│ Action       │───▶│ Response │
│ GET /actions │    │ Route          │    │ Repository   │    │ (JSON)   │
└──────────────┘    └────────────────┘    └──────────────┘    └──────────┘

VALIDATION FLOW (Pre-Execution):
┌──────────────┐    ┌────────────────┐    ┌──────────────┐    ┌──────────┐
│ Action Input │───▶│ JSON Schema    │───▶│ Validation   │───▶│ Valid/   │
│ (user data)  │    │ Validator      │    │ Result       │    │ Errors   │
└──────────────┘    └────────────────┘    └──────────────┘    └──────────┘
```

### API Endpoints

#### GET `/api/v1/integrations/:id/actions`

List all actions for an integration.

**Query Parameters:**

- `cursor` - Pagination cursor
- `limit` - Results per page (default: 50, max: 100)
- `search` - Search by name/description
- `tags` - Filter by tags (comma-separated)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Send Message",
      "slug": "send-message",
      "description": "Send a message to a channel",
      "httpMethod": "POST",
      "endpointTemplate": "https://api.slack.com/api/chat.postMessage",
      "inputSchema": {
        /* JSON Schema */
      },
      "outputSchema": {
        /* JSON Schema */
      },
      "cacheable": false,
      "metadata": {
        "tags": ["messaging", "channels"],
        "rateLimit": { "requests": 100, "window": 60 }
      }
    }
  ],
  "pagination": {
    "cursor": "next_cursor",
    "hasMore": true,
    "totalCount": 25
  }
}
```

#### GET `/api/v1/actions/:integration/:action/schema`

Get detailed schema for a specific action.

**Response:**

```json
{
  "success": true,
  "data": {
    "actionId": "{integration}.{action}",
    "inputSchema": {
      "type": "object",
      "properties": {
        "channel": { "type": "string", "description": "Channel ID" },
        "text": { "type": "string", "description": "Message text" }
      },
      "required": ["channel", "text"]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "ok": { "type": "boolean" },
        "ts": { "type": "string" }
      }
    },
    "metadata": {
      "httpMethod": "POST",
      "cacheable": false,
      "rateLimit": { "requests": 100, "window": 60 },
      "tags": ["messaging"]
    }
  }
}
```

### JSON Schema Validation

Input validation uses JSON Schema draft-07 with support for:

| Feature                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `type`                 | string, number, integer, boolean, array, object |
| `required`             | List of required properties                     |
| `enum`                 | Enumerated allowed values                       |
| `pattern`              | Regex pattern for strings                       |
| `minimum/maximum`      | Numeric range constraints                       |
| `minLength/maxLength`  | String length constraints                       |
| `minItems/maxItems`    | Array length constraints                        |
| `properties`           | Nested object schemas                           |
| `additionalProperties` | Control extra properties                        |

---

## Implementation Tasks

| #   | Task                            | Est. Time | Dependencies | Description                                       |
| --- | ------------------------------- | --------- | ------------ | ------------------------------------------------- |
| 1   | Create Action Zod Schemas       | 30 min    | —            | Zod schemas for CRUD, queries, API responses      |
| 2   | Create Action Repository        | 45 min    | Task 1       | Prisma-based CRUD, batch operations, queries      |
| 3   | Create Action Service           | 45 min    | Tasks 1-2    | Business logic, validation, conflict resolution   |
| 4   | Create JSON Schema Validator    | 30 min    | —            | Runtime validation utility using Ajv              |
| 5   | Create List Actions API         | 30 min    | Tasks 1-3    | GET /integrations/:id/actions endpoint            |
| 6   | Create Action Schema API        | 30 min    | Tasks 1-3    | GET /actions/:integration/:action/schema endpoint |
| 7   | Create Persist Actions Function | 30 min    | Tasks 1-3    | Connect scraper output to database                |
| 8   | Create Validate Input Endpoint  | 30 min    | Tasks 1-4    | Pre-execution validation endpoint                 |
| 9   | Add Unit Tests                  | 45 min    | Tasks 1-4    | Repository, service, validator tests              |
| 10  | Add Integration Tests           | 30 min    | Tasks 5-8    | API endpoint tests                                |

**Total Estimated Time:** ~6 hours

---

## Acceptance Criteria

- [ ] Given a configured integration, when listing actions, then returns typed actions with full input/output schemas
- [ ] Given an action input that violates schema, when validated, then returns detailed validation errors
- [ ] Given an action registry, when exported, then produces valid JSON Schema definitions
- [ ] Given AI-generated actions from scraper, when persisted, then all actions are stored with correct schemas
- [ ] Given a search query, when listing actions, then only matching actions are returned
- [ ] Given an integration slug and action slug, when requesting schema, then full schema is returned

---

## Edge Cases

| Case                   | Handling                                              |
| ---------------------- | ----------------------------------------------------- |
| Duplicate action slugs | Auto-rename with method suffix or counter             |
| Polymorphic responses  | Use `anyOf` or `additionalProperties: true`           |
| File uploads           | Represent as string (base64 or URL)                   |
| Missing schema info    | Default to `object` with `additionalProperties: true` |
| Empty action list      | Return empty array with 200 status                    |
| Invalid integration ID | Return 404 with clear error message                   |

---

## Testing Strategy

### Unit Tests

- Repository: CRUD operations, batch insert, queries
- Service: Business logic, slug collision handling, validation
- JSON Schema Validator: Type checking, required fields, constraints, nested objects

### Integration Tests

- List actions API with pagination
- List actions API with filters
- Action schema API
- Validation endpoint with valid/invalid inputs
- Persist actions from scraper output

---

## Future Enhancements (Out of Scope for MVP)

- Action versioning and rollback (V2)
- LLM tool schema export (V2)
- SDK generation from schemas (V2)
- Action analytics and usage metrics (V1)
- Custom action creation UI (V1)

---

## References

- [Product Spec - Action Registry & Schema](../product_spec.md#feature-action-registry--schema)
- [Architecture - Data Models](../architecture.md#42-entity-relationship-diagram)
- [JSON Schema Specification](https://json-schema.org/draft-07/json-schema-release-notes.html)
