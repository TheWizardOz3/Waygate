# Feature: Basic Configuration UI

**Status:** ✅ Complete  
**Priority:** P0 (MVP Required)  
**Estimated Complexity:** HIGH (expanded from MEDIUM)  
**Dependencies:** Gateway API ✅, AI Documentation Scraper ✅, Action Registry ✅
**Completed:** 2026-01-02

---

## Overview

The Basic Configuration UI is the web dashboard that enables developers to create integrations from API docs, manage actions (both AI-generated and manual), test connections, and monitor request logs. This is the final MVP feature that completes the core user-facing workflow.

### User Stories

> As a developer, I want to create an integration by providing API documentation, so that I can quickly set up connections without manually defining every endpoint.

> As a developer, I want to view, edit, and create actions for my integrations, so that I can customize what AI generated or add actions it missed.

> As a developer, I want to test actions directly in the UI, so that I can verify my configuration before using it in my app.

### Goals

1. **Create Integration Wizard**: Multi-step flow to scrape docs, review AI-generated actions, and configure auth
2. **Full Action Management**: Tabular view with create, edit, delete capabilities for actions
3. **Manual Override**: Ability to tweak AI-generated actions or create new ones from scratch
4. **Action Testing**: Execute actions with sample data and view formatted responses
5. **Connection Management**: OAuth and API key flows with status indicators
6. **Request Logs**: Filterable log viewer for debugging
7. **Developer-Focused Aesthetic**: Clean UI similar to Supabase, Linear, Postman

---

## Requirements

### Functional Requirements

- [x] **Dashboard Home**: Summary view with integration count, health status, recent activity
- [x] **Integration List**: View all integrations with status indicators and quick actions
- [x] **Create Integration Wizard**: Multi-step flow: URL input → AI scraping → Review actions → Configure auth → Activate
- [x] **Integration Detail**: Full configuration panel with tabs for overview, actions, credentials, logs
- [x] **Action Table**: Tabular view of all actions with inline editing, sorting, filtering
- [x] **Action Editor**: Full editor for creating/editing actions with schema builder
- [x] **Action Testing ("Try It")**: Execute actions with sample data and view responses
- [x] **Connection Wizards**: Guided flows for OAuth and API key authentication
- [x] **Request Logs**: Filterable log viewer for debugging requests
- [x] **Settings Page**: API key management and tenant settings

### Non-Functional Requirements

- [x] Responsive design (desktop-first, tablet-friendly)
- [x] Dark mode support
- [x] Loading states with skeleton loaders
- [x] Error boundaries with friendly error messages
- [x] Optimistic updates for better UX

---

## Design System Architecture

> **Goal**: All visual styling (colors, fonts, spacing, component variants) is controlled via centralized tokens. Changing the theme = updating a few variables, not touching individual components.

### Theming Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DESIGN TOKEN LAYERS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CSS Variables (globals.css)          ← SINGLE SOURCE OF TRUTH       │
│     :root {                                                             │
│       --color-primary: #1E1B4B;                                         │
│       --color-secondary: #7C3AED;                                       │
│       --font-heading: 'Crimson Pro';                                    │
│       --radius: 0.5rem;                                                 │
│       ...                                                               │
│     }                                                                   │
│                              │                                          │
│                              ▼                                          │
│  2. Tailwind Config (tailwind.config.ts) ← REFERENCES CSS VARS          │
│     colors: {                                                           │
│       primary: 'hsl(var(--primary))',                                   │
│       secondary: 'hsl(var(--secondary))',                               │
│     }                                                                   │
│                              │                                          │
│                              ▼                                          │
│  3. Shadcn/ui Components                 ← USE TAILWIND CLASSES         │
│     <Button className="bg-primary text-primary-foreground" />           │
│                              │                                          │
│                              ▼                                          │
│  4. Feature Components                   ← COMPOSE SHADCN + TAILWIND    │
│     <IntegrationCard className="bg-surface border-border" />            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

