/**
 * Error Formatter
 *
 * Formats failed tool invocation results into agent-readable error responses.
 * Generates clear error messages and remediation guidance that help AI agents
 * understand what went wrong and how to fix it.
 *
 * Design principles:
 * - Error messages clearly explain what happened
 * - Remediation guidance provides actionable steps to fix the issue
 * - Context includes what was attempted for debugging
 * - Retryable errors indicate when to retry
 */

import { type ToolErrorResponse, type ErrorFormatterInput } from './response.schemas';

// =============================================================================
// Error Categories & Remediation Templates
// =============================================================================

/**
 * Categories of errors for generating appropriate remediation
 */
type ErrorCategory =
  | 'validation' // Input validation errors
  | 'authentication' // Auth/credential errors
  | 'not_found' // Resource not found
  | 'rate_limit' // Rate limiting
  | 'external_api' // External API errors
  | 'timeout' // Timeout errors
  | 'permission' // Permission/authorization errors
  | 'configuration' // Configuration errors
  | 'internal'; // Internal errors

/**
 * Categorize an error code
 */
function categorizeError(errorCode: string): ErrorCategory {
  const code = errorCode.toUpperCase();

  if (code.includes('VALIDATION') || code.includes('INVALID')) {
    return 'validation';
  }
  if (
    code.includes('AUTH') ||
    code.includes('CREDENTIAL') ||
    code.includes('TOKEN') ||
    code === 'CREDENTIALS_MISSING' ||
    code === 'CREDENTIALS_EXPIRED'
  ) {
    return 'authentication';
  }
  if (code.includes('NOT_FOUND') || code.includes('404')) {
    return 'not_found';
  }
  if (
    code.includes('RATE') ||
    code.includes('LIMIT') ||
    code.includes('429') ||
    code === 'RATE_LIMITED'
  ) {
    return 'rate_limit';
  }
  if (code.includes('TIMEOUT') || code.includes('504')) {
    return 'timeout';
  }
  if (
    code.includes('PERMISSION') ||
    code.includes('FORBIDDEN') ||
    code.includes('403') ||
    code === 'INTEGRATION_DISABLED'
  ) {
    return 'permission';
  }
  if (code.includes('CONFIG') || code.includes('SETUP')) {
    return 'configuration';
  }
  if (code.includes('EXTERNAL') || code.includes('API') || code.includes('502')) {
    return 'external_api';
  }

  return 'internal';
}

// =============================================================================
// Message Templates
// =============================================================================

/**
 * Generate error message based on category
 */
