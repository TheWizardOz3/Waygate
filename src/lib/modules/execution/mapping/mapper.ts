/**
 * Mapping Engine
 *
 * Core field mapping engine that transforms data between Waygate and consuming apps.
 * Supports JSONPath-based field extraction and setting, type coercion,
 * and fail-open passthrough mode for reliability.
 */

import {
  type FieldMapping,
  type MappingConfig,
  type MappingResult,
  type MappingError,
  type MappingMeta,
  type MappingDirection,
  createEmptyMappingMeta,
  DEFAULT_TRANSFORM_CONFIG,
} from './mapping.schemas';
import {
  getValue,
  setValue,
  validatePath,
  deepClone,
  isEmpty,
  isNullish,
  type PathSegment,
  compilePath,
} from './path-utils';
import { coerceValueForMapping } from './coercion';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the mapping operation
 */
export interface MapOptions {
  /** Direction of mapping (input or output) */
  direction: MappingDirection;

  /** Mapping configuration */
  config: MappingConfig;

  /** Field mappings to apply */
  mappings: FieldMapping[];
}

/**
 * Compiled mapping with pre-parsed paths for performance
 */
interface CompiledMapping {
  original: FieldMapping;
  sourceSegments: PathSegment[];
  targetSegments: PathSegment[];
}

// =============================================================================
// Mapping Cache (for compiled paths)
// =============================================================================

/** Cache for compiled mappings */
const compiledMappingsCache = new Map<string, CompiledMapping[]>();

/**
 * Get or compile mappings for an action
 */
function getCompiledMappings(
  mappings: FieldMapping[],
  cacheKey?: string
): { compiled: CompiledMapping[]; errors: MappingError[] } {
  // Try cache if key provided
  if (cacheKey) {
    const cached = compiledMappingsCache.get(cacheKey);
    if (cached) {
      return { compiled: cached, errors: [] };
    }
  }

  const compiled: CompiledMapping[] = [];
  const errors: MappingError[] = [];

  for (const mapping of mappings) {
    // Compile source path
    const sourceResult = compilePath(mapping.sourcePath);
    if (!sourceResult.success) {
      errors.push({
        path: mapping.sourcePath,
        code: 'INVALID_PATH',
        message: `Invalid source path: ${sourceResult.error}`,
      });
      continue;
    }

    // Compile target path
    const targetResult = compilePath(mapping.targetPath);
    if (!targetResult.success) {
      errors.push({
        path: mapping.targetPath,
        code: 'INVALID_PATH',
        message: `Invalid target path: ${targetResult.error}`,
      });
      continue;
    }

    compiled.push({
      original: mapping,
      sourceSegments: sourceResult.segments,
      targetSegments: targetResult.segments,
    });
  }

  // Cache if key provided and no errors
  if (cacheKey && errors.length === 0) {
    compiledMappingsCache.set(cacheKey, compiled);
  }

  return { compiled, errors };
}

/**
 * Invalidate compiled mappings cache
 */
export function invalidateCompiledCache(cacheKey: string): void {
  compiledMappingsCache.delete(cacheKey);
}

/**
 * Clear entire compiled mappings cache
 */
export function clearCompiledCache(): void {
  compiledMappingsCache.clear();
}

// =============================================================================
// Main Mapping Function
// =============================================================================

/**
 * Apply field mappings to data
 *
 * @param data The data to transform
 * @param options Mapping options including direction, config, and mappings
 * @param cacheKey Optional cache key for compiled paths
 * @returns MappingResult with transformed data and metadata
 */
