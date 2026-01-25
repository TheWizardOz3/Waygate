/**
 * Connectivity Check Service (Tier 2)
 *
 * Tier 2 health checks verify API connectivity by making a single test action call.
 * These checks run less frequently (every 6-12 hours by default) to:
 * - Verify the API endpoint is reachable
 * - Confirm credentials work for actual requests
 * - Measure response latency
 *
 * Test action selection priority:
 * 1. Connection's configured healthCheckTestActionId
 * 2. Integration's default healthCheckConfig.testActionId
 * 3. First safe GET action (read-only, no side effects)
 * 4. Any GET action
 */

import { prisma } from '@/lib/db/client';
import {
  HealthCheckStatus,
  HealthCheckTier,
  HealthCheckTrigger,
  CredentialHealthStatus,
  CredentialStatus,
  HttpMethod,
} from '@prisma/client';
import { createHealthCheck, updateConnectionHealthStatus } from './health-check.repository';
import {
  calculateOverallHealthStatus,
  HealthCheckErrorCodes,
  type HealthCheckResponse,
  type TestActionError,
} from './health-check.schemas';
import { toHealthCheckResponse } from './health-check.schemas';
import { invokeAction } from '../gateway/gateway.service';

import type { Action, Connection, Integration, IntegrationCredential } from '@prisma/client';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default timeout for test action execution (in milliseconds)
 */
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Warning threshold for credential expiration (1 hour in milliseconds)
 */
const EXPIRING_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a connectivity check
 */
export interface ConnectivityCheckResult {
  success: boolean;
  healthCheck: HealthCheckResponse;
  connectionId: string;
  connectionName: string;
  testActionId: string | null;
  testActionSlug: string | null;
  previousStatus: HealthCheckStatus;
  newStatus: HealthCheckStatus;
  statusChanged: boolean;
  latencyMs: number | null;
}

/**
 * Error thrown when connectivity check operations fail
 */
export class ConnectivityCheckError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ConnectivityCheckError';
  }
}

/**
 * Connection with all related data needed for connectivity check
 */
interface ConnectionWithDetails extends Connection {
  integration: Integration & {
    actions: Action[];
  };
  credentials: IntegrationCredential[];
  healthCheckTestAction: Action | null;
}

// =============================================================================
// Main Service Function
// =============================================================================

/**
 * Runs a Tier 2 connectivity check for a connection
 *
 * This check verifies API connectivity by executing a single test action:
 * - Selects an appropriate test action (configured or safe GET)
 * - Executes the action with timeout handling
 * - Records latency and success/failure
 *
 * Also includes Tier 1 credential status as part of the check.
 *
 * @param connectionId - The connection to check
 * @param trigger - How the check was triggered (scheduled or manual)
 * @returns The connectivity check result with new health status
 */