function generateErrorMessage(input: ErrorFormatterInput, category: ErrorCategory): string {
  const lines: string[] = [];

  switch (category) {
    case 'validation':
      lines.push(`## Validation Error for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      if (input.errorDetails && typeof input.errorDetails === 'object') {
        const details = input.errorDetails as Record<string, unknown>;
        if (Array.isArray(details.errors)) {
          lines.push('');
          lines.push('**Validation issues:**');
          for (const err of details.errors.slice(0, 5)) {
            const e = err as { field?: string; path?: string; message?: string };
            const field = e.field || e.path || 'unknown';
            const msg = e.message || 'Invalid value';
            lines.push(`- \`${field}\`: ${msg}`);
          }
          if (details.errors.length > 5) {
            lines.push(`- ... and ${details.errors.length - 5} more issues`);
          }
        }
      }
      break;

    case 'authentication':
      lines.push(`## Authentication Error for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      lines.push('');
      lines.push('The credentials for this integration are missing, expired, or invalid.');
      break;

    case 'not_found':
      lines.push(`## Resource Not Found for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      break;

    case 'rate_limit':
      lines.push(`## Rate Limited for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      if (input.retryAfterMs) {
        lines.push('');
        lines.push(`**Retry after:** ${Math.ceil(input.retryAfterMs / 1000)} seconds`);
      }
      break;

    case 'timeout':
      lines.push(`## Timeout for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      lines.push('');
      lines.push('The external API took too long to respond.');
      break;

    case 'permission':
      lines.push(`## Permission Denied for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      break;

    case 'configuration':
      lines.push(`## Configuration Error for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      break;

    case 'external_api':
      lines.push(`## External API Error for ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
      if (input.errorDetails && typeof input.errorDetails === 'object') {
        const details = input.errorDetails as Record<string, unknown>;
        if (details.externalStatusCode) {
          lines.push('');
          lines.push(`**External status code:** ${details.externalStatusCode}`);
        }
        if (details.externalMessage) {
          lines.push(`**External message:** ${details.externalMessage}`);
        }
      }
      break;

    default:
      lines.push(`## Error in ${input.actionDisplayName}`);
      lines.push('');
      lines.push(input.errorMessage);
  }

  return lines.join('\n');
}

// =============================================================================
// Remediation Templates
// =============================================================================

/**
 * Generate remediation guidance based on error category
 */
function generateRemediation(input: ErrorFormatterInput, category: ErrorCategory): string {
  const lines: string[] = ['## How to fix:'];

  switch (category) {
    case 'validation':
      lines.push('1. Review the validation errors above');
      lines.push('2. Correct the invalid input values:');
      if (input.errorDetails && typeof input.errorDetails === 'object') {
        const details = input.errorDetails as Record<string, unknown>;
        if (Array.isArray(details.errors)) {
          for (const err of details.errors.slice(0, 3)) {
            const e = err as { field?: string; path?: string; message?: string };
            const field = e.field || e.path;
            if (field) {
              lines.push(`   - Fix the \`${field}\` parameter`);
            }
          }
        }
      }
      lines.push('3. Retry the action with corrected inputs');
      lines.push('');
      lines.push(
        'If you are unsure about the correct format, check the action schema or ask the user for clarification.'
      );
      break;

    case 'authentication':
      lines.push('1. The integration credentials need to be refreshed');
      lines.push('2. Inform the user that re-authentication is required');
      lines.push('3. Do NOT retry this action until credentials are updated');
      lines.push('');
      lines.push('This is a configuration issue that requires human intervention.');
      break;

    case 'not_found':
      lines.push('1. Verify the resource identifier is correct');
      lines.push('2. Check if the resource exists using a list or search action');
      lines.push(
        '3. If using a human-friendly name, ensure it matches exactly (names are often case-sensitive)'
      );
      lines.push('');
      if (input.retryable) {
        lines.push('You can retry with a different identifier if you have an alternative.');
      } else {
        lines.push(
          'If you have already retried with different identifiers, skip this step and inform the user the resource could not be found.'
        );
      }
      break;

    case 'rate_limit':
      if (input.retryAfterMs) {
        const seconds = Math.ceil(input.retryAfterMs / 1000);
        lines.push(`1. Wait ${seconds} seconds before retrying`);
        lines.push('2. Do NOT make additional requests until the wait period has passed');
        lines.push('3. After waiting, retry the exact same request');
      } else {
        lines.push('1. Wait a few seconds before retrying');
        lines.push('2. If rate limiting persists, inform the user to try again later');
      }
      lines.push('');
      lines.push('Rate limiting is temporary and the request should succeed after waiting.');
      break;

    case 'timeout':
      lines.push('1. The external API may be experiencing high load');
      lines.push('2. You can retry the request once');
      lines.push('3. If the timeout persists, inform the user that the external service is slow');
      lines.push('');
      lines.push('Consider whether a simpler or more targeted request might succeed faster.');
      break;

    case 'permission':
      lines.push('1. The integration does not have permission to perform this action');
      lines.push('2. This may require updated OAuth scopes or API permissions');
      lines.push('3. Inform the user that additional permissions are needed');
      lines.push('');
      lines.push('This typically requires human intervention to grant additional access.');
      break;

    case 'configuration':
      lines.push('1. The integration configuration is incomplete or incorrect');
      lines.push('2. This requires updating the integration settings');
      lines.push('3. Inform the user about the configuration issue');
      lines.push('');
      lines.push('Do NOT retry until the configuration is fixed.');
      break;

    case 'external_api':
      lines.push('1. The external API returned an error');
      lines.push('2. Check if the external service has known issues or outages');
      lines.push('3. Review the error message for specific guidance');
      lines.push('');
      if (input.retryable) {
        lines.push('This may be a transient issue - you can retry once.');
      } else {
        lines.push(
          'If the error persists, inform the user and suggest checking the external service status.'
        );
      }
      break;

    default:
      lines.push('1. An unexpected error occurred');
      lines.push('2. You can retry the request once');
      lines.push(
        '3. If the error persists, inform the user and provide the request ID for debugging'
      );
      lines.push('');
      lines.push(`Request ID for support: ${input.requestId}`);
  }

  // Add skip guidance for persistent errors
  lines.push('');
  lines.push(
    'If you have already retried and are still encountering this error, skip this step and proceed with your next task.'
  );

  return lines.join('\n');
}

// =============================================================================
// Main Formatter Function
// =============================================================================

/**
 * Format a failed tool invocation into an agent-readable error response.
 *
 * @param input - The formatter input containing error details
 * @returns An agent-readable error response
 *
 * @example
 * ```typescript
 * const response = formatErrorResponse({
 *   actionName: 'slack_send_message',
 *   actionDisplayName: 'Send Message',
 *   integrationSlug: 'slack',
 *   integrationDisplayName: 'Slack',
 *   requestId: 'req_123',
 *   errorCode: 'CHANNEL_NOT_FOUND',
 *   errorMessage: 'Channel "#nonexistent" not found',
 *   attemptedInput: { channel: '#nonexistent', text: 'Hello!' },
 *   retryable: true,
 * });
 * ```
 */
export function formatErrorResponse(input: ErrorFormatterInput): ToolErrorResponse {
  // Categorize the error
  const category = categorizeError(input.errorCode);

  let message: string;
  let remediation: string;

  // Use stored template if available, otherwise fall back to category-based templates
  if (input.storedErrorTemplate) {
    // Interpolate stored template with actual values
    const templateVars = buildErrorTemplateVariables(input, category);
    const interpolated = interpolateErrorTemplate(input.storedErrorTemplate, templateVars);
    // Stored templates typically include both message and remediation
    message = interpolated;
    remediation = generateRemediation(input, category);
  } else {
    // Generate error message using category-based approach
    message = generateErrorMessage(input, category);
    // Generate remediation guidance
    remediation = generateRemediation(input, category);
  }

  // Build response
  const response: ToolErrorResponse = {
    success: false,
    message,
    error: {
      code: input.errorCode,
      details: input.errorDetails,
    },
    meta: {
      action: input.actionName,
      integration: input.integrationSlug,
      requestId: input.requestId,
      latencyMs: 0, // Errors may not have timing info
    },
    context: {
      attemptedInputs: input.attemptedInput,
    },
    remediation,
  };

  return response;
}

/**
 * Build template variables for error template interpolation
 */
function buildErrorTemplateVariables(
  input: ErrorFormatterInput,
  category: ErrorCategory
): Record<string, string> {
  return {
    error_type: formatErrorType(category),
    error_message: input.errorMessage,
    error_code: input.errorCode,
    attempted_action: input.actionDisplayName,
    integration: input.integrationDisplayName,
    request_id: input.requestId,
    category,
  };
}

/**
 * Format error category into human-readable type
 */
function formatErrorType(category: ErrorCategory): string {
  const typeMap: Record<ErrorCategory, string> = {
    validation: 'Validation',
    authentication: 'Authentication',
    not_found: 'Not Found',
    rate_limit: 'Rate Limit',
    external_api: 'External API',
    timeout: 'Timeout',
    permission: 'Permission',
    configuration: 'Configuration',
    internal: 'Internal',
  };
  return typeMap[category] || 'Unknown';
}

/**
 * Interpolate error template with variables
 * Replaces {{variable_name}} with actual values
 */
function interpolateErrorTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

/**
 * Format a tool error response for direct use in LLM responses.
 * Combines the message and remediation into a single string.
 *
 * @param response - A tool error response
 * @returns A combined message string suitable for LLM output
 */
export function formatErrorForLLM(response: ToolErrorResponse): string {
  return `${response.message}\n\n${response.remediation}`;
}

// =============================================================================
// Gateway Error Adapter
// =============================================================================

/**
 * Common gateway error codes to help with categorization
 */
export const GATEWAY_ERROR_CODES = {
  VALIDATION_ERROR: 'validation',
  INTEGRATION_NOT_FOUND: 'not_found',
  ACTION_NOT_FOUND: 'not_found',
  INTEGRATION_DISABLED: 'permission',
  CONFIGURATION_ERROR: 'configuration',
  CREDENTIALS_MISSING: 'authentication',
  CREDENTIALS_EXPIRED: 'authentication',
  RESPONSE_VALIDATION_ERROR: 'external_api',
  RATE_LIMITED: 'rate_limit',
  CIRCUIT_OPEN: 'external_api',
  EXTERNAL_API_ERROR: 'external_api',
  TIMEOUT: 'timeout',
  INTERNAL_ERROR: 'internal',
} as const;

/**
 * Create error formatter input from a gateway error response.
 * This is a convenience function for converting gateway errors to tool errors.
 *
 * @param actionName - The action name (e.g., "slack_send_message")
 * @param actionDisplayName - The action display name
 * @param integrationSlug - The integration slug
 * @param integrationDisplayName - The integration display name
 * @param gatewayError - The error object from gateway response
 * @param attemptedInput - The input that was attempted
 * @returns ErrorFormatterInput ready for formatErrorResponse
 */
export function createErrorInputFromGateway(
  actionName: string,
  actionDisplayName: string,
  integrationSlug: string,
  integrationDisplayName: string,
  gatewayError: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    suggestedResolution?: {
      action?: string;
      retryable?: boolean;
      retryAfterMs?: number | null;
    };
  },
  attemptedInput: Record<string, unknown>
): ErrorFormatterInput {
  return {
    actionName,
    actionDisplayName,
    integrationSlug,
    integrationDisplayName,
    requestId: gatewayError.requestId,
    errorCode: gatewayError.code,
    errorMessage: gatewayError.message,
    errorDetails: gatewayError.details,
    attemptedInput,
    retryable: gatewayError.suggestedResolution?.retryable ?? false,
    retryAfterMs: gatewayError.suggestedResolution?.retryAfterMs,
    suggestedAction: gatewayError.suggestedResolution?.action,
  };
}
