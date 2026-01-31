/**
 * Tool Description Generator
 *
 * Generates LLM-optimized tool descriptions, success templates, and error templates
 * using AI at action creation/import time. These are stored with the action and
 * used at tool export time for high-quality, contextually-aware descriptions.
 *
 * The generated descriptions follow the mini-prompt format:
 * - Opening line explaining what the tool does
 * - Required inputs with guidance on what to pass
 * - Optional inputs with when to include them
 * - Context available for name/ID resolution
 * - What the tool outputs and how to use it
 */

import { getLLM } from '../../ai/llm/client';
import type { LLMResponseSchema } from '../../ai/llm/types';
import type { JsonSchema } from '../../actions';

// =============================================================================
// Types
// =============================================================================

/**
 * Input for generating tool descriptions
 */
export interface ToolDescriptionInput {
  /** Action name (human readable) */
  actionName: string;
  /** Action slug (for tool naming) */
  actionSlug: string;
  /** Action description from API docs */
  actionDescription?: string;
  /** HTTP method */
  httpMethod: string;
  /** Endpoint template */
  endpointTemplate: string;
  /** Input schema (parameters) */
  inputSchema: JsonSchema;
  /** Output schema (response) */
  outputSchema: JsonSchema;
  /** Integration name */
  integrationName: string;
  /** Integration slug */
  integrationSlug: string;
  /** Available context types for reference data */
  contextTypes?: string[];
  /** Tags for additional context */
  tags?: string[];
}

/**
 * Generated tool descriptions
 */
export interface GeneratedToolDescriptions {
  /** LLM-optimized mini-prompt description */
  toolDescription: string;
  /** Template for formatting successful responses */
  toolSuccessTemplate: string;
  /** Template for formatting error responses */
  toolErrorTemplate: string;
}

// =============================================================================
// Response Schema for LLM
// =============================================================================

const TOOL_DESCRIPTION_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    toolDescription: {
      type: 'string',
      description: 'LLM-optimized tool description in mini-prompt format',
      maxLength: 2000,
    },
    toolSuccessTemplate: {
      type: 'string',
      description: 'Template for formatting successful tool responses',
      maxLength: 1000,
    },
    toolErrorTemplate: {
      type: 'string',
      description: 'Template for formatting error responses',
      maxLength: 1000,
    },
  },
  required: ['toolDescription', 'toolSuccessTemplate', 'toolErrorTemplate'],
};

// =============================================================================
// Prompts
// =============================================================================

const SYSTEM_PROMPT = `You are an expert at writing tool descriptions for AI agents. Your goal is to create clear, actionable descriptions that help AI agents understand:
1. What the tool does
2. What inputs are required and what values to pass
3. What the tool outputs and how to use the response

You write in a direct, technical style without unnecessary words. You follow the mini-prompt format exactly.`;

function buildGenerationPrompt(input: ToolDescriptionInput): string {
  const inputSchemaStr = JSON.stringify(input.inputSchema, null, 2);
  const outputSchemaStr = JSON.stringify(input.outputSchema, null, 2);

  return `Generate a tool description, success template, and error template for this API action.

## Action Details
- **Name**: ${input.actionName}
- **Integration**: ${input.integrationName}
- **HTTP Method**: ${input.httpMethod}
- **Endpoint**: ${input.endpointTemplate}
- **Description**: ${input.actionDescription || 'No description provided'}
${input.tags?.length ? `- **Tags**: ${input.tags.join(', ')}` : ''}
${input.contextTypes?.length ? `- **Available Context**: ${input.contextTypes.join(', ')} (for name-to-ID resolution)` : ''}

## Input Schema (Parameters)
\`\`\`json
${inputSchemaStr}
\`\`\`

## Output Schema (Response)
\`\`\`json
${outputSchemaStr}
\`\`\`

## Instructions

### For toolDescription:
Write a mini-prompt format description following this structure:

\`\`\`
Use this tool to {what it does in actionable terms}.

# Required inputs:
- {param_name}: {Clear guidance on what value to pass, including examples and format hints}

# Optional inputs (include when {specific condition}):
- {param_name}: {When and why to include this parameter}

${
  input.contextTypes?.length
    ? `# Context available:
{Explain how reference data can be used to resolve names to IDs}

`
    : ''
}# What the tool outputs:
{Description of key response fields and how to use them}
\`\`\`

Guidelines for the description:
- Start with "Use this tool to..." followed by an imperative verb
- For each parameter, explain WHAT value to pass, not just the type
- Include format examples (e.g., "channel ID starts with 'C'", "timestamp in Unix format")
- Mention constraints, defaults, and allowed values
- For the output section, describe the key fields an agent would need to use
- Keep the total description under 2000 characters

### For toolSuccessTemplate:
Create a template that will be filled in when the tool succeeds. Use placeholders like:
- {{action_name}} - The action that was performed
- {{resource_type}} - The type of resource (message, user, channel, etc.)
- {{key_id}} - A key identifier from the response (ID, timestamp, etc.)
- {{summary}} - A brief summary of what was done

Example: "## Sent {{resource_type}} successfully\\n\\n{{summary}}\\n\\nID: {{key_id}}"

### For toolErrorTemplate:
Create a template for error responses. Use placeholders like:
- {{error_type}} - Category of error (validation, not_found, auth, etc.)
- {{error_message}} - The specific error message
- {{attempted_action}} - What was attempted
- {{remediation}} - How to fix the issue

Example: "## {{error_type}} Error\\n\\n{{error_message}}\\n\\n**How to fix:**\\n{{remediation}}"

Generate all three fields now.`;
}

