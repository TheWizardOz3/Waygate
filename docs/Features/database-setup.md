# Feature Spec: Database Setup

## 1. Overview

### 1.1 One-Line Summary

Configure Supabase PostgreSQL database with Prisma ORM, defining all core tables required for the MVP including tenants, integrations, actions, credentials, and logging.

### 1.2 User Story

> As a **developer**, I want to have a properly configured database with all core data models, so that **I can build features that persist and retrieve integration data reliably**.

### 1.3 Problem Statement

The project scaffolding is complete but the database schema is empty. All subsequent features (Authentication Framework, AI Documentation Scraper, Action Registry, Gateway API) depend on having the core data models in place. Without a proper database setup, no feature development can proceed.

### 1.4 Business Value

- **User Impact:** Enables all user-facing features (integration management, action invocation, logging)
- **Business Impact:** Critical blocker for MVP - nothing else can be built without this
- **Technical Impact:** Establishes data patterns, relationships, and security model (RLS) for entire application

---

## 2. Scope & Requirements

### 2.1 Functional Requirements

| ID   | Requirement                                                     | Priority | Notes                                       |
| ---- | --------------------------------------------------------------- | -------- | ------------------------------------------- |
| FR-1 | Define Tenant model with API key hash storage                   | MUST     | Foundation for multi-tenancy                |
| FR-2 | Define Integration model with auth configuration                | MUST     | Stores integration definitions              |
| FR-3 | Define Action model with JSON Schema input/output               | MUST     | Stores typed action definitions             |
| FR-4 | Define IntegrationCredential model with encrypted storage       | MUST     | Secure credential storage for external APIs |
| FR-5 | Define FieldMapping model for data transformations              | MUST     | Enables field mapping feature (V0.5)        |
| FR-6 | Define RequestLog model for audit trail                         | MUST     | Required for debugging and monitoring       |
| FR-7 | Create database migration that can be applied to fresh database | MUST     | Enables reproducible deployments            |
| FR-8 | Create seed script for development data                         | SHOULD   | Improves developer experience               |
| FR-9 | Configure Supabase client for RLS-aware queries                 | SHOULD   | Required for proper tenant isolation        |

### 2.2 Non-Functional Requirements

| Requirement | Target                               | Measurement                    |
| ----------- | ------------------------------------ | ------------------------------ |
| Performance | < 50ms p95 for basic queries         | Prisma query metrics           |
| Scalability | Support 1000 integrations per tenant | Database indexes               |
| Security    | Tenant isolation via RLS             | RLS policy audit               |
| Security    | No plaintext credentials in database | Code review, encrypted columns |

### 2.3 Acceptance Criteria

- [x] **Given** a fresh database, **when** `prisma migrate deploy` is run, **then** all tables are created successfully
- [x] **Given** the seed script, **when** `prisma db seed` is run, **then** test tenant and sample data are created
- [x] **Given** a tenant ID, **when** querying integrations, **then** only that tenant's integrations are returned
- [x] **Given** credential data, **when** stored, **then** sensitive fields are encrypted (bytea columns)
- [x] **Given** the Prisma client, **when** making queries, **then** TypeScript types are properly inferred

### 2.4 Out of Scope

- Setting up Row-Level Security policies in Supabase dashboard (will be done via SQL migration or manual setup, but full RLS testing is for Auth Framework feature)
- Implementing repository layer (will be done per-module as features are built)
- Redis cache setup (V1+ feature)
- Database backups configuration (handled by Supabase)

---

## 3. User Experience

### 3.1 Developer Experience

This is a backend infrastructure feature with no user-facing UI. The "user" is a developer working on the codebase.

**Developer Flow:**

```
Clone repo → npm install → Set DATABASE_URL → prisma migrate dev → prisma db seed → Ready to develop
```

**Success State:** Developer can run the application, and all database operations work correctly with full TypeScript support.

---

## 4. Technical Approach

### 4.1 Architecture Fit

**Affected Areas:**

| Area              | Impact | Description                                      |
| ----------------- | ------ | ------------------------------------------------ |
| Frontend          | NONE   | No frontend changes required                     |
| Backend           | NEW    | New Prisma models, Supabase client configuration |
| Database          | NEW    | All core tables, enums, indexes, and constraints |
| External Services | MODIFY | Supabase project configuration                   |

**Alignment with Existing Patterns:**

- Uses Prisma as defined in `architecture.md` Section 1.2
- Follows table structure defined in `architecture.md` Section 4.3
- Uses PostgreSQL JSONB for flexible schema storage as specified
- Implements bytea columns for encrypted credential storage

### 4.2 Database Schema

Based on `architecture.md` Section 4.2-4.3, the following models will be created:

**Enums:**

