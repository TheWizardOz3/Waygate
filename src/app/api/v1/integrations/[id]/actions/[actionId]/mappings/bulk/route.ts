/**
 * Bulk Mapping Endpoint
 *
 * POST /api/v1/integrations/:id/actions/:actionId/mappings/bulk
 *
 * Bulk create or update mappings for an action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ActionError, getAction } from '@/lib/modules/actions';
import {
  BulkMappingRequestSchema,
  bulkUpsertMappings,
  validateMappings,
  mappingService,
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
 * POST /api/v1/integrations/:id/actions/:actionId/mappings/bulk
 *
 * Bulk create or update mappings.
 *
 * Request body:
 * {
 *   "mappings": [
 *     { "sourcePath": "$.data.email", "targetPath": "$.email", "direction": "output" },
 *     { "id": "...", "sourcePath": "$.name", "targetPath": "$.displayName", "direction": "output" }
 *   ],
 *   "replace": false  // If true, deletes all existing mappings first
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "mappings": [ ... ],    // Created/updated mappings
 *     "created": 2,
 *     "updated": 1
 *   }
 * }
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
    const validationResult = BulkMappingRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid bulk mapping request',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { mappings, replace } = validationResult.data;

    // Validate all mapping paths
    const pathErrors = validateMappings(mappings);
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

    // Count existing vs new for response
    const existingCount = mappings.filter((m) => m.id).length;
    const newCount = mappings.length - existingCount;

    // Bulk upsert mappings
    const results = await bulkUpsertMappings(actionId, mappings, replace, null);

    // Invalidate caches
    mappingService.invalidateCaches(actionId);

    return NextResponse.json(
      {
        success: true,
        data: {
          mappings: results,
          created: replace ? mappings.length : newCount,
          updated: replace ? 0 : existingCount,
          replaced: replace,
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

    console.error('Bulk mapping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing bulk mappings',
        },
      },
      { status: 500 }
    );
  }
});