export function applyMappings(
  data: unknown,
  options: MapOptions,
  cacheKey?: string
): MappingResult {
  const startTime = Date.now();
  const { direction, config, mappings } = options;
  const errors: MappingError[] = [];
  const meta: MappingMeta = createEmptyMappingMeta();

  // Filter mappings by direction
  const directionalMappings = mappings.filter((m) => m.direction === direction);

  // If no mappings for this direction, return original data
  if (directionalMappings.length === 0) {
    meta.mappingDurationMs = Date.now() - startTime;
    return {
      applied: false,
      bypassed: false,
      data,
      failureMode: config.failureMode,
      meta,
    };
  }

  // Compile mappings
  const { compiled, errors: compileErrors } = getCompiledMappings(
    directionalMappings,
    cacheKey ? `${cacheKey}:${direction}` : undefined
  );
  errors.push(...compileErrors);

  // If all mappings failed to compile, handle based on failure mode
  if (compiled.length === 0 && errors.length > 0) {
    meta.mappingDurationMs = Date.now() - startTime;
    if (config.failureMode === 'fail') {
      return {
        applied: false,
        bypassed: false,
        data,
        errors,
        failureMode: config.failureMode,
        meta,
      };
    }
    // Passthrough mode
    return {
      applied: false,
      bypassed: false,
      data,
      errors,
      failureMode: config.failureMode,
      meta,
    };
  }

  // Start with original or empty object based on preserveUnmapped
  let result: unknown;
  if (config.preserveUnmapped) {
    result = deepClone(data);
  } else {
    result = Array.isArray(data) ? [] : {};
  }

  // Track paths that were set (for removing source if needed)
  const processedSourcePaths: string[] = [];

  // Apply each mapping
  for (const compiledMapping of compiled) {
    const { original: mapping, sourceSegments, targetSegments } = compiledMapping;
    const transformConfig = mapping.transformConfig ?? DEFAULT_TRANSFORM_CONFIG;

    // Get source value
    const getResult = getValue(data, sourceSegments);

    if (getResult.error) {
      errors.push(getResult.error);
      continue;
    }

    let sourceValue = getResult.value;
    let valueWasDefaulted = false;

    // Handle missing source
    if (!getResult.found || isNullish(sourceValue)) {
      // Apply default value if configured
      if (transformConfig.defaultValue !== undefined) {
        sourceValue = transformConfig.defaultValue;
        valueWasDefaulted = true;
        meta.fieldsDefaulted++;
      } else if (transformConfig.omitIfNull) {
        // Skip this mapping entirely
        continue;
      } else {
        // Path not found, add error
        if (!getResult.found) {
          errors.push({
            path: mapping.sourcePath,
            code: 'PATH_NOT_FOUND',
            message: `Source path not found: ${mapping.sourcePath}`,
          });
        }
        continue;
      }
    }

    // Handle omitIfEmpty
    if (!valueWasDefaulted && transformConfig.omitIfEmpty && isEmpty(sourceValue)) {
      continue;
    }

    // Handle omitIfNull (for found but null values)
    if (!valueWasDefaulted && transformConfig.omitIfNull && isNullish(sourceValue)) {
      continue;
    }

    // Apply type coercion if configured
    if (transformConfig.coercion && sourceValue !== null && sourceValue !== undefined) {
      // Handle array values
      if (getResult.isArray && Array.isArray(sourceValue)) {
        const coercedArray: unknown[] = [];
        let anyCoerced = false;

        for (let i = 0; i < sourceValue.length; i++) {
          const coerceResult = coerceValueForMapping(
            sourceValue[i],
            transformConfig.coercion.type,
            `${mapping.sourcePath}[${i}]`
          );

          if (coerceResult.success) {
            coercedArray.push(coerceResult.value);
            if (coerceResult.coerced) {
              anyCoerced = true;
            }
          } else {
            // In passthrough mode, keep original value
            if (config.failureMode === 'passthrough') {
              coercedArray.push(sourceValue[i]);
              if (coerceResult.error) {
                errors.push(coerceResult.error);
              }
            } else {
              if (coerceResult.error) {
                errors.push(coerceResult.error);
              }
              // In fail mode, we'll handle this after the loop
            }
          }
        }

        sourceValue = coercedArray;
        if (anyCoerced) {
          meta.fieldsCoerced++;
        }
      } else {
        // Single value coercion
        const coerceResult = coerceValueForMapping(
          sourceValue,
          transformConfig.coercion.type,
          mapping.sourcePath
        );

        if (coerceResult.success) {
          sourceValue = coerceResult.value;
          if (coerceResult.coerced) {
            meta.fieldsCoerced++;
          }
        } else {
          // Coercion failed
          if (config.failureMode === 'passthrough') {
            // Keep original value, continue
            if (coerceResult.error) {
              errors.push(coerceResult.error);
            }
          } else {
            // Fail mode
            if (coerceResult.error) {
              errors.push(coerceResult.error);
            }
          }
        }
      }
    }

    // Handle array mode for non-array target paths with array source
    if (getResult.isArray && Array.isArray(sourceValue) && transformConfig.arrayMode) {
      switch (transformConfig.arrayMode) {
        case 'first':
          sourceValue = sourceValue.length > 0 ? sourceValue[0] : undefined;
          break;
        case 'last':
          sourceValue = sourceValue.length > 0 ? sourceValue[sourceValue.length - 1] : undefined;
          break;
        // 'all' keeps the array as-is
      }
    }

    // Set the value at target path
    const setResult = setValue(result, targetSegments, sourceValue);

    if (setResult.success) {
      result = setResult.data;
      meta.fieldsTransformed++;
      processedSourcePaths.push(mapping.sourcePath);
    } else if (setResult.error) {
      errors.push(setResult.error);
    }
  }

  // If not preserving unmapped and we had mappings, remove source paths
  // (this is handled by starting with empty object above)

  // Update direction-specific counter
  if (direction === 'input') {
    meta.inputMappingsApplied = meta.fieldsTransformed;
  } else {
    meta.outputMappingsApplied = meta.fieldsTransformed;
  }

  meta.mappingDurationMs = Date.now() - startTime;

  // Determine if mapping was successful
  const hasErrors = errors.length > 0;
  const applied = meta.fieldsTransformed > 0 || meta.fieldsDefaulted > 0 || meta.fieldsCoerced > 0;

  // In fail mode with errors, return failure
  if (hasErrors && config.failureMode === 'fail') {
    return {
      applied: false,
      bypassed: false,
      data, // Return original data
      errors,
      failureMode: config.failureMode,
      meta,
    };
  }

  return {
    applied,
    bypassed: false,
    data: result,
    errors: hasErrors ? errors : undefined,
    failureMode: config.failureMode,
    meta,
  };
}

