/**
 * Field Mapping Unit Tests
 *
 * Tests for the mapping module including:
 * - Path utilities (JSONPath parsing and evaluation)
 * - Type coercion
 * - Mapper engine
 * - Failure handling (passthrough vs fail modes)
 */

import { describe, it, expect } from 'vitest';
import {
  // Path utilities
  validatePath,
  parsePath,
  getValue,
  setValue,
  deepClone,
  isEmpty,
  isNullish,
  // Coercion
  coerceValueForMapping,
  canCoerce,
  // Mapper
  applyMappings,
  validateMappings,
  previewMapping,
  createBypassedResult,
  // Schemas & types
  FieldMappingSchema,
  MappingConfigSchema,
  TransformConfigSchema,
  DEFAULT_TRANSFORM_CONFIG,
  type FieldMapping,
  type MappingConfig,
} from '@/lib/modules/execution/mapping';

// =============================================================================
// Path Utilities Tests
// =============================================================================

describe('Path Utilities', () => {
  describe('validatePath', () => {
    it('should validate simple root paths', () => {
      expect(validatePath('$.email').valid).toBe(true);
      expect(validatePath('$.user').valid).toBe(true);
    });

    it('should validate nested paths', () => {
      expect(validatePath('$.user.contact.email').valid).toBe(true);
      expect(validatePath('$.data.items[0].name').valid).toBe(true);
    });

    it('should validate array wildcard paths', () => {
      expect(validatePath('$.users[*].email').valid).toBe(true);
      expect(validatePath('$.items[*].product.name').valid).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(validatePath('').valid).toBe(false);
      expect(validatePath('email').valid).toBe(false); // Missing $
    });

    it('should reject paths that are too deep', () => {
      const deepPath = '$.a.b.c.d.e.f.g.h.i.j.k'; // 11 levels
      const result = validatePath(deepPath);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('depth');
      }
    });
  });

  describe('parsePath', () => {
    it('should parse simple paths', () => {
      const segments = parsePath('$.email');
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({ type: 'property', value: 'email' });
    });

    it('should parse nested paths', () => {
      const segments = parsePath('$.user.contact.email');
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({ type: 'property', value: 'user' });
      expect(segments[1]).toEqual({ type: 'property', value: 'contact' });
      expect(segments[2]).toEqual({ type: 'property', value: 'email' });
    });

    it('should parse array index paths', () => {
      const segments = parsePath('$.users[0].email');
      expect(segments).toHaveLength(3);
      expect(segments[1]).toEqual({ type: 'index', value: 0 });
    });

    it('should parse array wildcard paths', () => {
      const segments = parsePath('$.users[*].email');
      expect(segments).toHaveLength(3);
      expect(segments[1].type).toBe('wildcard');
    });
  });

  describe('getValue', () => {
    const testData = {
      email: 'test@example.com',
      user: {
        contact: {
          email: 'nested@example.com',
          phone: null,
        },
      },
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    };

    it('should get root-level values', () => {
      const result = getValue(testData, parsePath('$.email'));
      expect(result.found).toBe(true);
      expect(result.value).toBe('test@example.com');
    });

    it('should get nested values', () => {
      const result = getValue(testData, parsePath('$.user.contact.email'));
      expect(result.found).toBe(true);
      expect(result.value).toBe('nested@example.com');
    });

    it('should get array index values', () => {
      const result = getValue(testData, parsePath('$.items[0].name'));
      expect(result.found).toBe(true);
      expect(result.value).toBe('Item 1');
    });

    it('should get array wildcard values', () => {
      const result = getValue(testData, parsePath('$.items[*].name'));
      expect(result.found).toBe(true);
      expect(result.isArray).toBe(true);
      expect(result.value).toEqual(['Item 1', 'Item 2']);
    });

    it('should return not found for missing paths', () => {
      const result = getValue(testData, parsePath('$.nonexistent'));
      expect(result.found).toBe(false);
    });

    it('should handle null values correctly', () => {
      const result = getValue(testData, parsePath('$.user.contact.phone'));
      expect(result.found).toBe(true);
      expect(result.value).toBe(null);
    });
  });

  describe('setValue', () => {
    it('should set root-level values', () => {
      const data = { existing: 'value' };
      const result = setValue(data, parsePath('$.newField'), 'new value');
      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).newField).toBe('new value');
    });

    it('should set nested values', () => {
      const data = { user: {} };
      const result = setValue(data, parsePath('$.user.email'), 'test@example.com');
      expect(result.success).toBe(true);
      expect((result.data as Record<string, Record<string, unknown>>).user.email).toBe(
        'test@example.com'
      );
    });

    it('should create intermediate objects', () => {
      const data = {};
      const result = setValue(data, parsePath('$.user.contact.email'), 'test@example.com');
      expect(result.success).toBe(true);
      expect(
        (result.data as Record<string, Record<string, Record<string, unknown>>>).user.contact.email
      ).toBe('test@example.com');
    });
  });

  describe('utility functions', () => {
    it('deepClone should create a deep copy', () => {
      const original = { a: { b: { c: 1 } } };
      const cloned = deepClone(original);
      cloned.a.b.c = 2;
      expect(original.a.b.c).toBe(1);
    });

    it('isEmpty should detect empty values', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('  ')).toBe(true); // whitespace
      expect(isEmpty([])).toBe(true);
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      // Note: empty objects are NOT considered empty by this implementation
      expect(isEmpty({})).toBe(false);
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty([1])).toBe(false);
    });

    it('isNullish should detect null/undefined', () => {
      expect(isNullish(null)).toBe(true);
      expect(isNullish(undefined)).toBe(true);
      expect(isNullish('')).toBe(false);
      expect(isNullish(0)).toBe(false);
    });
  });
});

