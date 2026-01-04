/**
 * Validation Issue Reporter
 *
 * Creates structured validation issues from Zod errors and other validation failures.
 * Provides LLM-friendly error messages with suggested resolutions.
 */

import type { ZodError, ZodIssue } from 'zod';
import {
  type ValidationIssue,
  type ValidationIssueCode,
  type ValidationMode,
  getSuggestedResolution,
} from './validation.schemas';
import { getValueType, getValuePreview } from './coercion';

// =============================================================================
// Zod Issue to Validation Issue Mapping
// =============================================================================

/**
 * Map Zod issue code to our validation issue code
 */
function mapZodCodeToValidationCode(zodCode: string, issue: ZodIssue): ValidationIssueCode {
  switch (zodCode) {
    case 'invalid_type':
      if ((issue as { received?: string }).received === 'null') {
        return 'UNEXPECTED_NULL';
      }
      return 'TYPE_MISMATCH';

    case 'invalid_literal':
    case 'invalid_enum_value':
      return 'INVALID_ENUM_VALUE';

    case 'unrecognized_keys':
      return 'UNKNOWN_FIELD';

    case 'invalid_string':
      return 'INVALID_FORMAT';

    case 'too_small':
      if ((issue as { type?: string }).type === 'string') {
        return 'STRING_TOO_SHORT';
      }
      if ((issue as { type?: string }).type === 'array') {
        return 'ARRAY_TOO_SHORT';
      }
      return 'VALUE_OUT_OF_RANGE';

    case 'too_big':
      if ((issue as { type?: string }).type === 'string') {
        return 'STRING_TOO_LONG';
      }
      if ((issue as { type?: string }).type === 'array') {
        return 'ARRAY_TOO_LONG';
      }
      return 'VALUE_OUT_OF_RANGE';

    case 'invalid_date':
    case 'invalid_union':
    case 'invalid_arguments':
    case 'invalid_return_type':
      return 'TYPE_MISMATCH';

    default:
      return 'TYPE_MISMATCH';
  }
}

/**
 * Convert a Zod issue path to a JSONPath string
 */
function pathToJsonPath(path: (string | number)[]): string {
  if (path.length === 0) return '$';

  return (
    '$' +
    path
      .map((segment) => {
        if (typeof segment === 'number') {
          return `[${segment}]`;
        }
        // Handle special characters in property names
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
          return `.${segment}`;
        }
        return `["${segment}"]`;
      })
      .join('')
  );
}

/**
 * Extract expected and received types from a Zod issue
 */
function extractTypesFromIssue(issue: ZodIssue): { expected?: string; received?: string } {
  const typedIssue = issue as {
    expected?: string;
    received?: string;
  };

  return {
    expected: typedIssue.expected,
    received: typedIssue.received,
  };
}

// =============================================================================
// Issue Creation
// =============================================================================

/**
 * Create a validation issue from a Zod issue
 */
export function createIssueFromZodIssue(zodIssue: ZodIssue, mode: ValidationMode): ValidationIssue {
  const code = mapZodCodeToValidationCode(zodIssue.code, zodIssue);
  // Filter out symbols from path (Zod uses PropertyKey[] which includes symbol)
  const safePath = zodIssue.path.filter((p): p is string | number => typeof p !== 'symbol');
  const path = pathToJsonPath(safePath);
  const { expected, received } = extractTypesFromIssue(zodIssue);

  return {
    path,
    code,
    message: zodIssue.message,
    expected,
    received,
    severity: mode === 'strict' ? 'error' : 'warning',
    suggestedResolution: getSuggestedResolution(code, path),
  };
}

/**
 * Create validation issues from a Zod error
 */
export function createIssuesFromZodError(
  zodError: ZodError,
  mode: ValidationMode
): ValidationIssue[] {
  return zodError.issues.map((issue) => createIssueFromZodIssue(issue, mode));
}

/**
 * Create a custom validation issue
 */
export function createCustomIssue(
  code: ValidationIssueCode,
  path: string,
  message: string,
  mode: ValidationMode,
  options?: {
    expected?: string;
    received?: string;
  }
): ValidationIssue {
  return {
    path,
    code,
    message,
    expected: options?.expected,
    received: options?.received,
    severity: mode === 'strict' ? 'error' : 'warning',
    suggestedResolution: getSuggestedResolution(code, path),
  };
}

/**
 * Create an issue for a missing required field
 */
