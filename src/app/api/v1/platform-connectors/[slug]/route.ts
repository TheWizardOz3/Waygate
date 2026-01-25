/**
 * Platform Connector Detail Endpoint
 *
 * GET /api/v1/platform-connectors/:slug
 *
 * Returns details for a specific platform connector by provider slug.
 *
 * Note: Secrets (client_id, client_secret) are NEVER exposed in responses.
 *
 * @route GET /api/v1/platform-connectors/:slug
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  getActivePlatformConnectorBySlug,
  PlatformConnectorError,
} from '@/lib/modules/platform-connectors';

/**
 * Extract platform connector slug from URL path
 * URL pattern: /api/v1/platform-connectors/{slug}
 */
function extractSlugFromUrl(url: string): string | null {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');

  // Find 'platform-connectors' in path and get the next segment
  const index = pathParts.indexOf('platform-connectors');
  if (index === -1) {
    return null;
  }

  return pathParts[index + 1] || null;
}

/**
 * GET /api/v1/platform-connectors/:slug
 *
 * Returns details for a specific platform connector.
 *
 * Path Parameters:
 * - `slug`: Provider slug (e.g., "slack", "google-workspace")
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "providerSlug": "slack",
 *     "displayName": "Slack",
 *     "description": "Connect to Slack workspaces",
 *     "logoUrl": "/images/providers/slack.svg",
 *     "authType": "oauth2",
 *     "authorizationUrl": "https://slack.com/oauth/v2/authorize",
 *     "tokenUrl": "https://slack.com/api/oauth.v2.access",
 *     "defaultScopes": ["chat:write", "channels:read"],
 *     "callbackPath": "/api/v1/auth/callback/slack",
 *     "status": "active",
 *     "certifications": {
 *       "appReview": { "status": "approved", "approvedAt": "2026-01-01" }
 *     },
 *     "rateLimits": { "requestsPerMinute": 1000, "shared": true }
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 404: Platform connector not found
 * - 410: Platform connector deprecated
 * - 503: Platform connector suspended
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const slug = extractSlugFromUrl(request.url);

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provider slug is required',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Provide a valid provider slug in the URL path.',
              retryable: true,
            },
          },
        },
        { status: 400 }
      );
    }

    const connector = await getActivePlatformConnectorBySlug(slug);

    return NextResponse.json(
      {
        success: true,
        data: connector,
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
              action: getErrorAction(error.code),
              description: getErrorDescription(error.code),
              retryable: isRetryable(error.code),
            },
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('[PLATFORM_CONNECTOR_GET] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An error occurred fetching platform connector',
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
      return 'The specified platform connector was not found. Check the provider slug and try again.';
    case 'CONNECTOR_SUSPENDED':
      return 'This platform connector is temporarily suspended for maintenance. Please try again later.';
    case 'CONNECTOR_DEPRECATED':
      return 'This platform connector is deprecated and no longer available. Consider using custom credentials instead.';
    default:
      return 'An error occurred while processing the platform connector request.';
  }
}

/**
 * Get suggested action for error
 */
function getErrorAction(code: string): string {
  switch (code) {
    case 'CONNECTOR_NOT_FOUND':
      return 'RETRY_WITH_MODIFIED_INPUT';
    case 'CONNECTOR_SUSPENDED':
      return 'RETRY_AFTER_DELAY';
    case 'CONNECTOR_DEPRECATED':
      return 'USE_ALTERNATIVE';
    default:
      return 'ESCALATE_TO_ADMIN';
  }
}

/**
 * Check if error is retryable
 */
function isRetryable(code: string): boolean {
  switch (code) {
    case 'CONNECTOR_SUSPENDED':
      return true;
    case 'CONNECTOR_NOT_FOUND':
    case 'CONNECTOR_DEPRECATED':
      return false;
    default:
      return false;
  }
}
