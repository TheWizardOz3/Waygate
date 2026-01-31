# Decision Log Archive: Initial Setup ADRs

> **Archived:** 2026-01-26
> **Covers:** ADR-001 through ADR-003 (one-time setup decisions)
> **Current decision log:** See `docs/decision_log.md` for active ADRs

---

These decisions were made during initial project setup and are now embedded in the codebase. They're preserved here for historical reference but don't require ongoing consultation.

---

## ADR-001: Prisma 7 PostgreSQL Adapter Configuration

**Date:** 2026-01-01 | **Category:** infra

**Decision:** Prisma 7 requires using `@prisma/adapter-pg` with a connection pool instead of `url = env("DATABASE_URL")` in schema.prisma. The adapter is configured in `src/lib/db/client.ts`.

**AI Instructions:** Do NOT add `url` property to datasource in schema.prisma. Always use the pg adapter pattern in client.ts.

---

## ADR-002: Prisma Config File Requires Explicit Environment Loading

**Date:** 2026-01-02 | **Category:** infra

**Decision:** Prisma CLI doesn't auto-load `.env` files when executing `prisma.config.ts`. Added `import 'dotenv/config';` at the top of config files.

**AI Instructions:** When creating Prisma-related TypeScript files that run via CLI, always add `import 'dotenv/config';` at the very top.

---

## ADR-003: Environment Variable File Strategy

**Date:** 2026-01-02 | **Category:** infra

**Decision:** Three-file strategy: `.env.example` (committed template), `.env.local` (actual secrets, gitignored), `.env` (non-sensitive defaults, gitignored).

**AI Instructions:** NEVER put secrets in `.env` - always use `.env.local`. Update `.env.example` when adding new required variables.

---

_These patterns are established and stable. For questions about current infrastructure patterns, refer to `docs/architecture.md`._
