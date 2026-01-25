/**
 * Latest Health Check Endpoint
 *
 * GET /api/v1/connections/:id/health-checks/latest
 *
 * Returns the most recent health check for a connection.
 *
 * @route GET /api/v1/connections/:id/health-checks/latest
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  getLatestByConnectionId,
  getLatestByAllTiers,
  toHealthCheckResponse,
} from '@/lib/modules/health-checks';
import { findConnectionByIdAndTenant } from '@/lib/modules/connections';
import { HealthCheckTier } from '@prisma/client';

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
 * GET /api/v1/connections/:id/health-checks/latest
 *
 * Returns the most recent health check for a connection.
 *
 * Query Parameters:
 * - `tier`: Specific tier to get latest for (credential, connectivity, full_scan)
 *           If not provided, returns latest for each tier.
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

    // If specific tier requested, return just that
    if (tierParam) {
      const healthCheck = await getLatestByConnectionId(connectionId);

      if (!healthCheck) {
        return NextResponse.json(
          {
            success: true,
            data: {
              healthCheck: null,
              message: 'No health checks found for this connection',
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            healthCheck: toHealthCheckResponse(healthCheck),
          },
        },
        { status: 200 }
      );
    }

    // Return latest for all tiers
    const latestByTier = await getLatestByAllTiers(connectionId);

    // Convert health checks to response format (only if they exist)
    const credentialCheck = latestByTier[HealthCheckTier.credential];
    const connectivityCheck = latestByTier[HealthCheckTier.connectivity];
    const fullScanCheck = latestByTier[HealthCheckTier.full_scan];

    return NextResponse.json(
      {
        success: true,
        data: {
          latest: connectivityCheck
            ? toHealthCheckResponse(connectivityCheck)
            : credentialCheck
              ? toHealthCheckResponse(credentialCheck)
              : null,
          byTier: {
            credential: credentialCheck ? toHealthCheckResponse(credentialCheck) : null,
            connectivity: connectivityCheck ? toHealthCheckResponse(connectivityCheck) : null,
            full_scan: fullScanCheck ? toHealthCheckResponse(fullScanCheck) : null,
          },
          connection: {
            id: connection.id,
            name: connection.name,
            healthStatus: connection.healthStatus,
            lastCredentialCheckAt: connection.lastCredentialCheckAt?.toISOString() ?? null,
            lastConnectivityCheckAt: connection.lastConnectivityCheckAt?.toISOString() ?? null,
            lastFullScanAt: connection.lastFullScanAt?.toISOString() ?? null,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[HEALTH_CHECK_LATEST] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An error occurred fetching latest health check',
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
