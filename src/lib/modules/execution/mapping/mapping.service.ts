/**
 * Mapping Service
 *
 * High-level service for field mapping operations.
 * Orchestrates repository, mapper, and caching for action invocations.
 *
 * Supports connection-level mapping overrides:
 * - connectionId = null: Use action-level default mappings
 * - connectionId = uuid: Use resolved mappings (defaults + connection overrides merged)
 */

import {
  getMappingsForAction,
  getMappingConfig,
  updateMappingConfig,
  invalidateCache as invalidateRepoCache,
  invalidateConnectionCache as invalidateRepoConnectionCache,
  getResolvedMappings,
  getMappingsByConnection,
  createConnectionMapping as createConnectionMappingRepo,
  deleteMapping,
  resetConnectionMappings as resetConnectionMappingsRepo,
  copyDefaultsToConnection,
  countConnectionsWithOverrides,
} from './mapping.repository';
import {
  applyMappings,
  validateMappings,
  previewMapping,
  createBypassedResult,
  mergeMappingResults,
  invalidateCompiledCache,
} from './mapper';
import {
  type FieldMapping,
  type MappingConfig,
  type MappingRequest,
  type MappingResult,
  type MappingDirection,
  type PartialMappingConfig,
  type MappingPreviewRequest,
  type MappingPreviewResponse,
  type MappingError,
  type ResolvedMapping,
  type ConnectionMappingState,
  type CreateFieldMapping,
  type FieldMappingWithConnection,
  mergeMappingConfig,
  shouldSkipMapping,
  DEFAULT_MAPPING_CONFIG,
} from './mapping.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for applying mapping to a request
 */
export interface ApplyMappingOptions {
  /** Action ID */
  actionId: string;

  /** Tenant ID (optional for tenant-specific overrides) */
  tenantId?: string;

  /** Connection ID (optional for connection-specific mapping overrides) */
  connectionId?: string | null;

  /** Request-level mapping options */
  requestOptions?: MappingRequest;
}

/**
 * Result of the full mapping operation (input + output)
 */
export interface FullMappingResult {
  /** Input mapping result */
  inputResult: MappingResult;

  /** Whether input mapping was skipped */
  inputSkipped: boolean;

  /** The mapped input data (or original if skipped) */
  mappedInput: unknown;
}

/**
 * Statistics about connection mapping overrides
 */
export interface ConnectionMappingStats {
  /** Number of connection-specific overrides */
  overrideCount: number;

  /** Number of default mappings being used */
  defaultCount: number;

  /** Total resolved mappings */
  totalCount: number;

  /** Whether any overrides exist */
  hasOverrides: boolean;
}

// =============================================================================
// Service Class
// =============================================================================

/**
 * Mapping Service
 *
 * Provides high-level mapping operations for the gateway pipeline.
 */
export class MappingService {
  /**
   * Apply input mappings to request data
   *
   * Called before sending request to external API.
   * Uses resolved mappings when connectionId is provided.
   */
  async applyInputMapping(
    input: unknown,
    options: ApplyMappingOptions
  ): Promise<FullMappingResult> {
    const { actionId, tenantId, connectionId, requestOptions } = options;

    // Get mappings - use resolved mappings if connection context provided
    const { mappings, config: baseConfig } = await this.getMappingsForContext(
      actionId,
      tenantId,
      connectionId,
      'input'
    );

    const config = mergeMappingConfig(baseConfig, requestOptions);

    // Check if mapping should be skipped
    if (shouldSkipMapping(config, mappings)) {
      return {
        inputResult: createBypassedResult(input, config),
        inputSkipped: true,
        mappedInput: input,
      };
    }

    // Apply input mappings
    const inputResult = applyMappings(
      input,
      {
        direction: 'input',
        config,
        mappings,
      },
      actionId
    );

    return {
      inputResult,
      inputSkipped: false,
      mappedInput: inputResult.data,
    };
  }

  /**
   * Apply output mappings to response data
   *
   * Called after receiving response from external API.
   * Uses resolved mappings when connectionId is provided.
   */
  async applyOutputMapping(output: unknown, options: ApplyMappingOptions): Promise<MappingResult> {
    const { actionId, tenantId, connectionId, requestOptions } = options;

    // Get mappings - use resolved mappings if connection context provided
    const { mappings, config: baseConfig } = await this.getMappingsForContext(
      actionId,
      tenantId,
      connectionId,
      'output'
    );

    const config = mergeMappingConfig(baseConfig, requestOptions);

    // Check if mapping should be skipped
    if (shouldSkipMapping(config, mappings)) {
      return createBypassedResult(output, config);
    }

    // Apply output mappings
    return applyMappings(
      output,
      {
        direction: 'output',
        config,
        mappings,
      },
      actionId
    );
  }