- `AuthType`: oauth2, api_key, basic, bearer, custom_header
- `IntegrationStatus`: draft, active, error, disabled
- `CredentialType`: oauth2_tokens, api_key, basic, bearer
- `CredentialStatus`: active, expired, revoked, needs_reauth
- `HttpMethod`: GET, POST, PUT, PATCH, DELETE
- `MappingDirection`: input, output

**Tables:**

- `tenants` - Multi-tenant accounts
- `integrations` - Integration definitions
- `actions` - Action definitions with JSON Schema
- `integration_credentials` - Encrypted external API credentials
- `field_mappings` - Field transformation configuration
- `request_logs` - Audit trail for action invocations

---

## 5. Implementation Tasks

### Task 1: Configure Supabase Connection & Environment

**Estimated Time:** 30 minutes  
**Dependencies:** None

**Description:**

- Verify `.env.example` has all required database variable names (as a template for developers)
- Ensure `.env.local` contains actual Supabase credentials (this file is gitignored)
- Test database connection with Prisma
- Create Supabase client for auth/RLS operations

**Files to Create/Modify:**

- `.env.example` (verify)
- `src/lib/db/supabase.ts` (create Supabase client)

**Acceptance Criteria:**

- [x] `prisma db pull` succeeds without errors
- [x] Supabase client can be imported and initialized

---

### Task 2: Define Prisma Schema - Enums

**Estimated Time:** 20 minutes  
**Dependencies:** Task 1

**Description:**

- Add all enum types to `prisma/schema.prisma`
- Verify enums match `architecture.md` specifications

**Files to Modify:**

- `prisma/schema.prisma`

**Acceptance Criteria:**

- [x] All 6 enum types defined
- [x] `prisma validate` passes

---

### Task 3: Define Prisma Schema - Tenant Model

**Estimated Time:** 30 minutes  
**Dependencies:** Task 2

**Description:**

- Create `Tenant` model with all columns from architecture spec
- Add unique indexes on `email` and `waygate_api_key_hash`
- Add timestamps with auto-update

**Fields:**

- id (uuid, default gen_random_uuid())
- name (varchar 255)
- email (varchar 255, unique)
- waygateApiKeyHash (varchar 255, unique)
- settings (jsonb, default {})
- createdAt, updatedAt (timestamps)

**Files to Modify:**

- `prisma/schema.prisma`

**Acceptance Criteria:**

- [x] Tenant model matches architecture spec
- [x] Indexes defined correctly
- [x] `prisma validate` passes

---

### Task 4: Define Prisma Schema - Integration Model

**Estimated Time:** 30 minutes  
**Dependencies:** Task 3

**Description:**

- Create `Integration` model with tenant relationship
- Add unique constraint on (tenant_id, slug)
- Configure JSONB fields for authConfig and metadata
- Add GIN index on tags array

**Fields:**

- id, tenantId (FK), name, slug, description
- documentationUrl, authType (enum), authConfig (jsonb)
- status (enum), tags (text[]), metadata (jsonb)
- createdAt, updatedAt

**Files to Modify:**

- `prisma/schema.prisma`

**Acceptance Criteria:**

- [x] Integration model matches architecture spec
- [x] Foreign key to Tenant defined
- [x] Compound unique index on tenant+slug
- [x] `prisma validate` passes

---

### Task 5: Define Prisma Schema - Action Model

**Estimated Time:** 30 minutes  
**Dependencies:** Task 4

**Description:**

- Create `Action` model with integration relationship
- Add unique constraint on (integration_id, slug)
- Configure JSON Schema storage fields (inputSchema, outputSchema)

**Fields:**

- id, integrationId (FK), name, slug, description
- httpMethod (enum), endpointTemplate
- inputSchema, outputSchema (jsonb)
- paginationConfig, retryConfig (jsonb, nullable)
- cacheable (bool), cacheTtlSeconds (int, nullable)
- metadata (jsonb), createdAt, updatedAt

**Files to Modify:**

- `prisma/schema.prisma`

**Acceptance Criteria:**

- [x] Action model matches architecture spec
- [x] Foreign key to Integration defined
- [x] Compound unique index on integration+slug
- [x] `prisma validate` passes

---

### Task 6: Define Prisma Schema - IntegrationCredential Model

**Estimated Time:** 30 minutes  
**Dependencies:** Task 4

**Description:**

- Create `IntegrationCredential` model
- Use `Bytes` type for encrypted columns (encryptedData, encryptedRefreshToken)
- Add index on expires_at for token refresh queries

**Fields:**

- id, integrationId (FK), tenantId (FK)
- credentialType (enum), encryptedData (bytes)
- expiresAt (timestamp, nullable)
- encryptedRefreshToken (bytes, nullable)
- scopes (text[]), status (enum)
- createdAt, updatedAt

**Files to Modify:**

- `prisma/schema.prisma`

**Acceptance Criteria:**

- [x] IntegrationCredential model matches architecture spec
- [x] Encrypted columns use Bytes type
- [x] Index on expires_at for active credentials
- [x] `prisma validate` passes

