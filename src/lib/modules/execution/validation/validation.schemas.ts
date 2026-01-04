/**
 * Validation Schemas
 *
 * Zod schemas for response validation configuration, request options, and result types.
 * Supports strict, warn, and lenient validation modes with configurable null handling,
 * extra fields handling, and type coercion.
 */

import { z } from 'zod';

// =============================================================================
// Enums & Constants
// =============================================================================

/**
 * Validation mode types
 * - strict: Fail on any schema mismatch
 * - warn: Log mismatches, pass data through
 * - lenient: Coerce types, use defaults for missing fields
 */
export const ValidationModeSchema = z.enum(['strict', 'warn', 'lenient']);
export type ValidationMode = z.infer<typeof ValidationModeSchema>;

/**
 * Null handling modes
 * - reject: Fail validation on unexpected null
 * - default: Use schema default value if available
 * - pass: Pass null through unchanged
 */
export const NullHandlingSchema = z.enum(['reject', 'default', 'pass']);
export type NullHandling = z.infer<typeof NullHandlingSchema>;

/**
 * Extra fields handling modes
 * - strip: Remove fields not in schema
 * - preserve: Keep extra fields in output
 * - error: Fail validation on extra fields
 */
export const ExtraFieldsHandlingSchema = z.enum(['strip', 'preserve', 'error']);
export type ExtraFieldsHandling = z.infer<typeof ExtraFieldsHandlingSchema>;

/**
 * Validation issue codes
 */
export const ValidationIssueCodeSchema = z.enum([
  'MISSING_REQUIRED_FIELD',
  'TYPE_MISMATCH',
  'INVALID_FORMAT',
  'UNEXPECTED_NULL',
  'UNKNOWN_FIELD',
  'VALUE_OUT_OF_RANGE',
  'INVALID_ENUM_VALUE',
  'ARRAY_TOO_SHORT',
  'ARRAY_TOO_LONG',
  'STRING_TOO_SHORT',
  'STRING_TOO_LONG',
  'COERCION_FAILED',
  'INVALID_RESPONSE',
  'SCHEMA_ERROR',
]);
export type ValidationIssueCode = z.infer<typeof ValidationIssueCodeSchema>;

/**
 * Drift status levels
 */
export const DriftStatusSchema = z.enum(['normal', 'warning', 'alert']);
export type DriftStatus = z.infer<typeof DriftStatusSchema>;

/**
 * Suggested resolution actions for validation issues
 */
export const ResolutionActionSchema = z.enum([
  'IGNORE',
  'USE_DEFAULT',
  'CONTACT_PROVIDER',
  'UPDATE_SCHEMA',
]);
export type ResolutionAction = z.infer<typeof ResolutionActionSchema>;

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default validation configuration - non-breaking defaults for existing integrations
 */
export const DEFAULT_VALIDATION_CONFIG = {
  enabled: true,
  mode: 'warn' as ValidationMode,
  nullHandling: 'pass' as NullHandling,
  extraFields: 'preserve' as ExtraFieldsHandling,
  coercion: {
    stringToNumber: true,
    numberToString: true,
    stringToBoolean: true,
    emptyStringToNull: false,
    nullToDefault: true,
  },
  driftDetection: {
    enabled: true,
    windowMinutes: 60,
    failureThreshold: 5,
    alertOnDrift: true,
  },
  bypassValidation: false,
} as const;

/**
 * Maximum validation duration before timeout (5 seconds)
 */
export const MAX_VALIDATION_DURATION_MS = 5000;

// =============================================================================
// Coercion Configuration
// =============================================================================

/**
 * Type coercion settings for lenient mode
 */
export const CoercionConfigSchema = z.object({
  /** Coerce strings to numbers (e.g., "123" → 123) */
  stringToNumber: z.boolean().default(true),

  /** Coerce numbers to strings (e.g., 123 → "123") */
  numberToString: z.boolean().default(true),

  /** Coerce strings to booleans (e.g., "true" → true, "false" → false) */
  stringToBoolean: z.boolean().default(true),

  /** Coerce empty strings to null (e.g., "" → null) */
  emptyStringToNull: z.boolean().default(false),

  /** Replace null with schema default values */
  nullToDefault: z.boolean().default(true),
});

