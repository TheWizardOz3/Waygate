# Feature: V1 E2E Testing & Polish

**Status:** Planning  
**Milestone:** V1  
**Priority:** P0  
**Dependencies:** V0.75 Complete ✅  
**Created:** 2026-01-25

---

## 1. Overview

Quick E2E pass to verify core workflows work, fix any obvious bugs, and ensure the UI has clear information hierarchy. Not a comprehensive QA effort - just making sure the app is production-ready.

### Definition of Done

- Core happy paths work without errors
- Screens have clear information hierarchy and logical layout
- Dashboard shows real data

---

## 2. Implementation Tasks

### Phase 1: Core Happy Path Verification (2-3 hours)

Walk through the main user journey, fix anything broken:

| #   | Task                 | Description                                                       | Est.   | Status  |
| --- | -------------------- | ----------------------------------------------------------------- | ------ | ------- |
| 1.1 | Integration Creation | Create integration from docs URL → verify it works end-to-end     | 30 min | ✅ Done |
| 1.2 | Action Testing       | Test an action from the tester UI → verify request/response works | 20 min | ✅ Done |
| 1.3 | Connection Setup     | Create a connection, configure credentials, verify health check   | 30 min | ✅ Done |
| 1.4 | Gateway API Call     | Invoke action via API (curl/Postman) → verify full pipeline       | 20 min |         |
| 1.5 | Fix Critical Bugs    | Address any blockers found in 1.1-1.4                             | 60 min |         |

### Phase 2: Screen Layout & Information Hierarchy (2-3 hours)

Audit main screens for clarity and logical organization:

| #   | Task                 | Description                                                                    | Est.   |
| --- | -------------------- | ------------------------------------------------------------------------------ | ------ |
| 2.1 | Dashboard            | Verify stats are real, layout surfaces important info, CTAs are clear          | 30 min |
| 2.2 | Integration Detail   | Check info hierarchy - what's primary vs secondary, reduce visual clutter      | 30 min |
| 2.3 | Action Detail/Editor | Ensure schema, testing, mappings are logically organized                       | 30 min |
| 2.4 | Connection Detail    | Check credentials, health, mappings sections have clear hierarchy              | 30 min |
| 2.5 | Layout Fixes         | Address any issues found - consolidate buttons, improve grouping, reduce noise | 30 min |

### Phase 3: Edge Case Spot Check (1 hour)

Quick check of common failure modes:

| #   | Task           | Description                                               | Est.   |
| --- | -------------- | --------------------------------------------------------- | ------ |
| 3.1 | Invalid Inputs | Test a few forms with bad data, ensure validation works   | 20 min |
| 3.2 | Auth Failures  | Test with expired/invalid credentials, ensure clear error | 20 min |
| 3.3 | Bug Fixes      | Address any issues found                                  | 20 min |

---

## 3. Testing Checklist (Quick)

### Must Work

- [x] Create integration from docs URL ✅ (Task 1.1 complete)
- [x] Test action in UI ✅ (Task 1.2 complete)
- [x] Connection detail panel loads correctly ✅ (Task 1.3 complete)
- [x] Health check runs successfully ✅ (Task 1.3 complete)
- [ ] Invoke action via Gateway API
- [ ] Create connection with credentials
- [ ] View request logs

### Should Look Right

- [ ] Dashboard shows real stats
- [ ] Primary actions are obvious, secondary actions are tucked away
- [ ] Related info is grouped together
- [ ] No walls of buttons or cluttered toolbars

---

## 4. Known Issues

### Bugs Fixed

| Issue                                                                                                                                        | Severity | Status   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| "View Integration" button in wizard success step calls `reset()` before `router.push()`, causing wizard to flash step 1 before navigation    | Medium   | ✅ Fixed |
| Action update API call going to wrong route (`/api/v1/actions/{id}` instead of `/api/v1/integrations/{id}/actions/{id}`)                     | High     | ✅ Fixed |
| Name field validation rejects spaces (shows error for "Test Action" - must use dots/hyphens like "test.action")                              | Low      | Noted    |
| Action tester calling wrong URL (`/api/v1/gateway/{integrationId}/{actionSlug}` instead of `/api/v1/actions/{integrationSlug}/{actionSlug}`) | High     | ✅ Fixed |
| Gateway endpoint preview showing wrong path `/api/v1/gateway/` instead of `/api/v1/actions/`                                                 | Low      | ✅ Fixed |
| Missing `/api/v1/connections/{id}/credentials` endpoint - causing 404 errors in connection detail panel                                      | High     | ✅ Fixed |
| Prisma schema mismatch - `credential_source` column missing from database (P2022 error)                                                      | Critical | ✅ Fixed |
| Mappings endpoint returning 400 error - needs investigation                                                                                  | Medium   | Noted    |

### UX Issues for Phase 2 (Layout Pass)

| Issue                                            | Location           | Severity | Notes                                                                                                                                                                                                                             |
| ------------------------------------------------ | ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"No Auth" label is misleading**                | Integration Header | Medium   | When user skips auth in wizard, shows "No Auth" even if API requires OAuth. Should say "Auth not configured" or similar to indicate pending setup rather than no auth required.                                                   |
| **Overlapping Auth Management**                  | Integration Detail | Medium   | "No Auth" shown in header + Overview, but credentials managed in Connections tab. Users may be confused about where to configure auth. Consider clarifying relationship between integration auth type and connection credentials. |
| Integration list card clicks are slow/unreliable | Integrations list  | Low      | May be browser automation issue, needs manual verification                                                                                                                                                                        |

---

## 5. Estimated Timeline

**Total: 5-7 hours**

| Phase                        | Est. Time |
| ---------------------------- | --------- |
| 1. Core Happy Path           | 2-3 hours |
| 2. Screen Layout & Hierarchy | 2-3 hours |
| 3. Edge Cases                | 1 hour    |

---

## 6. Out of Scope

- Comprehensive test coverage
- Mobile/tablet testing
- Performance optimization
- Automated E2E tests
- Loading state polish
- Accessibility audit
