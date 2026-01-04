/**
 * Mapping Schemas
 *
 * Zod schemas for field mapping configuration and operations.
 * Used to transform request inputs and response outputs between
 * Waygate and consuming applications.
 */

import { z } from 'zod';

// =============================================================================
// Enums & Constants
// =============================================================================

/**
 * Direction of field mapping
 * - input: Transform request params before sending to external API
 * - output: Transform response data before returning to consumer
 */
export const MappingDirectionSchema = z.enum(['input', 'output']);
export type MappingDirection = z.infer<typeof MappingDirectionSchema>;

/**
 * Failure handling modes for mapping operations
 * - fail: Request fails if any mapping fails
 * - passthrough: Return original data + error metadata (RECOMMENDED)
 */
export const FailureModeSchema = z.enum(['fail', 'passthrough']);
export type FailureMode = z.infer<typeof FailureModeSchema>;

/**
 * Coercion target types for basic type conversions
 */
export const CoercionTypeSchema = z.enum(['string', 'number', 'boolean']);
export type CoercionType = z.infer<typeof CoercionTypeSchema>;

/**
 * Array handling modes for mapping arrays
 * - all: Map all items in the array
 * - first: Map only the first item
 * - last: Map only the last item
 */
export const ArrayModeSchema = z.enum(['all', 'first', 'last']);
export type ArrayMode = z.infer<typeof ArrayModeSchema>;

/**
 * Mapping error codes
 */
export const MappingErrorCodeSchema = z.enum([
  'PATH_NOT_FOUND',
  'COERCION_FAILED',
  'INVALID_PATH',
  'ARRAY_LIMIT_EXCEEDED',
  'NESTING_LIMIT_EXCEEDED',
]);
export type MappingErrorCode = z.infer<typeof MappingErrorCodeSchema>;

// =============================================================================
// Constants
// =============================================================================

/** Maximum nesting depth for JSONPath */
export const MAX_NESTING_DEPTH = 10;

/** Maximum array items for [*] mapping */
export const MAX_ARRAY_ITEMS = 5000;

/** Default mapping configuration */
export const DEFAULT_MAPPING_CONFIG = {
  enabled: false,
  preserveUnmapped: true,
  failureMode: 'passthrough' as FailureMode,
} as const;

// =============================================================================
// Transform Configuration
// =============================================================================

/**
 * Type coercion configuration for a single mapping
 */
export const CoercionConfigSchema = z.object({
  type: CoercionTypeSchema,
});

export type CoercionConfig = z.infer<typeof CoercionConfigSchema>;

/**
 * Transform configuration for a single field mapping
 * V0.5 scope: basic transforms only
 */
export const TransformConfigSchema = z.object({
  /** Don't include target if source is null/undefined */
  omitIfNull: z.boolean().default(false),

  /** Don't include target if source is empty string/array */
  omitIfEmpty: z.boolean().default(false),

  /** Basic type coercion (string↔number, string↔boolean) */
  coercion: CoercionConfigSchema.optional(),

  /** Value to use if source is missing/null */
  defaultValue: z.unknown().optional(),

  /** Array handling mode for array source paths */
  arrayMode: ArrayModeSchema.default('all'),
});

export type TransformConfig = z.infer<typeof TransformConfigSchema>;

/**
 * Default transform configuration values
 */
export const DEFAULT_TRANSFORM_CONFIG: TransformConfig = {
  omitIfNull: false,
  omitIfEmpty: false,
  arrayMode: 'all',
} as const;

// =============================================================================
// Field Mapping Definition
// =============================================================================

/**
 * Single field mapping definition
 */
export const FieldMappingSchema = z.object({
  /** Unique identifier (optional for new mappings) */
  id: z.string().uuid().optional(),

  /** JSONPath to source field */
  sourcePath: z.string().min(1, 'Source path is required'),

  /** JSONPath to target field */
  targetPath: z.string().min(1, 'Target path is required'),

  /** Direction of mapping (input or output) */
  direction: MappingDirectionSchema,

  /** Transform configuration */
  transformConfig: TransformConfigSchema.optional(),
});

