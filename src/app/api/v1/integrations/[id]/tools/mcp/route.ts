/**
 * MCP Tools Export Endpoint
 *
 * GET /api/v1/integrations/:id/tools/mcp - Export all actions as MCP server definition
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { exportIntegrationToolsMCP, ToolExportError } from '@/lib/modules/tool-export';

/**
 * Get error description for user-facing message
 */
function getErrorDescription(code: string): string {
  switch (code) {
    case 'INTEGRATION_NOT_FOUND':
      return 'The specified integration was not found or access denied. Verify the integration ID and API key.';
    case 'NO_ACTIONS_AVAILABLE':
      return 'No actions available for export. Create actions for this integration first.';
    case 'SCHEMA_TRANSFORMATION_FAILED':
      return 'Failed to transform action schema. Check action configuration.';
    default:
      return 'An error occurred while processing the request.';
  }
}

export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Extract integration ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const integrationIdIndex = pathParts.indexOf('integrations') + 1;
    const integrationId = pathParts[integrationIdIndex];

    if (!integrationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Integration ID is required',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Include a valid integration ID in the URL path.',
              retryable: false,
            },
          },
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = url.searchParams;
    const options = {
      includeMetadata: searchParams.get('includeMetadata') === 'true',
      maxDescriptionLength: searchParams.get('maxDescriptionLength')
        ? parseInt(searchParams.get('maxDescriptionLength')!, 10)
        : undefined,
      includeContextTypes: searchParams.get('includeContextTypes') !== 'false',
      includeServerFile: searchParams.get('includeServerFile') !== 'false',
      includeResources: searchParams.get('includeResources') !== 'false',
      serverVersion: searchParams.get('serverVersion') || undefined,
      apiBaseUrl: searchParams.get('apiBaseUrl') || undefined,
    };

    // Export tools
    const result = await exportIntegrationToolsMCP(tenant.id, integrationId, options);

    // Return with cache headers (5 minute cache)
    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error) {
    if (error instanceof ToolExportError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: getErrorDescription(error.code),
              retryable: false,
            },
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('[ToolExport] MCP export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An error occurred while exporting tools',
          suggestedResolution: {
            action: 'ESCALATE_TO_ADMIN',
            description: 'Please try again or contact support if the error persists.',
            retryable: true,
          },
        },
      },
      { status: 500 }
    );
  }
});
