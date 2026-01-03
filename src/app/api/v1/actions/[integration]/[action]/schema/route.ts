/**
 * Action Schema Endpoint
 *
 * GET /api/v1/actions/:integration/:action/schema
 *
 * Get detailed input/output schema for a specific action.
 * Uses integration slug and action slug (not UUIDs).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { getActionSchema, ActionError } from '@/lib/modules/actions';

export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Extract integration and action slugs from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');

    // URL pattern: /api/v1/actions/{integration}/{action}/schema
    const actionsIndex = pathParts.indexOf('actions');
    const integrationSlug = pathParts[actionsIndex + 1];
    const actionSlug = pathParts[actionsIndex + 2];

    if (!integrationSlug || !actionSlug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Integration slug and action slug are required',
          },
        },
        { status: 400 }
      );
    }

    // Get action schema
    const schema = await getActionSchema(tenant.id, integrationSlug, actionSlug);

    return NextResponse.json(
      {
        success: true,
        data: schema,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ActionError) {
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

    console.error('Get action schema error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching action schema',
        },
      },
      { status: 500 }
    );
  }
});
