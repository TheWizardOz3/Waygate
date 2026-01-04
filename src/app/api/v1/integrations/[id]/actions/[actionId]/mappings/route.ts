/**
 * Action Mappings Endpoint
 *
 * GET /api/v1/integrations/:id/actions/:actionId/mappings
 * POST /api/v1/integrations/:id/actions/:actionId/mappings
 *
 * List and create field mappings for an action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ActionError, getAction } from '@/lib/modules/actions';
import {
  listMappings,
  createMapping,
  getMappingConfig,
  updateMappingConfig,
  FieldMappingSchema,
  MappingConfigSchema,
  validateMappings,
  type FieldMapping,
} from '@/lib/modules/execution/mapping/server';

/**
 * Extract action ID from URL
 */
function extractActionId(url: string): string | null {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const actionsIndex = pathParts.indexOf('actions');
  return actionsIndex !== -1 ? pathParts[actionsIndex + 1] : null;
}

/**
 * GET /api/v1/integrations/:id/actions/:actionId/mappings
 *
 * List all mappings for an action.
 * Query params:
 *   - direction: 'input' | 'output' (optional filter)
 *   - includeConfig: boolean (include mapping config in response)
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const actionId = extractActionId(request.url);

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

    // Verify action exists and belongs to tenant
    await getAction(tenant.id, actionId);

    // Get query params
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get('direction') as 'input' | 'output' | null;
    const includeConfig = searchParams.get('includeConfig') === 'true';

    // Get mappings
    const mappings = await listMappings(actionId, {
      direction: direction || undefined,
      tenantId: null, // Action-level mappings
    });

    // Optionally include config
    let config;
    if (includeConfig) {
      config = await getMappingConfig(actionId);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          mappings,
          ...(config && { config }),
        },
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

    console.error('List mappings error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while listing mappings',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/integrations/:id/actions/:actionId/mappings
 *
 * Create a new mapping for an action.
 */
export const POST = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const actionId = extractActionId(request.url);

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

    // Verify action exists and belongs to tenant
    await getAction(tenant.id, actionId);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = FieldMappingSchema.omit({ id: true }).safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid mapping configuration',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Validate path syntax
    const pathErrors = validateMappings([validationResult.data as FieldMapping]);
    if (pathErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid mapping paths',
            details: pathErrors,
          },
        },
        { status: 400 }
      );
    }

    // Create mapping
    const mapping = await createMapping(actionId, validationResult.data, null);

    return NextResponse.json(
      {
        success: true,
        data: mapping,
      },
      { status: 201 }
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

    console.error('Create mapping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while creating the mapping',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/v1/integrations/:id/actions/:actionId/mappings
 *
 * Update mapping configuration for an action.
 * This endpoint updates the config (enabled, failureMode, etc.), not individual mappings.
 */
export const PATCH = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const actionId = extractActionId(request.url);

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

    // Verify action exists and belongs to tenant
    await getAction(tenant.id, actionId);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = MappingConfigSchema.partial().safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid mapping configuration',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Update config
    const config = await updateMappingConfig(actionId, validationResult.data);

    return NextResponse.json(
      {
        success: true,
        data: config,
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

    console.error('Update mapping config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while updating mapping configuration',
        },
      },
      { status: 500 }
    );
  }
});
