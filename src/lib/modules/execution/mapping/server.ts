/**
 * Field Mapping Module - Server-Only Exports
 *
 * These exports include database access and should only be used in server-side code.
 * For client-safe exports, use the main index.ts
 */

// Re-export all client-safe exports
export * from './index';

// =============================================================================
// Repository (server-only - uses Prisma)
// =============================================================================

export {
  getMappingsForAction,
  listMappings,
  getMappingById,
  createMapping,
  updateMapping,
  deleteMapping,
  bulkUpsertMappings,
  deleteAllMappings,
  getMappingConfig,
  updateMappingConfig,
  invalidateCache,
  clearCache,
} from './mapping.repository';

export type { CachedMappings, ListMappingsOptions } from './mapping.repository';

// =============================================================================
// Service (server-only - uses repository)
// =============================================================================

export {
  MappingService,
  mappingService,
  applyInputMapping,
  applyOutputMapping,
  previewMappingWithSample,
  getMergedConfig,
  shouldSkip,
  getDefaultConfig,
} from './mapping.service';

export type { ApplyMappingOptions, FullMappingResult } from './mapping.service';
