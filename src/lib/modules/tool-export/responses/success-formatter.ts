/**
 * Success Formatter
 *
 * Formats successful tool invocation results into agent-readable responses.
 * Generates human/agent-readable message summaries and follow-on instructions
 * (next steps) that help AI agents understand what happened and what to do next.
 *
 * Design principles:
 * - Messages are markdown-formatted for readability
 * - Messages summarize what action was taken and the key outcome
 * - Next steps provide actionable guidance for follow-on actions
 * - Context resolution is surfaced for transparency
 */

import {
  type ToolSuccessResponse,
  type SuccessFormatterInput,
  type ToolActionCategory,
  detectToolActionCategory,
} from './response.schemas';

// =============================================================================
// Message Templates
// =============================================================================

/**
 * Message template functions by action category
 */
const MESSAGE_TEMPLATES: Record<
  ToolActionCategory,
  (input: SuccessFormatterInput, summary: string) => string
> = {
  send: (input, summary) => `## Sent ${input.actionDisplayName}\n\n${summary}`,

  create: (input, summary) =>
    `## Created ${extractResourceName(input.actionDisplayName)}\n\n${summary}`,

  read: (input, summary) =>
    `## Retrieved ${extractResourceName(input.actionDisplayName)}\n\n${summary}`,

  update: (input, summary) =>
    `## Updated ${extractResourceName(input.actionDisplayName)}\n\n${summary}`,

  delete: (input, summary) =>
    `## Deleted ${extractResourceName(input.actionDisplayName)}\n\n${summary}`,

  list: (input, summary) =>
    `## Listed ${extractResourceName(input.actionDisplayName)}\n\n${summary}`,

  search: (input, summary) =>
    `## Search results for ${extractResourceName(input.actionDisplayName)}\n\n${summary}`,

  execute: (input, summary) => `## Executed ${input.actionDisplayName}\n\n${summary}`,

  generic: (input, summary) => `## ${input.actionDisplayName} completed\n\n${summary}`,
};

/**
 * Next steps template functions by action category
 */
const NEXT_STEPS_TEMPLATES: Record<
  ToolActionCategory,
  (input: SuccessFormatterInput, identifiers: ResponseIdentifiers) => string
> = {
  send: (input, ids) => {
    const lines = ['## In your response:'];
    lines.push(
      `- Confirm that the message was sent successfully to ${ids.target || 'the recipient'}`
    );
    if (ids.messageId) {
      lines.push(
        `- The message ID (${ids.messageId}) can be used to reply in a thread, react to, or update the message`
      );
    }
    lines.push('- If this was part of a larger task, proceed with the next step');
    return lines.join('\n');
  },

  create: (input, ids) => {
    const resource = extractResourceName(input.actionDisplayName);
    const lines = ['## In your response:'];
    lines.push(`- Confirm that the ${resource} was created successfully`);
    if (ids.resourceId) {
      lines.push(`- The ${resource} ID (${ids.resourceId}) can be used for subsequent operations`);
    }
    if (ids.resourceUrl) {
      lines.push(`- Direct link: ${ids.resourceUrl}`);
    }
    lines.push('- If additional configuration is needed, use the appropriate update action');
    return lines.join('\n');
  },

  read: (input, ids) => {
    const resource = extractResourceName(input.actionDisplayName);
    const lines = ['## In your response:'];
    lines.push(`- Summarize the key information from the ${resource} data`);
    if (ids.resourceId) {
      lines.push(`- Resource ID: ${ids.resourceId}`);
    }
    lines.push('- If the user asked a specific question, answer it using the retrieved data');
    lines.push('- If more details are needed, you can fetch related resources');
    return lines.join('\n');
  },

  update: (input, ids) => {
    const resource = extractResourceName(input.actionDisplayName);
    const lines = ['## In your response:'];
    lines.push(`- Confirm what was updated on the ${resource}`);
    if (ids.resourceId) {
      lines.push(`- The ${resource} ID is ${ids.resourceId}`);
    }
    lines.push('- If verification is needed, use the corresponding read action');
    return lines.join('\n');
  },

  delete: (input, ids) => {
    const resource = extractResourceName(input.actionDisplayName);
    const lines = ['## In your response:'];
    lines.push(`- Confirm that the ${resource} was deleted successfully`);
    if (ids.resourceId) {
      lines.push(`- Deleted resource ID: ${ids.resourceId}`);
    }
    lines.push('- Note: This action is typically irreversible');
    lines.push('- If this was part of a cleanup task, proceed with any remaining deletions');
    return lines.join('\n');
  },

  list: (input, ids) => {
    const resource = extractResourceName(input.actionDisplayName);
    const lines = ['## In your response:'];
    lines.push(`- Summarize the ${resource} list (count, key items, etc.)`);
    if (ids.hasMore) {
      lines.push('- Note: More results may be available; use pagination to fetch additional items');
    }
    lines.push('- If the user needs to work with a specific item, you can use read/update actions');
    return lines.join('\n');
  },

  search: (input, ids) => {
    const resource = extractResourceName(input.actionDisplayName);
    const lines = ['## In your response:'];
    lines.push(`- Present the search results to the user`);
    if (ids.resultCount !== undefined) {
      lines.push(`- Found ${ids.resultCount} matching ${resource}`);
    }
    lines.push('- If no results were found, suggest alternative search terms or broader criteria');
    lines.push('- If results were found, you can perform operations on specific items');
    return lines.join('\n');
  },

  execute: (input, ids) => {
    const lines = ['## In your response:'];
    lines.push(`- Confirm that ${input.actionDisplayName} completed successfully`);
    if (ids.jobId) {
      lines.push(`- Job/execution ID: ${ids.jobId}`);
    }
    lines.push('- Report any relevant output or status information');
    lines.push('- If this triggers an async process, you may need to check status later');
    return lines.join('\n');
  },

  generic: (input, ids) => {
    const lines = ['## In your response:'];
    lines.push(`- Confirm that ${input.actionDisplayName} completed successfully`);
    if (ids.resourceId) {
      lines.push(`- Resource ID: ${ids.resourceId}`);
    }
    if (ids.resourceUrl) {
      lines.push(`- URL: ${ids.resourceUrl}`);
    }
    lines.push('- Summarize any relevant data from the response');
    lines.push('- If this was part of a larger task, proceed with the next step');
    return lines.join('\n');
  },
};

