/**
 * Tool Export Schemas
 *
 * Zod schemas for AI tool export formats. Defines the universal tool format
 * that works across all major LLMs (OpenAI, Anthropic, Gemini) and tool
 * frameworks (LangChain, MCP).
 *
 * Key design decisions:
 * - Flat JSON Schema (no $ref, no oneOf/anyOf) for maximum LLM compatibility
 * - Explicit type and description on every property
 * - Mini-prompt style descriptions for better AI understanding
 */

import { z } from 'zod';

// =============================================================================
// Universal Tool Schema Property
// =============================================================================

/**
 * A single property in a universal tool schema.
 * Flattened and explicit for LLM compatibility.
 */
export interface UniversalToolProperty {
  /** Explicit type for the property */
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  /** Required description for LLM understanding */
  description: string;
  /** Enum values for constrained string properties */
  enum?: (string | number | boolean)[];
  /** Default value if any */
  default?: unknown;
  /** For array types: the type of items */
  items?: {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'object';
    description?: string;
  };
  /** For object types: nested properties */
  properties?: Record<string, UniversalToolProperty>;
  /** For nested objects: which properties are required */
  required?: string[];
}

export const UniversalToolPropertySchema: z.ZodType<UniversalToolProperty> = z.lazy(() =>
  z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
    description: z.string().min(1),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    default: z.unknown().optional(),
    items: z
      .object({
        type: z.enum(['string', 'number', 'integer', 'boolean', 'object']),
        description: z.string().optional(),
      })
      .optional(),
    properties: z
      .record(
        z.string(),
        z.lazy(() => UniversalToolPropertySchema)
      )
      .optional(),
    required: z.array(z.string()).optional(),
  })
);

// =============================================================================
// Universal Tool Parameters Schema
// =============================================================================

/**
 * Parameters schema for a universal tool.
 * Always an object with explicit properties.
 */
export const UniversalToolParametersSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), UniversalToolPropertySchema),
  required: z.array(z.string()),
});

export type UniversalToolParameters = z.infer<typeof UniversalToolParametersSchema>;

// =============================================================================
// Universal Tool Schema
// =============================================================================

/**
 * Complete universal tool definition.
 * Works with OpenAI, Anthropic, Gemini, and LangChain.
 */
export const UniversalToolSchema = z.object({
  /** Tool name in snake_case (e.g., "slack_send_message") */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case'),
  /** LLM-optimized description (mini-prompt format) */
  description: z.string().min(1).max(2000),
  /** Parameter definitions */
  parameters: UniversalToolParametersSchema,
  /** What types of context this tool can use */
  contextTypes: z.array(z.string()).optional(),
});

export type UniversalTool = z.infer<typeof UniversalToolSchema>;

// =============================================================================
// Export Response Schemas
// =============================================================================

/**
 * Response when exporting tools for an integration
 */
export const ToolExportResponseSchema = z.object({
  /** Integration metadata */
  integration: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
  }),
  /** Exported tools */
  tools: z.array(UniversalToolSchema),
  /** Available context types for this integration */
  contextTypes: z.array(z.string()),
  /** Export format metadata */
  format: z.object({
    name: z.literal('universal'),
    version: z.literal('1.0'),
    compatibleWith: z.array(z.string()),
  }),
});

export type ToolExportResponse = z.infer<typeof ToolExportResponseSchema>;

/**
 * Response when exporting a single action as a tool
 */
export const SingleToolExportResponseSchema = z.object({
  /** Action metadata */
  action: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
  }),
  /** The exported tool */
  tool: UniversalToolSchema,
  /** Export format metadata */
  format: z.object({
    name: z.literal('universal'),
    version: z.literal('1.0'),
    compatibleWith: z.array(z.string()),
  }),
});

export type SingleToolExportResponse = z.infer<typeof SingleToolExportResponseSchema>;

// =============================================================================
// Internal Types for Transformation
// =============================================================================

/**
 * Input JSON Schema property from action schema.
 * May contain $ref, oneOf, anyOf that need flattening.
 */
export interface InputJsonSchemaProperty {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: (string | number | boolean)[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: InputJsonSchemaProperty;
  properties?: Record<string, InputJsonSchemaProperty>;
  required?: string[];
  nullable?: boolean;
  additionalProperties?: boolean | InputJsonSchemaProperty;
  oneOf?: InputJsonSchemaProperty[];
  anyOf?: InputJsonSchemaProperty[];
  allOf?: InputJsonSchemaProperty[];
  $ref?: string;
}

/**
 * Input JSON Schema from action (may need flattening)
 */
export interface InputJsonSchema {
  type: string;
  properties?: Record<string, InputJsonSchemaProperty>;
  required?: string[];
  items?: InputJsonSchemaProperty;
  additionalProperties?: boolean | InputJsonSchemaProperty;
  description?: string;
  title?: string;
  definitions?: Record<string, InputJsonSchemaProperty>;
  $defs?: Record<string, InputJsonSchemaProperty>;
}

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Tool export error codes
 */
export const ToolExportErrorCodes = {
  INTEGRATION_NOT_FOUND: 'INTEGRATION_NOT_FOUND',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  NO_ACTIONS_AVAILABLE: 'NO_ACTIONS_AVAILABLE',
  SCHEMA_TRANSFORMATION_FAILED: 'SCHEMA_TRANSFORMATION_FAILED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
} as const;

export type ToolExportErrorCode = (typeof ToolExportErrorCodes)[keyof typeof ToolExportErrorCodes];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a tool name from integration and action slugs.
 * Format: {integration}_{action} in snake_case.
 */
export function generateToolName(integrationSlug: string, actionSlug: string): string {
  // Ensure snake_case by replacing hyphens with underscores
  const normalizedIntegration = integrationSlug.toLowerCase().replace(/-/g, '_');
  const normalizedAction = actionSlug.toLowerCase().replace(/-/g, '_');
  return `${normalizedIntegration}_${normalizedAction}`;
}

/**
 * Check if a universal tool is valid
 */
export function isValidUniversalTool(tool: unknown): tool is UniversalTool {
  const result = UniversalToolSchema.safeParse(tool);
  return result.success;
}
