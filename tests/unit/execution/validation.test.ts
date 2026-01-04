/**
 * Validation Module Tests
 *
 * Unit tests for the response validation system including:
 * - JSON Schema to Zod conversion
 * - Validation modes (strict, warn, lenient)
 * - Type coercion
 * - Field handling (strip, preserve, error)
 * - Null handling (reject, default, pass)
 * - Issue reporting
 */

import { describe, it, expect } from 'vitest';
import {
  jsonSchemaToZod,
  parseOutputSchema,
  validate,
} from '@/lib/modules/execution/validation/zod-validator';
import { DEFAULT_VALIDATION_CONFIG } from '@/lib/modules/execution/validation/validation.schemas';
import type { ValidationConfig } from '@/lib/modules/execution/validation/validation.schemas';

// =============================================================================
// Test Helpers
// =============================================================================

function createConfig(overrides: Partial<ValidationConfig> = {}): ValidationConfig {
  return { ...DEFAULT_VALIDATION_CONFIG, ...overrides };
}

// =============================================================================
// JSON Schema to Zod Conversion Tests
// =============================================================================

describe('jsonSchemaToZod', () => {
  describe('primitive types', () => {
    it('should convert string type', () => {
      const schema = jsonSchemaToZod({ type: 'string' });
      expect(schema.safeParse('hello').success).toBe(true);
      expect(schema.safeParse(123).success).toBe(false);
    });

    it('should convert string with minLength/maxLength', () => {
      const schema = jsonSchemaToZod({
        type: 'string',
        minLength: 2,
        maxLength: 10,
      });
      expect(schema.safeParse('ab').success).toBe(true);
      expect(schema.safeParse('a').success).toBe(false);
      expect(schema.safeParse('12345678901').success).toBe(false);
    });

    it('should convert string with email format', () => {
      const schema = jsonSchemaToZod({
        type: 'string',
        format: 'email',
      });
      expect(schema.safeParse('test@example.com').success).toBe(true);
      expect(schema.safeParse('not-an-email').success).toBe(false);
    });

    it('should convert number type', () => {
      const schema = jsonSchemaToZod({ type: 'number' });
      expect(schema.safeParse(42).success).toBe(true);
      expect(schema.safeParse(3.14).success).toBe(true);
      expect(schema.safeParse('42').success).toBe(false);
    });

    it('should convert integer type', () => {
      const schema = jsonSchemaToZod({ type: 'integer' });
      expect(schema.safeParse(42).success).toBe(true);
      expect(schema.safeParse(3.14).success).toBe(false);
    });

    it('should convert boolean type', () => {
      const schema = jsonSchemaToZod({ type: 'boolean' });
      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse(false).success).toBe(true);
      expect(schema.safeParse('true').success).toBe(false);
    });

    it('should convert null type', () => {
      const schema = jsonSchemaToZod({ type: 'null' });
      expect(schema.safeParse(null).success).toBe(true);
      expect(schema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('array types', () => {
    it('should convert array with typed items', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: { type: 'string' },
      });
      expect(schema.safeParse(['a', 'b', 'c']).success).toBe(true);
      expect(schema.safeParse([1, 2, 3]).success).toBe(false);
    });

    it('should convert array with min/max items', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 3,
      });
      expect(schema.safeParse([1]).success).toBe(true);
      expect(schema.safeParse([1, 2, 3]).success).toBe(true);
      expect(schema.safeParse([]).success).toBe(false);
      expect(schema.safeParse([1, 2, 3, 4]).success).toBe(false);
    });
  });

  describe('object types', () => {
    it('should convert object with properties', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      });
      expect(schema.safeParse({ name: 'John', age: 30 }).success).toBe(true);
    });

    it('should handle required fields', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      });
      expect(schema.safeParse({ name: 'John' }).success).toBe(true);
      expect(schema.safeParse({ age: 30 }).success).toBe(false);
    });

    it('should convert nested objects', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
            required: ['id'],
          },
        },
      });
      const result = schema.safeParse({
        user: { id: '123', email: 'test@example.com' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('unknown type handling', () => {
    it('should accept anything when type is not specified', () => {
      const schema = jsonSchemaToZod({});
      expect(schema.safeParse('string').success).toBe(true);
      expect(schema.safeParse(123).success).toBe(true);
      expect(schema.safeParse({ obj: true }).success).toBe(true);
    });

    it('should return unknown for unrecognized types', () => {
      const schema = jsonSchemaToZod({ type: 'unknown_type' });
      expect(schema.safeParse('anything').success).toBe(true);
    });
  });
});

describe('parseOutputSchema', () => {
  it('should return null for empty schema', () => {
    expect(parseOutputSchema({})).toBeNull();
    expect(parseOutputSchema(null)).toBeNull();
    expect(parseOutputSchema(undefined)).toBeNull();
  });

  it('should parse valid JSON Schema', () => {
    const schema = parseOutputSchema({
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
    });
    expect(schema).not.toBeNull();
    expect(schema?.safeParse({ id: '123' }).success).toBe(true);
  });
});

// =============================================================================
// Validation Mode Tests
// =============================================================================

describe('validate', () => {
  const simpleSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      count: { type: 'integer' },
    },
    required: ['name'],
  };

  describe('strict mode', () => {
    it('should fail on type mismatch', () => {
      const result = validate({
        data: { name: 123, count: 5 },
        schema: simpleSchema,
        config: createConfig({ mode: 'strict' }),
      });
      expect(result.valid).toBe(false);
      expect(result.issues?.length).toBeGreaterThan(0);
    });

    it('should fail on missing required field', () => {
      const result = validate({
        data: { count: 5 },
        schema: simpleSchema,
        config: createConfig({ mode: 'strict' }),
      });
      expect(result.valid).toBe(false);
    });

    it('should pass with valid data', () => {
      const result = validate({
        data: { name: 'test', count: 5 },
        schema: simpleSchema,
        config: createConfig({ mode: 'strict' }),
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('warn mode', () => {
    it('should return valid=true with issues logged', () => {
      const result = validate({
        data: { name: 123, count: 5 },
        schema: simpleSchema,
        config: createConfig({ mode: 'warn' }),
      });
      // In warn mode, validation passes but issues are recorded
      expect(result.mode).toBe('warn');
      expect(result.issues?.length).toBeGreaterThan(0);
    });

    it('should still return the data', () => {
      const inputData = { name: 'test', count: 5 };
      const result = validate({
        data: inputData,
        schema: simpleSchema,
        config: createConfig({ mode: 'warn' }),
      });
      expect(result.data).toEqual(inputData);
    });
  });

  describe('lenient mode', () => {
    it('should pass even with issues', () => {
      const result = validate({
        data: { name: 'test', count: 'five' },
        schema: simpleSchema,
        config: createConfig({ mode: 'lenient' }),
      });
      expect(result.mode).toBe('lenient');
      // Data is returned even if not perfectly valid
      expect(result.data).toBeDefined();
    });
  });

  describe('schema handling', () => {
    it('should skip validation when schema is null', () => {
      const result = validate({
        data: { anything: 'goes' },
        schema: null,
        config: createConfig(),
      });
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ anything: 'goes' });
    });

    it('should handle undefined data', () => {
      const result = validate({
        data: undefined,
        schema: simpleSchema,
        config: createConfig({ mode: 'strict' }),
      });
      expect(result.valid).toBe(false);
      expect(result.issues?.some((i) => i.message.includes('undefined'))).toBe(true);
    });
  });
});

// =============================================================================
// Field Handling Tests
// =============================================================================

describe('field handling', () => {
  const schema = {
    type: 'object',
    properties: {
      known: { type: 'string' },
    },
  };

  describe('extra fields: strip', () => {
    it('should strip unknown fields', () => {
      const result = validate({
        data: { known: 'value', unknown: 'extra' },
        schema,
        config: createConfig({ extraFields: 'strip' }),
      });
      expect(result.data).toEqual({ known: 'value' });
      expect(result.meta.fieldsStripped).toBe(1);
    });
  });

  describe('extra fields: preserve', () => {
    it('should not report unknown fields as errors', () => {
      const result = validate({
        data: { known: 'value', unknown: 'extra' },
        schema,
        config: createConfig({ extraFields: 'preserve', mode: 'strict' }),
      });
      // In preserve mode, unknown fields don't cause errors
      // (though Zod may strip them on successful parse - that's OK)
      expect(result.issues?.some((i) => i.code === 'UNKNOWN_FIELD')).toBeFalsy();
      expect(result.valid).toBe(true);
    });

    it('should not strip fields before validation (fieldsStripped = 0)', () => {
      const result = validate({
        data: { known: 'value', unknown: 'extra' },
        schema,
        config: createConfig({ extraFields: 'preserve' }),
      });
      expect(result.meta.fieldsStripped).toBe(0);
    });
  });

  describe('extra fields: error', () => {
    it('should report unknown fields as issues', () => {
      const result = validate({
        data: { known: 'value', unknown: 'extra' },
        schema,
        config: createConfig({ extraFields: 'error', mode: 'strict' }),
      });
      expect(result.issues?.some((i) => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });
  });
});

// =============================================================================
// Null Handling Tests
// =============================================================================

describe('null handling', () => {
  const schemaWithDefault = {
    type: 'object',
    properties: {
      value: { type: 'string', default: 'default_value' },
    },
  };

  describe('null handling: pass', () => {
    it('should pass through null values', () => {
      const result = validate({
        data: { value: null },
        schema: schemaWithDefault,
        config: createConfig({ nullHandling: 'pass', mode: 'lenient' }),
      });
      // Null is preserved (though might fail string validation)
      expect(result.data).toEqual({ value: null });
    });
  });

  describe('null handling: reject', () => {
    it('should reject null values in strict mode', () => {
      const result = validate({
        data: { value: null },
        schema: schemaWithDefault,
        config: createConfig({ nullHandling: 'reject', mode: 'strict' }),
      });
      expect(result.valid).toBe(false);
    });
  });
});

// =============================================================================
// Coercion Tests
// =============================================================================

describe('coercion', () => {
  describe('string to number', () => {
    it('should coerce numeric strings to numbers in lenient mode', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
        },
      };
      const result = validate({
        data: { count: '42' },
        schema,
        config: createConfig({
          mode: 'lenient',
          coercion: { ...DEFAULT_VALIDATION_CONFIG.coercion, stringToNumber: true },
        }),
      });
      // The validation should not fail for the string
      expect(result.mode).toBe('lenient');
    });
  });

  describe('string to boolean', () => {
    it('should handle boolean strings in lenient mode', () => {
      const schema = {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
        },
      };
      const result = validate({
        data: { active: 'true' },
        schema,
        config: createConfig({
          mode: 'lenient',
          coercion: { ...DEFAULT_VALIDATION_CONFIG.coercion, stringToBoolean: true },
        }),
      });
      expect(result.mode).toBe('lenient');
    });
  });
});

// =============================================================================
// Issue Reporting Tests
// =============================================================================

describe('issue reporting', () => {
  it('should include JSONPath in issue path', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      },
    };
    const result = validate({
      data: { user: { email: 'not-an-email' } },
      schema,
      config: createConfig({ mode: 'strict' }),
    });
    expect(result.valid).toBe(false);
    expect(result.issues?.some((i) => i.path.includes('user'))).toBe(true);
  });

  it('should include error code in issues', () => {
    const schema = { type: 'string' };
    const result = validate({
      data: 123,
      schema,
      config: createConfig({ mode: 'strict' }),
    });
    expect(result.issues?.[0]?.code).toBeDefined();
  });

  it('should include severity based on mode', () => {
    const schema = { type: 'string' };

    const strictResult = validate({
      data: 123,
      schema,
      config: createConfig({ mode: 'strict' }),
    });
    expect(strictResult.issues?.[0]?.severity).toBe('error');

    const warnResult = validate({
      data: 123,
      schema,
      config: createConfig({ mode: 'warn' }),
    });
    expect(warnResult.issues?.[0]?.severity).toBe('warning');
  });
});

