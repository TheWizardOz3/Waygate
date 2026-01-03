import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateJsonSchema,
  validateActionInput,
  validateActionOutput,
  clearValidatorCache,
  getValidatorCacheSize,
  isValidJsonSchemaStructure,
  isCompilableSchema,
  formatErrorsForLLM,
  formatAsApiError,
  mergeSchemas,
  createEmptySchema,
} from '@/lib/modules/actions/json-schema-validator';
import type { JSONSchema7 } from 'json-schema';

describe('JSON Schema Validator', () => {
  beforeEach(() => {
    clearValidatorCache();
  });

  describe('validateJsonSchema', () => {
    it('should validate valid data against schema', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const result = validateJsonSchema(schema, { name: 'John', age: 30 });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return errors for invalid data', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      const result = validateJsonSchema(schema, { name: 123 });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].field).toBe('name');
    });

    it('should detect missing required fields', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const result = validateJsonSchema(schema, { name: 'John' });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.message.includes('email'))).toBe(true);
    });

    it('should validate enum values', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
        },
        required: ['status'],
      };

      const validResult = validateJsonSchema(schema, { status: 'active' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJsonSchema(schema, { status: 'unknown' });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors![0].message).toContain('one of');
    });

    it('should validate string patterns', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          email: { type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
        },
        required: ['email'],
      };

      const validResult = validateJsonSchema(schema, { email: 'test@example.com' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJsonSchema(schema, { email: 'invalid-email' });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate numeric constraints', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          count: { type: 'number', minimum: 1, maximum: 100 },
        },
        required: ['count'],
      };

      const validResult = validateJsonSchema(schema, { count: 50 });
      expect(validResult.valid).toBe(true);

      const tooSmall = validateJsonSchema(schema, { count: 0 });
      expect(tooSmall.valid).toBe(false);
      expect(tooSmall.errors![0].message).toContain('>=');

      const tooBig = validateJsonSchema(schema, { count: 150 });
      expect(tooBig.valid).toBe(false);
      expect(tooBig.errors![0].message).toContain('<=');
    });

    it('should validate string length constraints', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          code: { type: 'string', minLength: 3, maxLength: 10 },
        },
        required: ['code'],
      };

      const validResult = validateJsonSchema(schema, { code: 'ABC123' });
      expect(validResult.valid).toBe(true);

      const tooShort = validateJsonSchema(schema, { code: 'AB' });
      expect(tooShort.valid).toBe(false);

      const tooLong = validateJsonSchema(schema, { code: 'ABCDEFGHIJK' });
      expect(tooLong.valid).toBe(false);
    });

    it('should validate array constraints', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
        },
        required: ['tags'],
      };

      const validResult = validateJsonSchema(schema, { tags: ['a', 'b'] });
      expect(validResult.valid).toBe(true);

      const emptyArray = validateJsonSchema(schema, { tags: [] });
      expect(emptyArray.valid).toBe(false);

      const tooMany = validateJsonSchema(schema, { tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
      expect(tooMany.valid).toBe(false);
    });

    it('should validate nested objects', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                },
                required: ['city'],
              },
            },
            required: ['name', 'address'],
          },
        },
        required: ['user'],
      };

      const validResult = validateJsonSchema(schema, {
        user: { name: 'John', address: { city: 'NYC' } },
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJsonSchema(schema, {
        user: { name: 'John', address: {} },
      });
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('validation modes', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const invalidData = { name: 123 };

    it('should return invalid in strict mode (default)', () => {
      const result = validateJsonSchema(schema, invalidData);
      expect(result.valid).toBe(false);
    });

    it('should return valid with errors in warn mode', () => {
      const result = validateJsonSchema(schema, invalidData, { mode: 'warn' });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should return valid with errors in lenient mode', () => {
      const result = validateJsonSchema(schema, invalidData, { mode: 'lenient' });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateActionInput', () => {
    it('should validate action input with defaults applied', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['channel', 'text'],
      };

      const result = validateActionInput(schema, { channel: 'C123', text: 'Hello' });
      expect(result.valid).toBe(true);
    });

    it('should fail for missing required fields', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['channel', 'text'],
      };

      const result = validateActionInput(schema, { channel: 'C123' });
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e) => e.message.includes('text'))).toBe(true);
    });
  });

  describe('validateActionOutput', () => {
    it('should validate output in warn mode by default', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          ts: { type: 'string' },
        },
        required: ['ok'],
      };

      // Invalid type but warn mode returns valid
      const result = validateActionOutput(schema, { ok: 'true' });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validator caching', () => {
    it('should cache validators', () => {
      const schema: JSONSchema7 = { type: 'string' };

      expect(getValidatorCacheSize()).toBe(0);

      validateJsonSchema(schema, 'test');
      expect(getValidatorCacheSize()).toBe(1);

      // Same schema should use cache
      validateJsonSchema(schema, 'test2');
      expect(getValidatorCacheSize()).toBe(1);

      // Different schema should create new entry
      validateJsonSchema({ type: 'number' }, 123);
      expect(getValidatorCacheSize()).toBe(2);
    });

    it('should clear cache', () => {
      validateJsonSchema({ type: 'string' }, 'test');
      expect(getValidatorCacheSize()).toBeGreaterThan(0);

      clearValidatorCache();
      expect(getValidatorCacheSize()).toBe(0);
    });
  });

  describe('schema utilities', () => {
    it('should identify valid JSON Schema structures', () => {
      expect(isValidJsonSchemaStructure({ type: 'object' })).toBe(true);
      expect(isValidJsonSchemaStructure({ type: 'string' })).toBe(true);
      expect(isValidJsonSchemaStructure({ $ref: '#/definitions/User' })).toBe(true);
      expect(isValidJsonSchemaStructure({ oneOf: [{ type: 'string' }] })).toBe(true);
      expect(isValidJsonSchemaStructure(null)).toBe(false);
      expect(isValidJsonSchemaStructure({})).toBe(false);
      expect(isValidJsonSchemaStructure({ foo: 'bar' })).toBe(false);
    });

    it('should check if schema is compilable', () => {
      expect(isCompilableSchema({ type: 'string' })).toBe(true);
      expect(isCompilableSchema({ type: 'invalid-type' })).toBe(false);
      expect(isCompilableSchema(null)).toBe(false);
    });

    it('should create empty schema', () => {
      const schema = createEmptySchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toEqual({});
      expect(schema.additionalProperties).toBe(true);
    });

    it('should merge schemas', () => {
      const base: JSONSchema7 = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      };
      const override: JSONSchema7 = {
        type: 'object',
        properties: { age: { type: 'number' } },
        required: ['age'],
      };

      const merged = mergeSchemas(base, override);

      expect(merged.properties).toHaveProperty('name');
      expect(merged.properties).toHaveProperty('age');
      expect(merged.required).toContain('name');
      expect(merged.required).toContain('age');
    });
  });

  describe('error formatting', () => {
    it('should format errors for LLM', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          count: { type: 'number', minimum: 1 },
        },
        required: ['channel', 'count'],
      };

      const result = validateJsonSchema(schema, { count: 0 });
      const formatted = formatErrorsForLLM(result.errors!);

      expect(formatted).toContain('validation error');
      expect(formatted).toContain('channel');
    });

    it('should format as API error', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      };

      const result = validateJsonSchema(schema, {});
      const apiError = formatAsApiError(result);

      expect(apiError.code).toBe('VALIDATION_ERROR');
      expect(apiError.message).toContain('validation failed');
      expect(apiError.suggestedResolution.action).toBe('RETRY_WITH_MODIFIED_INPUT');
      expect(apiError.suggestedResolution.retryable).toBe(true);
    });
  });

  describe('format validation', () => {
    it('should validate email format', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      };

      const validResult = validateJsonSchema(schema, { email: 'test@example.com' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJsonSchema(schema, { email: 'not-an-email' });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate uri format', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
        },
        required: ['url'],
      };

      const validResult = validateJsonSchema(schema, { url: 'https://example.com/path' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJsonSchema(schema, { url: 'not-a-url' });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate date-time format', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['timestamp'],
      };

      const validResult = validateJsonSchema(schema, { timestamp: '2024-01-01T00:00:00Z' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJsonSchema(schema, { timestamp: 'not-a-date' });
      expect(invalidResult.valid).toBe(false);
    });
  });
});
