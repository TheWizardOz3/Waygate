/**
 * JSON Schema Validator
 *
 * Runtime validation utility using Ajv for validating action inputs/outputs
 * against JSON Schema definitions. Uses draft-07 with format validation.
 *
 * Features:
 * - Validator caching for performance
 * - Detailed error messages suitable for API responses
 * - Support for all JSON Schema draft-07 features
 * - LLM-friendly error formatting
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the data is valid against the schema */
  valid: boolean;
  /** Human-readable error messages (if invalid) */
  errors?: ValidationError[];
  /** Raw Ajv errors for detailed debugging */
  rawErrors?: ErrorObject[];
}

/**
 * A structured validation error
 */
export interface ValidationError {
  /** JSONPath to the invalid field */
  path: string;
  /** Human-readable field name */
  field: string;
  /** Human-readable error message */
  message: string;
  /** The value that failed validation */
  value?: unknown;
  /** The constraint that was violated */
  constraint?: {
    type: string;
    expected: unknown;
    received?: unknown;
  };
}

/**
 * Validation mode for controlling strictness
 */
export type ValidationMode = 'strict' | 'warn' | 'lenient';

/**
 * Options for validation
 */
export interface ValidateOptions {
  /** Validation mode (default: 'strict') */
  mode?: ValidationMode;
  /** Remove additional properties not in schema */
  removeAdditional?: boolean;
  /** Use default values from schema */
  useDefaults?: boolean;
  /** Coerce types where possible */
  coerceTypes?: boolean;
}

// =============================================================================
// Ajv Instance (Singleton)
// =============================================================================

/**
 * Create and configure the Ajv instance
 * Uses draft-07 for broad compatibility with most API schemas
 */
function createAjvInstance(options: ValidateOptions = {}): Ajv {
  const ajv = new Ajv({
    allErrors: true, // Collect all errors, not just the first
    verbose: true, // Include data in error objects
    strict: false, // Allow unknown keywords for flexibility
    removeAdditional: options.removeAdditional ?? false,
    useDefaults: options.useDefaults ?? true,
    coerceTypes: options.coerceTypes ?? false,
    // Format validation
    validateFormats: true,
  });

  // Add format validation (email, uri, date-time, etc.)
  addFormats(ajv);

  return ajv;
}

// Default Ajv instance for validation
const defaultAjv = createAjvInstance();