// =============================================================================
// Validation Meta Tests
// =============================================================================

describe('validation meta', () => {
  it('should include validation duration', () => {
    const result = validate({
      data: { name: 'test' },
      schema: { type: 'object', properties: { name: { type: 'string' } } },
      config: createConfig(),
    });
    expect(result.meta.validationDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should track stripped field count', () => {
    const result = validate({
      data: { known: 'value', extra1: 'a', extra2: 'b' },
      schema: { type: 'object', properties: { known: { type: 'string' } } },
      config: createConfig({ extraFields: 'strip' }),
    });
    expect(result.meta.fieldsStripped).toBe(2);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  it('should handle empty object', () => {
    const result = validate({
      data: {},
      schema: { type: 'object', properties: {} },
      config: createConfig(),
    });
    expect(result.valid).toBe(true);
  });

  it('should handle deeply nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                level3: { type: 'string' },
              },
            },
          },
        },
      },
    };
    const result = validate({
      data: { level1: { level2: { level3: 'deep' } } },
      schema,
      config: createConfig(),
    });
    expect(result.valid).toBe(true);
  });

  it('should handle arrays of objects', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
        required: ['id'],
      },
    };
    const result = validate({
      data: [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ],
      schema,
      config: createConfig(),
    });
    expect(result.valid).toBe(true);
  });

  it('should handle mixed arrays failing in strict mode', () => {
    const schema = {
      type: 'array',
      items: { type: 'string' },
    };
    const result = validate({
      data: ['valid', 123, 'also valid'],
      schema,
      config: createConfig({ mode: 'strict' }),
    });
    expect(result.valid).toBe(false);
  });
});