export type FieldMapping = z.infer<typeof FieldMappingSchema>;

/**
 * Create field mapping request
 */
export const CreateFieldMappingSchema = FieldMappingSchema.omit({ id: true });
export type CreateFieldMapping = z.infer<typeof CreateFieldMappingSchema>;

/**
 * Update field mapping request (all fields optional except id)
 */
export const UpdateFieldMappingSchema = z.object({
  sourcePath: z.string().min(1).optional(),
  targetPath: z.string().min(1).optional(),
  direction: MappingDirectionSchema.optional(),
  transformConfig: TransformConfigSchema.partial().optional(),
});
export type UpdateFieldMapping = z.infer<typeof UpdateFieldMappingSchema>;

// =============================================================================
// Action-Level Mapping Configuration
// =============================================================================

/**
 * Action-level mapping configuration
 * Stored in Action.metadata.mappingConfig
 */
export const MappingConfigSchema = z.object({
  /** Whether mapping is enabled for this action */
  enabled: z.boolean().default(false),

  /** Keep fields not in mappings (default: true) */
  preserveUnmapped: z.boolean().default(true),

  /** How to handle mapping failures */
  failureMode: FailureModeSchema.default('passthrough'),
});

export type MappingConfig = z.infer<typeof MappingConfigSchema>;

/**
 * Partial mapping config for updates
 */
export const PartialMappingConfigSchema = MappingConfigSchema.partial();
export type PartialMappingConfig = z.infer<typeof PartialMappingConfigSchema>;

// =============================================================================
// Request-Level Mapping Options
// =============================================================================

/**
 * Mapping options that can be passed with each action invocation
 */
export const MappingRequestSchema = z.object({
  /** Skip mapping entirely for this request (debugging) */
  bypass: z.boolean().optional(),
});

export type MappingRequest = z.infer<typeof MappingRequestSchema>;

// =============================================================================
// Mapping Error Types
// =============================================================================

/**
 * A single mapping error
 */
export const MappingErrorSchema = z.object({
  /** Source path that failed */
  path: z.string(),

  /** Error code */
  code: MappingErrorCodeSchema,

  /** Human-readable error message */
  message: z.string(),

  /** Original value at the path (if available) */
  originalValue: z.unknown().optional(),
});

export type MappingError = z.infer<typeof MappingErrorSchema>;

// =============================================================================
// Mapping Result Types
// =============================================================================

/**
 * Mapping operation metadata
 */
export const MappingMetaSchema = z.object({
  /** Time spent mapping in milliseconds */
  mappingDurationMs: z.number().int().min(0),

  /** Number of input mappings applied */
  inputMappingsApplied: z.number().int().min(0),

  /** Number of output mappings applied */
  outputMappingsApplied: z.number().int().min(0),

  /** Number of fields transformed (renamed) */
  fieldsTransformed: z.number().int().min(0),

  /** Number of fields that underwent type coercion */
  fieldsCoerced: z.number().int().min(0),

  /** Number of fields that used default values */
  fieldsDefaulted: z.number().int().min(0),
});

export type MappingMeta = z.infer<typeof MappingMetaSchema>;

/**
 * Full mapping result
 */
export const MappingResultSchema = z.object({
  /** Whether mapping was applied successfully */
  applied: z.boolean(),

  /** Whether mapping was bypassed */
  bypassed: z.boolean(),

  /** The mapped data (or original if bypassed/error in passthrough mode) */
  data: z.unknown(),

  /** Mapping errors (present if any mappings failed) */
  errors: z.array(MappingErrorSchema).optional(),

  /** Failure mode used */
  failureMode: FailureModeSchema,

  /** Mapping metadata */
  meta: MappingMetaSchema,
});

export type MappingResult = z.infer<typeof MappingResultSchema>;

// =============================================================================
// Response Metadata
// =============================================================================

/**
 * Mapping metadata included in action invocation responses
 */
