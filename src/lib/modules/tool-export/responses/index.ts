/**
 * Tool Export Response Formatters
 *
 * Agent-readable response formatting for tool invocations.
 * Provides structured success/error messages with actionable guidance.
 */

// =============================================================================
// Response Schemas
// =============================================================================

export {
  // Schemas
  ToolResponseMetaSchema,
  ResolvedInputFieldSchema,
  ToolResolvedInputsSchema,
  ToolSuccessContextSchema,
  ToolSuccessResponseSchema,
  ToolErrorDetailsSchema,
  ToolErrorContextSchema,
  ToolErrorResponseSchema,
  ToolResponseSchema,
  // Types
  type ToolResponseMeta,
  type ResolvedInputField,
  type ToolResolvedInputs,
  type ToolSuccessContext,
  type ToolSuccessResponse,
  type ToolErrorDetails,
  type ToolErrorContext,
  type ToolErrorResponse,
  type ToolResponse,
  // Formatter input types
  type SuccessFormatterInput,
  type ErrorFormatterInput,
  // Action categories
  type ToolActionCategory,
  detectToolActionCategory,
} from './response.schemas';

// =============================================================================
// Success Formatter
// =============================================================================

export { formatSuccessResponse, formatSuccessForLLM } from './success-formatter';

// =============================================================================
// Error Formatter
// =============================================================================

export {
  formatErrorResponse,
  formatErrorForLLM,
  createErrorInputFromGateway,
  GATEWAY_ERROR_CODES,
} from './error-formatter';
