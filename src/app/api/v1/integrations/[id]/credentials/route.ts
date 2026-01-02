/**
 * Credentials Status Endpoint
 *
 * GET /api/v1/integrations/:id/credentials
 *
 * Returns the credential status for an integration (no secrets).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { getIntegrationAuthStatus, AuthServiceError } from '@/lib/modules/auth/auth.service';

export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
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

    const status = await getIntegrationAuthStatus(integrationId, tenant.id);

    return NextResponse.json(
      {
        success: true,
        data: status,
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
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('Credentials status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching credential status',
        },
      },
      { status: 500 }
    );
  }
});
