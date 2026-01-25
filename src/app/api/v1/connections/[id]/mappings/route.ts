/**
 * Connection Mappings Endpoint
 *
 * GET /api/v1/connections/:id/mappings
 * POST /api/v1/connections/:id/mappings
 *
 * List connection mapping overrides with inheritance state and create new overrides.
 * Requires actionId query parameter to scope mappings to a specific action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ConnectionError, getConnectionById } from '@/lib/modules/connections';
import {
  getConnectionMappingState,
  createConnectionOverride,
  FieldMappingSchema,
  validateMappings,
  type FieldMapping,
} from '@/lib/modules/execution/mapping/server';

/**
 * Extract connection ID from URL path
 */
function extractConnectionId(url: string): string | null {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const connectionsIndex = pathParts.indexOf('connections');
  return connectionsIndex !== -1 ? pathParts[connectionsIndex + 1] : null;
}

/**
 * Query params schema for GET
 */
const ListQuerySchema = z.object({
  actionId: z.string().uuid('Invalid action ID'),
  direction: z.enum(['input', 'output']).optional(),
});

/**
 * Request body schema for POST
 */
const CreateOverrideSchema = FieldMappingSchema.omit({ id: true }).extend({
  actionId: z.string().uuid('Invalid action ID'),
});

/**
 * GET /api/v1/connections/:id/mappings
 *
 * List mappings for a connection with inheritance state.
 * Returns resolved mappings (defaults + overrides merged) with source info.
 *
 * Query params:
 *   - actionId: string (required) - The action to get mappings for
 *   - direction: 'input' | 'output' (optional filter)
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
          },
        },
        { status: 400 }
      );
    }

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = ListQuerySchema.safeParse({
      actionId: searchParams.get('actionId'),
      direction: searchParams.get('direction'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryValidation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { actionId, direction } = queryValidation.data;

    // Verify connection exists and belongs to tenant
    await getConnectionById(tenant.id, connectionId);

    // Get connection mapping state with inheritance info
    const state = await getConnectionMappingState(actionId, connectionId);

    // Filter by direction if specified
    let mappings = state.mappings;
    if (direction) {
      mappings = mappings.filter((rm) => rm.mapping.direction === direction);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          actionId: state.actionId,
          connectionId: state.connectionId,
          mappings,
          config: state.config,
          stats: {
            defaultsCount: state.defaultsCount,
            overridesCount: state.overridesCount,
            totalCount: mappings.length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ConnectionError) {
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

    console.error('[CONNECTION_MAPPINGS_GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while listing connection mappings',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v1/connections/:id/mappings
 *
 * Create a connection-specific mapping override.
 * This overrides the action-level default for this specific connection.
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
          },
        },
        { status: 400 }
      );
    }

    // Verify connection exists and belongs to tenant
    await getConnectionById(tenant.id, connectionId);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateOverrideSchema.safeParse(body);

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

    const { actionId, ...mappingData } = validationResult.data;

    // Validate path syntax
    const pathErrors = validateMappings([mappingData as FieldMapping]);
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

    // Create the connection override
    const mapping = await createConnectionOverride(actionId, connectionId, mappingData, tenant.id);

    return NextResponse.json(
      {
        success: true,
        data: mapping,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ConnectionError) {
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

    console.error('[CONNECTION_MAPPINGS_POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while creating the connection mapping override',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/v1/connections/:id/mappings
 *
 * Reset all connection mappings to defaults for a specific action.
 * Deletes all connection-specific overrides.
 */
export const DELETE = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const connectionId = extractConnectionId(request.url);

    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Connection ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate query params - actionId is required
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');

    if (!actionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'actionId query parameter is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify connection exists and belongs to tenant
    await getConnectionById(tenant.id, connectionId);

    // Import dynamically to avoid circular dependency issues
    const { resetConnectionMappingsService } =
      await import('@/lib/modules/execution/mapping/server');
    const deletedCount = await resetConnectionMappingsService(actionId, connectionId);

    return NextResponse.json(
      {
        success: true,
        data: {
          deletedCount,
          message: `Reset ${deletedCount} mapping override(s) to defaults`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ConnectionError) {
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

    console.error('[CONNECTION_MAPPINGS_DELETE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while resetting connection mappings',
        },
      },
      { status: 500 }
    );
  }
});
