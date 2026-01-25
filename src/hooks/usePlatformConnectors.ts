/**
 * Platform Connector Hooks
 *
 * React Query hooks for fetching platform connectors.
 * Platform connectors enable "one-click connect" experiences using Waygate's OAuth apps.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PlatformConnectorResponse } from '@/lib/modules/platform-connectors';

// =============================================================================
// Query Keys
// =============================================================================

export const platformConnectorKeys = {
  all: ['platform-connectors'] as const,
  lists: () => [...platformConnectorKeys.all, 'list'] as const,
  list: (filters?: PlatformConnectorFilters) =>
    [...platformConnectorKeys.lists(), filters] as const,
  details: () => [...platformConnectorKeys.all, 'detail'] as const,
  detail: (slug: string) => [...platformConnectorKeys.details(), slug] as const,
};

// =============================================================================
// Types
// =============================================================================

interface PlatformConnectorFilters {
  status?: 'active' | 'suspended' | 'deprecated';
  authType?: string;
}

interface ListPlatformConnectorsResponse {
  connectors: PlatformConnectorResponse[];
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchPlatformConnectors(
  filters?: PlatformConnectorFilters
): Promise<ListPlatformConnectorsResponse> {
  return apiClient.get<ListPlatformConnectorsResponse>('/platform-connectors', {
    status: filters?.status,
    authType: filters?.authType,
  });
}

async function fetchPlatformConnector(slug: string): Promise<PlatformConnectorResponse> {
  return apiClient.get<PlatformConnectorResponse>(`/platform-connectors/${slug}`);
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch list of platform connectors
 * By default, only returns active connectors
 */
export function usePlatformConnectors(filters?: PlatformConnectorFilters) {
  return useQuery({
    queryKey: platformConnectorKeys.list(filters),
    queryFn: () => fetchPlatformConnectors(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes - platform connectors change rarely
  });
}

/**
 * Hook to fetch a single platform connector by slug
 */
export function usePlatformConnector(slug: string | undefined) {
  return useQuery({
    queryKey: platformConnectorKeys.detail(slug!),
    queryFn: () => fetchPlatformConnector(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch only active platform connectors (most common use case)
 */
export function useActivePlatformConnectors() {
  return usePlatformConnectors({ status: 'active' });
}
