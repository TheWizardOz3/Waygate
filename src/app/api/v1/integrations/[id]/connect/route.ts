/**
 * OAuth Connect Endpoint
 *
 * POST /api/v1/integrations/:id/connect
 *
 * Initiates an OAuth connection flow for an integration.
 * Returns the authorization URL to redirect the user to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { initiateOAuthConnection, AuthServiceError } from '@/lib/modules/auth/auth.service';

const ConnectRequestSchema = z.object({
  redirectAfterAuth: z.string().url().optional(),
});

export const POST = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Extract integration ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const integrationIdIndex = pathParts.indexOf('integrations') + 1;
    const integrationId = pathParts[integrationIdIndex];

    if (!integrationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Integration ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Parse request body (optional)
    let redirectAfterAuth: string | undefined;
    try {
      const body = await request.json();
      const parsed = ConnectRequestSchema.safeParse(body);
      if (parsed.success) {
        redirectAfterAuth = parsed.data.redirectAfterAuth;
      }
    } catch {
      // Body is optional, ignore parse errors
    }

    // Initiate OAuth flow
    const result = await initiateOAuthConnection(integrationId, tenant.id, redirectAfterAuth);

    return NextResponse.json(
      {
        success: true,
        data: {
          authorizationUrl: result.authorizationUrl,
          state: result.state,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            suggestedResolution:
              error.code === 'INVALID_AUTH_TYPE'
                ? {
                    action: 'CHECK_INTEGRATION_CONFIG',
                    description:
                      'This integration does not use OAuth2. Use the appropriate authentication method.',
                    retryable: false,
                  }
                : error.code === 'MISSING_CREDENTIALS'
                  ? {
                      action: 'CHECK_INTEGRATION_CONFIG',
                      description:
                        'Configure OAuth client ID and secret in the integration settings.',
                      retryable: false,
                    }
                  : undefined,
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('OAuth connect error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while initiating OAuth connection',
        },
      },
      { status: 500 }
    );
  }
});