// =============================================================================
// Response Identifier Extraction
// =============================================================================

/**
 * Common identifiers extracted from response data
 */
interface ResponseIdentifiers {
  resourceId?: string;
  resourceUrl?: string;
  messageId?: string;
  target?: string;
  jobId?: string;
  resultCount?: number;
  hasMore?: boolean;
}

/**
 * Extract common identifiers from response data
 * Looks for common patterns in API responses
 */
function extractIdentifiers(data: unknown): ResponseIdentifiers {
  const ids: ResponseIdentifiers = {};

  if (!data || typeof data !== 'object') {
    return ids;
  }

  const obj = data as Record<string, unknown>;

  // Resource IDs (various formats)
  ids.resourceId =
    extractString(obj, 'id') ||
    extractString(obj, 'Id') ||
    extractString(obj, 'ID') ||
    extractString(obj, 'uuid') ||
    extractString(obj, 'uid');

  // URLs
  ids.resourceUrl =
    extractString(obj, 'url') ||
    extractString(obj, 'html_url') ||
    extractString(obj, 'web_url') ||
    extractString(obj, 'permalink');

  // Message identifiers (Slack-style)
  ids.messageId =
    extractString(obj, 'ts') || extractString(obj, 'message_id') || extractString(obj, 'messageId');

  // Target (channel, recipient, etc.)
  ids.target =
    extractString(obj, 'channel') || extractString(obj, 'to') || extractString(obj, 'recipient');

  // Job/execution identifiers
  ids.jobId =
    extractString(obj, 'job_id') ||
    extractString(obj, 'jobId') ||
    extractString(obj, 'execution_id') ||
    extractString(obj, 'executionId') ||
    extractString(obj, 'run_id') ||
    extractString(obj, 'runId');

  // Result counts for lists/searches
  if (Array.isArray(obj)) {
    ids.resultCount = obj.length;
  } else if (typeof obj.count === 'number') {
    ids.resultCount = obj.count;
  } else if (typeof obj.total === 'number') {
    ids.resultCount = obj.total;
  } else if (typeof obj.total_count === 'number') {
    ids.resultCount = obj.total_count;
  } else if (Array.isArray(obj.data)) {
    ids.resultCount = (obj.data as unknown[]).length;
  } else if (Array.isArray(obj.items)) {
    ids.resultCount = (obj.items as unknown[]).length;
  } else if (Array.isArray(obj.results)) {
    ids.resultCount = (obj.results as unknown[]).length;
  }

  // Pagination indicators
  ids.hasMore =
    obj.has_more === true ||
    obj.hasMore === true ||
    obj.has_next === true ||
    obj.hasNext === true ||
    !!obj.next_cursor ||
    !!obj.nextCursor ||
    !!obj.next_page_token;

  return ids;
}

/**
 * Safely extract a string value from an object
 */
function extractString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

// =============================================================================
// Summary Generation
// =============================================================================

/**
 * Generate a summary of the response data
 */
