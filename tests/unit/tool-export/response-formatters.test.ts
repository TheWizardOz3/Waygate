import { describe, it, expect } from 'vitest';
import {
  formatSuccessResponse,
  formatSuccessForLLM,
} from '@/lib/modules/tool-export/responses/success-formatter';
import {
  formatErrorResponse,
  formatErrorForLLM,
} from '@/lib/modules/tool-export/responses/error-formatter';
import {
  detectToolActionCategory,
  type SuccessFormatterInput,
  type ErrorFormatterInput,
} from '@/lib/modules/tool-export/responses/response.schemas';

describe('Response Formatters', () => {
  describe('detectToolActionCategory', () => {
    it('should detect send actions', () => {
      expect(detectToolActionCategory('slack_send_message')).toBe('send');
      expect(detectToolActionCategory('slack_post_message')).toBe('send');
    });

    it('should detect create actions', () => {
      expect(detectToolActionCategory('github_create_issue')).toBe('create');
      expect(detectToolActionCategory('jira_add_task')).toBe('create');
    });

    it('should detect read actions', () => {
      expect(detectToolActionCategory('github_get_issue')).toBe('read');
      expect(detectToolActionCategory('slack_fetch_channel')).toBe('read');
      expect(detectToolActionCategory('api_retrieve_user')).toBe('read');
      expect(detectToolActionCategory('jira_view_ticket')).toBe('read');
    });

    it('should detect update actions', () => {
      expect(detectToolActionCategory('github_update_issue')).toBe('update');
      expect(detectToolActionCategory('slack_edit_channel')).toBe('update');
      expect(detectToolActionCategory('api_modify_settings')).toBe('update');
      expect(detectToolActionCategory('jira_change_status')).toBe('update');
    });

    it('should detect delete actions', () => {
      expect(detectToolActionCategory('github_delete_issue')).toBe('delete');
      expect(detectToolActionCategory('api_destroy_record')).toBe('delete');
      expect(detectToolActionCategory('slack_trash_file')).toBe('delete');
    });

    it('should detect list actions', () => {
      expect(detectToolActionCategory('slack_list_channels')).toBe('list');
      expect(detectToolActionCategory('github_browse_repos')).toBe('list');
      expect(detectToolActionCategory('api_all_users')).toBe('list');
    });

    it('should detect search actions', () => {
      expect(detectToolActionCategory('github_search_issues')).toBe('search');
      expect(detectToolActionCategory('slack_find_users')).toBe('search');
      expect(detectToolActionCategory('api_query_data')).toBe('search');
    });

    it('should detect execute actions', () => {
      expect(detectToolActionCategory('workflow_run_job')).toBe('execute');
      expect(detectToolActionCategory('ci_trigger_build')).toBe('execute');
      expect(detectToolActionCategory('api_invoke_function')).toBe('execute');
    });

    it('should return generic for unknown patterns', () => {
      expect(detectToolActionCategory('unknown_action')).toBe('generic');
      expect(detectToolActionCategory('custom_tool')).toBe('generic');
    });
  });

  describe('formatSuccessResponse', () => {
    const baseInput: SuccessFormatterInput = {
      actionName: 'slack_send_message',
      actionDisplayName: 'Send Message',
      integrationSlug: 'slack',
      integrationDisplayName: 'Slack',
      requestId: 'req_123456',
      latencyMs: 234,
      originalInput: { channel: '#general', text: 'Hello!' },
      responseData: { ok: true, ts: '1234567890.123456', channel: 'C123' },
    };

    it('should format basic success response', () => {
      const result = formatSuccessResponse(baseInput);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Sent');
      expect(result.data).toEqual(baseInput.responseData);
      expect(result.meta.action).toBe('slack_send_message');
      expect(result.meta.integration).toBe('slack');
      expect(result.meta.requestId).toBe('req_123456');
      expect(result.meta.latencyMs).toBe(234);
      expect(result.nextSteps).toBeDefined();
    });

    it('should include next steps for send actions', () => {
      const result = formatSuccessResponse(baseInput);

      expect(result.nextSteps).toContain('In your response');
      expect(result.nextSteps).toContain('message');
    });

    it('should include resolved inputs in context', () => {
      const input: SuccessFormatterInput = {
        ...baseInput,
        resolvedInputs: {
          channel: { original: '#general', resolved: 'C123' },
        },
      };
      const result = formatSuccessResponse(input);

      expect(result.context).toBeDefined();
      expect(result.context?.resolvedInputs?.channel?.original).toBe('#general');
      expect(result.context?.resolvedInputs?.channel?.resolved).toBe('C123');
    });

    it('should format create action success', () => {
      const input: SuccessFormatterInput = {
        ...baseInput,
        actionName: 'github_create_issue',
        actionDisplayName: 'Create Issue',
        integrationSlug: 'github',
        responseData: { id: 123, html_url: 'https://github.com/org/repo/issues/123' },
      };
      const result = formatSuccessResponse(input);

      expect(result.message).toContain('Created');
      expect(result.message).toContain('issue');
      expect(result.nextSteps).toContain('ID');
    });

    it('should format list action with pagination info', () => {
      const input: SuccessFormatterInput = {
        ...baseInput,
        actionName: 'slack_list_channels',
        actionDisplayName: 'List Channels',
        responseData: { channels: [{ id: 'C1' }, { id: 'C2' }], has_more: true },
      };
      const result = formatSuccessResponse(input);

      expect(result.message).toContain('Listed');
      expect(result.nextSteps).toContain('pagination');
    });

    it('should format search action with result count', () => {
      const input: SuccessFormatterInput = {
        ...baseInput,
        actionName: 'github_search_issues',
        actionDisplayName: 'Search Issues',
        responseData: { items: [{ id: 1 }, { id: 2 }], total_count: 2 },
      };
      const result = formatSuccessResponse(input);

      expect(result.message).toContain('Search');
      expect(result.nextSteps).toContain('results');
    });

    it('should format delete action success', () => {
      const input: SuccessFormatterInput = {
        ...baseInput,
        actionName: 'github_delete_issue',
        actionDisplayName: 'Delete Issue',
        responseData: { deleted: true },
      };
      const result = formatSuccessResponse(input);

      expect(result.message).toContain('Deleted');
      expect(result.nextSteps).toContain('irreversible');
    });

    it('should extract message content for send actions', () => {
      const result = formatSuccessResponse(baseInput);

      expect(result.message).toContain('Hello!'); // The message text
    });

    it('should extract identifiers from response', () => {
      // Use a create action so identifiers are included in the message
      const input: SuccessFormatterInput = {
        ...baseInput,
        actionName: 'github_create_issue',
        actionDisplayName: 'Create Issue',
        originalInput: { title: 'Test Issue' },
        responseData: { id: 'res_456', url: 'https://example.com/resource' },
      };
      const result = formatSuccessResponse(input);

      // For create actions, IDs should be in the message
      expect(result.message).toContain('res_456');
    });
  });

  describe('formatSuccessForLLM', () => {
    it('should combine message and next steps', () => {
      const input: SuccessFormatterInput = {
        actionName: 'slack_send_message',
        actionDisplayName: 'Send Message',
        integrationSlug: 'slack',
        integrationDisplayName: 'Slack',
        requestId: 'req_123',
        latencyMs: 100,
        originalInput: {},
        responseData: { ok: true },
      };
      const response = formatSuccessResponse(input);
      const llmText = formatSuccessForLLM(response);

      expect(llmText).toContain(response.message);
      expect(llmText).toContain(response.nextSteps);
    });
  });

  describe('formatErrorResponse', () => {
    const baseErrorInput: ErrorFormatterInput = {
      actionName: 'slack_send_message',
      actionDisplayName: 'Send Message',
      integrationSlug: 'slack',
      integrationDisplayName: 'Slack',
      requestId: 'req_err_123',
      errorCode: 'CHANNEL_NOT_FOUND',
      errorMessage: 'Channel not found',
      attemptedInput: { channel: '#nonexistent', text: 'Hello!' },
      retryable: false,
    };

    it('should format basic error response', () => {
      const result = formatErrorResponse(baseErrorInput);

      expect(result.success).toBe(false);
      // CHANNEL_NOT_FOUND is categorized as 'not_found', so message contains "Resource Not Found"
      expect(result.message).toContain('Not Found');
      expect(result.error.code).toBe('CHANNEL_NOT_FOUND');
      expect(result.meta.action).toBe('slack_send_message');
      expect(result.meta.requestId).toBe('req_err_123');
      expect(result.remediation).toBeDefined();
    });

    it('should include attempted inputs in context', () => {
      const result = formatErrorResponse(baseErrorInput);

      expect(result.context.attemptedInputs.channel).toBe('#nonexistent');
    });

    it('should provide remediation guidance', () => {
      const result = formatErrorResponse(baseErrorInput);

      expect(result.remediation).toContain('fix');
    });

    it('should include error details when provided', () => {
      const input: ErrorFormatterInput = {
        ...baseErrorInput,
        errorDetails: { suggestion: 'Try a different channel' },
      };
      const result = formatErrorResponse(input);

      expect(result.error.details).toEqual({ suggestion: 'Try a different channel' });
    });

    it('should format validation error', () => {
      const input: ErrorFormatterInput = {
        ...baseErrorInput,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Invalid input',
        errorDetails: { field: 'channel', issue: 'required' },
      };
      const result = formatErrorResponse(input);

      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.remediation).toBeDefined();
    });

    it('should format auth error', () => {
      const input: ErrorFormatterInput = {
        ...baseErrorInput,
        errorCode: 'UNAUTHORIZED',
        errorMessage: 'Authentication failed',
      };
      const result = formatErrorResponse(input);

      expect(result.error.code).toBe('UNAUTHORIZED');
      expect(result.remediation).toContain('auth');
    });

    it('should format rate limit error', () => {
      const input: ErrorFormatterInput = {
        ...baseErrorInput,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: 'Too many requests',
      };
      const result = formatErrorResponse(input);

      expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.remediation.toLowerCase()).toContain('retry');
    });

    it('should format timeout error', () => {
      const input: ErrorFormatterInput = {
        ...baseErrorInput,
        errorCode: 'TIMEOUT',
        errorMessage: 'Request timed out',
      };
      const result = formatErrorResponse(input);

      expect(result.error.code).toBe('TIMEOUT');
      expect(result.remediation.toLowerCase()).toContain('retry');
    });
  });

  describe('formatErrorForLLM', () => {
    it('should combine message and remediation', () => {
      const input: ErrorFormatterInput = {
        actionName: 'slack_send_message',
        actionDisplayName: 'Send Message',
        integrationSlug: 'slack',
        integrationDisplayName: 'Slack',
        requestId: 'req_123',
        errorCode: 'ERROR',
        errorMessage: 'Something went wrong',
        attemptedInput: {},
        retryable: false,
      };
      const response = formatErrorResponse(input);
      const llmText = formatErrorForLLM(response);

      expect(llmText).toContain(response.message);
      expect(llmText).toContain(response.remediation);
    });
  });
});
