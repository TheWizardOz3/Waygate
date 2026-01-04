/**
 * Zod-Based Validator
 *
 * Validates API responses against Zod schemas with support for different validation modes,
 * type coercion, and configurable handling of nulls and extra fields.
 */

import { z, type ZodTypeAny, type ZodObject, type ZodRawShape } from 'zod';
import {
  type ValidationConfig,
  type ValidationResult,
  type ValidationIssue,
  type ValidationMode,
  type ValidationMeta,
  createEmptyValidationMeta,
  MAX_VALIDATION_DURATION_MS,
} from './validation.schemas';
import { CoercionTracker } from './coercion';
import {
  createIssuesFromZodError,
  createInvalidResponseIssue,
  createSchemaErrorIssue,
  createUnknownFieldIssue,
} from './reporter';

// =============================================================================
// Schema Conversion
// =============================================================================

/**
 * Convert a JSON Schema-like object to a Zod schema
 * This is a simplified converter for common cases
 */
export function jsonSchemaToZod(jsonSchema: Record<string, unknown>): ZodTypeAny {
  const type = jsonSchema.type as string | undefined;

  if (!type) {
    // If no type specified, accept anything
    return z.unknown();
  }

  switch (type) {
    case 'string':
      let strSchema = z.string();
      if (jsonSchema.minLength !== undefined) {
        strSchema = strSchema.min(jsonSchema.minLength as number);
      }
      if (jsonSchema.maxLength !== undefined) {
        strSchema = strSchema.max(jsonSchema.maxLength as number);
      }
      if (jsonSchema.pattern !== undefined) {
        strSchema = strSchema.regex(new RegExp(jsonSchema.pattern as string));
      }
      if (jsonSchema.format === 'email') {
        strSchema = strSchema.email();
      }
      if (jsonSchema.format === 'url' || jsonSchema.format === 'uri') {
        strSchema = strSchema.url();
      }
      return strSchema;

    case 'number':
    case 'integer':
      let numSchema = type === 'integer' ? z.number().int() : z.number();
      if (jsonSchema.minimum !== undefined) {
        numSchema = numSchema.min(jsonSchema.minimum as number);
      }
      if (jsonSchema.maximum !== undefined) {
        numSchema = numSchema.max(jsonSchema.maximum as number);
      }
      return numSchema;

    case 'boolean':
      return z.boolean();

    case 'null':
      return z.null();

    case 'array': {
      const items = jsonSchema.items as Record<string, unknown> | undefined;
      let arrSchema = items ? z.array(jsonSchemaToZod(items)) : z.array(z.unknown());
      if (jsonSchema.minItems !== undefined) {
        arrSchema = arrSchema.min(jsonSchema.minItems as number);
      }
      if (jsonSchema.maxItems !== undefined) {
        arrSchema = arrSchema.max(jsonSchema.maxItems as number);
      }
      return arrSchema;
    }

    case 'object': {
      const properties = jsonSchema.properties as
        | Record<string, Record<string, unknown>>
        | undefined;
      const required = (jsonSchema.required as string[]) ?? [];

      if (!properties) {
        return z.record(z.string(), z.unknown());
      }

      const shape: Record<string, z.ZodType> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const zodProp = jsonSchemaToZod(propSchema);
        shape[key] = required.includes(key) ? zodProp : zodProp.optional();
      }

      return z.object(shape as z.ZodRawShape);
    }

    default:
      return z.unknown();
  }
}

/**
 * Parse a stored output schema into a Zod schema
 */
export function parseOutputSchema(outputSchema: unknown): ZodTypeAny | null {
  if (!outputSchema || typeof outputSchema !== 'object') {
    return null;
  }

  try {
    // If it's already empty or minimal, return null
    const schemaObj = outputSchema as Record<string, unknown>;
    if (Object.keys(schemaObj).length === 0) {
      return null;
    }

    return jsonSchemaToZod(schemaObj);
  } catch {
    return null;
  }
}

// =============================================================================
// Pre-Validation Processing
// =============================================================================

// NOTE: applyCoercion is reserved for future use with deep object coercion
// Currently, coercion is handled at the schema level by Zod transforms

/**
 * Strip unknown fields from an object
 */
function stripUnknownFields(
  data: Record<string, unknown>,
  schema: ZodObject<ZodRawShape>,
  path: string
): { data: Record<string, unknown>; strippedCount: number; strippedPaths: string[] } {
  const schemaShape = schema.shape;
  const knownKeys = new Set(Object.keys(schemaShape));
  const stripped: Record<string, unknown> = {};
  let strippedCount = 0;
  const strippedPaths: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (knownKeys.has(key)) {
      stripped[key] = value;
    } else {
      strippedCount++;
      strippedPaths.push(`${path}.${key}`);
    }
  }

  return { data: stripped, strippedCount, strippedPaths };
}

/**
 * Collect unknown fields from an object
 */
function collectUnknownFields(
  data: Record<string, unknown>,
  schema: ZodObject<ZodRawShape>,
  path: string,
  mode: ValidationMode
): ValidationIssue[] {
  const schemaShape = schema.shape;
  const knownKeys = new Set(Object.keys(schemaShape));
  const issues: ValidationIssue[] = [];

  for (const key of Object.keys(data)) {
    if (!knownKeys.has(key)) {
      issues.push(createUnknownFieldIssue(`${path}.${key}`, key, mode));
    }
  }

  return issues;
}

