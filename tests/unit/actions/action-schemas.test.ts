import { describe, it, expect } from 'vitest';
import {
  HttpMethodSchema,
  JsonSchemaSchema,
  JsonSchemaPropertySchema,
  PaginationConfigSchema,
  ActionRetryConfigSchema,
  ActionMetadataSchema,
  CreateActionInputSchema,
  UpdateActionInputSchema,
  ListActionsQuerySchema,
  generateSlug,
  generateActionId,
  parseActionId,
  isValidJsonSchema,
  createEmptyObjectSchema,
  ActionErrorCodes,
} from '@/lib/modules/actions/action.schemas';
import { HttpMethod } from '@prisma/client';

describe('Action Schemas', () => {
  describe('HttpMethodSchema', () => {
    it('should validate valid HTTP methods', () => {
      expect(HttpMethodSchema.safeParse(HttpMethod.GET).success).toBe(true);
      expect(HttpMethodSchema.safeParse(HttpMethod.POST).success).toBe(true);
      expect(HttpMethodSchema.safeParse(HttpMethod.PUT).success).toBe(true);
      expect(HttpMethodSchema.safeParse(HttpMethod.PATCH).success).toBe(true);
      expect(HttpMethodSchema.safeParse(HttpMethod.DELETE).success).toBe(true);
    });

    it('should reject invalid HTTP methods', () => {
      expect(HttpMethodSchema.safeParse('INVALID').success).toBe(false);
      expect(HttpMethodSchema.safeParse('get').success).toBe(false);
    });
  });

  describe('JsonSchemaPropertySchema', () => {
    it('should validate simple type properties', () => {
      const result = JsonSchemaPropertySchema.safeParse({
        type: 'string',
        description: 'A simple string',
      });
      expect(result.success).toBe(true);
    });

    it('should validate properties with constraints', () => {
      const result = JsonSchemaPropertySchema.safeParse({
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-z]+$',
      });
      expect(result.success).toBe(true);
    });

    it('should validate enum properties', () => {
      const result = JsonSchemaPropertySchema.safeParse({
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      });
      expect(result.success).toBe(true);
    });

    it('should validate numeric properties', () => {
      const result = JsonSchemaPropertySchema.safeParse({
        type: 'number',
        minimum: 0,
        maximum: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should validate array properties', () => {
      const result = JsonSchemaPropertySchema.safeParse({
        type: 'array',
        items: { type: 'string' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('JsonSchemaSchema', () => {
    it('should validate object schemas', () => {
      const result = JsonSchemaSchema.safeParse({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      });
      expect(result.success).toBe(true);
    });

    it('should validate array schemas', () => {
      const result = JsonSchemaSchema.safeParse({
        type: 'array',
        items: { type: 'string' },
      });
      expect(result.success).toBe(true);
    });

    it('should validate schemas with nested objects', () => {
      const result = JsonSchemaSchema.safeParse({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PaginationConfigSchema', () => {
    it('should validate cursor pagination', () => {
      const result = PaginationConfigSchema.safeParse({
        type: 'cursor',
        cursorParam: 'cursor',
        limitParam: 'limit',
        responseNextCursorPath: 'next_cursor',
      });
      expect(result.success).toBe(true);
    });

    it('should validate offset pagination', () => {
      const result = PaginationConfigSchema.safeParse({
        type: 'offset',
        pageParam: 'offset',
        limitParam: 'limit',
        responseTotalPath: 'total',
      });
      expect(result.success).toBe(true);
    });

    it('should validate page pagination', () => {
      const result = PaginationConfigSchema.safeParse({
        type: 'page',
        pageParam: 'page',
        limitParam: 'per_page',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid pagination type', () => {
      const result = PaginationConfigSchema.safeParse({
        type: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ActionRetryConfigSchema', () => {
    it('should validate retry config', () => {
      const result = ActionRetryConfigSchema.safeParse({
        maxRetries: 3,
        retryableStatuses: [429, 500, 502, 503],
        backoffMultiplier: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should validate partial retry config', () => {
      const result = ActionRetryConfigSchema.safeParse({
        maxRetries: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative max retries', () => {
      const result = ActionRetryConfigSchema.safeParse({
        maxRetries: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive backoff multiplier', () => {
      const result = ActionRetryConfigSchema.safeParse({
        backoffMultiplier: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ActionMetadataSchema', () => {
    it('should validate complete metadata', () => {
      const result = ActionMetadataSchema.safeParse({
        originalPath: '/api/users',
        tags: ['users', 'crud'],
        deprecated: false,
        aiConfidence: 0.95,
        rateLimit: { requests: 100, window: 60 },
        sourceUrl: 'https://api.example.com/docs',
        wishlistScore: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should validate minimal metadata', () => {
      const result = ActionMetadataSchema.safeParse({
        originalPath: '/api/test',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid AI confidence', () => {
      const result = ActionMetadataSchema.safeParse({
        originalPath: '/api/test',
        aiConfidence: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid source URL', () => {
      const result = ActionMetadataSchema.safeParse({
        originalPath: '/api/test',
        sourceUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateActionInputSchema', () => {
    // Use a valid UUID v4 format for tests
    const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const validInput = {
      integrationId: validUuid,
      name: 'Send Message',
      slug: 'send-message',
      httpMethod: HttpMethod.POST,
      endpointTemplate: 'https://api.example.com/messages',
      inputSchema: {
        type: 'object' as const,
        properties: {
          channel: { type: 'string' },
          text: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object' as const,
        properties: {
          ok: { type: 'boolean' },
        },
      },
      cacheable: false,
    };

    it('should validate complete action input', () => {
      const result = CreateActionInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate action with optional fields', () => {
      const result = CreateActionInputSchema.safeParse({
        ...validInput,
        description: 'Send a message to a channel',
        paginationConfig: { type: 'cursor' as const, cursorParam: 'cursor' },
        retryConfig: { maxRetries: 3 },
        cacheTtlSeconds: 300,
        metadata: { originalPath: '/messages', tags: ['messaging'] },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { name: _, ...incomplete } = validInput;
      const result = CreateActionInputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = CreateActionInputSchema.safeParse({
        ...validInput,
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty slug', () => {
      const result = CreateActionInputSchema.safeParse({
        ...validInput,
        slug: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateActionInputSchema', () => {
    it('should validate partial updates', () => {
      const result = UpdateActionInputSchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('should validate empty update (no changes)', () => {
      const result = UpdateActionInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate multiple field updates', () => {
      const result = UpdateActionInputSchema.safeParse({
        name: 'Updated Name',
        description: 'Updated description',
        cacheable: true,
        cacheTtlSeconds: 600,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ListActionsQuerySchema', () => {
    it('should apply defaults', () => {
      const result = ListActionsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it('should validate cursor pagination', () => {
      const result = ListActionsQuerySchema.safeParse({
        cursor: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        limit: 25,
      });
      expect(result.success).toBe(true);
    });

    it('should validate search and filters', () => {
      const result = ListActionsQuerySchema.safeParse({
        search: 'message',
        tags: 'messaging,channels',
        httpMethod: HttpMethod.POST,
        cacheable: 'true', // cacheable expects string that transforms to boolean
      });
      expect(result.success).toBe(true);
    });

    it('should reject limit above max', () => {
      const result = ListActionsQuerySchema.safeParse({
        limit: 200,
      });
      expect(result.success).toBe(false);
    });

    it('should reject limit below min', () => {
      const result = ListActionsQuerySchema.safeParse({
        limit: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should coerce string limit to number', () => {
      const result = ListActionsQuerySchema.safeParse({
        limit: '25',
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(25);
    });
  });

  describe('utility functions', () => {
    describe('generateSlug', () => {
      it('should generate slug from simple name', () => {
        expect(generateSlug('Send Message')).toBe('send-message');
      });

      it('should handle special characters', () => {
        expect(generateSlug('Create User (v2)')).toBe('create-user-v2');
      });

      it('should handle consecutive spaces/hyphens', () => {
        expect(generateSlug('List   All   Users')).toBe('list-all-users');
      });

      it('should trim leading/trailing hyphens', () => {
        expect(generateSlug('  Send Message  ')).toBe('send-message');
      });

      it('should truncate long names', () => {
        const longName = 'A'.repeat(150);
        expect(generateSlug(longName).length).toBeLessThanOrEqual(100);
      });

      it('should handle empty string', () => {
        expect(generateSlug('')).toBe('');
      });
    });

    describe('generateActionId', () => {
      it('should create action ID from slugs', () => {
        expect(generateActionId('slack', 'send-message')).toBe('slack.send-message');
      });
    });

    describe('parseActionId', () => {
      it('should parse valid action ID', () => {
        const result = parseActionId('slack.send-message');
        expect(result).toEqual({
          integrationSlug: 'slack',
          actionSlug: 'send-message',
        });
      });

      it('should return null for invalid action ID', () => {
        expect(parseActionId('invalid')).toBeNull();
        expect(parseActionId('too.many.parts')).toBeNull();
        expect(parseActionId('')).toBeNull();
      });
    });

    describe('isValidJsonSchema', () => {
      it('should return true for valid schemas', () => {
        expect(isValidJsonSchema({ type: 'object', properties: {} })).toBe(true);
        expect(isValidJsonSchema({ type: 'string' })).toBe(true);
      });

      it('should return false for invalid schemas', () => {
        expect(isValidJsonSchema(null)).toBe(false);
        expect(isValidJsonSchema({})).toBe(false);
        expect(isValidJsonSchema({ foo: 'bar' })).toBe(false);
      });
    });

    describe('createEmptyObjectSchema', () => {
      it('should create valid empty object schema', () => {
        const schema = createEmptyObjectSchema();
        expect(schema.type).toBe('object');
        expect(schema.properties).toEqual({});
        expect(schema.additionalProperties).toBe(true);
      });
    });
  });

  describe('ActionErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(ActionErrorCodes.ACTION_NOT_FOUND).toBe('ACTION_NOT_FOUND');
      expect(ActionErrorCodes.INTEGRATION_NOT_FOUND).toBe('INTEGRATION_NOT_FOUND');
      expect(ActionErrorCodes.DUPLICATE_SLUG).toBe('DUPLICATE_SLUG');
      expect(ActionErrorCodes.INVALID_SCHEMA).toBe('INVALID_SCHEMA');
      expect(ActionErrorCodes.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(ActionErrorCodes.BATCH_LIMIT_EXCEEDED).toBe('BATCH_LIMIT_EXCEEDED');
    });
  });
});
