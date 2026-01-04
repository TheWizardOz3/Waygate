/**
 * Mapping Type Coercion
 *
 * Type coercion utilities specifically for field mapping.
 * Re-exports and wraps the validation coercion utilities with
 * mapping-specific error handling.
 */

import type { CoercionType, MappingError } from './mapping.schemas';
import {
  coerceStringToNumber,
  coerceNumberToString,
  coerceStringToBoolean,
  type CoercionResult,
} from '../validation/coercion';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a mapping coercion operation
 */
export interface MappingCoercionResult {
  /** Whether coercion was successful */
  success: boolean;
  /** The coerced value (or original if failed) */
  value: unknown;
  /** Whether the value was actually changed */
  coerced: boolean;
  /** Error if coercion failed */
  error?: MappingError;
}

// =============================================================================
// Main Coercion Function
// =============================================================================

/**
 * Coerce a value to a target type for field mapping
 *
 * @param value The value to coerce
 * @param targetType The target type to coerce to
 * @param sourcePath The source path (for error reporting)
 * @returns MappingCoercionResult with coerced value or error
 */
export function coerceValueForMapping(
  value: unknown,
  targetType: CoercionType,
  sourcePath: string
): MappingCoercionResult {
  // Null/undefined values can't be coerced
  if (value === null || value === undefined) {
    return {
      success: false,
      value,
      coerced: false,
      error: {
        path: sourcePath,
        code: 'COERCION_FAILED',
        message: `Cannot coerce null/undefined to ${targetType}`,
        originalValue: value,
      },
    };
  }

  const actualType = typeof value;

  // No coercion needed if types already match
  if (actualType === targetType) {
    return { success: true, value, coerced: false };
  }

  // Handle specific coercions
  switch (targetType) {
    case 'string':
      return coerceToString(value, sourcePath);

    case 'number':
      return coerceToNumber(value, sourcePath);

    case 'boolean':
      return coerceToBoolean(value, sourcePath);

    default:
      return {
        success: false,
        value,
        coerced: false,
        error: {
          path: sourcePath,
          code: 'COERCION_FAILED',
          message: `Unknown target type: ${targetType}`,
          originalValue: value,
        },
      };
  }
}

// =============================================================================
// Specific Coercion Functions
// =============================================================================

/**
 * Coerce a value to string
 */
function coerceToString(value: unknown, sourcePath: string): MappingCoercionResult {
  const actualType = typeof value;

  // Number to string
  if (actualType === 'number') {
    const result = coerceNumberToString(value as number);
    return wrapCoercionResult(result, value, sourcePath);
  }

  // Boolean to string
  if (actualType === 'boolean') {
    return {
      success: true,
      value: value ? 'true' : 'false',
      coerced: true,
    };
  }

  // Arrays and objects - stringify
  if (Array.isArray(value) || actualType === 'object') {
    try {
      return {
        success: true,
        value: JSON.stringify(value),
        coerced: true,
      };
    } catch {
      return {
        success: false,
        value,
        coerced: false,
        error: {
          path: sourcePath,
          code: 'COERCION_FAILED',
          message: 'Cannot stringify value',
          originalValue: value,
        },
      };
    }
  }

  // Fallback - use String()
  return {
    success: true,
    value: String(value),
    coerced: true,
  };
}

/**
 * Coerce a value to number
 */
function coerceToNumber(value: unknown, sourcePath: string): MappingCoercionResult {
  const actualType = typeof value;

  // String to number
  if (actualType === 'string') {
    const result = coerceStringToNumber(value as string);
    return wrapCoercionResult(result, value, sourcePath);
  }

  // Boolean to number
  if (actualType === 'boolean') {
    return {
      success: true,
      value: value ? 1 : 0,
      coerced: true,
    };
  }

  // Can't coerce objects/arrays to number
  return {
    success: false,
    value,
    coerced: false,
    error: {
      path: sourcePath,
      code: 'COERCION_FAILED',
      message: `Cannot coerce ${actualType} to number`,
      originalValue: value,
    },
  };
}

/**
 * Coerce a value to boolean
 */
function coerceToBoolean(value: unknown, sourcePath: string): MappingCoercionResult {
  const actualType = typeof value;

  // String to boolean
  if (actualType === 'string') {
    const result = coerceStringToBoolean(value as string);
    return wrapCoercionResult(result, value, sourcePath);
  }

  // Number to boolean
  if (actualType === 'number') {
    return {
      success: true,
      value: value !== 0,
      coerced: true,
    };
  }

  // Can't coerce objects/arrays to boolean
  return {
    success: false,
    value,
    coerced: false,
    error: {
      path: sourcePath,
      code: 'COERCION_FAILED',
      message: `Cannot coerce ${actualType} to boolean`,
      originalValue: value,
    },
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Wrap a validation CoercionResult into a MappingCoercionResult
 */
function wrapCoercionResult(
  result: CoercionResult,
  originalValue: unknown,
  sourcePath: string
): MappingCoercionResult {
  if (result.success) {
    return {
      success: true,
      value: result.value,
      coerced: result.coerced,
    };
  }

  return {
    success: false,
    value: originalValue,
    coerced: false,
    error: {
      path: sourcePath,
      code: 'COERCION_FAILED',
      message: result.error ?? 'Coercion failed',
      originalValue,
    },
  };
}

/**
 * Check if a value can be coerced to a target type
 * (without actually performing the coercion)
 */
export function canCoerce(value: unknown, targetType: CoercionType): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const actualType = typeof value;

  // Same type - no coercion needed
  if (actualType === targetType) {
    return true;
  }

  switch (targetType) {
    case 'string':
      // Almost anything can be coerced to string
      return true;

    case 'number':
      if (actualType === 'string') {
        const num = Number(value);
        return !isNaN(num);
      }
      if (actualType === 'boolean') {
        return true;
      }
      return false;

    case 'boolean':
      if (actualType === 'string') {
        const lowered = (value as string).toLowerCase().trim();
        return ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(lowered);
      }
      if (actualType === 'number') {
        return true;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Get a human-readable description of what coercion will be attempted
 */
export function describeCoercion(value: unknown, targetType: CoercionType): string {
  if (value === null) return `null → ${targetType}`;
  if (value === undefined) return `undefined → ${targetType}`;

  const actualType = typeof value;

  if (actualType === targetType) {
    return `${targetType} (no change)`;
  }

  // Truncate long values
  let valueStr: string;
  if (typeof value === 'string' && value.length > 20) {
    valueStr = `"${value.substring(0, 17)}..."`;
  } else if (typeof value === 'object') {
    valueStr = JSON.stringify(value).substring(0, 20);
  } else {
    valueStr = String(value);
  }

  return `${actualType} ${valueStr} → ${targetType}`;
}