// =============================================================================
// Validation Helper
// =============================================================================

/**
 * Validate mappings without applying them
 *
 * @param mappings Mappings to validate
 * @returns Array of validation errors (empty if all valid)
 */
export function validateMappings(mappings: FieldMapping[]): MappingError[] {
  const errors: MappingError[] = [];

  for (const mapping of mappings) {
    // Validate source path
    const sourceValidation = validatePath(mapping.sourcePath);
    if (!sourceValidation.valid) {
      errors.push({
        path: mapping.sourcePath,
        code: 'INVALID_PATH',
        message: `Invalid source path: ${sourceValidation.error}`,
      });
    }

    // Validate target path
    const targetValidation = validatePath(mapping.targetPath);
    if (!targetValidation.valid) {
      errors.push({
        path: mapping.targetPath,
        code: 'INVALID_PATH',
        message: `Invalid target path: ${targetValidation.error}`,
      });
    }
  }

  return errors;
}

// =============================================================================
// Preview Helper
// =============================================================================

/**
 * Preview mapping result with sample data
 *
 * @param data Sample data to transform
 * @param options Mapping options
 * @returns Mapping result with original and transformed data
 */
export function previewMapping(
  data: unknown,
  options: MapOptions
): { original: unknown; transformed: unknown; result: MappingResult } {
  const original = deepClone(data);
  const result = applyMappings(data, options);

  return {
    original,
    transformed: result.data,
    result,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get summary of what mappings will do
 */
export function describeMappings(mappings: FieldMapping[]): string[] {
  return mappings.map((m) => {
    let desc = `${m.sourcePath} → ${m.targetPath}`;
    if (m.transformConfig?.coercion) {
      desc += ` (coerce to ${m.transformConfig.coercion.type})`;
    }
    if (m.transformConfig?.defaultValue !== undefined) {
      desc += ` (default: ${JSON.stringify(m.transformConfig.defaultValue)})`;
    }
    if (m.transformConfig?.omitIfNull) {
      desc += ' (omit if null)';
    }
    if (m.transformConfig?.omitIfEmpty) {
      desc += ' (omit if empty)';
    }
    return desc;
  });
}

/**
 * Create a mapping result for bypassed mapping
 */
export function createBypassedResult(data: unknown, config: MappingConfig): MappingResult {
  return {
    applied: false,
    bypassed: true,
    data,
    failureMode: config.failureMode,
    meta: createEmptyMappingMeta(),
  };
}

/**
 * Merge two mapping results (for combining input and output mapping)
 */
export function mergeMappingResults(
  inputResult: MappingResult,
  outputResult: MappingResult
): MappingResult {
  const errors = [...(inputResult.errors ?? []), ...(outputResult.errors ?? [])];

  return {
    applied: inputResult.applied || outputResult.applied,
    bypassed: inputResult.bypassed && outputResult.bypassed,
    data: outputResult.data, // Use output result's data
    errors: errors.length > 0 ? errors : undefined,
    failureMode: outputResult.failureMode,
    meta: {
      mappingDurationMs: inputResult.meta.mappingDurationMs + outputResult.meta.mappingDurationMs,
      inputMappingsApplied: inputResult.meta.inputMappingsApplied,
      outputMappingsApplied: outputResult.meta.outputMappingsApplied,
      fieldsTransformed: inputResult.meta.fieldsTransformed + outputResult.meta.fieldsTransformed,
      fieldsCoerced: inputResult.meta.fieldsCoerced + outputResult.meta.fieldsCoerced,
      fieldsDefaulted: inputResult.meta.fieldsDefaulted + outputResult.meta.fieldsDefaulted,
    },
  };
}
