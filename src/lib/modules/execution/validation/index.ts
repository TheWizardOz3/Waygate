/**
 * Validation Module Exports
 *
 * Response validation for API responses with support for
 * strict/warn/lenient modes, type coercion, and drift detection.
 *
 * NOTE: This file exports client-safe schemas and types.
 * Server-only exports (drift repository, validation service) are in server.ts
 */

// Schemas and types (client-safe)
export {
  // Enums
  ValidationModeSchema,
  NullHandlingSchema,
  ExtraFieldsHandlingSchema,
  ValidationIssueCodeSchema,
  DriftStatusSchema,
  ResolutionActionSchema,

  // Config schemas
  CoercionConfigSchema,
  DriftDetectionConfigSchema,
  ValidationConfigSchema,
  PartialValidationConfigSchema,
  ValidationRequestSchema,

  // Result schemas
  SuggestedResolutionSchema,
  ValidationIssueSchema,
  ValidationMetaSchema,
  ValidationResultSchema,
  ValidationResponseMetadataSchema,
  ValidationFailureRecordSchema,

  // Types
  type ValidationMode,
  type NullHandling,
  type ExtraFieldsHandling,
  type ValidationIssueCode,
  type DriftStatus,
  type ResolutionAction,
  type CoercionConfig,
  type DriftDetectionConfig,
  type ValidationConfig,
  type PartialValidationConfig,
  type ValidationRequest,
  type SuggestedResolution,
  type ValidationIssue,
  type ValidationMeta,
  type ValidationResult,
  type ValidationResponseMetadata,
  type ValidationFailureRecord,
  type ValidationPreset,

  // Constants
  DEFAULT_VALIDATION_CONFIG,
  MAX_VALIDATION_DURATION_MS,
  ValidationPresets,

  // Helper functions
  mergeValidationConfig,
  applyValidationPreset,
  getSuggestedResolution,
  createEmptyValidationMeta,
  createValidationResponseMetadata,
  isStrictConfig,
  shouldSkipValidation,
  describeValidationConfig,
} from './validation.schemas';

// Coercion utilities (client-safe)
export {
  coerceValue,
  coerceStringToNumber,
  coerceNumberToString,
  coerceStringToBoolean,
  coerceEmptyStringToNull,
  getValueType,
  getValuePreview,
  CoercionTracker,
  DEFAULT_COERCION_CONFIG,
  type CoercionResult,
  type FieldCoercionResult,
} from './coercion';

// Reporter (client-safe)
export {
  createIssueFromZodIssue,
  createIssuesFromZodError,
  createCustomIssue,
  createMissingFieldIssue,
  createTypeMismatchIssue,
  createUnexpectedNullIssue,
  createUnknownFieldIssue,
  createCoercionFailedIssue,
  createInvalidResponseIssue,
  createSchemaErrorIssue,
  groupIssuesByPath,
  summarizeIssuesByCod,
  hasErrors,
  getErrors,
  getWarnings,
  formatIssuesAsText,
  formatIssueForLog,
} from './reporter';

// Validator (client-safe)
export {
  validate,
  createValidator,
  isValid,
  jsonSchemaToZod,
  parseOutputSchema,
  type ValidateOptions,
} from './zod-validator';
