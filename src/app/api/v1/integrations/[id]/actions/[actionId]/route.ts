/**
 * Single Action Endpoint
 *
 * GET /api/v1/integrations/:id/actions/:actionId
 * PATCH /api/v1/integrations/:id/actions/:actionId
 * DELETE /api/v1/integrations/:id/actions/:actionId
 *
 * CRUD operations for a single action by ID, scoped to an integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  getAction,
  updateAction,
  deleteAction,
  ActionError,
  UpdateActionInputSchema,
} from '@/lib/modules/actions';

/**
 * Extract integration ID and action ID from URL
 */
function extractIds(url: string): { integrationId: string | null; actionId: string | null } {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');

  const integrationsIndex = pathParts.indexOf('integrations');
  const actionsIndex = pathParts.indexOf('actions');

  const integrationId = integrationsIndex !== -1 ? pathParts[integrationsIndex + 1] : null;
  const actionId = actionsIndex !== -1 ? pathParts[actionsIndex + 1] : null;

  return { integrationId, actionId };
}

/**
 * GET /api/v1/integrations/:id/actions/:actionId
 *
 * Fetch a single action by ID.
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { actionId } = extractIds(request.url);

    if (!actionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Get action - this verifies tenant ownership and returns ActionResponse
    const action = await getAction(tenant.id, actionId);

    return NextResponse.json(
      {
        success: true,
        data: action,
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

    console.error('Get action error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching the action',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/v1/integrations/:id/actions/:actionId
 *
 * Update a single action by ID.
 */
export const PATCH = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { actionId } = extractIds(request.url);

    if (!actionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateActionInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Update action - this verifies tenant ownership and returns ActionResponse
    const action = await updateAction(tenant.id, actionId, validationResult.data);

    return NextResponse.json(
      {
        success: true,
        data: action,
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

    console.error('Update action error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while updating the action',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/v1/integrations/:id/actions/:actionId
 *
 * Delete a single action by ID.
 */
export const DELETE = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { actionId } = extractIds(request.url);

    if (!actionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Delete action - this verifies tenant ownership
    await deleteAction(tenant.id, actionId);

    return NextResponse.json(
      {
        success: true,
        data: null,
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

    console.error('Delete action error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while deleting the action',
        },
      },
      { status: 500 }
    );
  }
});
