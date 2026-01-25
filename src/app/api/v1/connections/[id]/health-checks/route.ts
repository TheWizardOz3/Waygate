/**
 * Connection Health Checks Endpoint
 *
 * GET /api/v1/connections/:id/health-checks
 * POST /api/v1/connections/:id/health-checks
 *
 * List health check history or trigger a manual health check.
 *
 * @route GET /api/v1/connections/:id/health-checks
 * @route POST /api/v1/connections/:id/health-checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  findByConnectionId,
  toListHealthChecksResponse,
  runCredentialCheck,
  runConnectivityCheck,
  CredentialCheckError,
  ConnectivityCheckError,
  HealthCheckErrorCodes,
} from '@/lib/modules/health-checks';
import { runFullScan, FullScanError } from '@/lib/modules/health-checks';
import { findConnectionByIdAndTenant } from '@/lib/modules/connections';
import { HealthCheckTier, HealthCheckTrigger } from '@prisma/client';

/**
 * Extract connection ID from URL path
 */
function extractConnectionId(url: string): string | null {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const connectionsIndex = pathParts.indexOf('connections');
  if (connectionsIndex === -1) return null;
  return pathParts[connectionsIndex + 1] || null;
}

/**
 * GET /api/v1/connections/:id/health-checks
 *
 * Returns health check history for a connection.
 *
 * Query Parameters:
 * - `tier`: Filter by tier (credential, connectivity, full_scan)
 * - `status`: Filter by status (healthy, degraded, unhealthy)
 * - `cursor`: Pagination cursor
 * - `limit`: Page size (default: 20, max: 100)
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const connectionId = extractConnectionId(request.url);

    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Connection ID is required',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Include a valid connection ID in the URL path',
              retryable: false,
            },
          },
        },
        { status: 400 }
      );
    }

    // Verify connection belongs to tenant
    const connection = await findConnectionByIdAndTenant(connectionId, tenant.id);
    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONNECTION_NOT_FOUND',
            message: 'Connection not found',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Check the connection ID and try again',
              retryable: false,
            },
          },
        },
        { status: 404 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const tierParam = url.searchParams.get('tier') as HealthCheckTier | null;
    const statusParam = url.searchParams.get('status');
    const cursor = url.searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);

    // Validate tier if provided
    const validTiers = ['credential', 'connectivity', 'full_scan'];
    if (tierParam && !validTiers.includes(tierParam)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TIER',
            message: `Invalid tier: ${tierParam}. Must be one of: ${validTiers.join(', ')}`,
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Use a valid tier value',
              retryable: true,
            },
          },
        },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['healthy', 'degraded', 'unhealthy'];
    if (statusParam && !validStatuses.includes(statusParam)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Invalid status: ${statusParam}. Must be one of: ${validStatuses.join(', ')}`,
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Use a valid status value',
              retryable: true,
            },
          },
        },
        { status: 400 }
      );
    }

    // Fetch health checks
    const result = await findByConnectionId(
      connectionId,
      { cursor, limit },
      {
        tier: tierParam ?? undefined,
        status: statusParam as 'healthy' | 'degraded' | 'unhealthy' | undefined,
      }
    );

    const response = toListHealthChecksResponse(
      result.healthChecks,
      result.nextCursor,
      result.totalCount
    );

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[HEALTH_CHECKS_LIST] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An error occurred fetching health checks',
          suggestedResolution: {
            action: 'ESCALATE_TO_ADMIN',
            description: 'An internal error occurred. Please try again or contact support.',
            retryable: false,
          },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/connections/:id/health-checks
 *
 * Triggers a manual health check for a connection.
 *
 * Request Body:
 * - `tier`: Health check tier to run (credential, connectivity, full_scan). Default: connectivity
 */
