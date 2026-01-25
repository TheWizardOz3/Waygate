/**
 * Credential Check Service (Tier 1)
 *
 * Tier 1 health checks verify credential validity without making external API calls.
 * These checks run frequently (every 15 minutes by default) to catch:
 * - Missing credentials
 * - Expired credentials
 * - Credentials expiring soon (< 1 hour warning)
 *
 * Security: No external API calls means no risk of rate limiting or credential exposure.
 */

import { prisma } from '@/lib/db/client';
import {
  HealthCheckStatus,
  HealthCheckTier,
  HealthCheckTrigger,
  CredentialHealthStatus,
  CredentialStatus,
  CredentialType,
} from '@prisma/client';
import { createHealthCheck, updateConnectionHealthStatus } from './health-check.repository';
import {
  calculateOverallHealthStatus,
  HealthCheckErrorCodes,
  type HealthCheckResponse,
} from './health-check.schemas';
import { toHealthCheckResponse } from './health-check.schemas';

import type { Connection, IntegrationCredential } from '@prisma/client';

// =============================================================================
// Constants
// =============================================================================

/**
 * Warning threshold for credential expiration (1 hour in milliseconds)
 * Credentials expiring within this window are marked as "expiring"
 */
const EXPIRING_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a credential check
 */
export interface CredentialCheckResult {
  success: boolean;
  healthCheck: HealthCheckResponse;
  connectionId: string;
  connectionName: string;
  previousStatus: HealthCheckStatus;
  newStatus: HealthCheckStatus;
  statusChanged: boolean;
}

/**
 * Error thrown when credential check operations fail
 */
export class CredentialCheckError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'CredentialCheckError';
  }
}

// =============================================================================
// Main Service Function
// =============================================================================

/**
 * Runs a Tier 1 credential check for a connection
 *
 * This check verifies credential validity without making external API calls:
 * - Checks if credentials exist for the connection
 * - Checks credential status (active, expired, revoked, needs_reauth)
 * - For OAuth2 credentials, checks if token will expire within 1 hour
 *
 * @param connectionId - The connection to check
 * @param trigger - How the check was triggered (scheduled or manual)
 * @returns The credential check result with new health status
 */
export async function runCredentialCheck(
  connectionId: string,
  trigger: HealthCheckTrigger = HealthCheckTrigger.scheduled
): Promise<CredentialCheckResult> {
  const startTime = Date.now();

  // Get the connection with its current health status
  const connection = await getConnectionWithDetails(connectionId);
  if (!connection) {
    throw new CredentialCheckError(
      HealthCheckErrorCodes.CONNECTION_NOT_FOUND,
      `Connection not found: ${connectionId}`,
      404
    );
  }

  const previousStatus = connection.healthStatus;

  // Get credentials for this connection
  const credential = await getActiveCredentialForConnection(connection);

  // Analyze credential status
  const { credentialStatus, credentialExpiresAt } = analyzeCredentialStatus(credential);

  // Determine overall health status based on credential status
  const newStatus = calculateOverallHealthStatus({ credentialStatus });

  // Calculate duration
  const durationMs = Date.now() - startTime;

  // Store the health check result
  const healthCheck = await createHealthCheck({
    connectionId,
    tenantId: connection.tenantId,
    status: newStatus,
    checkTier: HealthCheckTier.credential,
    checkTrigger: trigger,
    durationMs,
    credentialStatus,
    credentialExpiresAt,
    circuitBreakerStatus: null, // Tier 1 doesn't affect circuit breaker
    error: null,
  });

  // Update connection health status
  await updateConnectionHealthStatus(connectionId, newStatus, HealthCheckTier.credential);

  return {
    success: true,
    healthCheck: toHealthCheckResponse(healthCheck),
    connectionId,
    connectionName: connection.name,
    previousStatus,
    newStatus,
    statusChanged: previousStatus !== newStatus,
  };
}

/**
 * Runs credential checks for multiple connections
 * Used by the scheduled cron job
 *
 * @param connectionIds - Array of connection IDs to check
 * @param trigger - How the check was triggered
 * @returns Array of results (success and failures)
 */
