/**
 * Connection Mapping Resolution Logic Tests
 *
 * Tests for the per-app custom mapping resolution logic.
 * These tests focus on the pure resolution logic without database mocking.
 */

import { describe, it, expect } from 'vitest';
import type { ResolvedMapping, FieldMapping, MappingSource } from '@/lib/modules/execution/mapping';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock field mapping
 */
function createMapping(overrides: Partial<FieldMapping> = {}): FieldMapping {
  return {
    id: 'test-mapping-id',
    sourcePath: '$.data.field',
    targetPath: '$.field',
    direction: 'output',
    transformConfig: {
      omitIfNull: false,
      omitIfEmpty: false,
      arrayMode: 'all',
    },
    ...overrides,
  };
}

/**
 * Simulates the mapping resolution merge logic
 * This is a simplified version of what the repository does
 */
function resolveMappings(defaults: FieldMapping[], overrides: FieldMapping[]): ResolvedMapping[] {
  const resolved: ResolvedMapping[] = [];

  // Create a lookup key for matching
  const getKey = (m: FieldMapping) => `${m.sourcePath}:${m.direction}`;

  // Create a map of overrides for quick lookup
  const overrideMap = new Map<string, FieldMapping>();
  for (const override of overrides) {
    overrideMap.set(getKey(override), override);
  }

  // Process defaults
  for (const defaultMapping of defaults) {
    const key = getKey(defaultMapping);
    const override = overrideMap.get(key);

    if (override) {
      // Default is overridden
      resolved.push({
        mapping: override,
        source: 'connection' as MappingSource,
        overridden: true,
        defaultMapping,
      });
      overrideMap.delete(key);
    } else {
      // Default is inherited
      resolved.push({
        mapping: defaultMapping,
        source: 'default' as MappingSource,
        overridden: false,
      });
    }
  }

  // Add standalone overrides (no matching default)
  for (const override of Array.from(overrideMap.values())) {
    resolved.push({
      mapping: override,
      source: 'connection' as MappingSource,
      overridden: false,
    });
  }

  return resolved;
}

// =============================================================================
// Tests
// =============================================================================

