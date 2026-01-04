/**
 * Type Coercion Utilities
 *
 * Provides type coercion functions for lenient validation mode.
 * Attempts to convert values to expected types when possible.
 */

import type { CoercionConfig } from './validation.schemas';

// =============================================================================
// Coercion Result Type
// =============================================================================

export interface CoercionResult<T = unknown> {
  /** Whether coercion was successful */
  success: boolean;
  /** The coerced value (or original if coercion failed/not needed) */
  value: T;
  /** Whether the value was actually changed */
  coerced: boolean;
  /** Error message if coercion failed */
  error?: string;
}

// =============================================================================
// Individual Coercion Functions
// =============================================================================

/**
 * Attempt to coerce a string to a number
 * Examples: "123" → 123, "45.67" → 45.67, "1e5" → 100000
 */
export function coerceStringToNumber(value: string): CoercionResult<number> {
  // Handle empty string
  if (value.trim() === '') {
    return {
      success: false,
      value: NaN,
      coerced: false,
      error: 'Empty string cannot be converted to number',
    };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return {
      success: false,
      value: NaN,
      coerced: false,
      error: `Cannot convert "${value}" to number`,
    };
  }

  return { success: true, value: num, coerced: true };
}

/**
 * Attempt to coerce a number to a string
 * Examples: 123 → "123", 45.67 → "45.67"
 */
export function coerceNumberToString(value: number): CoercionResult<string> {
  if (typeof value !== 'number' || isNaN(value)) {
    return { success: false, value: '', coerced: false, error: 'Invalid number value' };
  }

  return { success: true, value: String(value), coerced: true };
}

/**
 * Attempt to coerce a string to a boolean
 * Examples: "true" → true, "false" → false, "1" → true, "0" → false
 */
export function coerceStringToBoolean(value: string): CoercionResult<boolean> {
  const lowered = value.toLowerCase().trim();

  // True-ish values
  if (['true', '1', 'yes', 'on'].includes(lowered)) {
    return { success: true, value: true, coerced: true };
  }

  // False-ish values
  if (['false', '0', 'no', 'off'].includes(lowered)) {
    return { success: true, value: false, coerced: true };
  }

  return {
    success: false,
    value: false,
    coerced: false,
    error: `Cannot convert "${value}" to boolean`,
  };
}

/**
 * Check if a string is empty and optionally coerce to null
 */
export function coerceEmptyStringToNull(value: string): CoercionResult<null> {
  if (value === '' || value.trim() === '') {
    return { success: true, value: null, coerced: true };
  }

  return { success: false, value: null, coerced: false, error: 'String is not empty' };
}

// =============================================================================
// Type Detection
// =============================================================================

/**
 * Get the type of a value for error reporting
 */
export function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Get a preview of a value for error messages (truncated if long)
 */
export function getValuePreview(value: unknown, maxLength = 50): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  try {
    const str = JSON.stringify(value);
    if (str.length > maxLength) {
      return str.substring(0, maxLength - 3) + '...';
    }
    return str;
  } catch {
    return String(value);
  }
}

// =============================================================================
// Main Coercion Function
// =============================================================================

/**
 * Attempt to coerce a value to the expected type
 *
 * @param value The value to coerce
 * @param expectedType The expected Zod/JSON Schema type
 * @param config Coercion configuration
 * @returns Coercion result with the (potentially coerced) value
 */
export function coerceValue(
  value: unknown,
  expectedType: string,
  config: CoercionConfig
): CoercionResult {
  const actualType = getValueType(value);

  // No coercion needed if types match
  if (actualType === expectedType) {
    return { success: true, value, coerced: false };
  }

  // Handle null coercion
  if (value === null && config.nullToDefault) {
    // This will be handled at the schema level with defaults
    return { success: true, value: null, coerced: false };
  }

  // String to Number
  if (actualType === 'string' && expectedType === 'number' && config.stringToNumber) {
    return coerceStringToNumber(value as string);
  }

  // Number to String
  if (actualType === 'number' && expectedType === 'string' && config.numberToString) {
    return coerceNumberToString(value as number);
  }

  // String to Boolean
  if (actualType === 'string' && expectedType === 'boolean' && config.stringToBoolean) {
    return coerceStringToBoolean(value as string);
  }

  // Empty String to Null
  if (actualType === 'string' && expectedType === 'null' && config.emptyStringToNull) {
    return coerceEmptyStringToNull(value as string);
  }

  // No coercion available
  return {
    success: false,
    value,
    coerced: false,
    error: `Cannot coerce ${actualType} to ${expectedType}`,
  };
}

// =============================================================================
// Batch Coercion for Objects
// =============================================================================

export interface FieldCoercionResult {
  path: string;
  originalValue: unknown;
  coercedValue: unknown;
  expectedType: string;
  actualType: string;
  success: boolean;
  error?: string;
}

/**
 * Track coerced fields during validation
 */
export class CoercionTracker {
  private coercedFields: FieldCoercionResult[] = [];

  /**
   * Record a coercion attempt
   */
  record(result: FieldCoercionResult): void {
    this.coercedFields.push(result);
  }

  /**
   * Get all coerced fields (successful coercions only)
   */
  getCoercedFields(): FieldCoercionResult[] {
    return this.coercedFields.filter((f) => f.success);
  }

  /**
   * Get failed coercion attempts
   */
  getFailedCoercions(): FieldCoercionResult[] {
    return this.coercedFields.filter((f) => !f.success);
  }

  /**
   * Get total count of successful coercions
   */
  getCoercedCount(): number {
    return this.coercedFields.filter((f) => f.success).length;
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.coercedFields = [];
  }
}

// =============================================================================
// Default Config
// =============================================================================

export const DEFAULT_COERCION_CONFIG: CoercionConfig = {
  stringToNumber: true,
  numberToString: true,
  stringToBoolean: true,
  emptyStringToNull: false,
  nullToDefault: true,
};
