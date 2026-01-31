/**
 * Tool Export Hooks
 *
 * React Query hooks for fetching AI tool export data in various formats
 * (Universal, LangChain, MCP).
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ToolExportResponse } from '@/lib/modules/tool-export/tool-export.schemas';
import type { LangChainExportResponse } from '@/lib/modules/tool-export/formats/langchain.transformer';
import type { MCPExportResponse } from '@/lib/modules/tool-export/formats/mcp.transformer';

// =============================================================================
// Query Keys
// =============================================================================

export const toolExportKeys = {
  all: ['toolExport'] as const,
  universal: (integrationId: string) =>
    [...toolExportKeys.all, 'universal', integrationId] as const,
  langchain: (integrationId: string) =>
    [...toolExportKeys.all, 'langchain', integrationId] as const,
  mcp: (integrationId: string) => [...toolExportKeys.all, 'mcp', integrationId] as const,
};

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = 'universal' | 'langchain' | 'mcp';

export interface UniversalExportOptions {
  includeMetadata?: boolean;
  maxDescriptionLength?: number;
  includeContextTypes?: boolean;
}

export interface LangChainExportOptions {
  includeCodeSnippets?: boolean;
  apiBaseUrl?: string;
}

export interface MCPExportOptions {
  includeServerFile?: boolean;
  includeResources?: boolean;
  serverVersion?: string;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchUniversalExport(
  integrationId: string,
  options?: UniversalExportOptions
): Promise<ToolExportResponse> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (options?.includeMetadata !== undefined) params.includeMetadata = options.includeMetadata;
  if (options?.maxDescriptionLength !== undefined)
    params.maxDescriptionLength = options.maxDescriptionLength;
  if (options?.includeContextTypes !== undefined)
    params.includeContextTypes = options.includeContextTypes;

  return apiClient.get<ToolExportResponse>(
    `/integrations/${integrationId}/tools/universal`,
    params
  );
}

async function fetchLangChainExport(
  integrationId: string,
  options?: LangChainExportOptions
): Promise<LangChainExportResponse> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (options?.includeCodeSnippets !== undefined)
    params.includeCodeSnippets = options.includeCodeSnippets;
  if (options?.apiBaseUrl !== undefined) params.apiBaseUrl = options.apiBaseUrl;

  return apiClient.get<LangChainExportResponse>(
    `/integrations/${integrationId}/tools/langchain`,
    params
  );
}

async function fetchMCPExport(
  integrationId: string,
  options?: MCPExportOptions
): Promise<MCPExportResponse> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (options?.includeServerFile !== undefined)
    params.includeServerFile = options.includeServerFile;
  if (options?.includeResources !== undefined) params.includeResources = options.includeResources;
  if (options?.serverVersion !== undefined) params.serverVersion = options.serverVersion;

  return apiClient.get<MCPExportResponse>(`/integrations/${integrationId}/tools/mcp`, params);
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch tools exported in Universal (LLM-agnostic) format.
 * Works with OpenAI, Anthropic, Gemini, and LangChain.
 */
export function useUniversalExport(
  integrationId: string | undefined,
  options?: UniversalExportOptions
) {
  return useQuery({
    queryKey: toolExportKeys.universal(integrationId!),
    queryFn: () => fetchUniversalExport(integrationId!, options),
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000, // 5 minutes (matches API cache)
  });
}

/**
 * Hook to fetch tools exported in LangChain format with code snippets.
 */
export function useLangChainExport(
  integrationId: string | undefined,
  options?: LangChainExportOptions
) {
  return useQuery({
    queryKey: toolExportKeys.langchain(integrationId!),
    queryFn: () => fetchLangChainExport(integrationId!, options),
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch tools exported in MCP format with server file generation.
 */
export function useMCPExport(integrationId: string | undefined, options?: MCPExportOptions) {
  return useQuery({
    queryKey: toolExportKeys.mcp(integrationId!),
    queryFn: () => fetchMCPExport(integrationId!, options),
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
