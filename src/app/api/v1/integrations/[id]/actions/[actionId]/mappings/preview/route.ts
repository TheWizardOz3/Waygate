/**
 * Mapping Preview Endpoint
 *
 * POST /api/v1/integrations/:id/actions/:actionId/mappings/preview
 *
 * Preview mapping transformation with sample data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ActionError, getAction } from '@/lib/modules/actions';
import {
  MappingPreviewRequestSchema,
  previewMappingWithSample,
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
 * POST /api/v1/integrations/:id/actions/:actionId/mappings/preview
 *
 * Preview mapping transformation with sample data.
 *
 * Request body:
 * {
 *   "sampleData": { ... },       // Data to transform
 *   "direction": "output",       // 'input' or 'output'
 *   "mappings": [ ... ]          // Optional: specific mappings to test (overrides stored)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "original": { ... },        // Original data
 *     "transformed": { ... },     // Transformed data
 *     "result": { ... }           // Full mapping result with metadata
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
    const validationResult = MappingPreviewRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preview request',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Preview the mapping
    const previewResult = await previewMappingWithSample(
      actionId,
      validationResult.data,
      tenant.id
    );

    return NextResponse.json(
      {
        success: true,
        data: previewResult,
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

    console.error('Preview mapping error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while previewing the mapping',
        },
      },
      { status: 500 }
    );
  }
});
