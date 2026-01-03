/**
 * Action Input Validation Endpoint
 *
 * POST /api/v1/actions/:integration/:action/validate
 *
 * Pre-execution validation of action inputs against JSON Schema.
 * Validates without executing the action - useful for form validation,
 * input preview, and LLM agents to check inputs before execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  getActionBySlug,
  ActionError,
  validateActionInput,
  formatAsApiError,
  formatErrorsForLLM,
} from '@/lib/modules/actions';

interface ValidateRequestBody {
  input: unknown;
  options?: {
    /** Return detailed errors suitable for LLM consumption */
    llmFormat?: boolean;
    /** Apply default values from schema */
    useDefaults?: boolean;
  };
}

export const POST = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Extract integration and action slugs from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');

    // URL pattern: /api/v1/actions/{integration}/{action}/validate
    const actionsIndex = pathParts.indexOf('actions');
    const integrationSlug = pathParts[actionsIndex + 1];
    const actionSlug = pathParts[actionsIndex + 2];

    if (!integrationSlug || !actionSlug) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Integration slug and action slug are required',
          },
        },
        { status: 400 }
      );
    }

    // Parse request body
    let body: ValidateRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
        },
        { status: 400 }
      );
    }

    if (body.input === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_INPUT',
            message: 'Request body must contain an "input" field with the data to validate',
          },
        },
        { status: 400 }
      );
    }

    // Get the action to retrieve its input schema
    const action = await getActionBySlug(tenant.id, integrationSlug, actionSlug);

    // Validate the input against the action's input schema
    const inputSchema = action.inputSchema as Record<string, unknown>;
    const validationResult = validateActionInput(inputSchema, body.input, {
      useDefaults: body.options?.useDefaults ?? true,
    });

    if (validationResult.valid) {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: true,
            actionId: `${integrationSlug}.${actionSlug}`,
            // Return the potentially modified input (with defaults applied)
            validatedInput: body.input,
          },
        },
        { status: 200 }
      );
    }

    // Validation failed - format errors based on requested format
    const llmFormat = body.options?.llmFormat ?? false;

    if (llmFormat) {
      // Return LLM-friendly format
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatErrorsForLLM(validationResult.errors || []),
            details: {
              actionId: `${integrationSlug}.${actionSlug}`,
              errors: validationResult.errors,
            },
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: formatErrorsForLLM(validationResult.errors || []),
              retryable: true,
            },
          },
        },
        { status: 400 }
      );
    }

    // Return standard API error format
    const apiError = formatAsApiError(validationResult);
    return NextResponse.json(
      {
        success: false,
        error: {
          ...apiError,
          details: {
            ...apiError.details,
            actionId: `${integrationSlug}.${actionSlug}`,
          },
        },
      },
      { status: 400 }
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

    console.error('Validate action input error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while validating input',
        },
      },
      { status: 500 }
    );
  }
});