// Validator cache: Map<schemaHash, ValidateFunction>
const validatorCache = new Map<string, ValidateFunction>();

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Validates data against a JSON Schema
 *
 * @param schema - The JSON Schema to validate against
 * @param data - The data to validate
 * @param options - Validation options
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```ts
 * const result = validateJsonSchema(
 *   { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
 *   { name: 'John' }
 * );
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateJsonSchema(
  schema: JSONSchema7 | Record<string, unknown>,
  data: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  // Get or create validator
  const validator = getOrCreateValidator(schema, options);

  // Validate the data
  const valid = validator(data);

  if (valid) {
    return { valid: true };
  }

  // Format errors
  const errors = formatErrors(validator.errors ?? []);

  // In lenient mode, just return valid with warnings
  if (options.mode === 'lenient') {
    return { valid: true, errors };
  }

  // In warn mode, return valid but include errors
  if (options.mode === 'warn') {
    return { valid: true, errors };
  }

  // Strict mode (default): return invalid
  return {
    valid: false,
    errors,
    rawErrors: validator.errors ?? undefined,
  };
}

/**
 * Validates action input data against its input schema
 *
 * @param inputSchema - The action's input JSON Schema
 * @param input - The input data to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateActionInput(
  inputSchema: JSONSchema7 | Record<string, unknown>,
  input: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  return validateJsonSchema(inputSchema, input, {
    useDefaults: true,
    removeAdditional: false,
    ...options,
  });
}

/**
 * Validates action output/response data against its output schema
 *
 * @param outputSchema - The action's output JSON Schema
 * @param output - The output data to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateActionOutput(
  outputSchema: JSONSchema7 | Record<string, unknown>,
  output: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  // Output validation is typically more lenient to handle API changes
  return validateJsonSchema(outputSchema, output, {
    mode: 'warn',
    removeAdditional: false,
    ...options,
  });
}

// =============================================================================
// Validator Management
// =============================================================================

/**
 * Gets a cached validator or creates a new one
 */
function getOrCreateValidator(
  schema: JSONSchema7 | Record<string, unknown>,
  options: ValidateOptions
): ValidateFunction {
  // Create a cache key from the schema
  const cacheKey = createCacheKey(schema, options);

  // Check cache
  let validator = validatorCache.get(cacheKey);
  if (validator) {
    return validator;
  }

  // Create new validator
  const ajv =
    options.removeAdditional || options.coerceTypes ? createAjvInstance(options) : defaultAjv;

  try {
    validator = ajv.compile(schema);
    validatorCache.set(cacheKey, validator);
    return validator;
  } catch (error) {
    // If schema compilation fails, create a passthrough validator
    // This allows graceful degradation for invalid schemas
    console.error('Failed to compile JSON Schema:', error);
    // Return a minimal passthrough function - use unknown first then cast
    return (() => true) as unknown as ValidateFunction;
  }
}

/**
 * Creates a cache key for a schema + options combination
 */
function createCacheKey(
  schema: JSONSchema7 | Record<string, unknown>,
  options: ValidateOptions
): string {
  // Simple hash based on JSON stringification
  const schemaStr = JSON.stringify(schema);
  const optionsStr = JSON.stringify({
    removeAdditional: options.removeAdditional,
    coerceTypes: options.coerceTypes,
  });
  return `${hashString(schemaStr)}_${hashString(optionsStr)}`;
}

/**
 * Simple string hash for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Clears the validator cache
 * Useful for testing or when schemas are updated
 */
export function clearValidatorCache(): void {
  validatorCache.clear();
}

/**
 * Gets the current cache size
 */
export function getValidatorCacheSize(): number {
  return validatorCache.size;
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Formats Ajv errors into human-readable ValidationError objects
 */
function formatErrors(ajvErrors: ErrorObject[]): ValidationError[] {
  return ajvErrors.map((err) => formatSingleError(err));
}

/**
 * Formats a single Ajv error into a ValidationError
 */
function formatSingleError(err: ErrorObject): ValidationError {
  const path = err.instancePath || '/';
  const field = path.split('/').filter(Boolean).pop() || 'root';

  return {
    path,
    field,
    message: createErrorMessage(err),
    value: err.data,
    constraint: extractConstraint(err),
  };
}

/**
 * Creates a human-readable error message from an Ajv error
 */
function createErrorMessage(err: ErrorObject): string {
  const field = err.instancePath.split('/').filter(Boolean).pop() || 'value';

  switch (err.keyword) {
    case 'required': {
      const missingField = (err.params as { missingProperty?: string }).missingProperty;
      return `Missing required field '${missingField}'`;
    }
    case 'type': {
      const params = err.params as { type?: string };
      return `'${field}' must be ${params.type}`;
    }
    case 'enum': {
      const params = err.params as { allowedValues?: unknown[] };
      return `'${field}' must be one of: ${params.allowedValues?.join(', ')}`;
    }
    case 'pattern': {
      const params = err.params as { pattern?: string };
      return `'${field}' must match pattern: ${params.pattern}`;
    }
    case 'format': {
      const params = err.params as { format?: string };
      return `'${field}' must be a valid ${params.format}`;
    }
    case 'minimum': {
      const params = err.params as { limit?: number };
      return `'${field}' must be >= ${params.limit}`;
    }
    case 'maximum': {
      const params = err.params as { limit?: number };
      return `'${field}' must be <= ${params.limit}`;
    }
    case 'minLength': {
      const params = err.params as { limit?: number };
      return `'${field}' must have at least ${params.limit} characters`;
    }
    case 'maxLength': {
      const params = err.params as { limit?: number };
      return `'${field}' must have at most ${params.limit} characters`;
    }
    case 'minItems': {
      const params = err.params as { limit?: number };
      return `'${field}' must have at least ${params.limit} items`;
    }
    case 'maxItems': {
      const params = err.params as { limit?: number };
      return `'${field}' must have at most ${params.limit} items`;
    }
    case 'additionalProperties': {
      const params = err.params as { additionalProperty?: string };
      return `'${field}' has unknown property '${params.additionalProperty}'`;
    }
    case 'const': {
      const params = err.params as { allowedValue?: unknown };
      return `'${field}' must be ${JSON.stringify(params.allowedValue)}`;
    }
    case 'uniqueItems':
      return `'${field}' must contain unique items`;
    case 'oneOf':
      return `'${field}' must match exactly one schema`;
    case 'anyOf':
      return `'${field}' must match at least one schema`;
    default:
      return err.message || `'${field}' is invalid`;
  }
}

/**
 * Extracts constraint information from an Ajv error
 */
function extractConstraint(err: ErrorObject): ValidationError['constraint'] {
  switch (err.keyword) {
    case 'type':
      return {
        type: 'type',
        expected: (err.params as { type?: string }).type,
        received: typeof err.data,
      };
    case 'enum':
      return {
        type: 'enum',
        expected: (err.params as { allowedValues?: unknown[] }).allowedValues,
        received: err.data,
      };
    case 'minimum':
    case 'maximum':
      return {
        type: err.keyword,
        expected: (err.params as { limit?: number }).limit,
        received: err.data,
      };
    case 'minLength':
    case 'maxLength':
      return {
        type: err.keyword,
        expected: (err.params as { limit?: number }).limit,
        received: typeof err.data === 'string' ? err.data.length : undefined,
      };
    case 'pattern':
      return {
        type: 'pattern',
        expected: (err.params as { pattern?: string }).pattern,
        received: err.data,
      };
    case 'format':
      return {
        type: 'format',
        expected: (err.params as { format?: string }).format,
        received: err.data,
      };
    case 'required':
      return {
        type: 'required',
        expected: (err.params as { missingProperty?: string }).missingProperty,
      };
    default:
      return undefined;
  }
}

// =============================================================================
// Schema Utilities
// =============================================================================

/**
 * Checks if a value is a valid JSON Schema structure
 */
export function isValidJsonSchemaStructure(schema: unknown): schema is JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return false;
  }

  const obj = schema as Record<string, unknown>;

  // Must have a type or be a boolean schema or have $ref
  if (
    obj.type === undefined &&
    obj.$ref === undefined &&
    obj.oneOf === undefined &&
    obj.anyOf === undefined &&
    obj.allOf === undefined &&
    typeof schema !== 'boolean'
  ) {
    return false;
  }

  return true;
}

/**
 * Compiles a schema and returns whether it's valid
 * Useful for validating schemas before storing them
 */
export function isCompilableSchema(schema: unknown): boolean {
  if (!isValidJsonSchemaStructure(schema)) {
    return false;
  }

  try {
    defaultAjv.compile(schema as JSONSchema7);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a default empty object schema
 */
export function createEmptySchema(): JSONSchema7 {
  return {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };
}

/**
 * Merges two schemas (for composing complex validations)
 */
export function mergeSchemas(base: JSONSchema7, override: JSONSchema7): JSONSchema7 {
  // Combine required fields from both schemas, removing duplicates
  const baseRequired = (base.required as string[]) || [];
  const overrideRequired = (override.required as string[]) || [];
  const combinedRequired = Array.from(new Set([...baseRequired, ...overrideRequired]));

  return {
    ...base,
    ...override,
    properties: {
      ...(base.properties || {}),
      ...(override.properties || {}),
    },
    required: combinedRequired,
  };
}

// =============================================================================
// LLM-Friendly Error Formatting
// =============================================================================

/**
 * Formats validation errors into an LLM-friendly message
 * Useful for AI agents that need to understand and fix validation issues
 */
export function formatErrorsForLLM(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No validation errors.';
  }

  const lines = [`Found ${errors.length} validation error(s):`, ''];

  errors.forEach((err, index) => {
    lines.push(`${index + 1}. ${err.message}`);
    if (err.path !== '/') {
      lines.push(`   Path: ${err.path}`);
    }
    if (err.constraint) {
      lines.push(`   Expected: ${JSON.stringify(err.constraint.expected)}`);
      if (err.constraint.received !== undefined) {
        lines.push(`   Received: ${JSON.stringify(err.constraint.received)}`);
      }
    }
  });

  return lines.join('\n');
}

/**
 * Formats validation result as an API error response
 */
export function formatAsApiError(result: ValidationResult): {
  code: string;
  message: string;
  details: {
    errors: ValidationError[];
  };
  suggestedResolution: {
    action: string;
    description: string;
    retryable: boolean;
  };
} {
  const errorMessages =
    result.errors?.map((e) => e.message).join('; ') || 'Unknown validation error';

  return {
    code: 'VALIDATION_ERROR',
    message: `Input validation failed: ${errorMessages}`,
    details: {
      errors: result.errors || [],
    },
    suggestedResolution: {
      action: 'RETRY_WITH_MODIFIED_INPUT',
      description: formatErrorsForLLM(result.errors || []),
      retryable: true,
    },
  };
}
