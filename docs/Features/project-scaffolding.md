# Feature: Project Scaffolding

**Status:** Complete  
**Completed:** 2026-01-01  
**Priority:** P0  
**Complexity:** LOW  
**Dependencies:** None  
**Estimated Total Time:** ~5 hours

---

## Overview

Initialize the Waygate codebase with the full tech stack and directory structure. This establishes the foundation for all subsequent development with proper tooling, formatting, testing, and CI/CD in place from day one.

---

## Tech Stack Summary

| Category        | Technology           | Version |
| --------------- | -------------------- | ------- |
| Framework       | Next.js (App Router) | 14.x    |
| Language        | TypeScript           | 5.x     |
| Styling         | Tailwind CSS         | 3.x     |
| Components      | Shadcn/ui            | Latest  |
| ORM             | Prisma               | 5.x     |
| Validation      | Zod                  | 3.x     |
| State (Server)  | TanStack Query       | 5.x     |
| State (UI)      | Zustand              | 4.x     |
| Forms           | React Hook Form      | 7.x     |
| Icons           | Lucide React         | Latest  |
| Testing         | Vitest               | Latest  |
| Package Manager | pnpm                 | 8.x     |
| Linting         | ESLint               | Latest  |
| Formatting      | Prettier             | Latest  |
| Git Hooks       | Husky + lint-staged  | Latest  |

---

## Implementation Tasks

### Task 1: Initialize Next.js 14 Project

**Time Estimate:** 30 min

**Actions:**

- [ ] Create Next.js 14 app with TypeScript using `pnpm create next-app`
- [ ] Configure App Router (default in 14.x)
- [ ] Set up `tsconfig.json` with:
  - `strict: true`
  - Path alias `@/*` → `./src/*`
- [ ] Verify initial build and dev server work

**Acceptance Criteria:**

- `pnpm dev` starts without errors
- `pnpm build` completes successfully
- TypeScript strict mode enabled

---

### Task 2: Configure ESLint and Prettier

**Time Estimate:** 30 min

**Actions:**

