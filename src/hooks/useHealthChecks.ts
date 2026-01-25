/**
 * Health Check Hooks
 *
 * React Query hooks for fetching and managing health checks.
 * Used for monitoring connection health status and history.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// =============================================================================
// Query Keys
// =============================================================================

export const healthCheckKeys = {
  all: ['health-checks'] as const,
  summary: () => [...healthCheckKeys.all, 'summary'] as const,
  lists: () => [...healthCheckKeys.all, 'list'] as const,
  list: (connectionId: string, filters?: HealthCheckFilters) =>
    [...healthCheckKeys.lists(), connectionId, filters] as const,
  latest: (connectionId: string) => [...healthCheckKeys.all, 'latest', connectionId] as const,
};

// =============================================================================
// Types
// =============================================================================

type HealthCheckStatus = 'healthy' | 'degraded' | 'unhealthy';
type HealthCheckTier = 'credential' | 'connectivity' | 'full_scan';
type HealthCheckTrigger = 'scheduled' | 'manual' | 'on_demand' | 'startup';

interface HealthCheckFilters {
  tier?: HealthCheckTier;
  status?: HealthCheckStatus;
}

interface ListHealthChecksParams extends HealthCheckFilters {
  cursor?: string;
  limit?: number;
}

interface HealthCheckEntry {
  id: string;
  connectionId: string;
  status: HealthCheckStatus;
  checkTier: HealthCheckTier;
  checkTrigger: HealthCheckTrigger;
  credentialStatus: string | null;
  credentialExpiresAt: string | null;
  testActionId: string | null;
  httpStatusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  metadata: Record<string, unknown> | null;
  scanResults: unknown | null;
  previousStatus: HealthCheckStatus | null;
  statusChanged: boolean;
  durationMs: number;
  createdAt: string;
}

interface HealthCheckListResponse {
  items: HealthCheckEntry[];
  nextCursor: string | null;
  totalCount: number;
}

interface HealthCheckLatestResponse {
  latest: HealthCheckEntry | null;
  byTier: {
    credential: HealthCheckEntry | null;
    connectivity: HealthCheckEntry | null;
    full_scan: HealthCheckEntry | null;
  };
  connection: {
    id: string;
    name: string;
    healthStatus: HealthCheckStatus | null;
    lastCredentialCheckAt: string | null;
    lastConnectivityCheckAt: string | null;
    lastFullScanAt: string | null;
  };
}

interface HealthSummary {
  healthy: number;
  degraded: number;
  unhealthy: number;
  total: number;
  healthScore: number;
}

interface ConnectionWithHealth {
  id: string;
  name: string;
  slug: string;
  integrationId: string;
  healthStatus: HealthCheckStatus;
  lastCredentialCheckAt: string | null;
  lastConnectivityCheckAt: string | null;
  lastFullScanAt: string | null;
}

interface HealthSummaryResponse {
  summary: HealthSummary;
  connections?: ConnectionWithHealth[];
  needsAttention?: ConnectionWithHealth[];
  meta: {
    generatedAt: string;
    since?: string;
  };
}

interface TriggerHealthCheckResult {
  healthCheck: HealthCheckEntry;
  tier: HealthCheckTier;
  previousStatus: HealthCheckStatus | null;
  newStatus: HealthCheckStatus;
  statusChanged: boolean;
  latencyMs?: number;
  scanSummary?: {
    total: number;
    passed: number;
    failed: number;
  };
  failedActions?: string[];
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchHealthChecks(
  connectionId: string,
  params?: ListHealthChecksParams
): Promise<HealthCheckListResponse> {
  return apiClient.get<HealthCheckListResponse>(`/connections/${connectionId}/health-checks`, {
    cursor: params?.cursor,
    limit: params?.limit,
    tier: params?.tier,
    status: params?.status,
  });
}

async function fetchLatestHealthCheck(connectionId: string): Promise<HealthCheckLatestResponse> {
  return apiClient.get<HealthCheckLatestResponse>(
    `/connections/${connectionId}/health-checks/latest`
  );
}

async function fetchHealthSummary(includeConnections = true): Promise<HealthSummaryResponse> {
  return apiClient.get<HealthSummaryResponse>('/health-checks/summary', {
    includeConnections: includeConnections.toString(),
  });
}

async function triggerHealthCheck(
  connectionId: string,
  tier: HealthCheckTier = 'connectivity'
): Promise<TriggerHealthCheckResult> {
  return apiClient.post<TriggerHealthCheckResult>(`/connections/${connectionId}/health-checks`, {
    tier,
  });
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch health check history for a connection
 */
export function useHealthChecks(connectionId: string | undefined, params?: ListHealthChecksParams) {
  return useQuery({
    queryKey: healthCheckKeys.list(connectionId!, params),
    queryFn: () => fetchHealthChecks(connectionId!, params),
    enabled: !!connectionId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch the latest health check for a connection (all tiers)
 */
export function useLatestHealthCheck(connectionId: string | undefined) {
  return useQuery({
    queryKey: healthCheckKeys.latest(connectionId!),
    queryFn: () => fetchLatestHealthCheck(connectionId!),
    enabled: !!connectionId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch tenant health summary
 */
export function useHealthSummary(includeConnections = true) {
  return useQuery({
    queryKey: healthCheckKeys.summary(),
    queryFn: () => fetchHealthSummary(includeConnections),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to trigger a manual health check
 */
export function useTriggerHealthCheck(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tier: HealthCheckTier = 'connectivity') => triggerHealthCheck(connectionId, tier),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.list(connectionId) });
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.latest(connectionId) });
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.summary() });
    },
  });
}

/**
 * Hook to invalidate health check caches (useful after connection changes)
 */
export function useInvalidateHealthChecks() {
  const queryClient = useQueryClient();

  return {
    invalidateConnection: (connectionId: string) => {
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.list(connectionId) });
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.latest(connectionId) });
    },
    invalidateSummary: () => {
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.summary() });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: healthCheckKeys.all });
    },
  };
}
