/**
 * Description Builder
 *
 * Builds LLM-optimized tool descriptions in the mini-prompt format.
 * These descriptions help AI models understand exactly when and how to use each tool,
 * what inputs are required/optional, and what output to expect.
 *
 * Mini-prompt format:
 * ```
 * Use this tool to {what the tool does}.
 *
 * # Required inputs:
 * - {input_name}: {description with type, constraints}
 *
 * # Optional inputs (include when {condition}):
 * - {input_name}: {description with when to include}
 *
 * # Context available:
 * {List of context types available for resolution}
 *
 * # What the tool outputs:
 * {Description of output format}
 * ```
 */

import type { ActionResponse, JsonSchema, JsonSchemaProperty } from '../../actions';
import type { UniversalToolParameters } from '../tool-export.schemas';
import {
  type ActionCategory,
  type TemplateContext,
  detectActionCategory,
  extractResourceType,
  getTemplateForCategory,
  applyOpeningTemplate,
  applyOutputTemplate,
  getTemplateHints,
} from './templates';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for building tool descriptions
 */
export interface DescriptionBuilderOptions {
  /** Maximum description length (will truncate if exceeded) */
  maxLength?: number;
  /** Include context type information in description */
  includeContextInfo?: boolean;
  /** Include output description section */
  includeOutputInfo?: boolean;
  /** Integration name for context */
  integrationName?: string;
  /** Context types available for this tool */
  contextTypes?: string[];
}

/**
 * Input parameter info extracted from schema
 */
interface ParameterInfo {
  name: string;
  description: string;
  type: string;
  isRequired: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
  enumValues?: (string | number | boolean)[];
  constraints: string[];
}

// =============================================================================
// Main Builder Function
// =============================================================================

/**
 * Build an LLM-optimized tool description in mini-prompt format.
 *
 * @param action - The action to build a description for
 * @param parameters - The transformed universal tool parameters
 * @param options - Builder options
 * @returns Formatted tool description
 */
export function buildToolDescription(
  action: ActionResponse,
  parameters: UniversalToolParameters,
  options: DescriptionBuilderOptions = {}
): string {
  const {
    maxLength = 2000,
    includeContextInfo = true,
    includeOutputInfo = true,
    integrationName = 'the service',
    contextTypes = [],
  } = options;

  // Detect action category and extract resource type
  const category = detectActionCategory(action.name, action.httpMethod, action.description);
  const resourceType = extractResourceType(action.name);

  // Build template context
  const templateContext: TemplateContext = {
    actionName: action.name,
    integrationName,
    httpMethod: action.httpMethod,
    category,
    resourceType,
    originalDescription: action.description,
    contextTypes,
    isPaginated: !!action.paginationConfig,
    isCacheable: action.cacheable,
  };

  // Get the template for this category
  const template = getTemplateForCategory(category);

  // Build description parts
  const parts: string[] = [];

  // 1. Opening line
  const opening = action.description
    ? buildOpeningFromDescription(action.description, category)
    : applyOpeningTemplate(template, templateContext);
  parts.push(opening);

  // 2. Extract parameter info
  const parameterInfos = extractParameterInfos(parameters, action.inputSchema);
  const requiredParams = parameterInfos.filter((p) => p.isRequired);
  const optionalParams = parameterInfos.filter((p) => !p.isRequired);

  // 3. Required inputs section
  if (requiredParams.length > 0) {
    parts.push('');
    parts.push('# Required inputs:');
    for (const param of requiredParams) {
      parts.push(`- ${param.name}: ${formatParameterDescription(param)}`);
    }
  }

  // 4. Optional inputs section
  if (optionalParams.length > 0) {
    parts.push('');
    parts.push('# Optional inputs:');
    for (const param of optionalParams) {
      parts.push(`- ${param.name}: ${formatParameterDescription(param)}`);
    }
  }

  // 5. Context information section
  if (includeContextInfo && contextTypes.length > 0) {
    parts.push('');
    parts.push('# Context available:');
    parts.push(formatContextTypes(contextTypes, category));
  }

  // 6. Output description section
  if (includeOutputInfo) {
    parts.push('');
    parts.push('# What the tool outputs:');
    parts.push(applyOutputTemplate(template, templateContext));
  }

  // 7. Additional hints from template
  const hints = getTemplateHints(template, templateContext);
  if (hints.length > 0) {
    // Include hints inline if there's room
    const hintsText = hints.map((h) => `Tip: ${h}`).join(' ');
    if (parts.join('\n').length + hintsText.length < maxLength - 100) {
      parts.push('');
      parts.push(hintsText);
    }
  }

  // Join and truncate if needed
  let description = parts.join('\n');
  if (description.length > maxLength) {
    description = truncateDescription(description, maxLength);
  }

  return description;
}

/**
 * Build a simple description (without full mini-prompt format).
 * Useful for contexts where brevity is preferred.
 */