  /**
   * Get mappings for a given context (with optional connection resolution)
   * @private
   */
  private async getMappingsForContext(
    actionId: string,
    tenantId: string | undefined,
    connectionId: string | null | undefined,
    direction: MappingDirection
  ): Promise<{ mappings: FieldMapping[]; config: MappingConfig }> {
    // If connection context provided, use resolved mappings
    if (connectionId) {
      const { resolvedMappings, config } = await getResolvedMappings(actionId, connectionId);
      const mappings = resolvedMappings
        .filter((rm) => rm.mapping.direction === direction)
        .map((rm) => rm.mapping);
      return { mappings, config };
    }

    // Otherwise use default action-level mappings
    const cached = await getMappingsForAction(actionId, tenantId);
    const mappings = direction === 'input' ? cached.inputMappings : cached.outputMappings;
    return { mappings, config: cached.config };
  }

  /**
   * Apply both input and output mappings (for full pipeline)
   *
   * Returns a combined result with both mapping operations.
   */
  async applyFullMapping(
    input: unknown,
    output: unknown,
    options: ApplyMappingOptions
  ): Promise<{
    inputResult: FullMappingResult;
    outputResult: MappingResult;
    combinedResult: MappingResult;
  }> {
    // Apply input mapping
    const inputResult = await this.applyInputMapping(input, options);

    // Apply output mapping
    const outputResult = await this.applyOutputMapping(output, options);

    // Combine results for metadata
    const combinedResult = mergeMappingResults(inputResult.inputResult, outputResult);

    return {
      inputResult,
      outputResult,
      combinedResult,
    };
  }

  /**
   * Get mapping configuration for an action
   */
  async getConfig(actionId: string): Promise<MappingConfig> {
    return getMappingConfig(actionId);
  }

  /**
   * Update mapping configuration for an action
   */
  async updateConfig(actionId: string, config: PartialMappingConfig): Promise<MappingConfig> {
    // Invalidate compiled cache when config changes
    invalidateCompiledCache(actionId);
    return updateMappingConfig(actionId, config);
  }

  /**
   * Get all mappings for an action
   */
  async getMappings(
    actionId: string,
    tenantId?: string,
    direction?: MappingDirection
  ): Promise<FieldMapping[]> {
    const cached = await getMappingsForAction(actionId, tenantId);

    if (direction === 'input') {
      return cached.inputMappings;
    } else if (direction === 'output') {
      return cached.outputMappings;
    }

    return [...cached.inputMappings, ...cached.outputMappings];
  }

  /**
   * Preview mapping with sample data
   */
  async preview(
    actionId: string,
    request: MappingPreviewRequest,
    tenantId?: string
  ): Promise<MappingPreviewResponse> {
    const { sampleData, direction, mappings: customMappings } = request;

    // Load config and mappings
    const cached = await getMappingsForAction(actionId, tenantId);
    const config = cached.config;

    // Use custom mappings if provided, otherwise use stored mappings
    const mappingsToUse =
      customMappings ?? (direction === 'input' ? cached.inputMappings : cached.outputMappings);

    // Preview the mapping
    const { original, transformed, result } = previewMapping(sampleData, {
      direction,
      config,
      mappings: mappingsToUse,
    });

    return {
      original,
      transformed,
      result,
    };
  }

  /**
   * Validate mappings before saving
   */
  validateMappings(mappings: FieldMapping[]): MappingError[] {
    return validateMappings(mappings);
  }

  /**
   * Invalidate all caches for an action
   * (called when mappings are modified)
   */
  invalidateCaches(actionId: string): void {
    invalidateRepoCache(actionId);
    invalidateCompiledCache(`${actionId}:input`);
    invalidateCompiledCache(`${actionId}:output`);
  }

  /**
   * Invalidate caches for a specific connection
   */
  invalidateConnectionCaches(actionId: string, connectionId: string): void {
    invalidateRepoConnectionCache(actionId, connectionId);
    invalidateCompiledCache(`${actionId}:${connectionId}:input`);
    invalidateCompiledCache(`${actionId}:${connectionId}:output`);
  }

  /**
   * Check if mapping is enabled for an action
   */
  async isEnabled(actionId: string): Promise<boolean> {
    const config = await getMappingConfig(actionId);
    return config.enabled;
  }

  /**
   * Check if action has any mappings configured
   */
  async hasMappings(actionId: string, tenantId?: string): Promise<boolean> {
    const cached = await getMappingsForAction(actionId, tenantId);
    return cached.inputMappings.length > 0 || cached.outputMappings.length > 0;
  }

