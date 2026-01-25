/**
 * Connection Mapping Copy Endpoint
 *
 * POST /api/v1/connections/:id/mappings/copy
 *
 * Copy action-level default mappings to a connection as overrides.
 * Useful when user wants to customize but start from existing defaults.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { ConnectionError, getConnectionById } from '@/lib/modules/connections';
import { copyMappingsToConnectionService } from '@/lib/modules/execution/mapping/server';

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
const CopyRequestSchema = z.object({
  actionId: z.string().uuid('Invalid action ID'),
});

/**
 * POST /api/v1/connections/:id/mappings/copy
 *
 * Copy action-level default mappings to a connection as starting overrides.
 * This allows users to start customizing from the existing defaults.
 *
 * Request body:
 *   - actionId: string - The action to copy mappings from
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
    const validationResult = CopyRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { actionId } = validationResult.data;

    // Copy defaults to connection
    const copiedMappings = await copyMappingsToConnectionService(actionId, connectionId, tenant.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          connectionId,
          actionId,
          copiedCount: copiedMappings.length,
          mappings: copiedMappings,
          message: `Copied ${copiedMappings.length} default mapping(s) to connection`,
        },
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

    console.error('[CONNECTION_MAPPING_COPY] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while copying mappings',
        },
      },
      { status: 500 }
    );
  }
});
