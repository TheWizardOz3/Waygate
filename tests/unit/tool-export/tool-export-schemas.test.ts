import { describe, it, expect } from 'vitest';
import {
  generateToolName,
  isValidUniversalTool,
  UniversalToolPropertySchema,
  UniversalToolParametersSchema,
  ToolExportErrorCodes,
} from '@/lib/modules/tool-export/tool-export.schemas';

describe('Tool Export Schemas', () => {
  describe('generateToolName', () => {
    it('should generate snake_case tool name from slugs', () => {
      expect(generateToolName('slack', 'send-message')).toBe('slack_send_message');
      expect(generateToolName('github', 'create-issue')).toBe('github_create_issue');
    });

    it('should handle already snake_case slugs', () => {
      expect(generateToolName('slack', 'send_message')).toBe('slack_send_message');
    });

    it('should handle mixed case and normalize to lowercase', () => {
      expect(generateToolName('Slack', 'Send-Message')).toBe('slack_send_message');
      expect(generateToolName('GITHUB', 'CREATE_ISSUE')).toBe('github_create_issue');
    });

    it('should handle complex slugs with multiple hyphens', () => {
      expect(generateToolName('google-calendar', 'create-calendar-event')).toBe(
        'google_calendar_create_calendar_event'
      );
    });
  });

  describe('isValidUniversalTool', () => {
    it('should validate a valid universal tool', () => {
      const tool = {
        name: 'slack_send_message',
        description: 'Send a message to Slack',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'The channel to send to',
            },
          },
          required: ['channel'],
        },
      };
      expect(isValidUniversalTool(tool)).toBe(true);
    });

    it('should reject tool with invalid name format', () => {
      const tool = {
        name: 'Slack-SendMessage', // Invalid: not snake_case
        description: 'Send a message',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      };
      expect(isValidUniversalTool(tool)).toBe(false);
    });

    it('should reject tool with missing description', () => {
      const tool = {
        name: 'slack_send_message',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      };
      expect(isValidUniversalTool(tool)).toBe(false);
    });

    it('should reject tool with invalid parameters type', () => {
      const tool = {
        name: 'slack_send_message',
        description: 'Send a message',
        parameters: {
          type: 'array', // Should be 'object'
          properties: {},
          required: [],
        },
      };
      expect(isValidUniversalTool(tool)).toBe(false);
    });

    it('should accept tool with contextTypes', () => {
      const tool = {
        name: 'slack_send_message',
        description: 'Send a message to Slack',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        contextTypes: ['channels', 'users'],
      };
      expect(isValidUniversalTool(tool)).toBe(true);
    });
  });

  describe('UniversalToolPropertySchema', () => {
    it('should validate string property', () => {
      const prop = {
        type: 'string',
        description: 'A string value',
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(true);
    });

    it('should validate property with enum', () => {
      const prop = {
        type: 'string',
        description: 'Status value',
        enum: ['active', 'inactive', 'pending'],
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(true);
    });

    it('should validate property with default', () => {
      const prop = {
        type: 'boolean',
        description: 'Enable feature',
        default: false,
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(true);
    });

    it('should validate array property with items', () => {
      const prop = {
        type: 'array',
        description: 'List of tags',
        items: {
          type: 'string',
          description: 'A tag',
        },
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(true);
    });

    it('should validate nested object property', () => {
      const prop = {
        type: 'object',
        description: 'Nested config',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Enable flag',
          },
          limit: {
            type: 'integer',
            description: 'Max limit',
          },
        },
        required: ['enabled'],
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(true);
    });

    it('should reject invalid type', () => {
      const prop = {
        type: 'invalid',
        description: 'Invalid type',
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(false);
    });

    it('should reject empty description', () => {
      const prop = {
        type: 'string',
        description: '',
      };
      expect(UniversalToolPropertySchema.safeParse(prop).success).toBe(false);
    });
  });

  describe('UniversalToolParametersSchema', () => {
    it('should validate basic parameters object', () => {
      const params = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name',
          },
        },
        required: ['name'],
      };
      expect(UniversalToolParametersSchema.safeParse(params).success).toBe(true);
    });

    it('should validate empty parameters', () => {
      const params = {
        type: 'object',
        properties: {},
        required: [],
      };
      expect(UniversalToolParametersSchema.safeParse(params).success).toBe(true);
    });

    it('should reject non-object type', () => {
      const params = {
        type: 'string',
        properties: {},
        required: [],
      };
      expect(UniversalToolParametersSchema.safeParse(params).success).toBe(false);
    });
  });

  describe('ToolExportErrorCodes', () => {
    it('should have expected error codes', () => {
      expect(ToolExportErrorCodes.INTEGRATION_NOT_FOUND).toBe('INTEGRATION_NOT_FOUND');
      expect(ToolExportErrorCodes.ACTION_NOT_FOUND).toBe('ACTION_NOT_FOUND');
      expect(ToolExportErrorCodes.NO_ACTIONS_AVAILABLE).toBe('NO_ACTIONS_AVAILABLE');
      expect(ToolExportErrorCodes.SCHEMA_TRANSFORMATION_FAILED).toBe(
        'SCHEMA_TRANSFORMATION_FAILED'
      );
      expect(ToolExportErrorCodes.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
    });
  });
});