  /**
   * Get mapping statistics for an action
   */
  async getStats(
    actionId: string,
    tenantId?: string
  ): Promise<{
    enabled: boolean;
    inputMappingCount: number;
    outputMappingCount: number;
    failureMode: MappingConfig['failureMode'];
    preserveUnmapped: boolean;
  }> {
    const cached = await getMappingsForAction(actionId, tenantId);

    return {
      enabled: cached.config.enabled,
      inputMappingCount: cached.inputMappings.length,
      outputMappingCount: cached.outputMappings.length,
      failureMode: cached.config.failureMode,
      preserveUnmapped: cached.config.preserveUnmapped,
    };
  }

  // ===========================================================================
  // Connection-Level Mapping Methods
  // ===========================================================================

  /**
   * Resolve mappings for a connection
   *
   * Returns merged defaults + connection overrides with inheritance info.
   * Connection overrides take precedence over action defaults.
   */
  async resolveMappings(
    actionId: string,
    connectionId: string | null
  ): Promise<{ resolvedMappings: ResolvedMapping[]; config: MappingConfig }> {
    return getResolvedMappings(actionId, connectionId);
  }

  /**
   * Get full connection mapping state with inheritance information
   *
   * Returns all mappings with source (default vs connection) and override status.
   */
  async getConnectionMappingState(
    actionId: string,
    connectionId: string
  ): Promise<ConnectionMappingState> {
    const { resolvedMappings, config } = await getResolvedMappings(actionId, connectionId);

    const defaultsCount = resolvedMappings.filter((rm) => rm.source === 'default').length;
    const overridesCount = resolvedMappings.filter((rm) => rm.source === 'connection').length;

    return {
      actionId,
      connectionId,
      mappings: resolvedMappings,
      config,
      defaultsCount,
      overridesCount,
    };
  }

  /**
   * Create a connection-specific mapping override
   *
   * Creates a new mapping for a connection that overrides the action default.
   */
  async createConnectionOverride(
    actionId: string,
    connectionId: string,
    mapping: CreateFieldMapping,
    tenantId?: string
  ): Promise<FieldMappingWithConnection> {
    // Validate mapping first
    const errors = validateMappings([{ ...mapping, id: 'temp' }]);
    if (errors.length > 0) {
      throw new Error(`Invalid mapping: ${errors.map((e) => e.message).join(', ')}`);
    }

    const created = await createConnectionMappingRepo(actionId, connectionId, mapping, tenantId);

    // Invalidate caches
    this.invalidateConnectionCaches(actionId, connectionId);

    return created;
  }

  /**
   * Delete a connection-specific mapping override
   *
   * Reverts to using the action-level default for this mapping.
   */
  async deleteConnectionOverride(
    mappingId: string,
    actionId: string,
    connectionId: string
  ): Promise<boolean> {
    const deleted = await deleteMapping(mappingId);

    if (deleted) {
      // Invalidate caches
      this.invalidateConnectionCaches(actionId, connectionId);
    }

    return deleted;
  }

  /**
   * Reset all connection mappings to defaults
   *
   * Deletes all connection-specific overrides for an action.
   */
  async resetConnectionMappings(actionId: string, connectionId: string): Promise<number> {
    const count = await resetConnectionMappingsRepo(actionId, connectionId);

    // Invalidate caches
    this.invalidateConnectionCaches(actionId, connectionId);

    return count;
  }

  /**
   * Copy action default mappings to a connection as starting point
   *
   * Useful when user wants to customize but start from defaults.
   */
  async copyMappingsToConnection(
    actionId: string,
    connectionId: string,
    tenantId?: string
  ): Promise<FieldMappingWithConnection[]> {
    const copied = await copyDefaultsToConnection(actionId, connectionId, tenantId);

    // Invalidate caches
    this.invalidateConnectionCaches(actionId, connectionId);

    return copied;
  }

  /**
   * Get connection mapping statistics
   */
  async getConnectionMappingStats(
    actionId: string,
    connectionId: string
  ): Promise<ConnectionMappingStats> {
    const { resolvedMappings } = await getResolvedMappings(actionId, connectionId);

    const defaultCount = resolvedMappings.filter((rm) => rm.source === 'default').length;
    const overrideCount = resolvedMappings.filter((rm) => rm.source === 'connection').length;

    return {
      overrideCount,
      defaultCount,
      totalCount: resolvedMappings.length,
      hasOverrides: overrideCount > 0,
    };
  }

  /**
   * Get list of connection-specific overrides only (not merged with defaults)
   */
  async getConnectionOverrides(
    actionId: string,
    connectionId: string
  ): Promise<FieldMappingWithConnection[]> {
    return getMappingsByConnection(actionId, connectionId);
  }

  /**
   * Count how many connections have custom overrides for an action
   *
   * Useful for UI indicator on action mapping panel.
   */
  async countConnectionsWithOverrides(actionId: string): Promise<number> {
    return countConnectionsWithOverrides(actionId);
  }