---

### Task 7: Define Prisma Schema - FieldMapping & RequestLog Models

**Estimated Time:** 30 minutes  
**Dependencies:** Task 5

**Description:**

- Create `FieldMapping` model for field transformations
- Create `RequestLog` model for audit trail
- Add appropriate indexes for common query patterns

**FieldMapping Fields:**

- id, actionId (FK), tenantId (FK, nullable)
- sourcePath, targetPath, transformConfig (jsonb)
- direction (enum), createdAt

**RequestLog Fields:**

- id, tenantId (FK), integrationId (FK), actionId (FK)
- requestSummary, responseSummary (jsonb)
- statusCode (int), latencyMs (int), retryCount (int)
- error (jsonb, nullable), createdAt

**Files to Modify:**

- `prisma/schema.prisma`

**Acceptance Criteria:**

- [x] Both models match architecture spec
- [x] RequestLog has indexes for tenant+created_at queries
- [x] `prisma validate` passes

---

### Task 8: Generate Initial Migration

**Estimated Time:** 20 minutes  
**Dependencies:** Tasks 2-7

**Description:**

- Run `prisma migrate dev` to generate initial migration
- Verify migration SQL is correct
- Test migration applies cleanly

**Commands:**

```bash
npx prisma migrate dev --name initial_schema
```

**Files Created:**

- `prisma/migrations/{timestamp}_initial_schema/migration.sql`

**Acceptance Criteria:**

- [x] Migration generates without errors
- [x] Migration applies to database successfully
- [x] `prisma generate` creates client without errors

---

### Task 9: Create Database Seed Script

**Estimated Time:** 45 minutes  
**Dependencies:** Task 8

**Description:**

- Create `prisma/seed.ts` with development seed data
- Add test tenant with known API key hash
- Add sample integration (mock Slack) with actions
- Configure seed script in `package.json`

**Seed Data:**

- 1 test tenant (for development)
- 1 sample integration (Slack mock)
- 3-5 sample actions (sendMessage, listChannels, etc.)

**Files to Create/Modify:**

- `prisma/seed.ts` (create)
- `package.json` (add prisma.seed config)

**Acceptance Criteria:**

- [x] `prisma db seed` runs without errors
- [x] Test tenant exists with known credentials
- [x] Sample integration and actions are queryable

---

### Task 10: Set Up Supabase Client

**Estimated Time:** 30 minutes  
**Dependencies:** Task 1

**Description:**

- Create Supabase client configuration for auth/storage
- Set up service role client for server-side operations
- Create anon client for client-side operations

**Files to Create:**

- `src/lib/db/supabase.ts`

**Acceptance Criteria:**

- [x] Supabase client exports work correctly
- [x] Service role client can bypass RLS (for internal operations)
- [x] Anon client respects RLS (for user-facing operations)

---

## 6. Implementation Summary

**Status:** ✅ Complete

**Files Created:**
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Complete database schema with 6 enums and 6 models |
| `prisma/seed.ts` | Development seed script with test tenant and sample data |
| `prisma/migrations/20250102_initial_schema/` | Initial database migration |
| `src/lib/db/supabase.ts` | Supabase client (anon + admin) |
| `tests/integration/database.test.ts` | 16 integration tests for database operations |

**Files Modified:**
| File | Changes |
|------|---------|
| `prisma/prisma.config.ts` | Added datasource URL and seed script configuration |
| `.env.example` | Added Waygate-specific environment variable template |
| `.env.local` | Actual credentials (gitignored) |
| `.gitignore` | Added `.env` to prevent secret leakage |
| `package.json` | Added `prisma.seed` configuration and `db:seed` script |

**Key Implementation Details:**

- Used Prisma 7's new `prisma.config.ts` for datasource URL configuration
- Encrypted credential columns use `Bytes` type (bytea in PostgreSQL)
- All models have proper cascade delete relationships
- Comprehensive indexes for query performance
- Test API key: `wg_test_dev_abc123xyz789`

---

## 7. Testing Approach

### Manual Testing

- [x] Run migrations against fresh database
- [x] Run seed script
- [x] Query each table via Prisma queries
- [x] Verify foreign key relationships work correctly

### Automated Testing

- [x] 16 integration tests added (`tests/integration/database.test.ts`)
- Tests cover: models, relationships, constraints, enums, JSON fields

---

## 8. Rollout Plan

1. ✅ Complete all tasks on development branch
2. ✅ Test migrations on fresh database
3. PR review with migration SQL review
4. Merge to main
5. Apply migrations to staging/production

---

## 9. Open Questions

| Question       | Context | Decision Needed By |
| -------------- | ------- | ------------------ |
| None currently | —       | —                  |

---

## 10. References

- [Architecture Documentation - Database Design](../architecture.md#4-database-design)
- [Product Spec - Data Architecture](../product_spec.md#63-data-architecture)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
