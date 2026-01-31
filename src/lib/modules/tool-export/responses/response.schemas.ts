/**
 * Tool Response Schemas
 *
 * Zod schemas for agent-readable tool invocation responses.
 * These formats are designed for AI agents to understand what happened,
 * what the result was, and what to do next.
 *
 * Design principles:
 * - Success responses include a human/agent-readable message summary
 * - Success responses include next steps guidance for follow-on actions
 * - Error responses include remediation guidance for fixing the issue
 * - All responses include metadata for debugging and transparency
 */

import { z } from 'zod';

// =============================================================================
// Tool Response Metadata
// =============================================================================

/**
 * Metadata about the tool invocation
 */
export const ToolResponseMetaSchema = z.object({
  /** The action that was performed (e.g., "slack_send_message") */
  action: z.string(),
  /** The integration used (e.g., "slack") */
  integration: z.string(),
  /** Unique request ID for debugging */
  requestId: z.string(),
  /** Total execution time in milliseconds */
  latencyMs: z.number().int().min(0),
});

export type ToolResponseMeta = z.infer<typeof ToolResponseMetaSchema>;

// =============================================================================
// Resolved Inputs Context
// =============================================================================

/**
 * A single resolved input field
 */
export const ResolvedInputFieldSchema = z.object({
  /** The original value provided by the agent */
  original: z.string(),
  /** The resolved value (typically an ID) */
  resolved: z.string(),
});

export type ResolvedInputField = z.infer<typeof ResolvedInputFieldSchema>;

/**
 * All resolved inputs for transparency
 */
export const ToolResolvedInputsSchema = z.record(z.string(), ResolvedInputFieldSchema);

export type ToolResolvedInputs = z.infer<typeof ToolResolvedInputsSchema>;

// =============================================================================
// Success Response
// =============================================================================

/**
 * Context information for successful tool invocations
 */
export const ToolSuccessContextSchema = z.object({
  /** Details of inputs that were resolved from names to IDs */
  resolvedInputs: ToolResolvedInputsSchema.optional(),
});

export type ToolSuccessContext = z.infer<typeof ToolSuccessContextSchema>;

/**
 * Successful tool invocation response
 *
 * This format is optimized for AI agents:
 * - `message`: A human/agent-readable summary of what happened
 * - `data`: The actual response data from the external API
 * - `nextSteps`: Guidance on what to do next
 */
export const ToolSuccessResponseSchema = z.object({
  success: z.literal(true),
  /** Human/agent-readable summary of what happened (markdown) */
  message: z.string(),
  /** The actual response data from the external API */
  data: z.unknown(),
  /** Metadata about the invocation */
  meta: ToolResponseMetaSchema,
  /** Context information (resolved inputs, etc.) */
  context: ToolSuccessContextSchema.optional(),
  /** Follow-on instructions for the agent */
  nextSteps: z.string(),
});

export type ToolSuccessResponse = z.infer<typeof ToolSuccessResponseSchema>;

// =============================================================================
// Error Response
// =============================================================================

/**
 * Error details for failed tool invocations
 */
export const ToolErrorDetailsSchema = z.object({
  /** Error code for programmatic handling */
  code: z.string(),
  /** Detailed error information */
  details: z.unknown().optional(),
});

export type ToolErrorDetails = z.infer<typeof ToolErrorDetailsSchema>;

/**
 * Context information for failed tool invocations
 */
export const ToolErrorContextSchema = z.object({
  /** The inputs that were attempted */
  attemptedInputs: z.record(z.string(), z.unknown()),
});

export type ToolErrorContext = z.infer<typeof ToolErrorContextSchema>;

/**
 * Failed tool invocation response
 *
 * This format helps AI agents understand and recover from errors:
 * - `message`: A clear description of what went wrong
 * - `error`: Structured error information
 * - `remediation`: Step-by-step guidance on how to fix the issue
 */
export const ToolErrorResponseSchema = z.object({
  success: z.literal(false),
  /** Human/agent-readable description of what went wrong (markdown) */
  message: z.string(),
  /** Structured error information */
  error: ToolErrorDetailsSchema,
  /** Metadata about the invocation */
  meta: ToolResponseMetaSchema,
  /** Context about what was attempted */
  context: ToolErrorContextSchema,
  /** Guidance on how to fix the issue and what to do next (markdown) */
  remediation: z.string(),
});

export type ToolErrorResponse = z.infer<typeof ToolErrorResponseSchema>;

// =============================================================================
// Combined Response Type
// =============================================================================

/**
 * Union type for all tool responses
 */
export const ToolResponseSchema = z.discriminatedUnion('success', [
  ToolSuccessResponseSchema,
  ToolErrorResponseSchema,
]);

export type ToolResponse = z.infer<typeof ToolResponseSchema>;

// =============================================================================
// Formatter Input Types
// =============================================================================

/**
 * Input for success message formatting
 */
export interface SuccessFormatterInput {
  /** The action that was performed */
  actionName: string;
  /** The action's display name (human-readable) */
  actionDisplayName: string;
  /** The integration slug */
  integrationSlug: string;
  /** The integration's display name */
  integrationDisplayName: string;
  /** The request ID for debugging */
  requestId: string;
  /** Execution latency in milliseconds */
  latencyMs: number;
  /** The original input parameters */
  originalInput: Record<string, unknown>;
  /** The response data from the external API */
  responseData: unknown;
  /** Resolved inputs (if context resolution occurred) */
  resolvedInputs?: Record<string, { original: string; resolved: string }>;
}

/**
 * Input for error message formatting
 */
export interface ErrorFormatterInput {
  /** The action that was attempted */
  actionName: string;
  /** The action's display name (human-readable) */
  actionDisplayName: string;
  /** The integration slug */
  integrationSlug: string;
  /** The integration's display name */
  integrationDisplayName: string;
  /** The request ID for debugging */
  requestId: string;
  /** The error code */
  errorCode: string;
  /** The error message */
  errorMessage: string;
  /** Additional error details */
  errorDetails?: unknown;
  /** The input that was attempted */
  attemptedInput: Record<string, unknown>;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Retry delay in milliseconds (if rate limited) */
  retryAfterMs?: number | null;
  /** Suggested action from the gateway */
  suggestedAction?: string;
}

// =============================================================================
// Action Categories for Templates
// =============================================================================

/**
 * Categories of actions for generating appropriate messages
 */
export type ToolActionCategory =
  | 'send' // Sending messages, notifications
  | 'create' // Creating resources
  | 'read' // Reading/fetching data
  | 'update' // Updating resources
  | 'delete' // Deleting resources
  | 'list' // Listing multiple resources
  | 'search' // Searching for resources
  | 'execute' // Executing operations
  | 'generic'; // Fallback for unknown actions

/**
 * Detect action category from action name
 */
export function detectToolActionCategory(actionName: string): ToolActionCategory {
  const lowerName = actionName.toLowerCase();

  if (/send|post|message|notify|email|sms/.test(lowerName)) return 'send';
  if (/create|add|new|insert/.test(lowerName)) return 'create';
  if (/get|read|fetch|retrieve|show|view/.test(lowerName)) return 'read';
  if (/update|edit|modify|patch|change/.test(lowerName)) return 'update';
  if (/delete|remove|destroy|trash/.test(lowerName)) return 'delete';
  if (/list|all|browse/.test(lowerName)) return 'list';
  if (/search|find|query|lookup/.test(lowerName)) return 'search';
  if (/run|execute|invoke|trigger|start/.test(lowerName)) return 'execute';

  return 'generic';
}
