/**
 * Tool Export Service
 *
 * Business logic for exporting Waygate actions as AI-consumable tool definitions.
 * Supports multiple formats: universal (LLM-agnostic), LangChain, and MCP.
 *
 * Key responsibilities:
 * - Export integration actions as universal tools
 * - Export individual actions as tools
 * - Validate integration/action ownership
 * - Aggregate context types from actions
 */

import { prisma } from '@/lib/db/client';
import { findActionsByIntegration, findActionBySlug, toActionResponse } from '../actions';
import {
  transformActionToUniversalTool,
  transformActionsToUniversalTools,
} from './formats/universal.transformer';
import {
  transformUniversalExportToLangChain,
  type LangChainExportResponse,
  type LangChainTransformOptions,
} from './formats/langchain.transformer';
import {
  transformUniversalExportToMCP,
  type MCPExportResponse,
  type MCPTransformOptions,
} from './formats/mcp.transformer';
import {
  ToolExportErrorCodes,
  type ToolExportErrorCode,
  type UniversalTool,
  type ToolExportResponse,
  type SingleToolExportResponse,
} from './tool-export.schemas';

// =============================================================================
// Error Class
// =============================================================================

/**
 * Error thrown when tool export operations fail
 */
export class ToolExportError extends Error {
  constructor(
    public code: ToolExportErrorCode,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ToolExportError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for exporting tools
 */
export interface ExportToolsOptions {
  /** Include action metadata in descriptions */
  includeMetadata?: boolean;
  /** Maximum description length */
  maxDescriptionLength?: number;
  /** Include context type declarations */
  includeContextTypes?: boolean;
}

// =============================================================================
// Integration Tool Export
// =============================================================================

/**
 * Export all actions from an integration as universal tools.
 *
 * @param tenantId - The tenant requesting the export
 * @param integrationId - The integration to export
 * @param options - Export options
 * @returns Tool export response with all tools
 */
export async function exportIntegrationToolsUniversal(
  tenantId: string,
  integrationId: string,
  options: ExportToolsOptions = {}
): Promise<ToolExportResponse> {
  // Verify integration ownership and get metadata
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      tenantId,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!integration) {
    throw new ToolExportError(
      ToolExportErrorCodes.INTEGRATION_NOT_FOUND,
      `Integration not found or access denied`,
      404
    );
  }

  // Get all actions for the integration
  const actions = await findActionsByIntegration(integrationId);

  if (actions.length === 0) {
    throw new ToolExportError(
      ToolExportErrorCodes.NO_ACTIONS_AVAILABLE,
      `No actions available for export. Create actions first.`,
      404
    );
  }

  // Transform actions to API response format
  const actionResponses = actions.map((action) => toActionResponse(action));

  // Transform to universal tools
  const { tools, errors } = transformActionsToUniversalTools(actionResponses, integration.slug, {
    includeMetadata: options.includeMetadata,
    maxDescriptionLength: options.maxDescriptionLength,
    includeContextTypes: options.includeContextTypes ?? true,
  });

  // Log transformation errors but don't fail the request
  if (errors.length > 0) {
    console.warn(
      `[ToolExport] ${errors.length} actions failed to transform:`,
      errors.map((e) => `${e.actionSlug}: ${e.error}`)
    );
  }

  // Aggregate context types from all tools
  const contextTypes = aggregateContextTypes(tools);

  return {
    integration: {
      id: integration.id,
      slug: integration.slug,
      name: integration.name,
    },
    tools,
    contextTypes,
    format: {
      name: 'universal',
      version: '1.0',
      compatibleWith: ['openai', 'anthropic', 'gemini', 'langchain'],
    },
  };
}

/**
 * Export a single action as a universal tool.
 *
 * @param tenantId - The tenant requesting the export
 * @param integrationId - The integration containing the action
 * @param actionSlug - The action's slug
 * @param options - Export options
 * @returns Single tool export response
 */
export async function exportActionToolUniversal(
  tenantId: string,
  integrationId: string,
  actionSlug: string,
  options: ExportToolsOptions = {}
): Promise<SingleToolExportResponse> {
  // Verify integration ownership and get metadata
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      tenantId,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!integration) {
    throw new ToolExportError(
      ToolExportErrorCodes.INTEGRATION_NOT_FOUND,
      `Integration not found or access denied`,
      404
    );
  }