export async function runConnectivityCheck(
  connectionId: string,
  trigger: HealthCheckTrigger = HealthCheckTrigger.scheduled
): Promise<ConnectivityCheckResult> {
  const startTime = Date.now();

  // Get the connection with all related data
  const connection = await getConnectionWithDetails(connectionId);
  if (!connection) {
    throw new ConnectivityCheckError(
      HealthCheckErrorCodes.CONNECTION_NOT_FOUND,
      `Connection not found: ${connectionId}`,
      404
    );
  }

  const previousStatus = connection.healthStatus;

  // First, check credential status (Tier 1 included in Tier 2)
  const { credentialStatus, credentialExpiresAt } = analyzeCredentialStatus(
    connection.credentials[0] ?? null
  );

  // If credentials are missing or expired, skip the API call
  if (
    credentialStatus === CredentialHealthStatus.missing ||
    credentialStatus === CredentialHealthStatus.expired
  ) {
    const durationMs = Date.now() - startTime;
    const newStatus = calculateOverallHealthStatus({ credentialStatus });

    const healthCheck = await createHealthCheck({
      connectionId,
      tenantId: connection.tenantId,
      status: newStatus,
      checkTier: HealthCheckTier.connectivity,
      checkTrigger: trigger,
      durationMs,
      credentialStatus,
      credentialExpiresAt,
      testActionId: null,
      testActionSuccess: null,
      testActionLatencyMs: null,
      testActionStatusCode: null,
      testActionError: {
        code: 'CREDENTIAL_ISSUE',
        message:
          credentialStatus === CredentialHealthStatus.missing
            ? 'No credentials found for connection'
            : 'Credentials have expired',
      },
      circuitBreakerStatus: null,
      error: null,
    });

    await updateConnectionHealthStatus(connectionId, newStatus, HealthCheckTier.connectivity);

    return {
      success: false,
      healthCheck: toHealthCheckResponse(healthCheck),
      connectionId,
      connectionName: connection.name,
      testActionId: null,
      testActionSlug: null,
      previousStatus,
      newStatus,
      statusChanged: previousStatus !== newStatus,
      latencyMs: null,
    };
  }

  // Select the test action
  const testAction = selectTestAction(connection);
  if (!testAction) {
    throw new ConnectivityCheckError(
      HealthCheckErrorCodes.NO_TEST_ACTION,
      `No suitable test action found for connection: ${connectionId}`,
      400
    );
  }

  // Execute the test action
  const actionStartTime = Date.now();
  let testActionSuccess = false;
  let testActionLatencyMs: number | null = null;
  let testActionStatusCode: number | null = null;
  let testActionError: TestActionError | null = null;

  try {
    const result = await invokeAction(
      connection.tenantId,
      connection.integration.slug,
      testAction.slug,
      {}, // Empty input for test actions (GET requests typically don't need input)
      {
        connectionId: connection.id,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        skipValidation: true, // Skip input validation for health checks
      }
    );

    testActionLatencyMs = Date.now() - actionStartTime;

    if (result.success) {
      testActionSuccess = true;
      // Success responses don't have status code in schema, assume 200
      testActionStatusCode = 200;
    } else {
      testActionSuccess = false;
      // Status code is in error.details.externalStatusCode for error responses
      testActionStatusCode = result.error?.details?.externalStatusCode ?? null;
      testActionError = {
        code: result.error?.code ?? 'UNKNOWN_ERROR',
        message: result.error?.message ?? 'Test action failed',
      };
    }
  } catch (error) {
    testActionLatencyMs = Date.now() - actionStartTime;
    testActionSuccess = false;
    testActionError = {
      code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown execution error',
    };
  }

  // Calculate overall health status
  const newStatus = calculateOverallHealthStatus({
    credentialStatus,
    testActionSuccess,
  });

  // Calculate total duration
  const durationMs = Date.now() - startTime;

  // Store the health check result
  const healthCheck = await createHealthCheck({
    connectionId,
    tenantId: connection.tenantId,
    status: newStatus,
    checkTier: HealthCheckTier.connectivity,
    checkTrigger: trigger,
    durationMs,
    credentialStatus,
    credentialExpiresAt,
    testActionId: testAction.id,
    testActionSuccess,
    testActionLatencyMs,
    testActionStatusCode,
    testActionError: testActionError
      ? { code: testActionError.code, message: testActionError.message }
      : null,
    circuitBreakerStatus: null, // Could be enhanced to check circuit breaker state
    error: null,
  });

  // Update connection health status
  await updateConnectionHealthStatus(connectionId, newStatus, HealthCheckTier.connectivity);

  return {
    success: testActionSuccess,
    healthCheck: toHealthCheckResponse(healthCheck),
    connectionId,
    connectionName: connection.name,
    testActionId: testAction.id,
    testActionSlug: testAction.slug,
    previousStatus,
    newStatus,
    statusChanged: previousStatus !== newStatus,
    latencyMs: testActionLatencyMs,
  };
}

/**
 * Runs connectivity checks for multiple connections
 * Used by the scheduled cron job
 *
 * @param connectionIds - Array of connection IDs to check
 * @param trigger - How the check was triggered
 * @returns Array of results (success and failures)
 */
