/**
 * Connection Mapping Hooks
 *
 * React Query hooks for connection-level field mapping overrides.
 * These hooks manage per-app custom mappings that override action defaults.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import type {
  FieldMapping,
  MappingConfig,
  CreateFieldMapping,
  UpdateFieldMapping,
  MappingPreviewRequest,
  MappingPreviewResponse,
  ResolvedMapping,
  FieldMappingWithConnection,
} from '@/lib/modules/execution/mapping';
import { mappingKeys } from './useMappings';

// =============================================================================
// Query Keys
// =============================================================================

export const connectionMappingKeys = {
  all: ['connectionMappings'] as const,
  lists: () => [...connectionMappingKeys.all, 'list'] as const,
  list: (connectionId: string, actionId: string) =>
    [...connectionMappingKeys.lists(), connectionId, actionId] as const,
  stats: (connectionId: string, actionId: string) =>
    [...connectionMappingKeys.all, 'stats', connectionId, actionId] as const,
};

// =============================================================================
// Types
// =============================================================================

/**
 * Connection mapping state with inheritance info
 */
export interface ConnectionMappingsResponse {
  actionId: string;
  connectionId: string;
  mappings: ResolvedMapping[];
  config: MappingConfig;
  stats: {
    defaultsCount: number;
    overridesCount: number;
    totalCount: number;
  };
}

/**
 * Create override input
 */
export interface CreateOverrideInput extends CreateFieldMapping {
  actionId: string;
}

/**
 * Update override input
 */
export interface UpdateOverrideInput {
  mappingId: string;
  actionId: string;
  data: UpdateFieldMapping;
}

/**
 * Delete override input
 */
export interface DeleteOverrideInput {
  mappingId: string;
  actionId: string;
}

/**
 * Reset mappings input
 */
export interface ResetMappingsInput {
  actionId: string;
}

/**
 * Copy defaults input
 */
export interface CopyDefaultsInput {
  actionId: string;
}

/**
 * Preview input
 */
export interface PreviewInput extends MappingPreviewRequest {
  actionId: string;
}

// =============================================================================
// List Connection Mappings
// =============================================================================

/**
 * Fetch resolved mappings for a connection + action
 * Returns defaults + overrides merged with inheritance info
 */
export function useConnectionMappings(
  connectionId: string | undefined,
  actionId: string | undefined
) {
  return useQuery({
    queryKey: connectionMappingKeys.list(connectionId ?? '', actionId ?? ''),
    queryFn: async (): Promise<ConnectionMappingsResponse | null> => {
      if (!connectionId || !actionId) {
        return null;
      }
      return apiClient.get<ConnectionMappingsResponse>(
        `/connections/${connectionId}/mappings?actionId=${actionId}`
      );
    },
    enabled: !!connectionId && !!actionId,
  });
}

// =============================================================================
// Create Override
// =============================================================================

/**
 * Create a connection-specific mapping override
 */
export function useCreateConnectionOverride(connectionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId, ...mapping }: CreateOverrideInput) => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      return apiClient.post<FieldMappingWithConnection>(`/connections/${connectionId}/mappings`, {
        actionId,
        ...mapping,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate connection mappings
      queryClient.invalidateQueries({
        queryKey: connectionMappingKeys.list(connectionId ?? '', variables.actionId),
      });
      // Also invalidate action-level mappings (for override count indicator)
      queryClient.invalidateQueries({
        queryKey: mappingKeys.list(variables.actionId),
      });
      toast.success('Mapping override created');
    },
    onError: () => {
      toast.error('Failed to create mapping override');
    },
  });
}

// =============================================================================
// Update Override
// =============================================================================

/**
 * Update a connection-specific mapping override
 */
export function useUpdateConnectionOverride(connectionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mappingId, actionId, data }: UpdateOverrideInput) => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      return apiClient.patch<FieldMapping>(
        `/connections/${connectionId}/mappings/${mappingId}?actionId=${actionId}`,
        data
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionMappingKeys.list(connectionId ?? '', variables.actionId),
      });
      toast.success('Mapping override updated');
    },
    onError: () => {
      toast.error('Failed to update mapping override');
    },
  });
}

