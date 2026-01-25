/**
 * Single Connection Mapping Endpoint
 *
 * PATCH /api/v1/connections/:id/mappings/:mappingId
 * DELETE /api/v1/connections/:id/mappings/:mappingId
 *
 * Update or delete a specific connection mapping override.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ConnectionError, getConnectionById } from '@/lib/modules/connections';
import {
  deleteConnectionOverride,
  UpdateFieldMappingSchema,
  getMappingById,
  updateMapping,
} from '@/lib/modules/execution/mapping/server';

/**
 * Extract IDs from URL path
 */
function extractIds(url: string): { connectionId: string | null; mappingId: string | null } {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');

  const connectionsIndex = pathParts.indexOf('connections');
  const mappingsIndex = pathParts.indexOf('mappings');

  return {
    connectionId: connectionsIndex !== -1 ? pathParts[connectionsIndex + 1] : null,
    mappingId: mappingsIndex !== -1 ? pathParts[mappingsIndex + 1] : null,
  };
}

/**
 * Query params schema - actionId required for cache invalidation
 */
const QuerySchema = z.object({
  actionId: z.string().uuid('Invalid action ID'),
});

/**
 * PATCH /api/v1/connections/:id/mappings/:mappingId
 *
 * Update a connection-specific mapping override.
 * Only allows updating targetPath and transformConfig (not source or direction).
 */
export const PATCH = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { connectionId, mappingId } = extractIds(request.url);

    if (!connectionId || !mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Connection ID and Mapping ID are required',
          },
        },
        { status: 400 }
      );
    }

    // Verify connection exists and belongs to tenant
    await getConnectionById(tenant.id, connectionId);

    // Verify the mapping exists and belongs to this connection
    const existingMapping = await getMappingById(mappingId);
    if (!existingMapping) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MAPPING_NOT_FOUND',
            message: 'Mapping not found',
          },
        },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateFieldMappingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid mapping update',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Update the mapping
    const updated = await updateMapping(mappingId, validationResult.data);

    return NextResponse.json(
      {
        success: true,
        data: updated,
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

    console.error('[CONNECTION_MAPPING_PATCH] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while updating the mapping',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/v1/connections/:id/mappings/:mappingId
 *
 * Delete a connection-specific mapping override.
 * The connection will revert to using the action-level default for this mapping.
 *
 * Query params:
 *   - actionId: string (required) - For cache invalidation
 */
export const DELETE = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { connectionId, mappingId } = extractIds(request.url);

    if (!connectionId || !mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Connection ID and Mapping ID are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = QuerySchema.safeParse({
      actionId: searchParams.get('actionId'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'actionId query parameter is required',
            details: queryValidation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { actionId } = queryValidation.data;

    // Verify connection exists and belongs to tenant
    await getConnectionById(tenant.id, connectionId);

    // Verify the mapping exists
    const existingMapping = await getMappingById(mappingId);
    if (!existingMapping) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MAPPING_NOT_FOUND',
            message: 'Mapping not found',
          },
        },
        { status: 404 }
      );
    }

    // Delete the override
    const deleted = await deleteConnectionOverride(mappingId, actionId, connectionId);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete the mapping override',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Mapping override deleted. Connection will now use the action default.',
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

    console.error('[CONNECTION_MAPPING_DELETE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while deleting the mapping override',
        },
      },
      { status: 500 }
    );
  }
});
