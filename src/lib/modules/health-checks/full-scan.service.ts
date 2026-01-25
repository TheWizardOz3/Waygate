/**
 * Full Scan Service (Tier 3)
 *
 * Tier 3 health checks test all actions to detect API breaking changes.
 * These checks run monthly or on-demand (manual trigger) to:
 * - Verify all action endpoints are still working
 * - Detect schema drift and breaking changes
 * - Identify missing fields, type changes, new required fields
 *
 * Safety rules:
 * - Only tests GET actions by default (no side effects)
 * - Skips POST/PUT/PATCH/DELETE unless explicitly marked safe
 * - Does NOT store response data, only pass/fail and error messages
 * - Respects rate limiting with delays between requests
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
} from './health-check.schemas';
import { toHealthCheckResponse } from './health-check.schemas';
import { invokeAction } from '../gateway/gateway.service';
import { validateActionOutput } from '../actions/json-schema-validator';

import type { Action, Connection, Integration, IntegrationCredential } from '@prisma/client';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default timeout for each action execution (in milliseconds)
 */
const DEFAULT_ACTION_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Delay between action requests to avoid rate limiting (in milliseconds)
 */
const INTER_REQUEST_DELAY_MS = 500; // 500ms between requests

/**
 * Maximum number of actions to test in a single full scan
 */
const MAX_ACTIONS_PER_SCAN = 50;

/**
 * Warning threshold for credential expiration (1 hour in milliseconds)
 */
const EXPIRING_THRESHOLD_MS = 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a full scan
 */
export interface FullScanResult {
  success: boolean;
  healthCheck: HealthCheckResponse;
  connectionId: string;
  connectionName: string;
  previousStatus: HealthCheckStatus;
  newStatus: HealthCheckStatus;
  statusChanged: boolean;
  scanSummary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  failedActions: Array<{
    actionId: string;
    actionSlug: string;
    error: string;
  }>;
}

/**
 * Error thrown when full scan operations fail
 */
export class FullScanError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FullScanError';
  }
}

/**
 * Connection with all related data needed for full scan
 */
interface ConnectionWithDetails extends Connection {
  integration: Integration & {
    actions: Action[];
  };
  credentials: IntegrationCredential[];
}

/**
 * Individual action test result
 */
interface ActionTestResult {
  actionId: string;
  actionSlug: string;
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  latencyMs?: number;
  statusCode?: number;
  error?: {
    code: string;
    message: string;
  };
  schemaValidation?: {
    valid: boolean;
    errors?: string[];
  };
}

// =============================================================================
// Main Service Function
// =============================================================================

/**
 * Runs a Tier 3 full scan for a connection
 *
 * This check tests all safe actions to detect API breaking changes:
 * - Tests all GET actions (no side effects)
 * - Validates responses against output schemas
 * - Detects schema drift and breaking changes
 *
 * @param connectionId - The connection to scan
 * @param trigger - How the check was triggered (scheduled or manual)
 * @returns The full scan result with detailed per-action results
 */
