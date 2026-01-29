# Update Task

Implement an update or fix for **Connection Management UX** related to the feature **Multi-App Connections**: **Lift connection selector to integration level and distribute config across tabs**

## Problem Statement

The current implementation puts all connection-specific configuration (credentials, health, field mappings, preamble template, activity) inside the Connections tab. This buries important configuration and doesn't leverage the existing tab structure.

## Desired Architecture

1. **Connection Selector at Integration Level** - Move the connection dropdown to the IntegrationHeader (or just below it), so it affects all tabs. The selected connection becomes the "active context" for the entire integration detail page.

2. **Tab Restructure:**
   - **Actions** - No change (actions are integration-level)
   - **Overview** - Add Auth status and Health indicators for the selected connection
   - **Logs** - Filter by selected connection (already exists, just needs connection filter)
   - **Field Mappings** - New tab for per-connection field mapping overrides
   - **LLM Response** - New tab for preamble template configuration
   - **Connections** - Simplified to just list/add/delete connections (not full config)

3. **Context-Aware Tabs** - When a connection is selected, relevant tabs show that connection's configuration. The connection selector should be visible and accessible from any tab.

## Implementation Steps

1. Read `docs/Features/hybrid-auth-model.md` for relevant feature docs
2. Plan the refactoring approach
3. Move ConnectionSelector to IntegrationDetail level (above tabs)
4. Update IntegrationOverview to show connection credentials + health
5. Create new FieldMappingsTab component
6. Create new LLMResponseTab component (preamble template)
7. Update LogsTab to filter by selected connection
8. Simplify ConnectionList to just manage connections (no inline config)
9. Run linting after implementation
10. Run tests
11. Update relevant docs
12. Confirm when complete and prepare commit message

Start with step 1.
