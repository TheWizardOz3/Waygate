/**
 * Single Mapping Endpoint
 *
 * GET /api/v1/integrations/:id/actions/:actionId/mappings/:mappingId
 * PATCH /api/v1/integrations/:id/actions/:actionId/mappings/:mappingId
 * DELETE /api/v1/integrations/:id/actions/:actionId/mappings/:mappingId
 *
 * CRUD operations for a single mapping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ActionError, getAction } from '@/lib/modules/actions';
import {
  getMappingById,
  updateMapping,
  deleteMapping,
  UpdateFieldMappingSchema,
  validateMappings,
  mappingService,
  type FieldMapping,
} from '@/lib/modules/execution/mapping/server';

/**
 * Extract IDs from URL
 */
function extractIds(url: string): { actionId: string | null; mappingId: string | null } {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');

  const actionsIndex = pathParts.indexOf('actions');
  const mappingsIndex = pathParts.indexOf('mappings');

  const actionId = actionsIndex !== -1 ? pathParts[actionsIndex + 1] : null;
  const mappingId = mappingsIndex !== -1 ? pathParts[mappingsIndex + 1] : null;

  return { actionId, mappingId };
}

/**
 * GET /api/v1/integrations/:id/actions/:actionId/mappings/:mappingId
 *
 * Get a single mapping by ID.
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { actionId, mappingId } = extractIds(request.url);

    if (!actionId || !mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action ID and Mapping ID are required',
          },
        },
        { status: 400 }
      );
    }

    // Verify action exists and belongs to tenant
    await getAction(tenant.id, actionId);

    // Get mapping
    const mapping = await getMappingById(mappingId);

    if (!mapping) {
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

    return NextResponse.json(
      {
        success: true,
        data: mapping,
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

    console.error('Get mapping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching the mapping',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/v1/integrations/:id/actions/:actionId/mappings/:mappingId
 *
 * Update a single mapping.
 */
export const PATCH = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { actionId, mappingId } = extractIds(request.url);

    if (!actionId || !mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action ID and Mapping ID are required',
          },
        },
        { status: 400 }
      );
    }

    // Verify action exists and belongs to tenant
    await getAction(tenant.id, actionId);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateFieldMappingSchema.safeParse(body);

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

    // If paths are being updated, validate them
    const updates = validationResult.data;
    if (updates.sourcePath || updates.targetPath) {
      // Get current mapping to merge with updates for validation
      const current = await getMappingById(mappingId);
      if (!current) {
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

      const testMapping: FieldMapping = {
        ...current,
        sourcePath: updates.sourcePath ?? current.sourcePath,
        targetPath: updates.targetPath ?? current.targetPath,
      };

      const pathErrors = validateMappings([testMapping]);
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
    }

    // Update mapping
    const mapping = await updateMapping(mappingId, updates);

    if (!mapping) {
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

    // Invalidate caches
    mappingService.invalidateCaches(actionId);

    return NextResponse.json(
      {
        success: true,
        data: mapping,
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

    console.error('Update mapping error:', error);
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
 * DELETE /api/v1/integrations/:id/actions/:actionId/mappings/:mappingId
 *
 * Delete a single mapping.
 */
export const DELETE = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const { actionId, mappingId } = extractIds(request.url);

    if (!actionId || !mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Action ID and Mapping ID are required',
          },
        },
        { status: 400 }
      );
    }

    // Verify action exists and belongs to tenant
    await getAction(tenant.id, actionId);

    // Delete mapping
    const deleted = await deleteMapping(mappingId);

    if (!deleted) {
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

    // Invalidate caches
    mappingService.invalidateCaches(actionId);

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

    console.error('Delete mapping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while deleting the mapping',
        },
      },
      { status: 500 }
    );
  }
});