To change the entire theme: Update CSS variables in globals.css
→ Everything updates automatically (buttons, cards, text, etc.)
```

### CSS Variables (Single Source of Truth)

All design tokens live in `globals.css` as CSS custom properties:

```css
/* src/app/globals.css */
:root {
  /* Colors - Semantic naming */
  --background: 250 250 249; /* Stone 50 - Page backgrounds */
  --foreground: 28 25 23; /* Stone 900 - Primary text */

  --primary: 30 27 75; /* Indigo 950 - Primary actions */
  --primary-foreground: 250 250 249;

  --secondary: 124 58 237; /* Violet 600 - Secondary actions */
  --secondary-foreground: 255 255 255;

  --accent: 16 185 129; /* Emerald 500 - Success/active */
  --accent-foreground: 255 255 255;

  --destructive: 220 38 38; /* Red 600 - Errors/delete */
  --destructive-foreground: 255 255 255;

  --warning: 245 158 11; /* Amber 500 - Warnings */
  --warning-foreground: 0 0 0;

  --muted: 245 245 244; /* Stone 100 */
  --muted-foreground: 120 113 108; /* Stone 500 */

  --card: 255 255 255;
  --card-foreground: 28 25 23;

  --border: 231 229 228; /* Stone 200 */
  --input: 231 229 228;
  --ring: 124 58 237; /* Focus ring = secondary */

  /* Typography */
  --font-heading: 'Crimson Pro', serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing & Sizing */
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-lg: 0.75rem;
}

/* Dark mode - just override the variables */
.dark {
  --background: 28 25 23;
  --foreground: 250 250 249;
  --card: 41 37 36;
  --border: 68 64 60;
  /* ... other dark overrides */
}
```

### Tailwind Config (References CSS Variables)

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        // ... all semantic colors
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
      },
    },
  },
};
```

### What This Enables

| Change You Want                        | What You Update                        | Effort    |
| -------------------------------------- | -------------------------------------- | --------- |
| Swap primary color from Indigo to Blue | Change `--primary` in globals.css      | 1 line    |
| Change heading font                    | Change `--font-heading` in globals.css | 1 line    |
| Switch to dark mode                    | Toggle `.dark` class on `<html>`       | Automatic |
| Adjust border radius globally          | Change `--radius` in globals.css       | 1 line    |
| Complete rebrand                       | Update CSS variables section           | ~20 lines |

### Default Theme Values

#### Colors

| Token           | Light Mode  | Dark Mode   | Usage                  |
| --------------- | ----------- | ----------- | ---------------------- |
| `--primary`     | Indigo 950  | Indigo 400  | Primary buttons, links |
| `--secondary`   | Violet 600  | Violet 400  | Secondary actions      |
| `--accent`      | Emerald 500 | Emerald 400 | Success, active states |
| `--warning`     | Amber 500   | Amber 400   | Warnings, pending      |
| `--destructive` | Red 600     | Red 400     | Errors, delete actions |
| `--background`  | Stone 50    | Stone 900   | Page backgrounds       |
| `--card`        | White       | Stone 800   | Cards, modals          |
| `--border`      | Stone 200   | Stone 700   | Borders, dividers      |

#### Typography

| Token            | Value          | Usage                 |
| ---------------- | -------------- | --------------------- |
| `--font-heading` | Crimson Pro    | H1, H2, H3            |
| `--font-body`    | Inter          | Body text, UI labels  |
| `--font-mono`    | JetBrains Mono | Code, JSON, endpoints |

#### Sizing

| Token         | Value   | Usage                   |
| ------------- | ------- | ----------------------- |
| `--radius`    | 0.5rem  | Default border radius   |
| `--radius-sm` | 0.25rem | Small elements (badges) |
| `--radius-lg` | 0.75rem | Large elements (cards)  |

### Component Library

- **Base**: Shadcn/ui (uses CSS variables by default ✓)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table
- **Variants**: CVA (class-variance-authority) for component variants

### Status Indicators (Semantic Colors)

| Status           | CSS Variable    | Tailwind Class              | Label     |
| ---------------- | --------------- | --------------------------- | --------- |
| Active/Connected | `--accent`      | `text-accent` / `bg-accent` | "Active"  |
| Error            | `--destructive` | `text-destructive`          | "Error"   |
| Warning/Pending  | `--warning`     | `text-warning`              | "Pending" |
| Draft/Inactive   | `--muted`       | `text-muted-foreground`     | "Draft"   |

