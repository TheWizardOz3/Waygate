/**
 * Platform Connectors List Endpoint
 *
 * GET /api/v1/platform-connectors
 *
 * Returns list of available platform connectors (Waygate's registered OAuth apps).
 * These enable "one-click connect" experiences for users.
 *
 * Note: Only active connectors are returned by default.
 * Secrets (client_id, client_secret) are NEVER exposed in responses.
 *
 * @route GET /api/v1/platform-connectors
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  listActivePlatformConnectors,
  listPlatformConnectors,
  PlatformConnectorError,
  ListPlatformConnectorsQuerySchema,
} from '@/lib/modules/platform-connectors';

/**
 * GET /api/v1/platform-connectors
 *
 * Returns list of available platform connectors.
 *
 * Query Parameters:
 * - `status` (optional): Filter by status (active, suspended, deprecated). Default: active only
 * - `authType` (optional): Filter by auth type (oauth2, api_key, etc.)
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "connectors": [
 *       {
 *         "id": "uuid",
 *         "providerSlug": "slack",
 *         "displayName": "Slack",
 *         "description": "Connect to Slack workspaces",
 *         "logoUrl": "/images/providers/slack.svg",
 *         "authType": "oauth2",
 *         "status": "active",
 *         "certifications": { ... },
 *         "rateLimits": { ... }
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? undefined;
    const authType = url.searchParams.get('authType') ?? undefined;

    // Validate query parameters
    const queryResult = ListPlatformConnectorsQuerySchema.safeParse({
      status,
      authType,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryResult.error.flatten(),
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Check the query parameters and try again.',
              retryable: true,
            },
          },
        },
        { status: 400 }
      );
    }

    // If no filters specified, return only active connectors
    const hasFilters = status || authType;
    let connectors;

    if (hasFilters) {
      connectors = await listPlatformConnectors(queryResult.data);
    } else {
      connectors = await listActivePlatformConnectors();
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          connectors,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PlatformConnectorError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: getErrorDescription(error.code),
              retryable: true,
            },
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('[PLATFORM_CONNECTORS_LIST] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An error occurred fetching platform connectors',
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
 * Get human-readable error description
 */
function getErrorDescription(code: string): string {
  switch (code) {
    case 'CONNECTOR_NOT_FOUND':
      return 'The specified platform connector was not found.';
    case 'CONNECTOR_SUSPENDED':
      return 'This platform connector is temporarily suspended for maintenance.';
    case 'CONNECTOR_DEPRECATED':
      return 'This platform connector is deprecated and no longer available.';
    default:
      return 'An error occurred while processing the platform connector request.';
  }
}
