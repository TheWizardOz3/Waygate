## Decision Log: {{PROJECT_NAME}}

> **Purpose:** This is the Architectural Decision Record (ADR) — the "Why" behind architectural changes, error resolutions, and pattern evolutions. It serves as institutional memory for AI assistants and developers to understand context, avoid repeating mistakes, and maintain consistency.

**Related Documents:**

- `architecture.md` — Technical implementation details (the "How")
- `product_spec.md` — Product requirements (the "What")
- `changelog.md` — Version history and release notes

---

## Quick Reference Index

| ID      | Date       | Category | Status | Summary                                               |
| ------- | ---------- | -------- | ------ | ----------------------------------------------------- |
| ADR-001 | 2026-01-01 | infra    | active | Prisma 7 requires pg adapter instead of URL in schema |

**Categories:** `arch` | `data` | `api` | `ui` | `test` | `infra` | `error`

**Statuses:** `active` | `superseded` | `reverted`

---

## Entry Format

```
### {{ID}}: {{TITLE}}
**Date:** {{YYYY-MM-DD}} | **Category:** {{CATEGORY}} | **Status:** {{STATUS}}

#### Trigger
{{What prompted this change — error encountered, limitation hit, requirement change, performance issue, etc.}}

#### Decision
{{What changed — be specific about files, patterns, or configurations modified}}

#### Rationale
{{Why this approach was chosen over alternatives}}

#### Supersedes
{{Previous decision ID this replaces, or "N/A" if new}}

#### Migration
- **Affected files:** {{glob pattern or specific paths}}
- **Find:** {{exact code pattern, function name, or import to locate}}
- **Replace with:** {{new pattern or approach}}
- **Verify:** {{command to run or test to confirm migration complete}}

#### AI Instructions
{{Specific rules for AI when working in this area — what to do, what NOT to do}}
```

---

## Log Entries

<!-- Add new entries below this line, newest first -->

### ADR-001: Prisma 7 PostgreSQL Adapter Configuration

**Date:** 2026-01-01 | **Category:** infra | **Status:** active

#### Trigger

Prisma 7 changed how database connections are configured. The `url` property in `datasource db` is no longer supported in schema.prisma files.

#### Decision

- Removed `url = env("DATABASE_URL")` from `prisma/schema.prisma`
- Created `prisma/prisma.config.ts` with schema path configuration
- Updated `src/lib/db/client.ts` to use `@prisma/adapter-pg` with a `pg` connection pool
- Installed `@prisma/adapter-pg` and `pg` packages

#### Rationale

Prisma 7 introduces a new configuration model that separates schema definition from connection management. This provides more flexibility for different deployment environments and enables features like Prisma Accelerate.

#### Supersedes

N/A (new project)

#### Migration

- **Affected files:** `prisma/schema.prisma`, `src/lib/db/client.ts`
- **Find:** `url = env("DATABASE_URL")` in schema.prisma
- **Replace with:** Remove from schema, use adapter in client
- **Verify:** `npm run db:generate` succeeds

#### AI Instructions

When working with Prisma in this project:

- Do NOT add `url` property to datasource in schema.prisma
- Always use the pg adapter pattern in client.ts
- Ensure DATABASE_URL is available in environment for the adapter

---
