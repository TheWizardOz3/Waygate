/**
 * Field Mapping Module
 *
 * Provides field transformation capabilities between Waygate and consuming apps.
 * Supports JSONPath-based field mapping, type coercion, and fail-open passthrough mode.
 *
 * NOTE: This file exports client-safe schemas and types.
 * Server-only exports (repository, service) are in server.ts
 */

// =============================================================================
// Schemas & Types
// =============================================================================

export {
  // Enums
  MappingDirectionSchema,
  FailureModeSchema,
  CoercionTypeSchema,
  ArrayModeSchema,
  MappingErrorCodeSchema,
  MappingSourceSchema,
  // Constants
  MAX_NESTING_DEPTH,
  MAX_ARRAY_ITEMS,
  DEFAULT_MAPPING_CONFIG,
  DEFAULT_TRANSFORM_CONFIG,
  // Transform config
  CoercionConfigSchema,
  TransformConfigSchema,
  // Field mapping
  FieldMappingSchema,
  CreateFieldMappingSchema,
  UpdateFieldMappingSchema,
  FieldMappingWithConnectionSchema,
  // Connection mapping
  ResolvedMappingSchema,
  CreateConnectionMappingSchema,
  UpdateConnectionMappingSchema,
  ConnectionMappingStateSchema,
  // Action config
  MappingConfigSchema,
  PartialMappingConfigSchema,
  // Request options
  MappingRequestSchema,
  // Error types
  MappingErrorSchema,
  // Result types
  MappingMetaSchema,
  MappingResultSchema,
  MappingResponseMetadataSchema,
  // Preview types
  MappingPreviewRequestSchema,
  MappingPreviewResponseSchema,
  // Bulk operations
  BulkMappingRequestSchema,
  // Helpers
  mergeMappingConfig,
  createEmptyMappingMeta,
  createMappingResponseMetadata,
  shouldSkipMapping,
} from './mapping.schemas';

export type {
  MappingDirection,
  FailureMode,
  CoercionType,
  ArrayMode,
  MappingErrorCode,
  MappingSource,
  CoercionConfig,
  TransformConfig,
  FieldMapping,
  CreateFieldMapping,
  UpdateFieldMapping,
  FieldMappingWithConnection,
  ResolvedMapping,
  CreateConnectionMapping,
  UpdateConnectionMapping,
  ConnectionMappingState,
  MappingConfig,
  PartialMappingConfig,
  MappingRequest,
  MappingError,
  MappingMeta,
  MappingResult,
  MappingResponseMetadata,
  MappingPreviewRequest,
  MappingPreviewResponse,
  BulkMappingRequest,
} from './mapping.schemas';

// =============================================================================
// Path Utilities (client-safe)
// =============================================================================

export {
  validatePath,
  parsePath,
  compilePath,
  getValue,
  setValue,
  deleteValue,
  segmentsToPath,
  deepClone,
  isEmpty,
  isNullish,
  getAllPaths,
  getSchemaFieldPaths,
} from './path-utils';

export type { PathSegment, GetValueResult, SetValueResult, SchemaFieldInfo } from './path-utils';

// =============================================================================
// Coercion (client-safe)
// =============================================================================

export { coerceValueForMapping, canCoerce, describeCoercion } from './coercion';

export type { MappingCoercionResult } from './coercion';

// =============================================================================
// Mapper Engine (client-safe - no database access)
// =============================================================================

export {
  applyMappings,
  validateMappings,
  previewMapping,
  describeMappings,
  createBypassedResult,
  mergeMappingResults,
  invalidateCompiledCache,
  clearCompiledCache,
} from './mapper';

export type { MapOptions } from './mapper';