export const MappingResponseMetadataSchema = z.object({
  /** Was mapping applied? */
  applied: z.boolean(),

  /** Was mapping bypassed? */
  bypassed: z.boolean(),

  /** Number of input mappings applied */
  inputMappingsApplied: z.number().int().min(0),

  /** Number of output mappings applied */
  outputMappingsApplied: z.number().int().min(0),

  /** Number of fields transformed */
  fieldsTransformed: z.number().int().min(0),

  /** Number of fields coerced */
  fieldsCoerced: z.number().int().min(0),

  /** Number of fields that used defaults */
  fieldsDefaulted: z.number().int().min(0),

  /** Time spent mapping */
  mappingDurationMs: z.number().int().min(0),

  /** Mapping errors (in passthrough mode) */
  errors: z.array(MappingErrorSchema).optional(),

  /** Failure mode used */
  failureMode: FailureModeSchema,
});

export type MappingResponseMetadata = z.infer<typeof MappingResponseMetadataSchema>;

// =============================================================================
// Preview Types
// =============================================================================

/**
 * Mapping preview request
 */
export const MappingPreviewRequestSchema = z.object({
  /** Sample data to transform */
  sampleData: z.unknown(),

  /** Direction to preview */
  direction: MappingDirectionSchema,

  /** Optional: specific mappings to preview (overrides stored mappings) */
  mappings: z.array(FieldMappingSchema).optional(),
});

export type MappingPreviewRequest = z.infer<typeof MappingPreviewRequestSchema>;

/**
 * Mapping preview response
 */
export const MappingPreviewResponseSchema = z.object({
  /** Original data */
  original: z.unknown(),

  /** Transformed data */
  transformed: z.unknown(),

  /** Mapping result details */
  result: MappingResultSchema,
});

export type MappingPreviewResponse = z.infer<typeof MappingPreviewResponseSchema>;

// =============================================================================
// Bulk Operations
// =============================================================================

/**
 * Bulk create/update mappings request
 */
export const BulkMappingRequestSchema = z.object({
  /** Mappings to create or update */
  mappings: z.array(FieldMappingSchema),

  /** Whether to replace all existing mappings (true) or merge (false) */
  replace: z.boolean().default(false),
});

export type BulkMappingRequest = z.infer<typeof BulkMappingRequestSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge request mapping options with action's default config
 */
export function mergeMappingConfig(
  actionConfig: MappingConfig | null | undefined,
  requestOptions: MappingRequest | null | undefined
): MappingConfig & { bypass: boolean } {
  // Start with defaults
  const base = actionConfig ?? MappingConfigSchema.parse({});

  return {
    ...base,
    bypass: requestOptions?.bypass ?? false,
  };
}

/**
 * Create empty mapping metadata
 */
export function createEmptyMappingMeta(): MappingMeta {
  return {
    mappingDurationMs: 0,
    inputMappingsApplied: 0,
    outputMappingsApplied: 0,
    fieldsTransformed: 0,
    fieldsCoerced: 0,
    fieldsDefaulted: 0,
  };
}

/**
 * Create mapping response metadata from result
 */
export function createMappingResponseMetadata(result: MappingResult): MappingResponseMetadata {
  return {
    applied: result.applied,
    bypassed: result.bypassed,
    inputMappingsApplied: result.meta.inputMappingsApplied,
    outputMappingsApplied: result.meta.outputMappingsApplied,
    fieldsTransformed: result.meta.fieldsTransformed,
    fieldsCoerced: result.meta.fieldsCoerced,
    fieldsDefaulted: result.meta.fieldsDefaulted,
    mappingDurationMs: result.meta.mappingDurationMs,
    errors: result.errors,
    failureMode: result.failureMode,
  };
}

/**
 * Check if mapping should be skipped
 */
export function shouldSkipMapping(
  config: MappingConfig & { bypass: boolean },
  mappings: FieldMapping[]
): boolean {
  // Bypass explicitly requested
  if (config.bypass) {
    return true;
  }

  // Mapping not enabled
  if (!config.enabled) {
    return true;
  }

  // No mappings configured
  if (mappings.length === 0) {
    return true;
  }

  return false;
}