  /**
   * Preview mapping with connection context
   */
  async previewWithConnection(
    actionId: string,
    connectionId: string,
    request: MappingPreviewRequest
  ): Promise<MappingPreviewResponse> {
    const { sampleData, direction, mappings: customMappings } = request;

    // Get resolved mappings for connection
    const { resolvedMappings, config } = await getResolvedMappings(actionId, connectionId);

    // Use custom mappings if provided, otherwise use resolved mappings
    let mappingsToUse: FieldMapping[];
    if (customMappings) {
      mappingsToUse = customMappings;
    } else {
      mappingsToUse = resolvedMappings
        .filter((rm) => rm.mapping.direction === direction)
        .map((rm) => rm.mapping);
    }

    // Preview the mapping
    const { original, transformed, result } = previewMapping(sampleData, {
      direction,
      config,
      mappings: mappingsToUse,
    });

    return {
      original,
      transformed,
      result,
    };
  }
}

// =============================================================================
// Default Instance & Convenience Functions
// =============================================================================

/**
 * Default mapping service instance
 */
export const mappingService = new MappingService();

/**
 * Apply input mapping to request data
 */
export async function applyInputMapping(
  input: unknown,
  options: ApplyMappingOptions
): Promise<FullMappingResult> {
  return mappingService.applyInputMapping(input, options);
}

/**
 * Apply output mapping to response data
 */
export async function applyOutputMapping(
  output: unknown,
  options: ApplyMappingOptions
): Promise<MappingResult> {
  return mappingService.applyOutputMapping(output, options);
}

/**
 * Preview mapping with sample data
 */
export async function previewMappingWithSample(
  actionId: string,
  request: MappingPreviewRequest,
  tenantId?: string
): Promise<MappingPreviewResponse> {
  return mappingService.preview(actionId, request, tenantId);
}

/**
 * Get mapping config with request options merged
 */
export function getMergedConfig(
  config: MappingConfig | null | undefined,
  requestOptions: MappingRequest | null | undefined
): MappingConfig & { bypass: boolean } {
  return mergeMappingConfig(config, requestOptions);
}

/**
 * Check if mapping should be skipped
 */
export function shouldSkip(
  config: MappingConfig & { bypass: boolean },
  mappings: FieldMapping[]
): boolean {
  return shouldSkipMapping(config, mappings);
}

/**
 * Get default mapping config
 */
export function getDefaultConfig(): MappingConfig {
  return { ...DEFAULT_MAPPING_CONFIG };
}

// =============================================================================
// Connection-Level Convenience Functions
// =============================================================================

/**
 * Resolve mappings for a connection (defaults + overrides merged)
 */
export async function resolveMappingsForConnection(
  actionId: string,
  connectionId: string | null
): Promise<{ resolvedMappings: ResolvedMapping[]; config: MappingConfig }> {
  return mappingService.resolveMappings(actionId, connectionId);
}

/**
 * Get full connection mapping state with inheritance info
 */
export async function getConnectionMappingState(
  actionId: string,
  connectionId: string
): Promise<ConnectionMappingState> {
  return mappingService.getConnectionMappingState(actionId, connectionId);
}

/**
 * Create a connection-specific mapping override
 */
export async function createConnectionOverride(
  actionId: string,
  connectionId: string,
  mapping: CreateFieldMapping,
  tenantId?: string
): Promise<FieldMappingWithConnection> {
  return mappingService.createConnectionOverride(actionId, connectionId, mapping, tenantId);
}

/**
 * Delete a connection-specific mapping override
 */
export async function deleteConnectionOverride(
  mappingId: string,
  actionId: string,
  connectionId: string
): Promise<boolean> {
  return mappingService.deleteConnectionOverride(mappingId, actionId, connectionId);
}

/**
 * Reset all connection mappings to defaults
 */
export async function resetConnectionMappings(
  actionId: string,
  connectionId: string
): Promise<number> {
  return mappingService.resetConnectionMappings(actionId, connectionId);
}

/**
 * Copy action default mappings to a connection
 */
export async function copyMappingsToConnection(
  actionId: string,
  connectionId: string,
  tenantId?: string
): Promise<FieldMappingWithConnection[]> {
  return mappingService.copyMappingsToConnection(actionId, connectionId, tenantId);
}

/**
 * Get connection mapping statistics
 */
export async function getConnectionMappingStats(
  actionId: string,
  connectionId: string
): Promise<ConnectionMappingStats> {
  return mappingService.getConnectionMappingStats(actionId, connectionId);
}

/**
 * Preview mapping with connection context
 */
export async function previewWithConnection(
  actionId: string,
  connectionId: string,
  request: MappingPreviewRequest
): Promise<MappingPreviewResponse> {
  return mappingService.previewWithConnection(actionId, connectionId, request);
}