export async function runConnectivityCheckBatch(
  connectionIds: string[],
  trigger: HealthCheckTrigger = HealthCheckTrigger.scheduled
): Promise<{
  results: ConnectivityCheckResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    statusChanges: number;
    avgLatencyMs: number | null;
  };
}> {
  const results: ConnectivityCheckResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let statusChanges = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  for (const connectionId of connectionIds) {
    try {
      const result = await runConnectivityCheck(connectionId, trigger);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      if (result.statusChanged) {
        statusChanges++;
      }

      if (result.latencyMs !== null) {
        totalLatency += result.latencyMs;
        latencyCount++;
      }
    } catch (error) {
      failed++;
      console.error(`[ConnectivityCheck] Failed for connection ${connectionId}:`, error);
    }
  }

  return {
    results,
    summary: {
      total: connectionIds.length,
      succeeded,
      failed,
      statusChanges,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets connection with all related data needed for connectivity check
 */
async function getConnectionWithDetails(
  connectionId: string
): Promise<ConnectionWithDetails | null> {
  return prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      integration: {
        include: {
          actions: {
            orderBy: [
              { httpMethod: 'asc' }, // GET methods first
              { createdAt: 'asc' },
            ],
          },
        },
      },
      credentials: {
        where: {
          status: CredentialStatus.active,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      healthCheckTestAction: true,
    },
  });
}

/**
 * Selects the most appropriate test action for a connection
 *
 * Priority:
 * 1. Connection's configured healthCheckTestActionId
 * 2. Integration's healthCheckConfig.testActionId
 * 3. First safe GET action (typically "list" or "get" endpoints)
 * 4. Any GET action
 */
function selectTestAction(connection: ConnectionWithDetails): Action | null {
  // Priority 1: Connection's configured test action
  if (connection.healthCheckTestAction) {
    return connection.healthCheckTestAction;
  }

  // Priority 2: Integration's configured test action
  const integrationConfig = connection.integration.healthCheckConfig as {
    testActionId?: string;
  } | null;

  if (integrationConfig?.testActionId) {
    const configuredAction = connection.integration.actions.find(
      (a) => a.id === integrationConfig.testActionId
    );
    if (configuredAction) {
      return configuredAction;
    }
  }

  // Priority 3 & 4: Find a safe GET action
  const getActions = connection.integration.actions.filter((a) => a.httpMethod === HttpMethod.GET);

  if (getActions.length === 0) {
    return null;
  }

  // Prefer "safe" actions (list, get, read, fetch, search, find, check, status, health, ping, me, profile)
  const safePatterns = [
    /^list/i,
    /^get/i,
    /^read/i,
    /^fetch/i,
    /^search/i,
    /^find/i,
    /^check/i,
    /^status/i,
    /^health/i,
    /^ping/i,
    /^me$/i,
    /^profile$/i,
    /^whoami/i,
    /^info/i,
    /^verify/i,
  ];

  const safeAction = getActions.find((a) => safePatterns.some((pattern) => pattern.test(a.slug)));

  return safeAction ?? getActions[0];
}

/**
 * Analyzes credential status and returns health status
 * (Same logic as Tier 1, included here for self-contained Tier 2 checks)
 */
function analyzeCredentialStatus(credential: IntegrationCredential | null): {
  credentialStatus: CredentialHealthStatus;
  credentialExpiresAt: Date | null;
} {
  if (!credential) {
    return {
      credentialStatus: CredentialHealthStatus.missing,
      credentialExpiresAt: null,
    };
  }

  switch (credential.status) {
    case CredentialStatus.expired:
    case CredentialStatus.revoked:
    case CredentialStatus.needs_reauth:
      return {
        credentialStatus: CredentialHealthStatus.expired,
        credentialExpiresAt: credential.expiresAt,
      };

    case CredentialStatus.active:
      if (credential.expiresAt) {
        const now = Date.now();
        const expiresAtMs = credential.expiresAt.getTime();

        if (expiresAtMs <= now) {
          return {
            credentialStatus: CredentialHealthStatus.expired,
            credentialExpiresAt: credential.expiresAt,
          };
        }

        if (expiresAtMs - now <= EXPIRING_THRESHOLD_MS) {
          return {
            credentialStatus: CredentialHealthStatus.expiring,
            credentialExpiresAt: credential.expiresAt,
          };
        }
      }

      return {
        credentialStatus: CredentialHealthStatus.active,
        credentialExpiresAt: credential.expiresAt,
      };

    default:
      return {
        credentialStatus: CredentialHealthStatus.missing,
        credentialExpiresAt: null,
      };
  }
}

/**
 * Gets connections needing a connectivity check for a tenant
 *
 * @param tenantId - The tenant ID
 * @param olderThanHours - Check connections not checked within this many hours
 * @returns Array of connection IDs
 */
export async function getConnectionsForConnectivityCheck(
  tenantId: string,
  olderThanHours: number = 12
): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const connections = await prisma.connection.findMany({
    where: {
      tenantId,
      OR: [{ lastConnectivityCheckAt: null }, { lastConnectivityCheckAt: { lt: cutoffTime } }],
    },
    select: { id: true },
  });

  return connections.map((c) => c.id);
}

/**
 * Gets all connections needing a connectivity check across all tenants
 *
 * @param olderThanHours - Check connections not checked within this many hours
 * @param limit - Maximum number of connections to return
 * @returns Array of connection IDs
 */
export async function getAllConnectionsForConnectivityCheck(
  olderThanHours: number = 12,
  limit: number = 50
): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const connections = await prisma.connection.findMany({
    where: {
      OR: [{ lastConnectivityCheckAt: null }, { lastConnectivityCheckAt: { lt: cutoffTime } }],
    },
    select: { id: true },
    take: limit,
    orderBy: {
      lastConnectivityCheckAt: { sort: 'asc', nulls: 'first' },
    },
  });

  return connections.map((c) => c.id);
}
