/**
 * LLM Response Preamble Module
 *
 * Provides utilities for adding contextual preambles to API responses,
 * making them more LLM-friendly by providing natural language context.
 */

import { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

/**
 * Context data available for preamble interpolation
 */
export interface PreambleContext {
  integrationName: string;
  integrationSlug: string;
  actionName: string;
  actionSlug: string;
  connectionName: string;
  resultCount?: number;
}

/**
 * Result of preamble application
 */
export interface PreambleResult {
  /** Whether a preamble was applied */
  applied: boolean;
  /** The interpolated preamble string (if applied) */
  context?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Valid template variables that can be used in preamble templates
 */
export const VALID_TEMPLATE_VARIABLES = [
  'integration_name',
  'integration_slug',
  'action_name',
  'action_slug',
  'connection_name',
  'result_count',
] as const;

export type TemplateVariable = (typeof VALID_TEMPLATE_VARIABLES)[number];

/**
 * Maximum length for preamble templates
 */
export const MAX_PREAMBLE_LENGTH = 500;

// =============================================================================
// Schemas
// =============================================================================

/**
 * Schema for preamble template validation
 */
export const PreambleTemplateSchema = z
  .string()
  .max(MAX_PREAMBLE_LENGTH, `Preamble template must be at most ${MAX_PREAMBLE_LENGTH} characters`)
  .optional()
  .nullable();

export type PreambleTemplate = z.infer<typeof PreambleTemplateSchema>;

// =============================================================================
// Validation
// =============================================================================

/**
 * Regex pattern to match template variables like {variable_name}
 */
const TEMPLATE_VAR_PATTERN = /\{([a-z_]+)\}/g;

/**
 * Validates a preamble template and returns any invalid variables found
 *
 * @param template - The preamble template string to validate
 * @returns Array of invalid variable names (empty if all valid)
 */
export function validatePreambleTemplate(template: string): string[] {
  const invalidVariables: string[] = [];
  let match;

  while ((match = TEMPLATE_VAR_PATTERN.exec(template)) !== null) {
    const varName = match[1];
    if (!VALID_TEMPLATE_VARIABLES.includes(varName as TemplateVariable)) {
      invalidVariables.push(varName);
    }
  }

  // Reset regex state
  TEMPLATE_VAR_PATTERN.lastIndex = 0;

  return invalidVariables;
}

/**
 * Checks if a preamble template is valid
 *
 * @param template - The preamble template string to validate
 * @returns True if template is valid, false otherwise
 */
export function isPreambleTemplateValid(template: string | null | undefined): boolean {
  if (!template) return true; // Empty/null templates are valid (means no preamble)
  return validatePreambleTemplate(template).length === 0;
}

// =============================================================================
// Interpolation
// =============================================================================

/**
 * Interpolates a preamble template with the given context
 *
 * @param template - The preamble template string
 * @param context - The context data to interpolate
 * @returns The interpolated preamble string
 *
 * @example
 * ```ts
 * const template = "The {action_name} results from {integration_name} are:";
 * const context = {
 *   integrationName: "Salesforce",
 *   integrationSlug: "salesforce",
 *   actionName: "Search Contacts",
 *   actionSlug: "search-contacts",
 *   connectionName: "Production",
 *   resultCount: 42,
 * };
 * const result = interpolatePreamble(template, context);
 * // "The Search Contacts results from Salesforce are:"
 * ```
 */
export function interpolatePreamble(template: string, context: PreambleContext): string {
  return template
    .replace(/\{integration_name\}/g, context.integrationName)
    .replace(/\{integration_slug\}/g, context.integrationSlug)
    .replace(/\{action_name\}/g, context.actionName)
    .replace(/\{action_slug\}/g, context.actionSlug)
    .replace(/\{connection_name\}/g, context.connectionName)
    .replace(/\{result_count\}/g, String(context.resultCount ?? 'N/A'));
}

/**
 * Calculates result count from response data
 *
 * @param data - The response data
 * @returns The count if data is an array, undefined otherwise
 */
export function calculateResultCount(data: unknown): number | undefined {
  if (Array.isArray(data)) {
    return data.length;
  }

  // Check if data is an object with a common array property
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Check common array property names
    for (const key of ['items', 'results', 'data', 'records', 'entries', 'list']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).length;
      }
    }
  }

  return undefined;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Applies a preamble to response data if configured
 *
 * @param template - The preamble template (null/undefined means no preamble)
 * @param context - The context data for interpolation
 * @param data - The response data (used to calculate result_count)
 * @returns The preamble result with applied status and context string
 *
 * @example
 * ```ts
 * const result = applyPreamble(
 *   "The {action_name} results from {integration_name} ({result_count} items):",
 *   { integrationName: "Slack", ... },
 *   [{ id: 1 }, { id: 2 }]
 * );
 * // { applied: true, context: "The List Users results from Slack (2 items):" }
 * ```
 */
export function applyPreamble(
  template: string | null | undefined,
  context: Omit<PreambleContext, 'resultCount'>,
  data: unknown
): PreambleResult {
  // No preamble configured
  if (!template || template.trim() === '') {
    return { applied: false };
  }

  // Calculate result count from data
  const resultCount = calculateResultCount(data);

  // Build full context
  const fullContext: PreambleContext = {
    ...context,
    resultCount,
  };

  // Interpolate the template
  const interpolated = interpolatePreamble(template, fullContext);

  return {
    applied: true,
    context: interpolated,
  };
}

/**
 * Creates a formatted help text showing available template variables
 *
 * @returns Formatted string describing available variables
 */
export function getAvailableVariablesHelp(): string {
  return `Available variables:
• {integration_name} - Integration display name (e.g., "Salesforce")
• {integration_slug} - Integration slug (e.g., "salesforce")
• {action_name} - Action display name (e.g., "Search Contacts")
• {action_slug} - Action slug (e.g., "search-contacts")
• {connection_name} - Connection label (e.g., "Production")
• {result_count} - Number of items if response is an array`;
}