export function buildSimpleDescription(
  action: ActionResponse,
  integrationName: string = 'the service'
): string {
  const category = detectActionCategory(action.name, action.httpMethod, action.description);
  const resourceType = extractResourceType(action.name);

  const templateContext: TemplateContext = {
    actionName: action.name,
    integrationName,
    httpMethod: action.httpMethod,
    category,
    resourceType,
    originalDescription: action.description,
  };

  const template = getTemplateForCategory(category);

  return action.description
    ? buildOpeningFromDescription(action.description, category)
    : applyOpeningTemplate(template, templateContext);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build opening line from existing description.
 */
function buildOpeningFromDescription(description: string, category: ActionCategory): string {
  // Clean up the description
  const cleaned = description.trim();

  // If description already starts with "Use this tool", use it as-is
  if (cleaned.toLowerCase().startsWith('use this tool')) {
    return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
  }

  // Otherwise, format it as "Use this tool to {description}"
  // Handle cases where description starts with a verb
  const verbPrefixes = ['get', 'list', 'create', 'update', 'delete', 'send', 'post', 'fetch'];
  const lowerCleaned = cleaned.toLowerCase();

  for (const prefix of verbPrefixes) {
    if (lowerCleaned.startsWith(prefix)) {
      const opening = `Use this tool to ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
      return opening.endsWith('.') ? opening : `${opening}.`;
    }
  }

  // For noun-starting descriptions (e.g., "A message in Slack")
  // Convert to "Use this tool to interact with {description}"
  if (category === 'get' || category === 'list') {
    return `Use this tool to retrieve ${cleaned.toLowerCase()}.`;
  }

  return (
    `Use this tool to ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`.replace(/\.$/, '') +
    '.'
  );
}

/**
 * Extract parameter info from the universal tool parameters.
 */
function extractParameterInfos(
  parameters: UniversalToolParameters,
  inputSchema: JsonSchema
): ParameterInfo[] {
  const infos: ParameterInfo[] = [];
  const requiredSet = new Set(parameters.required);

  for (const [name, prop] of Object.entries(parameters.properties)) {
    // Get additional info from original schema if available
    const originalProp = inputSchema.properties?.[name];

    const info: ParameterInfo = {
      name,
      description: prop.description,
      type: prop.type,
      isRequired: requiredSet.has(name),
      hasDefault: prop.default !== undefined,
      defaultValue: prop.default,
      enumValues: prop.enum,
      constraints: extractConstraints(originalProp),
    };

    infos.push(info);
  }

  // Sort: required first, then alphabetically
  return infos.sort((a, b) => {
    if (a.isRequired !== b.isRequired) {
      return a.isRequired ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Extract constraints from a schema property.
 */
function extractConstraints(prop?: JsonSchemaProperty): string[] {
  if (!prop) return [];

  const constraints: string[] = [];

  if (prop.minimum !== undefined) constraints.push(`min: ${prop.minimum}`);
  if (prop.maximum !== undefined) constraints.push(`max: ${prop.maximum}`);
  if (prop.minLength !== undefined) constraints.push(`min length: ${prop.minLength}`);
  if (prop.maxLength !== undefined) constraints.push(`max length: ${prop.maxLength}`);
  if (prop.pattern) constraints.push(`pattern: ${prop.pattern}`);
  if (prop.format) constraints.push(`format: ${prop.format}`);

  return constraints;
}

/**
 * Format a parameter description for display.
 */
function formatParameterDescription(param: ParameterInfo): string {
  const parts: string[] = [];

  // Start with the description, or generate one from the name
  if (param.description && param.description !== `The ${param.name}`) {
    parts.push(param.description);
  } else {
    // Generate description from name
    const readable = param.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .toLowerCase();
    parts.push(`The ${readable}`);
  }

  // Add type info if not already clear from description
  if (!parts[0].toLowerCase().includes(param.type)) {
    parts[0] += ` (${param.type})`;
  }

  // Add constraints
  if (param.constraints.length > 0) {
    parts.push(`[${param.constraints.join(', ')}]`);
  }

  // Add enum values (shortened if too many)
  if (param.enumValues && param.enumValues.length > 0) {
    if (param.enumValues.length <= 4) {
      parts.push(`Allowed: ${param.enumValues.join(', ')}`);
    } else {
      parts.push(
        `Allowed: ${param.enumValues.slice(0, 3).join(', ')}... (${param.enumValues.length} options)`
      );
    }
  }

  // Add default value
  if (param.hasDefault) {
    parts.push(`Default: ${JSON.stringify(param.defaultValue)}`);
  }

  return parts.join('. ').replace(/\.\./g, '.').trim();
}

/**
 * Format context types for description.
 */
function formatContextTypes(contextTypes: string[], category: ActionCategory): string {
  if (contextTypes.length === 0) return 'No context available.';

  const contextDescriptions: Record<string, string> = {
    users: 'User reference data for resolving usernames to IDs',
    channels: 'Channel reference data for resolving channel names (like "#general") to IDs',
    teams: 'Team reference data for resolving team names to IDs',
    groups: 'Group reference data for resolving group names to IDs',
    projects: 'Project reference data for resolving project names to IDs',
    repositories: 'Repository reference data for resolving repo names to IDs',
  };

  const lines = contextTypes.map((type) => {
    const desc = contextDescriptions[type] || `${type} reference data`;
    return `- ${type}: ${desc}`;
  });

  // Add usage hint based on category
  if (category === 'messaging' && contextTypes.includes('channels')) {
    lines.push(
      'When sending messages, you can use human-friendly names like "#general" and they will be resolved to IDs automatically.'
    );
  }

  return lines.join('\n');
}

/**
 * Truncate description to max length while preserving structure.
 */
function truncateDescription(description: string, maxLength: number): string {
  if (description.length <= maxLength) return description;

  // Try to truncate at a section boundary
  const sections = description.split(/\n(?=#)/);

  let result = '';
  for (const section of sections) {
    if (result.length + section.length + 1 > maxLength - 3) {
      break;
    }
    result += (result ? '\n' : '') + section;
  }

  // If we couldn't fit even one section, hard truncate
  if (!result) {
    result = description.slice(0, maxLength - 3);
  }

  return result + '...';
}

// =============================================================================
// Exports
// =============================================================================

export { detectActionCategory, extractResourceType, type ActionCategory, type ParameterInfo };