export function createMissingFieldIssue(
  path: string,
  fieldName: string,
  mode: ValidationMode
): ValidationIssue {
  return createCustomIssue(
    'MISSING_REQUIRED_FIELD',
    path,
    `Required field '${fieldName}' is missing`,
    mode,
    { expected: 'value', received: 'undefined' }
  );
}

/**
 * Create an issue for a type mismatch
 */
export function createTypeMismatchIssue(
  path: string,
  expectedType: string,
  actualValue: unknown,
  mode: ValidationMode
): ValidationIssue {
  const actualType = getValueType(actualValue);
  const preview = getValuePreview(actualValue);

  return createCustomIssue(
    'TYPE_MISMATCH',
    path,
    `Expected ${expectedType}, received ${actualType}: ${preview}`,
    mode,
    { expected: expectedType, received: actualType }
  );
}

/**
 * Create an issue for an unexpected null
 */
export function createUnexpectedNullIssue(
  path: string,
  expectedType: string,
  mode: ValidationMode
): ValidationIssue {
  return createCustomIssue(
    'UNEXPECTED_NULL',
    path,
    `Expected ${expectedType}, received null`,
    mode,
    { expected: expectedType, received: 'null' }
  );
}

/**
 * Create an issue for an unknown/extra field
 */
export function createUnknownFieldIssue(
  path: string,
  fieldName: string,
  mode: ValidationMode
): ValidationIssue {
  return createCustomIssue('UNKNOWN_FIELD', path, `Unknown field '${fieldName}' in response`, mode);
}

/**
 * Create an issue for a coercion failure
 */
export function createCoercionFailedIssue(
  path: string,
  fromType: string,
  toType: string,
  value: unknown,
  mode: ValidationMode
): ValidationIssue {
  const preview = getValuePreview(value);

  return createCustomIssue(
    'COERCION_FAILED',
    path,
    `Cannot coerce ${fromType} to ${toType}: ${preview}`,
    mode,
    { expected: toType, received: fromType }
  );
}

/**
 * Create an issue for invalid response format (e.g., not JSON)
 */
export function createInvalidResponseIssue(reason: string, mode: ValidationMode): ValidationIssue {
  return createCustomIssue('INVALID_RESPONSE', '$', `Invalid response: ${reason}`, mode);
}

/**
 * Create an issue for schema errors
 */
export function createSchemaErrorIssue(message: string, mode: ValidationMode): ValidationIssue {
  return createCustomIssue('SCHEMA_ERROR', '$', `Schema error: ${message}`, mode);
}

// =============================================================================
// Issue Aggregation
// =============================================================================

/**
 * Group issues by path for easier debugging
 */
export function groupIssuesByPath(issues: ValidationIssue[]): Map<string, ValidationIssue[]> {
  const grouped = new Map<string, ValidationIssue[]>();

  for (const issue of issues) {
    const existing = grouped.get(issue.path) ?? [];
    existing.push(issue);
    grouped.set(issue.path, existing);
  }

  return grouped;
}

/**
 * Get summary of issues by code
 */
export function summarizeIssuesByCod(issues: ValidationIssue[]): Map<ValidationIssueCode, number> {
  const summary = new Map<ValidationIssueCode, number>();

  for (const issue of issues) {
    const count = summary.get(issue.code) ?? 0;
    summary.set(issue.code, count + 1);
  }

  return summary;
}

/**
 * Check if any issues are errors (vs warnings)
 */
export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/**
 * Filter to only error-level issues
 */
export function getErrors(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === 'error');
}

/**
 * Filter to only warning-level issues
 */
export function getWarnings(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === 'warning');
}

// =============================================================================
// Human-Readable Reporting
// =============================================================================

/**
 * Format issues as a human-readable string
 */
export function formatIssuesAsText(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return 'No validation issues';
  }

  const lines: string[] = [`Found ${issues.length} validation issue(s):\n`];

  for (const issue of issues) {
    const severity = issue.severity.toUpperCase();
    lines.push(`[${severity}] ${issue.path}: ${issue.message}`);

    if (issue.expected && issue.received) {
      lines.push(`  Expected: ${issue.expected}, Received: ${issue.received}`);
    }

    if (issue.suggestedResolution) {
      lines.push(`  Suggestion: ${issue.suggestedResolution.description}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single issue as a log message
 */
export function formatIssueForLog(issue: ValidationIssue): string {
  const parts = [
    `[${issue.severity.toUpperCase()}]`,
    `${issue.code}:`,
    issue.path,
    '-',
    issue.message,
  ];

  return parts.join(' ');
}