// =============================================================================
// Coercion Tests
// =============================================================================

describe('Type Coercion', () => {
  describe('string to number', () => {
    it('should coerce valid number strings', () => {
      const result = coerceValueForMapping('123', 'number', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(123);
      expect(result.coerced).toBe(true);
    });

    it('should coerce decimal strings', () => {
      const result = coerceValueForMapping('123.45', 'number', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(123.45);
    });

    it('should fail for invalid number strings', () => {
      const result = coerceValueForMapping('abc', 'number', '$.field');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('COERCION_FAILED');
    });
  });

  describe('string to boolean', () => {
    it('should coerce "true" to true', () => {
      const result = coerceValueForMapping('true', 'boolean', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should coerce "false" to false', () => {
      const result = coerceValueForMapping('false', 'boolean', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should coerce "1" to true', () => {
      const result = coerceValueForMapping('1', 'boolean', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should coerce "0" to false', () => {
      const result = coerceValueForMapping('0', 'boolean', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should fail for invalid boolean strings', () => {
      const result = coerceValueForMapping('maybe', 'boolean', '$.field');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('COERCION_FAILED');
    });
  });

  describe('number to string', () => {
    it('should coerce numbers to strings', () => {
      const result = coerceValueForMapping(123, 'string', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe('123');
    });
  });

  describe('number to boolean', () => {
    it('should coerce 0 to false', () => {
      const result = coerceValueForMapping(0, 'boolean', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should coerce non-zero to true', () => {
      const result = coerceValueForMapping(42, 'boolean', '$.field');
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('canCoerce', () => {
    it('should return true for supported coercions', () => {
      expect(canCoerce('123', 'number')).toBe(true);
      expect(canCoerce('true', 'boolean')).toBe(true);
      expect(canCoerce(42, 'string')).toBe(true);
    });

    it('should return true when same type (no coercion needed)', () => {
      expect(canCoerce('hello', 'string')).toBe(true);
      expect(canCoerce(42, 'number')).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(canCoerce(null, 'string')).toBe(false);
      expect(canCoerce(undefined, 'number')).toBe(false);
    });
  });
});

// =============================================================================
// Mapper Engine Tests
// =============================================================================

describe('Mapper Engine', () => {
  describe('applyMappings', () => {
    const defaultConfig: MappingConfig = {
      enabled: true,
      preserveUnmapped: true,
      failureMode: 'passthrough',
    };

    it('should map a simple field', () => {
      const data = { user_email: 'test@example.com' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.user_email',
          targetPath: '$.email',
          direction: 'output',
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect(result.applied).toBe(true);
      expect((result.data as Record<string, unknown>).email).toBe('test@example.com');
    });

    it('should preserve unmapped fields when configured', () => {
      const data = { user_email: 'test@example.com', other: 'value' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.user_email',
          targetPath: '$.email',
          direction: 'output',
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).other).toBe('value');
    });

    it('should not preserve unmapped fields when preserveUnmapped is false', () => {
      const data = { user_email: 'test@example.com', other: 'value' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.user_email',
          targetPath: '$.email',
          direction: 'output',
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: { ...defaultConfig, preserveUnmapped: false },
        mappings,
      });
      expect((result.data as Record<string, unknown>).email).toBe('test@example.com');
      expect((result.data as Record<string, unknown>).other).toBeUndefined();
    });

    it('should map nested fields', () => {
      const data = { data: { user: { email: 'test@example.com' } } };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.data.user.email',
          targetPath: '$.email',
          direction: 'output',
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).email).toBe('test@example.com');
    });

    it('should apply type coercion', () => {
      const data = { count: '123' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.count',
          targetPath: '$.totalCount',
          direction: 'output',
          transformConfig: {
            ...DEFAULT_TRANSFORM_CONFIG,
            coercion: { type: 'number' },
          },
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).totalCount).toBe(123);
      expect(result.meta.fieldsCoerced).toBe(1);
    });

    it('should apply default value when source is missing', () => {
      const data = {};
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.missing',
          targetPath: '$.hasDefault',
          direction: 'output',
          transformConfig: {
            ...DEFAULT_TRANSFORM_CONFIG,
            defaultValue: 'default value',
          },
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).hasDefault).toBe('default value');
      expect(result.meta.fieldsDefaulted).toBe(1);
    });

    it('should omit field when omitIfNull is true and source is null', () => {
      const data = { nullField: null, existingField: 'value' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.nullField',
          targetPath: '$.mapped',
          direction: 'output',
          transformConfig: {
            ...DEFAULT_TRANSFORM_CONFIG,
            omitIfNull: true,
          },
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).mapped).toBeUndefined();
    });

    it('should omit field when omitIfEmpty is true and source is empty string', () => {
      const data = { emptyField: '' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.emptyField',
          targetPath: '$.mapped',
          direction: 'output',
          transformConfig: {
            ...DEFAULT_TRANSFORM_CONFIG,
            omitIfEmpty: true,
          },
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).mapped).toBeUndefined();
    });

    it('should apply multiple mappings', () => {
      const data = {
        user_email: 'test@example.com',
        user_name: 'Test User',
        count: '42',
      };
      const mappings: FieldMapping[] = [
        { sourcePath: '$.user_email', targetPath: '$.email', direction: 'output' },
        { sourcePath: '$.user_name', targetPath: '$.name', direction: 'output' },
        {
          sourcePath: '$.count',
          targetPath: '$.total',
          direction: 'output',
          transformConfig: { ...DEFAULT_TRANSFORM_CONFIG, coercion: { type: 'number' } },
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).email).toBe('test@example.com');
      expect((result.data as Record<string, unknown>).name).toBe('Test User');
      expect((result.data as Record<string, unknown>).total).toBe(42);
    });

    it('should handle array wildcard mappings', () => {
      const data = {
        users: [{ email: 'user1@example.com' }, { email: 'user2@example.com' }],
      };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.users[*].email',
          targetPath: '$.emails',
          direction: 'output',
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: defaultConfig,
        mappings,
      });
      expect((result.data as Record<string, unknown>).emails).toEqual([
        'user1@example.com',
        'user2@example.com',
      ]);
    });
  });

  describe('Failure Handling', () => {
    const passthroughConfig: MappingConfig = {
      enabled: true,
      preserveUnmapped: true,
      failureMode: 'passthrough',
    };

    it('should return original data with error in passthrough mode on coercion failure', () => {
      const data = { value: 'not-a-number' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.value',
          targetPath: '$.number',
          direction: 'output',
          transformConfig: {
            ...DEFAULT_TRANSFORM_CONFIG,
            coercion: { type: 'number' },
          },
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: passthroughConfig,
        mappings,
      });
      // In passthrough mode, mapping continues but original value is kept
      expect(result.applied).toBe(true);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0].code).toBe('COERCION_FAILED');
    });

    it('should return original data when source path not found in passthrough mode', () => {
      const data = { existingField: 'value' };
      const mappings: FieldMapping[] = [
        {
          sourcePath: '$.nonexistent',
          targetPath: '$.mapped',
          direction: 'output',
        },
      ];

      const result = applyMappings(data, {
        direction: 'output',
        config: passthroughConfig,
        mappings,
      });
      // In passthrough mode, mapping attempted but source not found
      // The mapping was "applied" in the sense that it ran, but failed for this field
      expect(result.bypassed).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0].code).toBe('PATH_NOT_FOUND');
      // Original data is preserved in passthrough mode
      expect((result.data as Record<string, unknown>).existingField).toBe('value');
    });
  });

  describe('validateMappings', () => {
    it('should return empty array for correct mappings', () => {
      const mappings: FieldMapping[] = [
        { sourcePath: '$.email', targetPath: '$.userEmail', direction: 'output' },
      ];

      const errors = validateMappings(mappings);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid paths', () => {
      const mappings: FieldMapping[] = [
        { sourcePath: 'invalid', targetPath: '$.email', direction: 'output' },
      ];

      const errors = validateMappings(mappings);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('INVALID_PATH');
    });
  });

  describe('createBypassedResult', () => {
    it('should create a result with bypassed flag', () => {
      const data = { test: 'value' };
      const config: MappingConfig = {
        enabled: true,
        preserveUnmapped: true,
        failureMode: 'passthrough',
      };
      const result = createBypassedResult(data, config);

      expect(result.data).toBe(data);
      expect(result.bypassed).toBe(true);
      expect(result.applied).toBe(false);
    });
  });

  describe('previewMapping', () => {
    it('should preview mapping transformation', () => {
      const data = { user_email: 'test@example.com' };
      const mappings: FieldMapping[] = [
        { sourcePath: '$.user_email', targetPath: '$.email', direction: 'output' },
      ];
      const config: MappingConfig = {
        enabled: true,
        preserveUnmapped: true,
        failureMode: 'passthrough',
      };

      const preview = previewMapping(data, {
        direction: 'output',
        config,
        mappings,
      });
      expect(preview.result.applied).toBe(true);
      expect((preview.transformed as Record<string, unknown>).email).toBe('test@example.com');
    });
  });
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('Schema Validation', () => {
  describe('FieldMappingSchema', () => {
    it('should validate a minimal mapping', () => {
      const mapping = {
        sourcePath: '$.email',
        targetPath: '$.userEmail',
        direction: 'output',
      };

      const result = FieldMappingSchema.safeParse(mapping);
      expect(result.success).toBe(true);
    });

    it('should validate a mapping with transform config', () => {
      const mapping = {
        sourcePath: '$.count',
        targetPath: '$.total',
        direction: 'output',
        transformConfig: {
          coercion: { type: 'number' },
          omitIfNull: true,
        },
      };

      const result = FieldMappingSchema.safeParse(mapping);
      expect(result.success).toBe(true);
    });

    it('should reject empty source path', () => {
      const mapping = {
        sourcePath: '',
        targetPath: '$.email',
        direction: 'output',
      };

      const result = FieldMappingSchema.safeParse(mapping);
      expect(result.success).toBe(false);
    });

    it('should reject invalid direction', () => {
      const mapping = {
        sourcePath: '$.email',
        targetPath: '$.userEmail',
        direction: 'invalid',
      };

      const result = FieldMappingSchema.safeParse(mapping);
      expect(result.success).toBe(false);
    });
  });

  describe('MappingConfigSchema', () => {
    it('should validate a minimal config', () => {
      const config = {
        enabled: true,
      };

      const result = MappingConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      // Check defaults are applied
      if (result.success) {
        expect(result.data.preserveUnmapped).toBe(true);
        expect(result.data.failureMode).toBe('passthrough');
      }
    });

    it('should validate a full config', () => {
      const config = {
        enabled: true,
        preserveUnmapped: false,
        failureMode: 'fail',
      };

      const result = MappingConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('TransformConfigSchema', () => {
    it('should validate coercion config', () => {
      const config = {
        coercion: { type: 'number' },
      };

      const result = TransformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate array mode', () => {
      const config = {
        arrayMode: 'first',
      };

      const result = TransformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid coercion type', () => {
      const config = {
        coercion: { type: 'invalid' },
      };

      const result = TransformConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});