describe('Connection Mapping Resolution Logic', () => {
  describe('Basic Resolution', () => {
    it('should return only defaults when no overrides exist', () => {
      const defaults = [
        createMapping({ id: 'default-1', sourcePath: '$.data.email', targetPath: '$.email' }),
        createMapping({ id: 'default-2', sourcePath: '$.data.name', targetPath: '$.name' }),
      ];
      const overrides: FieldMapping[] = [];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.source === 'default')).toBe(true);
      expect(result.every((r) => r.overridden === false)).toBe(true);
    });

    it('should return empty array when no defaults and no overrides', () => {
      const result = resolveMappings([], []);
      expect(result).toHaveLength(0);
    });

    it('should return connection overrides when no defaults exist', () => {
      const defaults: FieldMapping[] = [];
      const overrides = [
        createMapping({ id: 'override-1', sourcePath: '$.custom.field', targetPath: '$.special' }),
      ];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('connection');
      expect(result[0].overridden).toBe(false); // No default to override
    });
  });

  describe('Override Merging', () => {
    it('should merge defaults with connection overrides', () => {
      const defaults = [
        createMapping({
          id: 'default-email',
          sourcePath: '$.data.email',
          targetPath: '$.user_email',
        }),
        createMapping({ id: 'default-name', sourcePath: '$.data.name', targetPath: '$.user_name' }),
      ];
      const overrides = [
        createMapping({
          id: 'override-email',
          sourcePath: '$.data.email',
          targetPath: '$.contact_email',
        }),
      ];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(2);

      // Email should be overridden
      const emailMapping = result.find((r) => r.mapping.sourcePath === '$.data.email');
      expect(emailMapping?.source).toBe('connection');
      expect(emailMapping?.overridden).toBe(true);
      expect(emailMapping?.mapping.targetPath).toBe('$.contact_email');
      expect(emailMapping?.defaultMapping?.targetPath).toBe('$.user_email');

      // Name should be inherited
      const nameMapping = result.find((r) => r.mapping.sourcePath === '$.data.name');
      expect(nameMapping?.source).toBe('default');
      expect(nameMapping?.overridden).toBe(false);
    });

    it('should override take precedence based on sourcePath and direction', () => {
      const defaults = [
        createMapping({
          id: 'default',
          sourcePath: '$.data.field',
          targetPath: '$.original',
          direction: 'output',
        }),
      ];
      const overrides = [
        createMapping({
          id: 'override',
          sourcePath: '$.data.field',
          targetPath: '$.custom',
          direction: 'output',
        }),
      ];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(1);
      expect(result[0].mapping.targetPath).toBe('$.custom');
      expect(result[0].source).toBe('connection');
    });
  });

  describe('Direction Handling', () => {
    it('should treat input and output as separate override targets', () => {
      const defaults = [
        createMapping({
          id: 'input-default',
          sourcePath: '$.field',
          targetPath: '$.api_field',
          direction: 'input',
        }),
        createMapping({
          id: 'output-default',
          sourcePath: '$.api_field',
          targetPath: '$.field',
          direction: 'output',
        }),
      ];
      const overrides = [
        createMapping({
          id: 'output-override',
          sourcePath: '$.api_field',
          targetPath: '$.custom_field',
          direction: 'output',
        }),
      ];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(2);

      const inputResult = result.find((r) => r.mapping.direction === 'input');
      expect(inputResult?.source).toBe('default'); // Input not overridden

      const outputResult = result.find((r) => r.mapping.direction === 'output');
      expect(outputResult?.source).toBe('connection'); // Output is overridden
      expect(outputResult?.mapping.targetPath).toBe('$.custom_field');
    });

    it('should allow override of input without affecting output', () => {
      const defaults = [
        createMapping({
          id: 'input',
          sourcePath: '$.id',
          targetPath: '$.user_id',
          direction: 'input',
        }),
        createMapping({
          id: 'output',
          sourcePath: '$.user_id',
          targetPath: '$.id',
          direction: 'output',
        }),
      ];
      const overrides = [
        createMapping({
          id: 'input-override',
          sourcePath: '$.id',
          targetPath: '$.account_id',
          direction: 'input',
        }),
      ];

      const result = resolveMappings(defaults, overrides);

      const inputResult = result.find((r) => r.mapping.direction === 'input');
      expect(inputResult?.mapping.targetPath).toBe('$.account_id');
      expect(inputResult?.source).toBe('connection');

      const outputResult = result.find((r) => r.mapping.direction === 'output');
      expect(outputResult?.mapping.targetPath).toBe('$.id');
      expect(outputResult?.source).toBe('default');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple overrides and defaults', () => {
      const defaults = [
        createMapping({ id: 'd1', sourcePath: '$.a', targetPath: '$.a_out', direction: 'output' }),
        createMapping({ id: 'd2', sourcePath: '$.b', targetPath: '$.b_out', direction: 'output' }),
        createMapping({ id: 'd3', sourcePath: '$.c', targetPath: '$.c_out', direction: 'output' }),
      ];
      const overrides = [
        createMapping({
          id: 'o1',
          sourcePath: '$.a',
          targetPath: '$.a_custom',
          direction: 'output',
        }),
        createMapping({
          id: 'o3',
          sourcePath: '$.c',
          targetPath: '$.c_custom',
          direction: 'output',
        }),
        createMapping({ id: 'o4', sourcePath: '$.d', targetPath: '$.d_new', direction: 'output' }), // New
      ];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(4); // 3 from defaults + 1 new

      // $.a is overridden
      const aResult = result.find((r) => r.mapping.sourcePath === '$.a');
      expect(aResult?.source).toBe('connection');
      expect(aResult?.overridden).toBe(true);

      // $.b is inherited
      const bResult = result.find((r) => r.mapping.sourcePath === '$.b');
      expect(bResult?.source).toBe('default');
      expect(bResult?.overridden).toBe(false);

      // $.c is overridden
      const cResult = result.find((r) => r.mapping.sourcePath === '$.c');
      expect(cResult?.source).toBe('connection');
      expect(cResult?.overridden).toBe(true);

      // $.d is new connection-only
      const dResult = result.find((r) => r.mapping.sourcePath === '$.d');
      expect(dResult?.source).toBe('connection');
      expect(dResult?.overridden).toBe(false);
    });

    it('should preserve default mapping reference in override', () => {
      const defaultMapping = createMapping({
        id: 'default',
        sourcePath: '$.email',
        targetPath: '$.user_email',
        transformConfig: { omitIfNull: true, omitIfEmpty: false, arrayMode: 'all' },
      });
      const overrideMapping = createMapping({
        id: 'override',
        sourcePath: '$.email',
        targetPath: '$.contact_email',
        transformConfig: { omitIfNull: false, omitIfEmpty: true, arrayMode: 'first' },
      });

      const result = resolveMappings([defaultMapping], [overrideMapping]);

      expect(result).toHaveLength(1);
      expect(result[0].defaultMapping).toEqual(defaultMapping);
      expect(result[0].mapping).toEqual(overrideMapping);
    });
  });

  describe('Edge Cases', () => {
    it('should handle mapping with same source but different targets', () => {
      // This simulates a scenario where the default maps to one target
      // and the override maps to a different target
      const defaults = [createMapping({ sourcePath: '$.data.id', targetPath: '$.record_id' })];
      const overrides = [createMapping({ sourcePath: '$.data.id', targetPath: '$.entity_id' })];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(1);
      expect(result[0].mapping.targetPath).toBe('$.entity_id');
    });

    it('should handle different coercion in override', () => {
      const defaults = [
        createMapping({
          sourcePath: '$.amount',
          targetPath: '$.value',
          transformConfig: {
            coercion: { type: 'string' },
            omitIfNull: false,
            omitIfEmpty: false,
            arrayMode: 'all',
          },
        }),
      ];
      const overrides = [
        createMapping({
          sourcePath: '$.amount',
          targetPath: '$.value',
          transformConfig: {
            coercion: { type: 'number' },
            omitIfNull: false,
            omitIfEmpty: false,
            arrayMode: 'all',
          },
        }),
      ];

      const result = resolveMappings(defaults, overrides);

      expect(result).toHaveLength(1);
      expect(result[0].mapping.transformConfig?.coercion?.type).toBe('number');
      expect(result[0].defaultMapping?.transformConfig?.coercion?.type).toBe('string');
    });
  });
});
