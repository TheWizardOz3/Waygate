## Changelog: Waygate

> **Purpose:** Development history tracking all notable changes. Follows [Keep a Changelog](https://keepachangelog.com/) conventions. For architectural decisions and rationale, see `decision_log.md`.

**Related Documents:**

- `decision_log.md` — Why changes were made
- `architecture.md` — Technical implementation details
- `product_spec.md` — Product requirements

---

## Version Index

| Version | Date       | Type       | Summary                                                  |
| ------- | ---------- | ---------- | -------------------------------------------------------- |
| 0.0.0   | 2026-01-01 | prerelease | Pre-build baseline with documentation and workflow setup |

**Types:** `major` | `minor` | `patch` | `prerelease`

---

## Entry Format

```
## [{{VERSION}}] - {{YYYY-MM-DD}}

### Added
- {{New feature or capability}}

### Changed
- {{Modification to existing functionality}}

### Fixed
- {{Bug fix — reference ERR-XXX from decision_log if applicable}}

### Removed
- {{Removed feature or deprecated code}}

### Breaking
- {{Breaking change — reference decision_log entry}}
- **Migration:** {{Brief migration instruction or link to decision_log}}

### Dependencies
- {{Package}}: {{old_version}} → {{new_version}}

### Security
- {{Security fix or update}}
```

---

## Releases

<!-- Add new versions below this line, newest first -->

## [Unreleased]

### Added

- **Database Setup (Feature #2)** - Complete Prisma schema and Supabase configuration
  - 6 PostgreSQL enums: AuthType, IntegrationStatus, CredentialType, CredentialStatus, HttpMethod, MappingDirection
  - 6 Prisma models: Tenant, Integration, Action, IntegrationCredential, FieldMapping, RequestLog
  - All foreign key relationships with cascade deletes
  - Comprehensive indexes for query performance (tenant+slug, integration+slug, expires_at, created_at)
  - Encrypted credential storage using Bytes type (bytea)
  - Initial database migration (`20250102_initial_schema`)
  - Seed script with test tenant and sample Slack integration (5 actions)
  - Supabase client configuration (anon + service role)
  - 16 integration tests for database operations
  - Environment variable structure with `.env.example` template

- **Project Scaffolding (Feature #1)** - Complete foundation for Waygate development
  - Next.js 14 with App Router and TypeScript 5.x (strict mode)
  - Tailwind CSS with Waygate design system (custom colors, typography)
  - Shadcn/ui components (button, card, dialog, input, label, badge, separator, skeleton, sonner, dropdown-menu)
  - Prisma 7 with PostgreSQL adapter configured
  - TanStack Query provider with React Query Devtools
  - Zustand UI store for state management
  - Zod, React Hook Form with resolvers
  - ESLint + Prettier + Husky + lint-staged for code quality
  - Vitest + React Testing Library + MSW for testing (17 tests passing)
  - GitHub Actions CI workflow
  - Full directory structure per architecture.md
  - API response helpers and custom error classes
  - Health check endpoint at `/api/v1/health`

---

## [0.0.0] - 2026-01-01

### Added

- Complete project documentation suite (product spec, architecture, decision log)
- Vibe-coding workflow prompts for structured development process
- MCP configuration for Cursor integration
- Git repository structure and .cursorrules for AI assistant behavior

---
