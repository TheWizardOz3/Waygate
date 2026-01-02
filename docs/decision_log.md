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
| ADR-002 | 2026-01-02 | infra    | active | Prisma 7 config file requires explicit env loading    |
| ADR-003 | 2026-01-02 | infra    | active | Environment variable file strategy for secrets        |

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

### ADR-002: Prisma 7 Config File Requires Explicit Environment Loading

**Date:** 2026-01-02 | **Category:** infra | **Status:** active

#### Trigger

When running Prisma CLI commands (`prisma migrate dev`, `prisma db seed`), the `prisma.config.ts` file was not automatically loading environment variables from `.env.local`, causing "DATABASE_URL not found" errors.

#### Decision

- Added `import 'dotenv/config';` at the top of `prisma/prisma.config.ts`
- Updated `prisma/seed.ts` to also explicitly load env vars using `dotenv` with explicit paths
- Use Prisma's `env()` helper in config for datasource URL

#### Rationale

Prisma 7's new config file (`prisma.config.ts`) is executed by the Prisma CLI in a TypeScript context that doesn't automatically load `.env` files. The `dotenv/config` import ensures environment variables are loaded before any config properties are accessed.

#### Supersedes

N/A (extends ADR-001)

#### Migration

- **Affected files:** `prisma/prisma.config.ts`, `prisma/seed.ts`
- **Find:** Files without `import 'dotenv/config'`
- **Replace with:** Add import at top of file
- **Verify:** `npx prisma migrate status` succeeds

#### AI Instructions

When creating or modifying Prisma-related TypeScript files that run via CLI:

- Always add `import 'dotenv/config';` at the very top
- For seed scripts, also add explicit path loading: `config({ path: path.join(__dirname, '..', '.env.local') })`
- Do NOT assume environment variables are automatically available

---

### ADR-003: Environment Variable File Strategy

**Date:** 2026-01-02 | **Category:** infra | **Status:** active

#### Trigger

Initial setup had secrets stored in `.env` which was not gitignored, creating a security risk.

#### Decision

Established three-file environment variable strategy:

1. **`.env.example`** - Template with placeholder values, committed to repo
2. **`.env.local`** - Actual secrets for local development, gitignored
3. **`.env`** - Non-sensitive defaults only (NODE_ENV), gitignored as extra precaution

Added both `.env` and `.env.local` to `.gitignore`.

#### Rationale

- `.env.example` serves as documentation for required variables
- `.env.local` is Next.js's standard for local secrets (automatically loaded)
- Gitignoring both `.env` and `.env.local` prevents accidental secret exposure
- This follows Next.js conventions and security best practices

#### Supersedes

N/A (new project)

#### Migration

- **Affected files:** `.env`, `.env.local`, `.env.example`, `.gitignore`
- **Find:** Secrets in `.env`
- **Replace with:** Move to `.env.local`
- **Verify:** `git status` shows no `.env` or `.env.local` files

#### AI Instructions

When working with environment variables:

- NEVER put secrets in `.env` - always use `.env.local`
- Update `.env.example` when adding new required variables
- Check `.gitignore` includes both `.env` and `.env.local`
- For Prisma CLI operations, ensure dotenv is loaded in config files

---