### Component Variant Pattern

All custom components use CVA for consistent variant management:

```typescript
// Example: Button variants (already in Shadcn)
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
  }
);
```

**Key point**: Variants reference semantic tokens (`bg-primary`), not hard-coded colors (`bg-indigo-950`). This ensures theme changes propagate automatically.

---

## Page Structure

```
(dashboard)/
├── page.tsx                           # Dashboard Home
├── integrations/
│   ├── page.tsx                       # Integration List
│   ├── new/
│   │   └── page.tsx                   # Create Integration Wizard
│   └── [id]/
│       ├── page.tsx                   # Integration Detail (tabs: Overview, Actions, Logs)
│       ├── actions/
│       │   ├── page.tsx               # Action Table (list all actions)
│       │   ├── new/
│       │   │   └── page.tsx           # Create New Action
│       │   └── [actionId]/
│       │       ├── page.tsx           # Action Detail/Edit
│       │       └── test/
│       │           └── page.tsx       # Action Tester ("Try It")
│       └── settings/
│           └── page.tsx               # Integration Settings (auth, delete)
├── logs/
│   └── page.tsx                       # Request Logs (all integrations)
└── settings/
    └── page.tsx                       # Tenant Settings & API Keys
```

---

## Core User Flows

### Flow 1: Create Integration from API Docs

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Enter Documentation URL                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  API Documentation URL: [https://api.slack.com/methods         ]  │  │
│  │                                                                   │  │
│  │  Wishlist (optional): What actions do you want?                   │  │
│  │  [Send messages, list channels, manage users                   ]  │  │
│  │                                                                   │  │
│  │                                        [Cancel]  [Start Scraping] │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Scraping Progress                                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  🔄 Scraping API documentation...                                 │  │
│  │                                                                   │  │
│  │  ████████████░░░░░░░░░░░░  45%                                   │  │
│  │                                                                   │  │
│  │  ✓ Crawled 12 pages                                              │  │
│  │  ✓ Detected OAuth2 authentication                                 │  │
│  │  → Extracting endpoints...                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Review Detected Actions                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AI detected 24 actions. Select which to include:                 │  │
│  │                                                                   │  │
│  │  ☑ chat.postMessage    POST  /chat.postMessage    ★★★ High conf  │  │
│  │  ☑ users.list          GET   /users.list          ★★★ High conf  │  │
│  │  ☑ channels.create     POST  /channels.create     ★★☆ Med conf   │  │
│  │  ☐ admin.users.remove  POST  /admin.users.remove  ★☆☆ Low conf   │  │
│  │  ...                                                              │  │
│  │                                                                   │  │
│  │  [Select All]  [Deselect All]  [Edit Selected]                   │  │
│  │                                                                   │  │
│  │                                           [Back]  [Continue →]    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Configure Authentication                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Detected: OAuth 2.0                                              │  │
│  │                                                                   │  │
│  │  Client ID:     [xoxb-your-client-id                           ]  │  │
│  │  Client Secret: [••••••••••••••••••••                           ]  │  │
│  │  Scopes:        [chat:write, users:read, channels:manage       ]  │  │
│  │                                                                   │  │
│  │                                        [Back]  [Connect & Test]   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: Success!                                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ✓ Integration "Slack" created successfully!                      │  │
│  │                                                                   │  │
│  │  • 18 actions ready to use                                        │  │
│  │  • OAuth connected                                                │  │
│  │  • Status: Active                                                 │  │
│  │                                                                   │  │
│  │  [View Integration]  [Test an Action]  [Create Another]           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Action Management (Tabular View)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Slack > Actions                                         [+ New Action] │
├─────────────────────────────────────────────────────────────────────────┤
│  Search: [________________]  Filter: [All Methods ▼]  [AI ▼] [Manual ▼] │
├─────────────────────────────────────────────────────────────────────────┤
│  ☐ │ Name              │ Method │ Endpoint           │ Source │ Actions │
│────┼───────────────────┼────────┼────────────────────┼────────┼─────────│
│  ☐ │ chat.postMessage  │ POST   │ /chat.postMessage  │ 🤖 AI  │ ✎ 🗑 ▶  │
│  ☐ │ users.list        │ GET    │ /users.list        │ 🤖 AI  │ ✎ 🗑 ▶  │
│  ☐ │ channels.create   │ POST   │ /channels.create   │ 🤖 AI  │ ✎ 🗑 ▶  │
│  ☐ │ custom.webhook    │ POST   │ /webhook/custom    │ ✋ Man │ ✎ 🗑 ▶  │
│────┴───────────────────┴────────┴────────────────────┴────────┴─────────│
│  Showing 4 of 18 actions                          [← Prev] [Next →]     │
└─────────────────────────────────────────────────────────────────────────┘

Legend: ✎ = Edit, 🗑 = Delete, ▶ = Test ("Try It")
```

### Flow 3: Action Editor

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Edit Action: chat.postMessage                     [Cancel]  [Save]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Basic Info ───────────────────────────────────────────────────────┐ │
│  │  Name:        [chat.postMessage                                 ]  │ │
│  │  Description: [Send a message to a channel                      ]  │ │
│  │  Method:      [POST ▼]     Endpoint: [/chat.postMessage         ]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ Input Schema ─────────────────────────────────────────────────────┐ │
│  │  ┌──────────────┬──────────┬──────────┬─────────────────────────┐  │ │
│  │  │ Field        │ Type     │ Required │ Description             │  │ │
│  │  ├──────────────┼──────────┼──────────┼─────────────────────────┤  │ │
│  │  │ channel      │ string   │ ✓        │ Channel ID to post to   │  │ │
│  │  │ text         │ string   │ ✓        │ Message text            │  │ │
│  │  │ thread_ts    │ string   │          │ Thread timestamp        │  │ │
│  │  │ [+ Add Field]│          │          │                         │  │ │
│  │  └──────────────┴──────────┴──────────┴─────────────────────────┘  │ │
│  │                                                                    │ │
│  │  [View as JSON]  [Import from JSON]                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ Output Schema ────────────────────────────────────────────────────┐ │
│  │  (Similar field table for response schema)                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ Advanced ─────────────────────────────────────────────────────────┐ │
│  │  Cacheable: [ ]    Cache TTL: [___] seconds                        │ │
│  │  Custom Retry Policy: [ ]                                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Foundation & Design System (~2.5 hours)

| #   | Task                  | Description                                                                                       | Files                                                                                                                                                                       |
| --- | --------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Design Token Setup    | Define all CSS variables (colors, fonts, spacing, radii) in globals.css as single source of truth | `src/app/globals.css`                                                                                                                                                       |
| 1.2 | Tailwind Theme Config | Extend Tailwind config to reference CSS variables (colors, fonts, radii)                          | `tailwind.config.ts`                                                                                                                                                        |
| 1.3 | Font Loading          | Configure Crimson Pro, Inter, and JetBrains Mono fonts via next/font                              | `src/app/layout.tsx`                                                                                                                                                        |
| 1.4 | Dark Mode Setup       | Add dark mode CSS variable overrides, theme toggle provider                                       | `src/app/globals.css`, `src/components/providers/ThemeProvider.tsx`                                                                                                         |
| 1.5 | Dashboard Layout      | Create authenticated dashboard layout with sidebar navigation, header, and main content area      | `src/app/(dashboard)/layout.tsx`, `src/components/layouts/DashboardLayout.tsx`, `src/components/layouts/DashboardSidebar.tsx`, `src/components/layouts/DashboardHeader.tsx` |
| 1.6 | Navigation Component  | Build sidebar navigation with links to all dashboard sections, active state handling              | `src/components/layouts/DashboardSidebar.tsx`                                                                                                                               |

### Phase 2: Integration List & Management (~2 hours)

| #   | Task                     | Description                                                                    | Files                                                                                                                                                               |
| --- | ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Integration Hooks        | Create React Query hooks for fetching integrations list and single integration | `src/hooks/useIntegrations.ts`                                                                                                                                      |
| 2.2 | Integration List Page    | Build integrations list page with cards showing name, status, action count     | `src/app/(dashboard)/integrations/page.tsx`, `src/components/features/integrations/IntegrationList.tsx`, `src/components/features/integrations/IntegrationCard.tsx` |
| 2.3 | Integration Status Badge | Create reusable status badge component with color coding                       | `src/components/features/integrations/IntegrationStatusBadge.tsx`                                                                                                   |
| 2.4 | Empty State              | Design empty state for no integrations with CTA to create first                | `src/components/features/integrations/IntegrationEmptyState.tsx`                                                                                                    |

### Phase 3: Create Integration Wizard (~3 hours)

| #   | Task                      | Description                                                                    | Files                                                                                                                                                                          |
| --- | ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | Wizard Container          | Multi-step wizard with progress indicator, step navigation, state management   | `src/app/(dashboard)/integrations/new/page.tsx`, `src/components/features/integrations/CreateIntegrationWizard.tsx`, `src/components/features/integrations/WizardProgress.tsx` |
| 3.2 | Step 1: URL Input         | Form for documentation URL and optional wishlist of desired actions            | `src/components/features/integrations/wizard/StepUrlInput.tsx`                                                                                                                 |
| 3.3 | Step 2: Scraping Progress | Real-time progress display during AI scraping with status updates              | `src/components/features/integrations/wizard/StepScraping.tsx`                                                                                                                 |
| 3.4 | Step 3: Review Actions    | Selectable list of AI-detected actions with confidence indicators, bulk select | `src/components/features/integrations/wizard/StepReviewActions.tsx`, `src/components/features/integrations/wizard/ActionReviewCard.tsx`                                        |
| 3.5 | Step 4: Configure Auth    | Auth type detection, credential input forms (OAuth, API Key, Basic)            | `src/components/features/integrations/wizard/StepConfigureAuth.tsx`                                                                                                            |
| 3.6 | Step 5: Success           | Completion summary with next steps and quick actions                           | `src/components/features/integrations/wizard/StepSuccess.tsx`                                                                                                                  |
| 3.7 | Scrape Job Polling        | Hook to poll scrape job status and handle completion/errors                    | `src/hooks/useScrapeJob.ts`                                                                                                                                                    |

### Phase 4: Integration Detail View (~2 hours)

| #   | Task                      | Description                                                                               | Files                                                                                                          |
| --- | ------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 4.1 | Integration Detail Page   | Tabbed layout with Overview, Actions, Logs sections                                       | `src/app/(dashboard)/integrations/[id]/page.tsx`, `src/components/features/integrations/IntegrationDetail.tsx` |
| 4.2 | Integration Header        | Show integration name, status, documentation URL, quick actions (edit, delete, re-scrape) | `src/components/features/integrations/IntegrationHeader.tsx`                                                   |
| 4.3 | Overview Tab              | Summary stats, credentials status, recent activity for this integration                   | `src/components/features/integrations/IntegrationOverview.tsx`                                                 |
| 4.4 | Credentials Panel         | Display credential status, expiration, scopes; include connect/disconnect buttons         | `src/components/features/integrations/CredentialsPanel.tsx`                                                    |
| 4.5 | Delete Integration Dialog | Confirmation dialog for deleting integrations with warning about losing actions           | `src/components/features/integrations/DeleteIntegrationDialog.tsx`                                             |

### Phase 5: Action Table & Management (~3 hours)

| #   | Task                 | Description                                                                               | Files                                                                                                       |
| --- | -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 5.1 | Actions Hooks        | React Query hooks for fetching, creating, updating, deleting actions                      | `src/hooks/useActions.ts`                                                                                   |
| 5.2 | Action Table Page    | TanStack Table with sorting, filtering, pagination, bulk selection                        | `src/app/(dashboard)/integrations/[id]/actions/page.tsx`, `src/components/features/actions/ActionTable.tsx` |
| 5.3 | Action Row           | Table row with name, method badge, endpoint, source indicator (AI/Manual), action buttons | `src/components/features/actions/ActionTableRow.tsx`                                                        |
| 5.4 | Method Badge         | Colored badge for HTTP methods (GET=green, POST=blue, PUT=orange, DELETE=red)             | `src/components/features/actions/MethodBadge.tsx`                                                           |
| 5.5 | Bulk Actions         | Select multiple actions for bulk delete, export                                           | `src/components/features/actions/BulkActionBar.tsx`                                                         |
| 5.6 | Delete Action Dialog | Confirmation dialog for deleting actions                                                  | `src/components/features/actions/DeleteActionDialog.tsx`                                                    |

### Phase 6: Action Editor (~3 hours)

| #   | Task               | Description                                                                          | Files                                                                                                                                                                                 |
| --- | ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Action Editor Page | Full-page editor for creating or editing an action                                   | `src/app/(dashboard)/integrations/[id]/actions/new/page.tsx`, `src/app/(dashboard)/integrations/[id]/actions/[actionId]/page.tsx`, `src/components/features/actions/ActionEditor.tsx` |
| 6.2 | Basic Info Section | Name, description, method, endpoint inputs                                           | `src/components/features/actions/editor/BasicInfoSection.tsx`                                                                                                                         |
| 6.3 | Schema Builder     | Visual schema builder with field table (add/edit/remove fields, set types, required) | `src/components/features/actions/editor/SchemaBuilder.tsx`, `src/components/features/actions/editor/SchemaFieldRow.tsx`                                                               |
| 6.4 | JSON Schema Toggle | Switch between visual builder and raw JSON editor                                    | `src/components/features/actions/editor/JsonSchemaEditor.tsx`                                                                                                                         |
| 6.5 | Advanced Settings  | Cacheable toggle, cache TTL, custom retry config                                     | `src/components/features/actions/editor/AdvancedSettings.tsx`                                                                                                                         |
| 6.6 | Action Validation  | Client-side validation of action config before save                                  | `src/lib/modules/actions/action.validation.ts`                                                                                                                                        |

### Phase 7: Action Testing ("Try It") (~2.5 hours)

| #   | Task                    | Description                                                                  | Files                                                                                                                        |
| --- | ----------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Action Test Page        | Full-page action tester with input form and response viewer                  | `src/app/(dashboard)/integrations/[id]/actions/[actionId]/test/page.tsx`, `src/components/features/actions/ActionTester.tsx` |
| 7.2 | Dynamic Form Generator  | Generate form inputs from JSON Schema (text, number, boolean, array, object) | `src/components/features/actions/DynamicSchemaForm.tsx`                                                                      |
| 7.3 | Request/Response Viewer | Display formatted request and response with syntax highlighting (JSON)       | `src/components/features/actions/RequestResponseViewer.tsx`                                                                  |
| 7.4 | Test History            | Show recent test requests for quick re-execution (localStorage)              | `src/components/features/actions/TestHistory.tsx`                                                                            |
| 7.5 | Quick Test Button       | "Try It" button on action table that opens inline tester or modal            | `src/components/features/actions/QuickTestModal.tsx`                                                                         |

### Phase 8: Connection Wizards (~1.5 hours)

| #   | Task                      | Description                                                     | Files                                                                                                           |
| --- | ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 8.1 | OAuth Connect Flow        | Initiate OAuth flow, handle callback, show success/error states | `src/components/features/auth/OAuthConnectButton.tsx`, `src/app/(dashboard)/integrations/[id]/connect/page.tsx` |
| 8.2 | API Key Input Form        | Secure input for API keys with validation and test connection   | `src/components/features/auth/ApiKeyConnectForm.tsx`                                                            |
| 8.3 | Connection Status Display | Show connection state with refresh and disconnect options       | `src/components/features/auth/ConnectionStatus.tsx`                                                             |

### Phase 9: Request Logs (~1.5 hours)

| #   | Task              | Description                                                         | Files                                                                             |
| --- | ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 9.1 | Logs Hooks        | React Query hooks for fetching paginated logs with filters          | `src/hooks/useLogs.ts`                                                            |
| 9.2 | Logs Page         | Filterable log viewer with date range, integration, status filters  | `src/app/(dashboard)/logs/page.tsx`, `src/components/features/logs/LogViewer.tsx` |
| 9.3 | Log Entry Row     | Compact row showing timestamp, integration, action, status, latency | `src/components/features/logs/LogEntryRow.tsx`                                    |
| 9.4 | Log Detail Dialog | Modal showing full request/response details for a log entry         | `src/components/features/logs/LogDetailDialog.tsx`                                |

### Phase 10: Dashboard Home (~1.5 hours)

| #    | Task                 | Description                                                                 | Files                                                                                 |
| ---- | -------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 10.1 | Dashboard Home Page  | Summary cards: total integrations, healthy/unhealthy count, recent requests | `src/app/(dashboard)/page.tsx`, `src/components/features/dashboard/DashboardHome.tsx` |
| 10.2 | Stats Cards          | Reusable stat card component with icon, label, value, trend                 | `src/components/features/dashboard/StatsCard.tsx`                                     |
| 10.3 | Recent Activity Feed | Show last 5-10 requests with quick navigation to full logs                  | `src/components/features/dashboard/RecentActivity.tsx`                                |
| 10.4 | Quick Actions Panel  | Shortcuts to common tasks: create integration, view docs                    | `src/components/features/dashboard/QuickActions.tsx`                                  |

### Phase 11: Settings & API Keys (~1 hour)

| #    | Task            | Description                                                         | Files                                                                                        |
| ---- | --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 11.1 | Settings Page   | Tenant settings with API key display (masked), regenerate option    | `src/app/(dashboard)/settings/page.tsx`, `src/components/features/settings/SettingsPage.tsx` |
| 11.2 | API Key Display | Masked display with copy-to-clipboard, regenerate with confirmation | `src/components/features/settings/ApiKeyDisplay.tsx`                                         |

### Phase 12: Polish & Refinement (~1.5 hours)

| #    | Task                | Description                                                            | Files                                        |
| ---- | ------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| 12.1 | Loading States      | Add skeleton loaders to all data-fetching pages                        | Various components                           |
| 12.2 | Error Boundaries    | Add error boundaries with friendly error messages and retry buttons    | `src/components/layouts/ErrorBoundary.tsx`   |
| 12.3 | Toast Notifications | Configure sonner for success/error toasts on CRUD actions              | `src/components/providers/ToastProvider.tsx` |
| 12.4 | Responsive Tweaks   | Ensure tablet-friendly layouts, collapsible sidebar on smaller screens | Various components                           |
| 12.5 | Empty States        | Friendly empty states for all list views with CTAs                     | Various components                           |

---

## API Endpoints Used

The UI will consume these existing API endpoints:

| Endpoint                               | Method | Purpose                      |
| -------------------------------------- | ------ | ---------------------------- |
| `/api/v1/integrations`                 | GET    | List integrations            |
| `/api/v1/integrations`                 | POST   | Create integration           |
| `/api/v1/integrations/:id`             | GET    | Get integration detail       |
| `/api/v1/integrations/:id`             | PATCH  | Update integration           |
| `/api/v1/integrations/:id`             | DELETE | Delete integration           |
| `/api/v1/integrations/:id/actions`     | GET    | List actions for integration |
| `/api/v1/integrations/:id/health`      | GET    | Check integration health     |
| `/api/v1/actions`                      | POST   | Create new action            |
| `/api/v1/actions/:id`                  | GET    | Get action detail            |
| `/api/v1/actions/:id`                  | PATCH  | Update action                |
| `/api/v1/actions/:id`                  | DELETE | Delete action                |
| `/api/v1/actions/:integration/:action` | POST   | Invoke action (for testing)  |
| `/api/v1/scrape`                       | POST   | Initiate doc scraping        |
| `/api/v1/scrape/:jobId`                | GET    | Get scrape job status        |
| `/api/v1/logs`                         | GET    | Query request logs           |
| `/api/v1/auth/callback/:provider`      | GET    | OAuth callback               |

### New API Endpoints Needed

| Endpoint                           | Method           | Purpose                       | Notes           |
| ---------------------------------- | ---------------- | ----------------------------- | --------------- |
| `/api/v1/integrations/:id/actions` | POST             | Create action for integration | May need to add |
| `/api/v1/actions/:id`              | GET/PATCH/DELETE | Single action CRUD            | May need to add |

---

## Acceptance Criteria

### Integration Management

- [x] User can view list of all integrations with status indicators
- [x] User can create new integration via wizard flow
- [x] User can view integration detail with tabs
- [x] User can delete an integration (with confirmation)
- [x] User can re-trigger AI scraping for existing integration

### Create Integration Wizard

- [x] User can enter documentation URL and optional wishlist
- [x] User sees real-time progress during scraping
- [x] User can review and select AI-detected actions
- [x] User can configure authentication (OAuth or API Key)
- [x] User sees success confirmation with next steps

### Action Management

- [x] User can view all actions in a sortable, filterable table
- [x] User can distinguish AI-generated vs manually created actions
- [x] User can create a new action manually
- [x] User can edit any action (AI-generated or manual)
- [x] User can delete actions (with confirmation)
- [x] User can bulk select and delete actions

### Action Editor

- [x] User can edit action name, description, method, endpoint
- [x] User can build input/output schemas visually (add/edit/remove fields)
- [x] User can switch to raw JSON view for schemas
- [x] User can configure advanced settings (caching, retry)
- [x] Validation prevents saving invalid configurations

### Action Testing

- [x] User can test any action with dynamic form based on schema
- [x] User sees formatted request/response with syntax highlighting
- [x] User can view test history and re-run previous tests

### Connection & Auth

- [x] User can connect OAuth integration via redirect flow
- [x] User can enter API key credentials with test connection
- [x] User can see connection status and expiration
- [x] User can disconnect/revoke credentials

### Logs & Monitoring

- [x] User can view all request logs with filters
- [x] User can filter by date, integration, status
- [x] User can view detailed log entry with full request/response

### Dashboard & Settings

- [x] User sees summary dashboard on login
- [x] User can view and copy their Waygate API key
- [x] User can regenerate API key (with confirmation)

---

## Test Plan

### Manual Testing Checklist

1. **Create Integration Wizard**
   - Enter valid docs URL → scraping starts
   - Progress updates in real-time
   - AI detects actions with confidence scores
   - Can select/deselect actions
   - Auth configuration saves correctly
   - Integration created successfully

2. **Action Table**
   - Actions display in table format
   - Sorting by name, method works
   - Filtering by method, source works
   - Bulk selection works
   - Delete single action works
   - Bulk delete works

3. **Action Editor**
   - Can create new action from scratch
   - Can edit existing action
   - Schema builder adds/removes fields
   - JSON toggle works bidirectionally
   - Save validates and persists changes

4. **Action Testing**
   - Form generates from schema
   - Required fields enforced
   - Request executes successfully
   - Response displays formatted
   - Errors display clearly

5. **Auth Flows**
   - OAuth redirect works
   - Callback handles success/error
   - API key saves and tests
   - Status updates correctly

### Integration Tests (Post-Feature)

- Test API client functions with MSW mocks
- Test wizard state management
- Test form validation
- Test table interactions

---

## Estimated Timeline

| Phase                         | Estimated Time  |
| ----------------------------- | --------------- |
| 1. Foundation & Design System | ~2.5 hours      |
| 2. Integration List           | ~2 hours        |
| 3. Create Integration Wizard  | ~3 hours        |
| 4. Integration Detail View    | ~2 hours        |
| 5. Action Table & Management  | ~3 hours        |
| 6. Action Editor              | ~3 hours        |
| 7. Action Testing             | ~2.5 hours      |
| 8. Connection Wizards         | ~1.5 hours      |
| 9. Request Logs               | ~1.5 hours      |
| 10. Dashboard Home            | ~1.5 hours      |
| 11. Settings                  | ~1 hour         |
| 12. Polish                    | ~1.5 hours      |
| **Total**                     | **~25.5 hours** |

---

## Out of Scope (Deferred to V1+)

- Full keyboard shortcuts system
- Real-time WebSocket updates for scrape progress
- Drag-and-drop field reordering in schema builder
- Import/export integrations as JSON
- Advanced dark mode theming
- Mobile-optimized layouts
- AI suggestions for improving actions
- Action versioning/history

---

## References

- [Product Spec - Basic Configuration UI](../product_spec.md#feature-basic-configuration-ui)
- [Architecture - Directory Structure](../architecture.md#32-directory-tree)
- [Shadcn/ui Documentation](https://ui.shadcn.com)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [TanStack Table Documentation](https://tanstack.com/table/latest)