// =============================================================================
// Main Validation Function
// =============================================================================

export interface ValidateOptions {
  /** The data to validate */
  data: unknown;
  /** The Zod schema to validate against (or JSON Schema object to convert) */
  schema: ZodTypeAny | Record<string, unknown> | null;
  /** Validation configuration */
  config: ValidationConfig;
  /** Start time for timeout tracking */
  startTime?: number;
}

/**
 * Validate data against a schema with configurable mode
 */
export function validate(options: ValidateOptions): ValidationResult {
  const { data, config } = options;
  const startTime = options.startTime ?? Date.now();

  const meta: ValidationMeta = createEmptyValidationMeta();
  const issues: ValidationIssue[] = [];
  const coercionTracker = new CoercionTracker();

  // Check for timeout
  const elapsed = Date.now() - startTime;
  if (elapsed >= MAX_VALIDATION_DURATION_MS) {
    return {
      valid: false,
      mode: config.mode,
      data,
      issues: [createSchemaErrorIssue('Validation timeout exceeded', config.mode)],
      meta: { ...meta, validationDurationMs: elapsed },
    };
  }

  // If no schema provided, skip validation
  let schema = options.schema;
  if (!schema) {
    meta.validationDurationMs = Date.now() - startTime;
    return { valid: true, mode: config.mode, data, meta };
  }

  // Convert JSON Schema to Zod if needed
  if (!(schema instanceof z.ZodType)) {
    try {
      schema = jsonSchemaToZod(schema as Record<string, unknown>);
    } catch (error) {
      return {
        valid: false,
        mode: config.mode,
        data,
        issues: [
          createSchemaErrorIssue(
            `Failed to parse output schema: ${error instanceof Error ? error.message : String(error)}`,
            config.mode
          ),
        ],
        meta: { ...meta, validationDurationMs: Date.now() - startTime },
      };
    }
  }

  // Validate that data is JSON-serializable
  if (data === undefined) {
    issues.push(createInvalidResponseIssue('Response data is undefined', config.mode));
    meta.validationDurationMs = Date.now() - startTime;
    return {
      valid: config.mode !== 'strict',
      mode: config.mode,
      data: null,
      issues,
      meta,
    };
  }

  // Handle extra fields based on configuration
  let processedData = data;

  if (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    schema instanceof z.ZodObject
  ) {
    const dataObj = data as Record<string, unknown>;

    switch (config.extraFields) {
      case 'strip': {
        const stripResult = stripUnknownFields(dataObj, schema, '$');
        processedData = stripResult.data;
        meta.fieldsStripped = stripResult.strippedCount;
        break;
      }
      case 'error': {
        const unknownIssues = collectUnknownFields(dataObj, schema, '$', config.mode);
        issues.push(...unknownIssues);
        break;
      }
      // 'preserve' - do nothing, keep all fields
    }
  }

  // Perform Zod validation
  const parseResult = schema.safeParse(processedData);

  if (parseResult.success) {
    meta.fieldsValidated = countFields(parseResult.data);
    meta.fieldsCoerced = coercionTracker.getCoercedCount();
    meta.validationDurationMs = Date.now() - startTime;

    return {
      valid: true,
      mode: config.mode,
      data: parseResult.data,
      issues: issues.length > 0 ? issues : undefined,
      meta,
    };
  }

  // Handle validation errors
  const zodIssues = createIssuesFromZodError(parseResult.error, config.mode);
  issues.push(...zodIssues);

  // In lenient mode, try to extract as much data as possible
  let outputData = processedData;
  if (config.mode === 'lenient') {
    // Use the original data but note the issues
    outputData = processedData;
    meta.fieldsDefaulted = countDefaultedFields();
  }

  meta.fieldsValidated = countFields(processedData);
  meta.fieldsCoerced = coercionTracker.getCoercedCount();
  meta.validationDurationMs = Date.now() - startTime;

  // Determine if validation "passes" based on mode
  const valid = config.mode !== 'strict';

  return {
    valid,
    mode: config.mode,
    data: valid ? outputData : undefined,
    issues,
    meta,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Count the number of fields in an object (recursive)
 */
function countFields(data: unknown): number {
  if (data === null || data === undefined) {
    return 0;
  }

  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + countFields(item), 0);
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    return (
      Object.keys(obj).length +
      Object.values(obj).reduce<number>((sum, val) => sum + countFields(val), 0)
    );
  }

  return 1;
}

/**
 * Count fields that would need default values
 * Currently a placeholder - will be enhanced with schema introspection
 */
function countDefaultedFields(): number {
  // This is a simplified implementation
  // A full implementation would compare data against schema defaults
  return 0;
}

/**
 * Create a validator function that can be reused
 */
export function createValidator(
  schema: ZodTypeAny | Record<string, unknown> | null,
  config: ValidationConfig
): (data: unknown) => ValidationResult {
  // Pre-convert schema if needed
  let zodSchema = schema;
  if (schema && !(schema instanceof z.ZodType)) {
    zodSchema = jsonSchemaToZod(schema as Record<string, unknown>);
  }

  return (data: unknown) =>
    validate({
      data,
      schema: zodSchema,
      config,
    });
}

/**
 * Quick validation check (returns boolean only)
 */
export function isValid(
  data: unknown,
  schema: ZodTypeAny | Record<string, unknown> | null,
  config: ValidationConfig
): boolean {
  const result = validate({ data, schema, config });
  return result.valid;
}