export type CoercionConfig = z.infer<typeof CoercionConfigSchema>;

// =============================================================================
// Drift Detection Configuration
// =============================================================================

/**
 * Schema drift detection settings
 */
export const DriftDetectionConfigSchema = z.object({
  /** Enable drift detection */
  enabled: z.boolean().default(true),

  /** Time window in minutes to count failures (default: 60 = 1 hour) */
  windowMinutes: z.number().int().min(5).max(1440).default(60),

  /** Number of failures to trigger drift alert (default: 5) */
  failureThreshold: z.number().int().min(1).max(100).default(5),

  /** Whether to send alerts when drift is detected */
  alertOnDrift: z.boolean().default(true),
});

export type DriftDetectionConfig = z.infer<typeof DriftDetectionConfigSchema>;

// =============================================================================
// Validation Configuration (Per-Action Settings)
// =============================================================================

/**
 * Full validation configuration schema for action definitions
 * Stored in action.validationConfig (JSONB column)
 */
export const ValidationConfigSchema = z.object({
  /** Whether validation is enabled for this action */
  enabled: z.boolean().default(true),

  /** Validation mode: strict, warn, or lenient */
  mode: ValidationModeSchema.default('warn'),

  /** How to handle unexpected null values */
  nullHandling: NullHandlingSchema.default('pass'),

  /** How to handle fields not in schema */
  extraFields: ExtraFieldsHandlingSchema.default('preserve'),

  /** Type coercion settings (used in lenient mode) */
  coercion: CoercionConfigSchema.default({
    stringToNumber: true,
    numberToString: true,
    stringToBoolean: true,
    emptyStringToNull: false,
    nullToDefault: true,
  }),

  /** Schema drift detection settings */
  driftDetection: DriftDetectionConfigSchema.default({
    enabled: true,
    windowMinutes: 60,
    failureThreshold: 5,
    alertOnDrift: true,
  }),

  /** Bypass validation entirely (for debugging) */
  bypassValidation: z.boolean().default(false),
});

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;

/**
 * Partial validation config for updates (all fields optional)
 */
export const PartialValidationConfigSchema = ValidationConfigSchema.partial();
export type PartialValidationConfig = z.infer<typeof PartialValidationConfigSchema>;

// =============================================================================
// Request-Level Validation Options
// =============================================================================

/**
 * Validation options that can be passed with each action invocation
 * These override the action's default validation config
 */
export const ValidationRequestSchema = z.object({
  /** Override validation mode for this request */
  mode: ValidationModeSchema.optional(),

  /** Bypass validation entirely for this request (debugging) */
  bypassValidation: z.boolean().optional(),
});

export type ValidationRequest = z.infer<typeof ValidationRequestSchema>;

// =============================================================================
// Validation Issue Types
// =============================================================================

/**
 * Suggested resolution for a validation issue
 */
export const SuggestedResolutionSchema = z.object({
  /** Action to take */
  action: ResolutionActionSchema,

  /** Human-readable description of what to do */
  description: z.string(),
});

export type SuggestedResolution = z.infer<typeof SuggestedResolutionSchema>;

/**
 * A single validation issue found during validation
 */