export const POST = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const connectionId = extractConnectionId(request.url);

    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Connection ID is required',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Include a valid connection ID in the URL path',
              retryable: false,
            },
          },
        },
        { status: 400 }
      );
    }

    // Verify connection belongs to tenant
    const connection = await findConnectionByIdAndTenant(connectionId, tenant.id);
    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONNECTION_NOT_FOUND',
            message: 'Connection not found',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Check the connection ID and try again',
              retryable: false,
            },
          },
        },
        { status: 404 }
      );
    }

    // Parse request body
    let tier: HealthCheckTier = HealthCheckTier.connectivity;
    try {
      const body = await request.json();
      if (body.tier) {
        const validTiers = ['credential', 'connectivity', 'full_scan'];
        if (!validTiers.includes(body.tier)) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TIER',
                message: `Invalid tier: ${body.tier}. Must be one of: ${validTiers.join(', ')}`,
                suggestedResolution: {
                  action: 'RETRY_WITH_MODIFIED_INPUT',
                  description: 'Use a valid tier value',
                  retryable: true,
                },
              },
            },
            { status: 400 }
          );
        }
        tier = body.tier as HealthCheckTier;
      }
    } catch {
      // No body or invalid JSON - use default tier
    }

    // Run the appropriate health check
    let result;
    switch (tier) {
      case HealthCheckTier.credential:
        result = await runCredentialCheck(connectionId, HealthCheckTrigger.manual);
        break;
      case HealthCheckTier.connectivity:
        result = await runConnectivityCheck(connectionId, HealthCheckTrigger.manual);
        break;
      case HealthCheckTier.full_scan:
        result = await runFullScan(connectionId, HealthCheckTrigger.manual);
        break;
      default:
        result = await runConnectivityCheck(connectionId, HealthCheckTrigger.manual);
    }

    // Build response with tier-specific data
    const responseData: Record<string, unknown> = {
      healthCheck: result.healthCheck,
      tier,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      statusChanged: result.statusChanged,
    };

    // Add tier-specific fields using type-safe checks
    if (tier === HealthCheckTier.connectivity && 'latencyMs' in result) {
      responseData.latencyMs = (result as unknown as { latencyMs: unknown }).latencyMs;
    }
    if (tier === HealthCheckTier.full_scan) {
      if ('scanSummary' in result) {
        responseData.scanSummary = (result as unknown as { scanSummary: unknown }).scanSummary;
      }
      if ('failedActions' in result) {
        responseData.failedActions = (
          result as unknown as { failedActions: unknown }
        ).failedActions;
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle known errors
    if (
      error instanceof CredentialCheckError ||
      error instanceof ConnectivityCheckError ||
      error instanceof FullScanError
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            suggestedResolution: {
              action: getErrorAction(error.code),
              description: getErrorDescription(error.code),
              retryable: isRetryable(error.code),
            },
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('[HEALTH_CHECK_TRIGGER] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An error occurred running health check',
          suggestedResolution: {
            action: 'ESCALATE_TO_ADMIN',
            description: 'An internal error occurred. Please try again or contact support.',
            retryable: false,
          },
        },
      },
      { status: 500 }
    );
  }
});

function getErrorAction(code: string): string {
  switch (code) {
    case HealthCheckErrorCodes.CONNECTION_NOT_FOUND:
      return 'RETRY_WITH_MODIFIED_INPUT';
    case HealthCheckErrorCodes.NO_CREDENTIALS:
      return 'REFRESH_CREDENTIALS';
    case HealthCheckErrorCodes.NO_TEST_ACTION:
      return 'CHECK_INTEGRATION_CONFIG';
    default:
      return 'RETRY_AFTER_DELAY';
  }
}

function getErrorDescription(code: string): string {
  switch (code) {
    case HealthCheckErrorCodes.CONNECTION_NOT_FOUND:
      return 'The specified connection was not found';
    case HealthCheckErrorCodes.NO_CREDENTIALS:
      return 'No credentials found for this connection. Please add credentials first.';
    case HealthCheckErrorCodes.NO_TEST_ACTION:
      return 'No suitable test action found. Configure a test action for this integration.';
    case HealthCheckErrorCodes.HEALTH_CHECK_DISABLED:
      return 'Health checks are disabled for this integration.';
    default:
      return 'An error occurred while running the health check';
  }
}

function isRetryable(code: string): boolean {
  switch (code) {
    case HealthCheckErrorCodes.CONNECTION_NOT_FOUND:
    case HealthCheckErrorCodes.NO_CREDENTIALS:
    case HealthCheckErrorCodes.HEALTH_CHECK_DISABLED:
      return false;
    default:
      return true;
  }
}
