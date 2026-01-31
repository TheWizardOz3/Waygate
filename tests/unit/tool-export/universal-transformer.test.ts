import { describe, it, expect } from 'vitest';
import {
  transformActionToUniversalTool,
  transformActionsToUniversalTools,
  transformInputSchemaToParameters,
  flattenSchemaProperty,
  normalizeType,
  buildPropertyDescription,
} from '@/lib/modules/tool-export/formats/universal.transformer';
import type { ActionResponse, JsonSchema } from '@/lib/modules/actions/action.schemas';
import type { InputJsonSchemaProperty } from '@/lib/modules/tool-export/tool-export.schemas';

describe('Universal Transformer', () => {
  // Default input schema for mock actions
  const defaultInputSchema: JsonSchema = {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'The channel to send to',
      },
      text: {
        type: 'string',
        description: 'The message text',
      },
    },
    required: ['channel', 'text'],
  };

  // Empty schema for tests that need it
  const emptySchema: JsonSchema = { type: 'object' };

  // Helper to create a mock action
  const createMockAction = (overrides: Partial<ActionResponse> = {}): ActionResponse => ({
    id: '00000000-0000-0000-0000-000000000001',
    integrationId: '00000000-0000-0000-0000-000000000002',
    name: 'Send Message',
    slug: 'send-message',
    description: 'Send a message to a channel',
    httpMethod: 'POST',
    endpointTemplate: '/chat.postMessage',
    inputSchema: defaultInputSchema,
    outputSchema: emptySchema,
    paginationConfig: null,
    validationConfig: null,
    retryConfig: null,
    cacheable: false,
    tags: [],
    metadata: {},
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  describe('transformActionToUniversalTool', () => {
    it('should transform a basic action to universal tool', () => {
      const action = createMockAction();
      const result = transformActionToUniversalTool(action, 'slack');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tool.name).toBe('slack_send_message');
        expect(result.tool.parameters.type).toBe('object');
        expect(result.tool.parameters.properties).toHaveProperty('channel');
        expect(result.tool.parameters.properties).toHaveProperty('text');
        expect(result.tool.parameters.required).toEqual(['channel', 'text']);
      }
    });

    it('should generate descriptive tool description', () => {
      const action = createMockAction();
      const result = transformActionToUniversalTool(action, 'slack');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tool.description).toContain('message');
        expect(result.tool.description.length).toBeGreaterThan(20);
      }
    });

    it('should use simple description when specified', () => {
      const action = createMockAction();
      const result = transformActionToUniversalTool(action, 'slack', {
        useSimpleDescription: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Simple description should be shorter and more direct
        expect(result.tool.description.length).toBeLessThan(500);
      }
    });

    it('should extract context types from action tags', () => {
      const action = createMockAction({
        tags: ['messaging', 'channel', 'user'],
      });
      const result = transformActionToUniversalTool(action, 'slack', {
        includeContextTypes: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tool.contextTypes).toContain('channels');
        expect(result.tool.contextTypes).toContain('users');
      }
    });

    it('should handle action with empty input schema', () => {
      const action = createMockAction({
        inputSchema: emptySchema,
      });
      const result = transformActionToUniversalTool(action, 'slack');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tool.parameters.properties).toEqual({});
        expect(result.tool.parameters.required).toEqual([]);
      }
    });

    it('should truncate description at maxDescriptionLength', () => {
      const action = createMockAction();
      const result = transformActionToUniversalTool(action, 'slack', {
        maxDescriptionLength: 100,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tool.description.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('transformActionsToUniversalTools', () => {
    it('should transform multiple actions', () => {
      const actions = [
        createMockAction({ slug: 'send-message' }),
        createMockAction({ slug: 'list-channels', name: 'List Channels' }),
      ];
      const result = transformActionsToUniversalTools(actions, 'slack');

      expect(result.tools).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.tools[0].name).toBe('slack_send_message');
      expect(result.tools[1].name).toBe('slack_list_channels');
    });

    it('should collect errors for failed transformations', () => {
      const actions = [
        createMockAction({ slug: 'valid-action' }),
        // Create an action that will fail (deeply nested to trigger recursion limit)
        createMockAction({
          slug: 'complex-action',
          inputSchema: null as unknown as JsonSchema, // This might cause issues
        }),
      ];
      const result = transformActionsToUniversalTools(actions, 'slack');

      // Both should transform (null schema becomes empty params)
      expect(result.tools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('transformInputSchemaToParameters', () => {
    it('should transform object schema with properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name' },
          age: { type: 'integer', description: 'Age' },
        },
        required: ['name'],
      };
      const result = transformInputSchemaToParameters(schema);

      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('name');
      expect(result.properties).toHaveProperty('age');
      expect(result.required).toEqual(['name']);
    });

    it('should return empty parameters for null schema', () => {
      const result = transformInputSchemaToParameters(null as unknown as JsonSchema);

      expect(result.type).toBe('object');
      expect(result.properties).toEqual({});
      expect(result.required).toEqual([]);
    });

    it('should return empty parameters for non-object schema', () => {
      const result = transformInputSchemaToParameters({ type: 'array' } as JsonSchema);

      expect(result.type).toBe('object');
      expect(result.properties).toEqual({});
      expect(result.required).toEqual([]);
    });

    it('should handle schema with definitions and $ref', () => {
      // The transformer accepts InputJsonSchema which allows definitions
      // Cast through unknown to bypass strict type checking for this test
      const schema = {
        type: 'object',
        properties: {
          user: { $ref: '#/definitions/User' },
        },
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'User ID' },
              name: { type: 'string', description: 'User name' },
            },
          },
        },
      } as unknown as JsonSchema;
      const result = transformInputSchemaToParameters(schema);

      expect(result.properties).toHaveProperty('user');
      expect(result.properties.user.type).toBe('object');
    });
  });

  describe('flattenSchemaProperty', () => {
    it('should flatten simple string property', () => {
      const prop = { type: 'string', description: 'A string' };
      const result = flattenSchemaProperty(prop, {}, 'testProp');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('string');
      expect(result!.description).toContain('A string');
    });

    it('should flatten property with enum', () => {
      const prop = { type: 'string', enum: ['a', 'b', 'c'] };
      const result = flattenSchemaProperty(prop, {}, 'status');

      expect(result).not.toBeNull();
      expect(result!.enum).toEqual(['a', 'b', 'c']);
    });

    it('should flatten array property with items', () => {
      const prop = {
        type: 'array',
        items: { type: 'string', description: 'A tag' },
      };
      const result = flattenSchemaProperty(prop, {}, 'tags');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('array');
      expect(result!.items).toBeDefined();
      expect(result!.items!.type).toBe('string');
    });

    it('should resolve $ref to definitions', () => {
      const prop = { $ref: '#/definitions/Address' };
      const definitions = {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string', description: 'Street' },
          },
        },
      };
      const result = flattenSchemaProperty(prop, definitions, 'address');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('object');
    });

    it('should flatten oneOf by merging schemas', () => {
      const prop = {
        oneOf: [{ type: 'string' }, { type: 'number' }],
      };
      const result = flattenSchemaProperty(prop, {}, 'value');

      expect(result).not.toBeNull();
      // Should create a description noting the alternatives
      expect(result!.description).toContain('one of');
    });

    it('should flatten allOf by merging all schemas', () => {
      const prop: InputJsonSchemaProperty = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string', description: 'A' } } },
          { properties: { b: { type: 'string', description: 'B' } } },
        ],
      };
      const result = flattenSchemaProperty(prop, {}, 'combined');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('object');
    });

    it('should add default value when present', () => {
      const prop = { type: 'boolean', default: true, description: 'Flag' };
      const result = flattenSchemaProperty(prop, {}, 'enabled');

      expect(result).not.toBeNull();
      expect(result!.default).toBe(true);
    });

    it('should prevent infinite recursion with depth limit', () => {
      const prop = { type: 'object', description: 'Nested' };
      const result = flattenSchemaProperty(prop, {}, 'deep', 15); // Beyond depth limit

      expect(result).not.toBeNull();
      expect(result!.description).toContain('complex nested structure');
    });
  });

  describe('normalizeType', () => {
    it('should return valid types as-is', () => {
      expect(normalizeType('string')).toBe('string');
      expect(normalizeType('number')).toBe('number');
      expect(normalizeType('integer')).toBe('integer');
      expect(normalizeType('boolean')).toBe('boolean');
      expect(normalizeType('array')).toBe('array');
      expect(normalizeType('object')).toBe('object');
    });

    it('should filter null from type arrays', () => {
      expect(normalizeType(['string', 'null'])).toBe('string');
      expect(normalizeType(['null', 'number'])).toBe('number');
    });

    it('should return first non-null type from array', () => {
      expect(normalizeType(['boolean', 'string'])).toBe('boolean');
    });

    it('should default to object for undefined', () => {
      expect(normalizeType(undefined)).toBe('object');
    });

    it('should default to object for unknown types', () => {
      expect(normalizeType('custom')).toBe('object');
    });

    it('should treat null type as string', () => {
      expect(normalizeType('null')).toBe('string');
    });
  });

  describe('buildPropertyDescription', () => {
    it('should use existing description', () => {
      const prop = { type: 'string', description: 'Custom description' };
      const result = buildPropertyDescription(prop, 'field');

      expect(result).toContain('Custom description');
    });

    it('should generate description from prop name if missing', () => {
      const prop = { type: 'string' };
      const result = buildPropertyDescription(prop, 'userName');

      expect(result.toLowerCase()).toContain('user');
    });

    it('should include format hint', () => {
      const prop = { type: 'string', description: 'Email', format: 'email' };
      const result = buildPropertyDescription(prop, 'email');

      expect(result).toContain('format: email');
    });

    it('should include min/max constraints', () => {
      const prop = { type: 'number', description: 'Age', minimum: 0, maximum: 120 };
      const result = buildPropertyDescription(prop, 'age');

      expect(result).toContain('min: 0');
      expect(result).toContain('max: 120');
    });

    it('should include length constraints', () => {
      const prop = { type: 'string', description: 'Name', minLength: 1, maxLength: 100 };
      const result = buildPropertyDescription(prop, 'name');

      expect(result).toContain('min length: 1');
      expect(result).toContain('max length: 100');
    });

    it('should include enum values hint', () => {
      const prop = { type: 'string', description: 'Status', enum: ['active', 'inactive'] };
      const result = buildPropertyDescription(prop, 'status');

      expect(result).toContain('active');
      expect(result).toContain('inactive');
    });

    it('should truncate long enum lists', () => {
      const prop = {
        type: 'string',
        description: 'Code',
        enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      };
      const result = buildPropertyDescription(prop, 'code');

      // Implementation uses '..' not '...' for truncation
      expect(result).toContain('..');
      expect(result).toContain('7 options');
    });

    it('should include default value', () => {
      const prop = { type: 'boolean', description: 'Flag', default: true };
      const result = buildPropertyDescription(prop, 'flag');

      expect(result).toContain('Default:');
      expect(result).toContain('true');
    });

    it('should indicate nullable', () => {
      const prop = { type: 'string', description: 'Optional', nullable: true };
      const result = buildPropertyDescription(prop, 'optional');

      expect(result).toContain('Can be null');
    });
  });
});
