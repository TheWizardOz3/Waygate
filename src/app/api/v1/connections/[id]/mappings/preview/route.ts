/**
 * Connection Mapping Preview Endpoint
 *
 * POST /api/v1/connections/:id/mappings/preview
 *
 * Preview mapping transformation with connection-specific overrides.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ConnectionError, getConnectionById } from '@/lib/modules/connections';
import {
  previewWithConnection,
  MappingPreviewRequestSchema,
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
 * Request body schema
 */
const PreviewRequestSchema = MappingPreviewRequestSchema.extend({
  actionId: z.string().uuid('Invalid action ID'),
});

/**
 * POST /api/v1/connections/:id/mappings/preview
 *
 * Preview how data would be transformed using connection-specific mappings.
 * Uses resolved mappings (action defaults + connection overrides merged).
 *
 * Request body:
 *   - actionId: string - The action to preview mappings for
 *   - sampleData: unknown - Sample data to transform
 *   - direction: 'input' | 'output' - Direction to preview
 *   - mappings?: FieldMapping[] - Optional custom mappings to preview instead
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
    const validationResult = PreviewRequestSchema.safeParse(body);

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

    const { actionId, ...previewRequest } = validationResult.data;

    // Preview mapping with connection context
    const preview = await previewWithConnection(actionId, connectionId, previewRequest);

    return NextResponse.json(
      {
        success: true,
        data: {
          connectionId,
          actionId,
          ...preview,
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

    console.error('[CONNECTION_MAPPING_PREVIEW] Error:', error);
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