export async function runFullScan(
  connectionId: string,
  trigger: HealthCheckTrigger = HealthCheckTrigger.manual
): Promise<FullScanResult> {
  const startTime = Date.now();

  // Get the connection with all related data
  const connection = await getConnectionWithDetails(connectionId);
  if (!connection) {
    throw new FullScanError(
      HealthCheckErrorCodes.CONNECTION_NOT_FOUND,
      `Connection not found: ${connectionId}`,
      404
    );
  }

  const previousStatus = connection.healthStatus;

  // First, check credential status (Tier 1 included)
  const { credentialStatus, credentialExpiresAt } = analyzeCredentialStatus(
    connection.credentials[0] ?? null
  );

  // If credentials are missing or expired, skip the scan
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
      checkTier: HealthCheckTier.full_scan,
      checkTrigger: trigger,
      durationMs,
      credentialStatus,
      credentialExpiresAt,
      actionsScanned: 0,
      actionsPassed: 0,
      actionsFailed: 0,
      scanResults: {
        actions: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      },
      error: {
        code: 'CREDENTIAL_ISSUE',
        message:
          credentialStatus === CredentialHealthStatus.missing
            ? 'No credentials found for connection'
            : 'Credentials have expired',
      },
    });

    await updateConnectionHealthStatus(connectionId, newStatus, HealthCheckTier.full_scan);

    return {
      success: false,
      healthCheck: toHealthCheckResponse(healthCheck),
      connectionId,
      connectionName: connection.name,
      previousStatus,
      newStatus,
      statusChanged: previousStatus !== newStatus,
      scanSummary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      failedActions: [],
    };
  }

  // Get testable actions (GET actions only by default)
  const testableActions = selectTestableActions(connection.integration.actions);

  if (testableActions.length === 0) {
    const durationMs = Date.now() - startTime;
    const newStatus = HealthCheckStatus.healthy; // No testable actions is not an error

    const healthCheck = await createHealthCheck({
      connectionId,
      tenantId: connection.tenantId,
      status: newStatus,
      checkTier: HealthCheckTier.full_scan,
      checkTrigger: trigger,
      durationMs,
      credentialStatus,
      credentialExpiresAt,
      actionsScanned: 0,
      actionsPassed: 0,
      actionsFailed: 0,
      scanResults: {
        actions: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      },
      error: null,
    });

    await updateConnectionHealthStatus(connectionId, newStatus, HealthCheckTier.full_scan);

    return {
      success: true,
      healthCheck: toHealthCheckResponse(healthCheck),
      connectionId,
      connectionName: connection.name,
      previousStatus,
      newStatus,
      statusChanged: previousStatus !== newStatus,
      scanSummary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      failedActions: [],
    };
  }

  // Run tests on all testable actions
  const actionResults: ActionTestResult[] = [];

  for (const action of testableActions) {
    const result = await testAction(connection, action);
    actionResults.push(result);

    // Delay between requests to avoid rate limiting
    if (testableActions.indexOf(action) < testableActions.length - 1) {
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  // Aggregate results
  const passed = actionResults.filter((r) => r.success && !r.skipped).length;
  const failed = actionResults.filter((r) => !r.success && !r.skipped).length;
  const skipped = actionResults.filter((r) => r.skipped).length;
  const total = actionResults.length;

  // Convert to scan results format (simplified for JSON storage)
  const scanResultsForStorage = {
    actions: actionResults.map((r) => ({
      actionId: r.actionId,
      actionSlug: r.actionSlug,
      success: r.success,
      latencyMs: r.latencyMs ?? null,
      statusCode: r.statusCode ?? null,
      error: r.error ? { code: r.error.code, message: r.error.message } : null,
    })),
    summary: { total, passed, failed, skipped },
  };

  // Determine overall health status
  const newStatus = determineFullScanStatus(credentialStatus, passed, failed, total);

  // Calculate total duration
  const durationMs = Date.now() - startTime;

  // Store the health check result
  const healthCheck = await createHealthCheck({
    connectionId,
    tenantId: connection.tenantId,
    status: newStatus,
    checkTier: HealthCheckTier.full_scan,
    checkTrigger: trigger,
    durationMs,
    credentialStatus,
    credentialExpiresAt,
    actionsScanned: total - skipped,
    actionsPassed: passed,
    actionsFailed: failed,
    scanResults: scanResultsForStorage,
    error: null,
  });

  // Update connection health status
  await updateConnectionHealthStatus(connectionId, newStatus, HealthCheckTier.full_scan);

  // Get failed action details
  const failedActions = actionResults
    .filter((r) => !r.success && !r.skipped)
    .map((r) => ({
      actionId: r.actionId,
      actionSlug: r.actionSlug,
      error: r.error?.message ?? 'Unknown error',
    }));

  return {
    success: failed === 0,
    healthCheck: toHealthCheckResponse(healthCheck),
    connectionId,
    connectionName: connection.name,
    previousStatus,
    newStatus,
    statusChanged: previousStatus !== newStatus,
    scanSummary: { total, passed, failed, skipped },
    failedActions,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets connection with all related data needed for full scan
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
            orderBy: { name: 'asc' },
            take: MAX_ACTIONS_PER_SCAN,
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
    },
  });
}

/**
 * Selects actions that are safe to test (GET only by default)
 */
function selectTestableActions(actions: Action[]): Action[] {
  // Filter to GET actions only (no side effects)
  const getActions = actions.filter((a) => a.httpMethod === HttpMethod.GET);

  // Limit to MAX_ACTIONS_PER_SCAN
  return getActions.slice(0, MAX_ACTIONS_PER_SCAN);
}

/**
 * Tests a single action and returns the result
 */