  // Get the specific action
  const action = await findActionBySlug(integrationId, actionSlug);

  if (!action) {
    throw new ToolExportError(
      ToolExportErrorCodes.ACTION_NOT_FOUND,
      `Action '${actionSlug}' not found in integration`,
      404
    );
  }

  // Transform to API response format
  const actionResponse = toActionResponse(action);

  // Transform to universal tool
  const result = transformActionToUniversalTool(actionResponse, integration.slug, {
    includeMetadata: options.includeMetadata,
    maxDescriptionLength: options.maxDescriptionLength,
    includeContextTypes: options.includeContextTypes ?? true,
  });

  if (!result.success) {
    throw new ToolExportError(
      ToolExportErrorCodes.SCHEMA_TRANSFORMATION_FAILED,
      `Failed to transform action: ${result.error}`,
      500
    );
  }

  return {
    action: {
      id: action.id,
      slug: action.slug,
      name: action.name,
    },
    tool: result.tool,
    format: {
      name: 'universal',
      version: '1.0',
      compatibleWith: ['openai', 'anthropic', 'gemini', 'langchain'],
    },
  };
}

// =============================================================================
// LangChain Tool Export
// =============================================================================

/**
 * Options for LangChain export
 */
export interface LangChainExportOptions extends ExportToolsOptions {
  /** Waygate API base URL for code generation */
  apiBaseUrl?: string;
  /** Include code snippets in response */
  includeCodeSnippets?: boolean;
}

/**
 * Export all actions from an integration as LangChain tools.
 *
 * @param tenantId - The tenant requesting the export
 * @param integrationId - The integration to export
 * @param options - Export options
 * @returns LangChain export response with all tools
 */
export async function exportIntegrationToolsLangChain(
  tenantId: string,
  integrationId: string,
  options: LangChainExportOptions = {}
): Promise<LangChainExportResponse> {
  // First get the universal export
  const universalExport = await exportIntegrationToolsUniversal(tenantId, integrationId, {
    includeMetadata: options.includeMetadata,
    maxDescriptionLength: options.maxDescriptionLength,
    includeContextTypes: options.includeContextTypes,
  });

  // Transform to LangChain format
  const langchainOptions: LangChainTransformOptions = {
    apiBaseUrl: options.apiBaseUrl,
    includeCodeSnippets: options.includeCodeSnippets ?? true,
  };

  return transformUniversalExportToLangChain(universalExport, langchainOptions);
}

// =============================================================================
// MCP Tool Export
// =============================================================================

/**
 * Options for MCP export
 */
export interface MCPExportOptions extends ExportToolsOptions {
  /** Waygate API base URL */
  apiBaseUrl?: string;
  /** Include server file generation */
  includeServerFile?: boolean;
  /** Include resources for reference data */
  includeResources?: boolean;
  /** Server version */
  serverVersion?: string;
}

/**
 * Export all actions from an integration as MCP tools.
 *
 * @param tenantId - The tenant requesting the export
 * @param integrationId - The integration to export
 * @param options - Export options
 * @returns MCP export response with server definition
 */
export async function exportIntegrationToolsMCP(
  tenantId: string,
  integrationId: string,
  options: MCPExportOptions = {}
): Promise<MCPExportResponse> {
  // First get the universal export
  const universalExport = await exportIntegrationToolsUniversal(tenantId, integrationId, {
    includeMetadata: options.includeMetadata,
    maxDescriptionLength: options.maxDescriptionLength,
    includeContextTypes: options.includeContextTypes,
  });

  // Transform to MCP format
  const mcpOptions: MCPTransformOptions = {
    apiBaseUrl: options.apiBaseUrl,
    includeServerFile: options.includeServerFile ?? true,
    includeResources: options.includeResources ?? true,
    serverVersion: options.serverVersion,
  };

  return transformUniversalExportToMCP(universalExport, mcpOptions);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Aggregate all unique context types from a list of tools.
 */
function aggregateContextTypes(tools: UniversalTool[]): string[] {
  const contextTypesSet = new Set<string>();

  for (const tool of tools) {
    if (tool.contextTypes) {
      for (const contextType of tool.contextTypes) {
        contextTypesSet.add(contextType);
      }
    }
  }

  return Array.from(contextTypesSet).sort();
}

/**
 * Get available export formats.
 */
export function getAvailableExportFormats(): string[] {
  return ['universal', 'langchain', 'mcp'];
}