function generateSummary(
  input: SuccessFormatterInput,
  category: ToolActionCategory,
  ids: ResponseIdentifiers
): string {
  const lines: string[] = [];

  // Add resolved inputs if any
  if (input.resolvedInputs && Object.keys(input.resolvedInputs).length > 0) {
    for (const [field, resolution] of Object.entries(input.resolvedInputs)) {
      lines.push(`- Resolved ${field}: "${resolution.original}" -> ${resolution.resolved}`);
    }
    lines.push('');
  }

  // Category-specific summary
  switch (category) {
    case 'send':
      if (ids.target) {
        lines.push(`Sent to: ${ids.target}`);
      }
      if (ids.messageId) {
        lines.push(`Message ID: ${ids.messageId}`);
      }
      // Include message content if present
      const messageContent = extractMessageContent(input.originalInput);
      if (messageContent) {
        lines.push('');
        lines.push(`> ${truncate(messageContent, 200)}`);
      }
      break;

    case 'create':
      if (ids.resourceId) {
        lines.push(`ID: ${ids.resourceId}`);
      }
      if (ids.resourceUrl) {
        lines.push(`URL: ${ids.resourceUrl}`);
      }
      break;

    case 'list':
    case 'search':
      if (ids.resultCount !== undefined) {
        lines.push(`Found ${ids.resultCount} result${ids.resultCount === 1 ? '' : 's'}`);
      }
      if (ids.hasMore) {
        lines.push('(More results available)');
      }
      break;

    case 'delete':
      lines.push('Resource deleted successfully.');
      break;

    default:
      if (ids.resourceId) {
        lines.push(`Resource ID: ${ids.resourceId}`);
      }
  }

  // If we have no summary lines, add a generic success message
  if (lines.length === 0) {
    lines.push('Operation completed successfully.');
  }

  return lines.join('\n');
}

/**
 * Extract message content from input (for send actions)
 */
function extractMessageContent(input: Record<string, unknown>): string | undefined {
  return (
    extractString(input as Record<string, unknown>, 'text') ||
    extractString(input as Record<string, unknown>, 'message') ||
    extractString(input as Record<string, unknown>, 'content') ||
    extractString(input as Record<string, unknown>, 'body')
  );
}

/**
 * Extract resource name from action display name
 * e.g., "Send Message" -> "message", "Create Issue" -> "issue"
 */
function extractResourceName(actionDisplayName: string): string {
  // Common patterns: "Verb Resource", "Verb the Resource"
  const words = actionDisplayName.split(/\s+/);

  // Remove common verbs and articles
  const filtered = words.filter(
    (w) =>
      !/^(get|list|create|update|delete|send|post|read|fetch|retrieve|search|find|the|a|an)$/i.test(
        w
      )
  );

  if (filtered.length > 0) {
    return filtered.join(' ').toLowerCase();
  }

  // Fallback: use the whole name
  return actionDisplayName.toLowerCase();
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// Main Formatter Function
// =============================================================================

/**
 * Format a successful tool invocation into an agent-readable response.
 *
 * @param input - The formatter input containing action details and response data
 * @returns An agent-readable success response
 *
 * @example
 * ```typescript
 * const response = formatSuccessResponse({
 *   actionName: 'slack_send_message',
 *   actionDisplayName: 'Send Message',
 *   integrationSlug: 'slack',
 *   integrationDisplayName: 'Slack',
 *   requestId: 'req_123',
 *   latencyMs: 234,
 *   originalInput: { channel: '#general', text: 'Hello!' },
 *   responseData: { ok: true, ts: '1234567890.123456', channel: 'C123' },
 *   resolvedInputs: { channel: { original: '#general', resolved: 'C123' } },
 * });
 * ```
 */
export function formatSuccessResponse(input: SuccessFormatterInput): ToolSuccessResponse {
  // Detect action category
  const category = detectToolActionCategory(input.actionName);

  // Extract identifiers from response
  const ids = extractIdentifiers(input.responseData);

  // Generate summary
  const summary = generateSummary(input, category, ids);

  // Generate message using template
  const messageTemplate = MESSAGE_TEMPLATES[category];
  const message = messageTemplate(input, summary);

  // Generate next steps using template
  const nextStepsTemplate = NEXT_STEPS_TEMPLATES[category];
  const nextSteps = nextStepsTemplate(input, ids);

  // Build response
  const response: ToolSuccessResponse = {
    success: true,
    message,
    data: input.responseData,
    meta: {
      action: input.actionName,
      integration: input.integrationSlug,
      requestId: input.requestId,
      latencyMs: input.latencyMs,
    },
    nextSteps,
  };

  // Add context if we have resolved inputs
  if (input.resolvedInputs && Object.keys(input.resolvedInputs).length > 0) {
    response.context = {
      resolvedInputs: input.resolvedInputs,
    };
  }

  return response;
}

/**
 * Format a tool response message for direct use in LLM responses.
 * Combines the message and next steps into a single string.
 *
 * @param response - A tool success response
 * @returns A combined message string suitable for LLM output
 */
export function formatSuccessForLLM(response: ToolSuccessResponse): string {
  return `${response.message}\n\n${response.nextSteps}`;
}