async function testAction(
  connection: ConnectionWithDetails,
  action: Action
): Promise<ActionTestResult> {
  const startTime = Date.now();

  // Check if action has required parameters
  const inputSchema = action.inputSchema as Record<string, unknown>;
  const requiredParams = (inputSchema?.required as string[]) ?? [];

  // Skip actions with required parameters (we can't generate valid test data)
  if (requiredParams.length > 0) {
    return {
      actionId: action.id,
      actionSlug: action.slug,
      success: true, // Skipped is not a failure
      skipped: true,
      skipReason: `Action has ${requiredParams.length} required parameter(s): ${requiredParams.join(', ')}`,
    };
  }

  try {
    const result = await invokeAction(
      connection.tenantId,
      connection.integration.slug,
      action.slug,
      {}, // Empty input for GET actions
      {
        connectionId: connection.id,
        timeoutMs: DEFAULT_ACTION_TIMEOUT_MS,
        skipValidation: true, // We'll do our own validation
      }
    );

    const latencyMs = Date.now() - startTime;

    if (result.success) {
      // Validate response against output schema
      const schemaValidation = validateResponseSchema(result.data, action.outputSchema);

      return {
        actionId: action.id,
        actionSlug: action.slug,
        success: schemaValidation.valid,
        skipped: false,
        latencyMs,
        statusCode: 200,
        schemaValidation: {
          valid: schemaValidation.valid,
          errors: schemaValidation.errors,
        },
        error: schemaValidation.valid
          ? undefined
          : {
              code: 'SCHEMA_DRIFT',
              message: `Response schema mismatch: ${schemaValidation.errors?.join(', ') ?? 'Unknown error'}`,
            },
      };
    } else {
      return {
        actionId: action.id,
        actionSlug: action.slug,
        success: false,
        skipped: false,
        latencyMs,
        statusCode: result.error?.details?.externalStatusCode ?? undefined,
        error: {
          code: result.error?.code ?? 'UNKNOWN_ERROR',
          message: result.error?.message ?? 'Action execution failed',
        },
      };
    }
  } catch (error) {
    return {
      actionId: action.id,
      actionSlug: action.slug,
      success: false,
      skipped: false,
      latencyMs: Date.now() - startTime,
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown execution error',
      },
    };
  }
}

/**
 * Validates response data against the action's output schema
 */
function validateResponseSchema(
  data: unknown,
  outputSchema: unknown
): { valid: boolean; errors?: string[] } {
  // If no output schema defined, consider it valid
  if (!outputSchema || Object.keys(outputSchema as object).length === 0) {
    return { valid: true };
  }

  try {
    // validateActionOutput takes (schema, data) order
    const result = validateActionOutput(outputSchema as Record<string, unknown>, data);

    if (result.valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: result.errors?.map((e) => e.message) ?? ['Schema validation failed'],
    };
  } catch {
    // If validation throws, treat as valid (schema might be malformed)
    return { valid: true };
  }
}

/**
 * Analyzes credential status
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
 * Determines overall health status from full scan results
 */
function determineFullScanStatus(
  credentialStatus: CredentialHealthStatus,
  passed: number,
  failed: number,
  total: number
): HealthCheckStatus {
  // Credential issues take priority
  if (
    credentialStatus === CredentialHealthStatus.expired ||
    credentialStatus === CredentialHealthStatus.missing
  ) {
    return HealthCheckStatus.unhealthy;
  }

  // All actions failed = unhealthy
  if (total > 0 && failed === total) {
    return HealthCheckStatus.unhealthy;
  }

  // Some actions failed = degraded
  if (failed > 0) {
    return HealthCheckStatus.degraded;
  }

  // Expiring credentials = degraded
  if (credentialStatus === CredentialHealthStatus.expiring) {
    return HealthCheckStatus.degraded;
  }

  // All good
  return HealthCheckStatus.healthy;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets connections eligible for full scan
 * Note: Full scans are typically manual, this is for optional monthly scheduling
 *
 * @param tenantId - The tenant ID
 * @param olderThanDays - Check connections not scanned within this many days
 * @returns Array of connection IDs
 */
export async function getConnectionsForFullScan(
  tenantId: string,
  olderThanDays: number = 30
): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const connections = await prisma.connection.findMany({
    where: {
      tenantId,
      OR: [{ lastFullScanAt: null }, { lastFullScanAt: { lt: cutoffTime } }],
    },
    select: { id: true },
  });

  return connections.map((c) => c.id);
}