- [ ] Install ESLint with TypeScript support (should come with Next.js)
- [ ] Install Prettier and `eslint-config-prettier`
- [ ] Create `.prettierrc` with project standards:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5",
    "printWidth": 100
  }
  ```
- [ ] Install and configure Husky for git hooks
- [ ] Install and configure lint-staged
- [ ] Add npm scripts: `lint`, `lint:fix`, `format`, `format:check`

**Acceptance Criteria:**

- `pnpm lint` runs without errors on fresh codebase
- `pnpm format:check` passes
- Pre-commit hook runs lint-staged

---

### Task 3: Set Up Tailwind CSS with Design System

**Time Estimate:** 30 min

**Actions:**

- [ ] Verify Tailwind CSS installed (comes with Next.js template)
- [ ] Configure `tailwind.config.ts` with custom theme:
  - Colors per design system (primary: Indigo 950, secondary: Violet 600, accent: Emerald 500, etc.)
  - Typography (Crimson Pro, Inter, JetBrains Mono)
  - Spacing base unit: 4px
  - Breakpoints: sm (640), md (768), lg (1024), xl (1280)
- [ ] Set up CSS custom properties in `globals.css` for design tokens
- [ ] Add Google Fonts (Crimson Pro, Inter, JetBrains Mono) via next/font

**Acceptance Criteria:**

- Custom colors available as Tailwind classes (`bg-primary`, `text-secondary`, etc.)
- Fonts load correctly
- Design tokens accessible via CSS variables

---

### Task 4: Install and Configure Shadcn/ui

**Time Estimate:** 30 min

**Actions:**

- [ ] Initialize Shadcn/ui with `pnpm dlx shadcn@latest init`
  - Style: Default
  - Base color: Slate (will customize)
  - CSS variables: Yes
  - Configure `components.json` for `@/components/ui` path
- [ ] Install core components:
  - `button`
  - `card`
  - `dialog`
  - `input`
  - `label`
  - `badge`
  - `toast` / `sonner`
  - `dropdown-menu`
  - `separator`
  - `skeleton`
- [ ] Customize component styles to match design system

**Acceptance Criteria:**

- Shadcn components importable from `@/components/ui`
- Components render with correct styling
- Light/dark mode support functional

---

### Task 5: Set Up Prisma

**Time Estimate:** 30 min

**Actions:**

- [ ] Install Prisma: `pnpm add -D prisma` and `pnpm add @prisma/client`
- [ ] Initialize Prisma: `pnpm prisma init`
- [ ] Configure `schema.prisma`:
  - Provider: `postgresql`
  - Database URL from environment variable
  - Generator for Prisma Client
- [ ] Create Prisma client singleton at `src/lib/db/client.ts`
- [ ] Add npm scripts: `db:generate`, `db:push`, `db:migrate`, `db:studio`, `db:seed`

**Acceptance Criteria:**

- `pnpm prisma generate` works (even with empty schema)
- Prisma client singleton created
- Database scripts in package.json

---

### Task 6: Install Supporting Libraries

**Time Estimate:** 30 min

**Actions:**

- [ ] Install Zod: `pnpm add zod`
- [ ] Install Zustand: `pnpm add zustand`
- [ ] Install TanStack Query: `pnpm add @tanstack/react-query`
- [ ] Install React Hook Form: `pnpm add react-hook-form @hookform/resolvers`
- [ ] Install Lucide React: `pnpm add lucide-react`
- [ ] Set up TanStack Query provider in app layout
- [ ] Create placeholder Zustand store at `src/stores/ui.store.ts`

**Acceptance Criteria:**

- All packages installed without conflicts
- Query provider wraps app
- Basic store functional

---

### Task 7: Set Up Testing Infrastructure

**Time Estimate:** 30 min

**Actions:**

- [ ] Install Vitest and related packages:
  - `vitest`
  - `@vitejs/plugin-react`
  - `@testing-library/react`
  - `@testing-library/jest-dom`
  - `msw` (for API mocking)
- [ ] Create `vitest.config.ts` with:
  - React plugin
  - Path aliases matching tsconfig
  - Setup file for test utilities
- [ ] Create test directory structure:
  ```
  tests/
  ├── unit/
  ├── integration/
  ├── e2e/
  ├── fixtures/
  └── helpers/
  ```
- [ ] Add npm scripts: `test`, `test:watch`, `test:coverage`
- [ ] Create a sample test to verify setup

**Acceptance Criteria:**

- `pnpm test` runs successfully
- Test files can import from `@/` paths
- React Testing Library available

---

### Task 8: Create Directory Structure

**Time Estimate:** 45 min

**Actions:**

- [ ] Create full directory structure per `architecture.md`:
  ```
  src/
  ├── app/
  │   ├── (auth)/
  │   ├── (dashboard)/
  │   ├── api/v1/
  │   └── globals.css
  ├── components/
  │   ├── ui/
  │   ├── features/
  │   └── layouts/
  ├── lib/
  │   ├── modules/
  │   │   ├── integrations/
  │   │   ├── actions/
  │   │   ├── execution/
  │   │   ├── credentials/
  │   │   ├── auth/
  │   │   ├── ai/
  │   │   └── logging/
  │   ├── api/
  │   │   └── middleware/
  │   ├── db/
  │   └── utils/
  ├── hooks/
  ├── stores/
  └── types/
  ```
- [ ] Add index.ts files to each module folder
- [ ] Create placeholder files for module services/repositories
- [ ] Create `.env.example` with all required variables
- [ ] Create `.env.local` template (gitignored)

**Acceptance Criteria:**

- All directories exist
- Module index files export empty objects (no errors)
- Environment template comprehensive

---

### Task 9: Configure GitHub Actions CI

**Time Estimate:** 30 min

**Actions:**

- [ ] Create `.github/workflows/ci.yml`:
  - Trigger on push and pull_request
  - Steps: checkout, pnpm setup, install, lint, type-check, test, build
- [ ] Ensure all CI checks pass on fresh codebase
- [ ] Add branch protection rules documentation

**Acceptance Criteria:**

- CI workflow file valid
- `pnpm lint && pnpm type-check && pnpm test && pnpm build` all pass

---

### Task 10: Final Verification and Documentation

**Time Estimate:** 20 min

**Actions:**

- [ ] Run full verification:
  - `pnpm install` (clean install)
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm type-check`
  - `pnpm test`
  - `pnpm build`
  - `pnpm dev` (verify dev server)
- [ ] Update `README.md` with:
  - Project description
  - Prerequisites (Node 20, pnpm)
  - Setup instructions
  - Available scripts
  - Directory structure overview
- [ ] Verify all npm scripts documented

**Acceptance Criteria:**

- All checks pass
- README enables new developer onboarding
- Project runs locally

---

## Definition of Done

- [ ] All 10 tasks completed
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm build` completes successfully
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Directory structure matches architecture.md
- [ ] Design system colors/fonts configured
- [ ] CI workflow ready for GitHub
- [ ] README with setup instructions

---

## Notes

- Database tables are NOT included in this feature—that's Feature #2 (Database Setup)
- No actual business logic or UI pages—just scaffolding
- Focus on getting the foundation solid so all future features have a clean starting point

---

## Related Documentation

- [Architecture](../architecture.md) - Directory structure, tech stack details
- [Product Spec](../product_spec.md) - Design system colors, typography
