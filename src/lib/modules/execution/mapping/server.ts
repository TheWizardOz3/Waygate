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
  // Core CRUD
  getMappingsForAction,
  listMappings,
  listMappingsWithConnection,
  getMappingById,
  createMapping,
  updateMapping,
  deleteMapping,
  bulkUpsertMappings,
  deleteAllMappings,
  // Connection-specific operations
  getMappingsByConnection,
  getResolvedMappings,
  createConnectionMapping,
  resetConnectionMappings,
  copyDefaultsToConnection,
  countConnectionsWithOverrides,
  // Config
  getMappingConfig,
  updateMappingConfig,
  // Cache management
  invalidateCache,
  invalidateConnectionCache,
  clearCache,
} from './mapping.repository';

export type {
  CachedMappings,
  CachedResolvedMappings,
  ListMappingsOptions,
} from './mapping.repository';

// =============================================================================
// Service (server-only - uses repository)
// =============================================================================

export {
  MappingService,
  mappingService,
  // Core mapping functions
  applyInputMapping,
  applyOutputMapping,
  previewMappingWithSample,
  getMergedConfig,
  shouldSkip,
  getDefaultConfig,
  // Connection-level mapping functions (service layer)
  resolveMappingsForConnection,
  getConnectionMappingState,
  createConnectionOverride,
  deleteConnectionOverride,
  resetConnectionMappings as resetConnectionMappingsService,
  copyMappingsToConnection as copyMappingsToConnectionService,
  getConnectionMappingStats,
  previewWithConnection,
} from './mapping.service';

export type {
  ApplyMappingOptions,
  FullMappingResult,
  ConnectionMappingStats,
} from './mapping.service';