// =============================================================================
// Delete Override
// =============================================================================

/**
 * Delete a connection-specific mapping override
 * Connection will revert to using the action-level default
 */
export function useDeleteConnectionOverride(connectionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mappingId, actionId }: DeleteOverrideInput) => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      await apiClient.delete(
        `/connections/${connectionId}/mappings/${mappingId}?actionId=${actionId}`
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionMappingKeys.list(connectionId ?? '', variables.actionId),
      });
      // Also invalidate action-level mappings (for override count indicator)
      queryClient.invalidateQueries({
        queryKey: mappingKeys.list(variables.actionId),
      });
      toast.success('Reverted to default mapping');
    },
    onError: () => {
      toast.error('Failed to delete mapping override');
    },
  });
}

// =============================================================================
// Reset All Overrides
// =============================================================================

/**
 * Reset all connection mappings to defaults for an action
 * Deletes all connection-specific overrides
 */
export function useResetConnectionMappings(connectionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId }: ResetMappingsInput) => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      return apiClient.delete<{ deletedCount: number; message: string }>(
        `/connections/${connectionId}/mappings?actionId=${actionId}`
      );
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionMappingKeys.list(connectionId ?? '', variables.actionId),
      });
      // Also invalidate action-level mappings (for override count indicator)
      queryClient.invalidateQueries({
        queryKey: mappingKeys.list(variables.actionId),
      });
      toast.success(`Reset ${data.deletedCount} mapping override(s) to defaults`);
    },
    onError: () => {
      toast.error('Failed to reset mappings');
    },
  });
}

// =============================================================================
// Copy Defaults to Connection
// =============================================================================

/**
 * Copy action-level default mappings to connection as starting overrides
 * Useful when user wants to customize but start from existing defaults
 */
export function useCopyDefaultsToConnection(connectionId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId }: CopyDefaultsInput) => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      return apiClient.post<{
        connectionId: string;
        actionId: string;
        copiedCount: number;
        mappings: FieldMappingWithConnection[];
        message: string;
      }>(`/connections/${connectionId}/mappings/copy`, { actionId });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionMappingKeys.list(connectionId ?? '', variables.actionId),
      });
      toast.success(`Copied ${data.copiedCount} default mapping(s) to connection`);
    },
    onError: () => {
      toast.error('Failed to copy default mappings');
    },
  });
}

// =============================================================================
// Preview with Connection Context
// =============================================================================

/**
 * Preview mapping transformation with connection-specific overrides
 */
export function usePreviewConnectionMapping(connectionId: string | undefined) {
  return useMutation({
    mutationFn: async ({ actionId, ...request }: PreviewInput): Promise<MappingPreviewResponse> => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      return apiClient.post<MappingPreviewResponse>(
        `/connections/${connectionId}/mappings/preview`,
        { actionId, ...request }
      );
    },
    onError: () => {
      toast.error('Failed to preview mapping');
    },
  });
}

// =============================================================================
// Get Connection Override Count
// =============================================================================

/**
 * Get count of connections with overrides for an action
 * Useful for UI indicator on action mapping panel
 */
/**
 * Get the count of connections that have mapping overrides for an action.
 * Uses the action mappings endpoint with stats.
 */
export function useConnectionOverrideCount(
  actionId: string | undefined,
  integrationId: string | undefined
) {
  return useQuery({
    queryKey: [...mappingKeys.list(actionId ?? ''), 'overrideCount'] as const,
    queryFn: async (): Promise<number> => {
      if (!actionId || !integrationId) {
        return 0;
      }
      const response = await apiClient.get<{
        mappings: unknown[];
        stats?: { connectionsWithOverrides: number };
      }>(`/integrations/${integrationId}/actions/${actionId}/mappings?includeStats=true`);

      return response.stats?.connectionsWithOverrides ?? 0;
    },
    enabled: !!actionId && !!integrationId,
    staleTime: 30000, // 30 seconds
  });
}