// =============================================================================
// Generator Function
// =============================================================================

/**
 * Generate LLM-optimized tool descriptions for an action.
 *
 * This should be called at action creation/import time, and the results
 * stored in the action's toolDescription, toolSuccessTemplate, and
 * toolErrorTemplate fields.
 *
 * @param input - Action details for generating descriptions
 * @returns Generated descriptions
 *
 * @example
 * ```ts
 * const descriptions = await generateToolDescriptions({
 *   actionName: 'Send Message',
 *   actionSlug: 'send-message',
 *   actionDescription: 'Sends a message to a channel or user',
 *   httpMethod: 'POST',
 *   endpointTemplate: '/chat.postMessage',
 *   inputSchema: { ... },
 *   outputSchema: { ... },
 *   integrationName: 'Slack',
 *   integrationSlug: 'slack',
 *   contextTypes: ['channels', 'users'],
 * });
 *
 * // Store with the action
 * await prisma.action.update({
 *   where: { id: actionId },
 *   data: {
 *     toolDescription: descriptions.toolDescription,
 *     toolSuccessTemplate: descriptions.toolSuccessTemplate,
 *     toolErrorTemplate: descriptions.toolErrorTemplate,
 *   },
 * });
 * ```
 */
export async function generateToolDescriptions(
  input: ToolDescriptionInput
): Promise<GeneratedToolDescriptions> {
  const llm = getLLM('gemini-3-flash'); // Use fast model for description generation

  const prompt = buildGenerationPrompt(input);

  const result = await llm.generate<GeneratedToolDescriptions>(prompt, {
    systemInstruction: SYSTEM_PROMPT,
    responseSchema: TOOL_DESCRIPTION_SCHEMA,
    temperature: 0.3, // Low temperature for consistent, factual output
    maxOutputTokens: 4000,
  });

  return result.content;
}

/**
 * Generate tool descriptions for multiple actions in batch.
 * Processes in parallel for efficiency.
 *
 * @param inputs - Array of action details
 * @param concurrency - Max concurrent generations (default: 3)
 * @returns Array of results with action slug and descriptions or error
 */
export async function generateToolDescriptionsBatch(
  inputs: ToolDescriptionInput[],
  concurrency: number = 3
): Promise<
  Array<{
    actionSlug: string;
    success: boolean;
    descriptions?: GeneratedToolDescriptions;
    error?: string;
  }>
> {
  const results: Array<{
    actionSlug: string;
    success: boolean;
    descriptions?: GeneratedToolDescriptions;
    error?: string;
  }> = [];

  // Process in batches to respect concurrency
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (input) => {
        const descriptions = await generateToolDescriptions(input);
        return { actionSlug: input.actionSlug, descriptions };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push({
          actionSlug: result.value.actionSlug,
          success: true,
          descriptions: result.value.descriptions,
        });
      } else {
        // Find the corresponding input for this failed result
        const failedIndex = batchResults.indexOf(result);
        const failedInput = batch[failedIndex];
        results.push({
          actionSlug: failedInput?.actionSlug || 'unknown',
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  return results;
}

// =============================================================================
// Regeneration Helper
// =============================================================================

/**
 * Regenerate tool descriptions for an existing action.
 * Useful when the action's schema or description changes.
 */
export async function regenerateToolDescriptions(
  actionId: string,
  prismaClient: {
    action: {
      findUnique: (args: { where: { id: string }; include: { integration: true } }) => Promise<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        httpMethod: string;
        endpointTemplate: string;
        inputSchema: unknown;
        outputSchema: unknown;
        tags: string[];
        metadata: unknown;
        integration: { name: string; slug: string };
      } | null>;
      update: (args: {
        where: { id: string };
        data: {
          toolDescription: string;
          toolSuccessTemplate: string;
          toolErrorTemplate: string;
        };
      }) => Promise<unknown>;
    };
  }
): Promise<GeneratedToolDescriptions | null> {
  const action = await prismaClient.action.findUnique({
    where: { id: actionId },
    include: { integration: true },
  });

  if (!action) {
    return null;
  }

  // Extract context types from metadata if available
  const metadata = action.metadata as { referenceData?: { dataType?: string } } | null;
  const contextTypes: string[] = [];
  if (metadata?.referenceData?.dataType) {
    contextTypes.push(metadata.referenceData.dataType);
  }

  const descriptions = await generateToolDescriptions({
    actionName: action.name,
    actionSlug: action.slug,
    actionDescription: action.description || undefined,
    httpMethod: action.httpMethod,
    endpointTemplate: action.endpointTemplate,
    inputSchema: action.inputSchema as JsonSchema,
    outputSchema: action.outputSchema as JsonSchema,
    integrationName: action.integration.name,
    integrationSlug: action.integration.slug,
    contextTypes,
    tags: action.tags,
  });

  // Update the action with new descriptions
  await prismaClient.action.update({
    where: { id: actionId },
    data: {
      toolDescription: descriptions.toolDescription,
      toolSuccessTemplate: descriptions.toolSuccessTemplate,
      toolErrorTemplate: descriptions.toolErrorTemplate,
    },
  });

  return descriptions;
}
