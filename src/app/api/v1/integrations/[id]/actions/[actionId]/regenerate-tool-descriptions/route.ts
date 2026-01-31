/**
 * Regenerate Tool Descriptions Endpoint
 *
 * POST /api/v1/integrations/:id/actions/:actionId/regenerate-tool-descriptions
 *
 * Uses LLM to generate optimized tool descriptions for AI agents.
 * Generates and stores toolDescription, toolSuccessTemplate, and toolErrorTemplate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { getAction, ActionError } from '@/lib/modules/actions';
import { regenerateToolDescriptions } from '@/lib/modules/tool-export/descriptions';
import { prisma } from '@/lib/db/client';

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
 * POST /api/v1/integrations/:id/actions/:actionId/regenerate-tool-descriptions
 *
 * Regenerate AI tool descriptions using LLM.
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

    // Verify tenant has access to this action
    await getAction(tenant.id, actionId);

    // Regenerate tool descriptions using LLM
    const descriptions = await regenerateToolDescriptions(actionId, prisma);

    if (!descriptions) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Action not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          toolDescription: descriptions.toolDescription,
          toolSuccessTemplate: descriptions.toolSuccessTemplate,
          toolErrorTemplate: descriptions.toolErrorTemplate,
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

    console.error('Regenerate tool descriptions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while regenerating tool descriptions',
        },
      },
      { status: 500 }
    );
  }
});
