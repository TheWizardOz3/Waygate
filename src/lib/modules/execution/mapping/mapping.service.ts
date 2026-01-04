/**
 * Mapping Service
 *
 * High-level service for field mapping operations.
 * Orchestrates repository, mapper, and caching for action invocations.
 */

import {
  getMappingsForAction,
  getMappingConfig,
  updateMappingConfig,
  invalidateCache as invalidateRepoCache,
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
   */
  async applyInputMapping(
    input: unknown,
    options: ApplyMappingOptions
  ): Promise<FullMappingResult> {
    const { actionId, tenantId, requestOptions } = options;

    // Load mappings and config
    const cached = await getMappingsForAction(actionId, tenantId);
    const config = mergeMappingConfig(cached.config, requestOptions);

    // Check if mapping should be skipped
    if (shouldSkipMapping(config, cached.inputMappings)) {
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
        mappings: cached.inputMappings,
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
   */
  async applyOutputMapping(output: unknown, options: ApplyMappingOptions): Promise<MappingResult> {
    const { actionId, tenantId, requestOptions } = options;

    // Load mappings and config
    const cached = await getMappingsForAction(actionId, tenantId);
    const config = mergeMappingConfig(cached.config, requestOptions);

    // Check if mapping should be skipped
    if (shouldSkipMapping(config, cached.outputMappings)) {
      return createBypassedResult(output, config);
    }

    // Apply output mappings
    return applyMappings(
      output,
      {
        direction: 'output',
        config,
        mappings: cached.outputMappings,
      },
      actionId
    );
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