export const ValidationIssueSchema = z.object({
  /** JSONPath to the problematic field (e.g., "$.data[0].email") */
  path: z.string(),

  /** Standardized error code */
  code: ValidationIssueCodeSchema,

  /** Human-readable error message */
  message: z.string(),

  /** Expected type or value */
  expected: z.string().optional(),

  /** Actual type or value received */
  received: z.string().optional(),

  /** Severity based on validation mode */
  severity: z.enum(['error', 'warning']),

  /** LLM-friendly resolution suggestion */
  suggestedResolution: SuggestedResolutionSchema.optional(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

// =============================================================================
// Validation Result Types
// =============================================================================

/**
 * Metadata about the validation process
 */
export const ValidationMetaSchema = z.object({
  /** Time spent validating in milliseconds */
  validationDurationMs: z.number().int().min(0),

  /** Number of fields validated */
  fieldsValidated: z.number().int().min(0),

  /** Number of fields that were type-coerced */
  fieldsCoerced: z.number().int().min(0),

  /** Number of extra fields that were stripped */
  fieldsStripped: z.number().int().min(0),

  /** Number of fields that used default values */
  fieldsDefaulted: z.number().int().min(0),
});

export type ValidationMeta = z.infer<typeof ValidationMetaSchema>;

/**
 * Full validation result
 */
export const ValidationResultSchema = z.object({
  /** Whether validation passed (no errors in strict mode) */
  valid: z.boolean(),

  /** Validation mode that was used */
  mode: ValidationModeSchema,

  /** Validated/transformed data (present if valid or in warn/lenient mode) */
  data: z.unknown().optional(),

  /** Validation issues found */
  issues: z.array(ValidationIssueSchema).optional(),

  /** Validation metadata */
  meta: ValidationMetaSchema,
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// =============================================================================
// Response Metadata (Included in Action Response)
// =============================================================================

/**
 * Validation metadata included in action invocation responses
 */
export const ValidationResponseMetadataSchema = z.object({
  /** Whether validation passed */
  valid: z.boolean(),

  /** Validation mode used */
  mode: ValidationModeSchema,

  /** Number of issues found */
  issueCount: z.number().int().min(0),

  /** Validation issues (if any) */
  issues: z.array(ValidationIssueSchema).optional(),

  /** Number of fields that were coerced */
  fieldsCoerced: z.number().int().min(0),

  /** Number of extra fields that were stripped */
  fieldsStripped: z.number().int().min(0),

  /** Number of fields that used defaults */
  fieldsDefaulted: z.number().int().min(0),

  /** Time spent validating */
  validationDurationMs: z.number().int().min(0),

  /** Current drift detection status */
  driftStatus: DriftStatusSchema.optional(),

  /** Drift status message (if not normal) */
  driftMessage: z.string().optional(),
});

export type ValidationResponseMetadata = z.infer<typeof ValidationResponseMetadataSchema>;

// =============================================================================
// Drift Tracking Types
// =============================================================================

/**
 * Data stored for tracking validation failures (drift detection)
 */
export const ValidationFailureRecordSchema = z.object({
  /** Action ID */
  actionId: z.string().uuid(),

  /** Tenant ID */
  tenantId: z.string().uuid(),

  /** Issue code */
  issueCode: ValidationIssueCodeSchema,

  /** Field path where issue occurred */
  fieldPath: z.string(),

  /** Expected type/value */
  expectedType: z.string().optional(),

  /** Received type/value */
  receivedType: z.string().optional(),

  /** Number of times this failure has occurred */
  failureCount: z.number().int().min(1),

  /** First time this failure was seen */
  firstSeenAt: z.date(),

  /** Most recent occurrence */
  lastSeenAt: z.date(),

  /** Whether drift alert has been sent */
  driftAlertSent: z.boolean(),

  /** When drift alert was sent */
  driftAlertSentAt: z.date().optional(),
});

export type ValidationFailureRecord = z.infer<typeof ValidationFailureRecordSchema>;

// =============================================================================
// Preset Configurations
// =============================================================================

/**
 * Validation presets for quick configuration
 */
export const ValidationPresets = {
  /** Production: Strict validation for mission-critical data */
  PRODUCTION: {
    mode: 'strict' as ValidationMode,
    nullHandling: 'reject' as NullHandling,
    extraFields: 'strip' as ExtraFieldsHandling,
    driftDetection: {
      enabled: true,
      windowMinutes: 60,
      failureThreshold: 3,
      alertOnDrift: true,
    },
  },
  /** Resilient: Warn on issues but pass data through */
  RESILIENT: {
    mode: 'warn' as ValidationMode,
    nullHandling: 'pass' as NullHandling,
    extraFields: 'preserve' as ExtraFieldsHandling,
    driftDetection: {
      enabled: true,
      windowMinutes: 60,
      failureThreshold: 5,
      alertOnDrift: true,
    },
  },
  /** Flexible: Lenient validation for prototyping */
  FLEXIBLE: {
    mode: 'lenient' as ValidationMode,
    nullHandling: 'default' as NullHandling,
    extraFields: 'preserve' as ExtraFieldsHandling,
    driftDetection: {
      enabled: false,
      windowMinutes: 60,
      failureThreshold: 10,
      alertOnDrift: false,
    },
  },
} as const;

export type ValidationPreset = keyof typeof ValidationPresets;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge request validation options with action's default config
 */
export function mergeValidationConfig(
  actionConfig: ValidationConfig | null | undefined,
  requestOptions: ValidationRequest | null | undefined
): ValidationConfig {
  // Start with defaults
  const base = actionConfig ?? ValidationConfigSchema.parse({});

  if (!requestOptions) {
    return base;
  }

  // Merge request options (they override action config)
  return {
    ...base,
    mode: requestOptions.mode ?? base.mode,
    bypassValidation: requestOptions.bypassValidation ?? base.bypassValidation,
  };
}

/**
 * Apply a preset to a validation config
 */
export function applyValidationPreset(
  config: PartialValidationConfig,
  preset: ValidationPreset
): ValidationConfig {
  const presetConfig = ValidationPresets[preset];
  return ValidationConfigSchema.parse({
    ...config,
    ...presetConfig,
  });
}

/**
 * Get suggested resolution for a validation issue code
 */
export function getSuggestedResolution(
  code: ValidationIssueCode,
  fieldPath: string
): SuggestedResolution {
  switch (code) {
    case 'MISSING_REQUIRED_FIELD':
      return {
        action: 'UPDATE_SCHEMA',
        description: `The field '${fieldPath}' is missing. Consider making it optional in the schema if the API no longer returns it.`,
      };
    case 'TYPE_MISMATCH':
      return {
        action: 'UPDATE_SCHEMA',
        description: `The field '${fieldPath}' has an unexpected type. The API may have changed - consider updating the output schema.`,
      };
    case 'UNEXPECTED_NULL':
      return {
        action: 'USE_DEFAULT',
        description: `The field '${fieldPath}' is unexpectedly null. Consider using lenient mode to handle nulls gracefully.`,
      };
    case 'UNKNOWN_FIELD':
      return {
        action: 'IGNORE',
        description: `Unknown field '${fieldPath}' in response. This may be a new field added by the API.`,
      };
    case 'COERCION_FAILED':
      return {
        action: 'CONTACT_PROVIDER',
        description: `Cannot coerce the value at '${fieldPath}'. The API may be returning unexpected data.`,
      };
    case 'INVALID_RESPONSE':
      return {
        action: 'CONTACT_PROVIDER',
        description: `The API response is not valid JSON. This may indicate an API error or outage.`,
      };
    default:
      return {
        action: 'UPDATE_SCHEMA',
        description: `Validation failed at '${fieldPath}'. Review the output schema for this action.`,
      };
  }
}

/**
 * Create empty validation metadata
 */
export function createEmptyValidationMeta(): ValidationMeta {
  return {
    validationDurationMs: 0,
    fieldsValidated: 0,
    fieldsCoerced: 0,
    fieldsStripped: 0,
    fieldsDefaulted: 0,
  };
}

/**
 * Create validation response metadata from result
 */
export function createValidationResponseMetadata(
  result: ValidationResult,
  driftStatus?: DriftStatus,
  driftMessage?: string
): ValidationResponseMetadata {
  return {
    valid: result.valid,
    mode: result.mode,
    issueCount: result.issues?.length ?? 0,
    issues: result.issues,
    fieldsCoerced: result.meta.fieldsCoerced,
    fieldsStripped: result.meta.fieldsStripped,
    fieldsDefaulted: result.meta.fieldsDefaulted,
    validationDurationMs: result.meta.validationDurationMs,
    driftStatus,
    driftMessage,
  };
}

/**
 * Check if validation config uses strict settings
 */
export function isStrictConfig(config: ValidationConfig): boolean {
  return config.mode === 'strict';
}

/**
 * Check if validation should be skipped
 */
export function shouldSkipValidation(config: ValidationConfig): boolean {
  return !config.enabled || config.bypassValidation;
}

/**
 * Get human-readable description of validation config
 */
export function describeValidationConfig(config: ValidationConfig): string {
  const parts: string[] = [];
  parts.push(`Mode: ${config.mode}`);
  parts.push(`Nulls: ${config.nullHandling}`);
  parts.push(`Extra fields: ${config.extraFields}`);
  if (config.driftDetection.enabled) {
    parts.push(
      `Drift detection: ${config.driftDetection.failureThreshold} failures in ${config.driftDetection.windowMinutes}m`
    );
  }
  return parts.join(', ');
}