export async function runCredentialCheckBatch(
  connectionIds: string[],
  trigger: HealthCheckTrigger = HealthCheckTrigger.scheduled
): Promise<{
  results: CredentialCheckResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    statusChanges: number;
  };
}> {
  const results: CredentialCheckResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let statusChanges = 0;

  for (const connectionId of connectionIds) {
    try {
      const result = await runCredentialCheck(connectionId, trigger);
      results.push(result);
      succeeded++;
      if (result.statusChanged) {
        statusChanges++;
      }
    } catch (error) {
      failed++;
      // Log but continue with other connections
      console.error(`[CredentialCheck] Failed for connection ${connectionId}:`, error);
    }
  }

  return {
    results,
    summary: {
      total: connectionIds.length,
      succeeded,
      failed,
      statusChanges,
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Connection with details needed for credential check
 */
interface ConnectionWithDetails extends Connection {
  integration: {
    id: string;
    authType: string;
  };
}

/**
 * Gets connection with integration details
 */
async function getConnectionWithDetails(
  connectionId: string
): Promise<ConnectionWithDetails | null> {
  return prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      integration: {
        select: {
          id: true,
          authType: true,
        },
      },
    },
  });
}

/**
 * Gets the active credential for a connection
 */
async function getActiveCredentialForConnection(
  connection: ConnectionWithDetails
): Promise<IntegrationCredential | null> {
  return prisma.integrationCredential.findFirst({
    where: {
      tenantId: connection.tenantId,
      integrationId: connection.integrationId,
      connectionId: connection.id,
      status: CredentialStatus.active,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Analyzes credential status and returns health status
 */
function analyzeCredentialStatus(credential: IntegrationCredential | null): {
  credentialStatus: CredentialHealthStatus;
  credentialExpiresAt: Date | null;
} {
  // No credential found
  if (!credential) {
    return {
      credentialStatus: CredentialHealthStatus.missing,
      credentialExpiresAt: null,
    };
  }

  // Check database status first
  switch (credential.status) {
    case CredentialStatus.expired:
      return {
        credentialStatus: CredentialHealthStatus.expired,
        credentialExpiresAt: credential.expiresAt,
      };

    case CredentialStatus.revoked:
    case CredentialStatus.needs_reauth:
      // Treat revoked/needs_reauth as expired for health check purposes
      return {
        credentialStatus: CredentialHealthStatus.expired,
        credentialExpiresAt: credential.expiresAt,
      };

    case CredentialStatus.active:
      // Check if OAuth2 token is expiring soon
      if (credential.credentialType === CredentialType.oauth2_tokens && credential.expiresAt) {
        const now = Date.now();
        const expiresAtMs = credential.expiresAt.getTime();

        // Already expired
        if (expiresAtMs <= now) {
          return {
            credentialStatus: CredentialHealthStatus.expired,
            credentialExpiresAt: credential.expiresAt,
          };
        }

        // Expiring within threshold
        if (expiresAtMs - now <= EXPIRING_THRESHOLD_MS) {
          return {
            credentialStatus: CredentialHealthStatus.expiring,
            credentialExpiresAt: credential.expiresAt,
          };
        }
      }

      // Credential is active and not expiring soon
      return {
        credentialStatus: CredentialHealthStatus.active,
        credentialExpiresAt: credential.expiresAt,
      };

    default:
      // Unknown status, treat as missing
      return {
        credentialStatus: CredentialHealthStatus.missing,
        credentialExpiresAt: null,
      };
  }
}

/**
 * Gets connections needing a credential check for a tenant
 * Used by the cron job to determine which connections to check
 *
 * @param tenantId - The tenant ID
 * @param olderThanMinutes - Check connections not checked within this many minutes
 * @returns Array of connection IDs
 */
export async function getConnectionsForCredentialCheck(
  tenantId: string,
  olderThanMinutes: number = 15
): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const connections = await prisma.connection.findMany({
    where: {
      tenantId,
      OR: [{ lastCredentialCheckAt: null }, { lastCredentialCheckAt: { lt: cutoffTime } }],
    },
    select: { id: true },
  });

  return connections.map((c) => c.id);
}

/**
 * Gets all connections needing a credential check across all tenants
 * Used by the global cron job
 *
 * @param olderThanMinutes - Check connections not checked within this many minutes
 * @param limit - Maximum number of connections to return
 * @returns Array of connection IDs
 */
export async function getAllConnectionsForCredentialCheck(
  olderThanMinutes: number = 15,
  limit: number = 100
): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const connections = await prisma.connection.findMany({
    where: {
      OR: [{ lastCredentialCheckAt: null }, { lastCredentialCheckAt: { lt: cutoffTime } }],
    },
    select: { id: true },
    take: limit,
    orderBy: {
      // Prioritize connections that have never been checked
      lastCredentialCheckAt: { sort: 'asc', nulls: 'first' },
    },
  });

  return connections.map((c) => c.id);
}
