/**
 * Description Templates for Common Action Types
 *
 * Pre-defined templates for generating LLM-optimized descriptions based on
 * action categories. These templates provide consistent, well-structured
 * descriptions that help LLMs understand when and how to use each tool.
 */

import type { HttpMethod } from '../../actions';

// =============================================================================
// Types
// =============================================================================

/**
 * Action category for template selection
 */
export type ActionCategory =
  | 'messaging'
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'delete'
  | 'search'
  | 'upload'
  | 'download'
  | 'auth'
  | 'generic';

/**
 * Template context for building descriptions
 */
export interface TemplateContext {
  /** Action name (human readable) */
  actionName: string;
  /** Integration name (e.g., "Slack", "GitHub") */
  integrationName: string;
  /** HTTP method */
  httpMethod: HttpMethod;
  /** Action category */
  category: ActionCategory;
  /** Resource type being operated on (e.g., "message", "user", "channel") */
  resourceType: string;
  /** Original action description if available */
  originalDescription?: string;
  /** Available context types (e.g., ["users", "channels"]) */
  contextTypes?: string[];
  /** Whether the action is paginated */
  isPaginated?: boolean;
  /** Whether the action is cacheable */
  isCacheable?: boolean;
}

/**
 * Description template structure
 */
export interface DescriptionTemplate {
  /** Opening line pattern */
  opening: (ctx: TemplateContext) => string;
  /** Output description pattern */
  outputDescription: (ctx: TemplateContext) => string;
  /** Additional hints for specific categories */
  additionalHints?: (ctx: TemplateContext) => string[];
}

// =============================================================================
// Category Detection
// =============================================================================

/**
 * Detect action category from name, description, and HTTP method.
 */
export function detectActionCategory(
  actionName: string,
  httpMethod: HttpMethod,
  description?: string
): ActionCategory {
  const nameLower = actionName.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const combined = `${nameLower} ${descLower}`;

  // Messaging patterns
  if (
    combined.includes('send message') ||
    combined.includes('post message') ||
    combined.includes('send notification') ||
    combined.includes('send email') ||
    combined.includes('send dm') ||
    combined.includes('direct message')
  ) {
    return 'messaging';
  }

  // Search patterns
  if (combined.includes('search') || combined.includes('find') || combined.includes('query')) {
    return 'search';
  }

  // Upload patterns
  if (combined.includes('upload') || combined.includes('attach') || combined.includes('import')) {
    return 'upload';
  }

  // Download patterns
  if (combined.includes('download') || combined.includes('export')) {
    return 'download';
  }

  // Auth patterns
  if (
    combined.includes('login') ||
    combined.includes('logout') ||
    combined.includes('authenticate') ||
    combined.includes('authorize') ||
    combined.includes('token')
  ) {
    return 'auth';
  }

  // CRUD patterns based on HTTP method and naming
  switch (httpMethod) {
    case 'GET':
      if (
        combined.includes('list') ||
        nameLower.startsWith('list') ||
        nameLower.startsWith('get all') ||
        nameLower.endsWith('s') // plural usually means list
      ) {
        return 'list';
      }
      return 'get';

    case 'POST':
      if (combined.includes('create') || combined.includes('add') || combined.includes('new')) {
        return 'create';
      }
      // POST can also be for other operations
      return 'create';

    case 'PUT':
    case 'PATCH':
      return 'update';

    case 'DELETE':
      return 'delete';

    default:
      return 'generic';
  }
}

/**
 * Extract resource type from action name.
 * e.g., "sendMessage" -> "message", "listUsers" -> "user"
 */
export function extractResourceType(actionName: string): string {
  const nameLower = actionName.toLowerCase();

  // Common patterns: listUsers -> user, getMessage -> message, createChannel -> channel
  const patterns = [
    /^(?:list|get|create|update|delete|send|post|fetch|search|find)\s*(.+?)s?$/i,
    /^(.+?)\s*(?:list|get|create|update|delete|send|post|fetch|search|find)$/i,
    /^(.+?)$/,
  ];

  for (const pattern of patterns) {
    const match = nameLower.match(pattern);
    if (match && match[1]) {
      // Remove trailing 's' for plurals and clean up
      let resource = match[1].trim();
      if (resource.endsWith('s') && resource.length > 2) {
        resource = resource.slice(0, -1);
      }
      return resource || 'resource';
    }
  }

  return 'resource';
}

// =============================================================================
// Description Templates
// =============================================================================

/**
 * Templates for each action category
 */
export const DESCRIPTION_TEMPLATES: Record<ActionCategory, DescriptionTemplate> = {
  messaging: {
    opening: (ctx) => `Use this tool to send a ${ctx.resourceType} through ${ctx.integrationName}.`,
    outputDescription: (ctx) =>
      `Returns the sent ${ctx.resourceType} details including ID, timestamp, and delivery status. Use the ID if you need to reference, update, or delete this ${ctx.resourceType} later.`,
    additionalHints: (ctx) => {
      const hints: string[] = [];
      if (ctx.contextTypes?.includes('channels')) {
        hints.push(
          'Use reference data to resolve human-friendly channel names (like "#general") to IDs.'
        );
      }
      if (ctx.contextTypes?.includes('users')) {
        hints.push('Use reference data to resolve usernames to user IDs when needed.');
      }
      return hints;
    },
  },

  list: {
    opening: (ctx) =>
      `Use this tool to retrieve a list of ${ctx.resourceType}s from ${ctx.integrationName}.`,
    outputDescription: (ctx) => {
      let desc = `Returns an array of ${ctx.resourceType} objects with their IDs and properties.`;
      if (ctx.isPaginated) {
        desc += ' Results may be paginated - check for pagination metadata to retrieve more.';
      }
      return desc;
    },
    additionalHints: () => [
      'Use filters to narrow down results when looking for specific items.',
      'Results are typically sorted by most recent first.',
    ],
  },

  get: {
    opening: (ctx) =>
      `Use this tool to retrieve details about a specific ${ctx.resourceType} from ${ctx.integrationName}.`,
    outputDescription: (ctx) =>
      `Returns the full ${ctx.resourceType} object with all available properties and metadata.`,
    additionalHints: (ctx) => {
      const hints: string[] = [];
      if (ctx.isCacheable) {
        hints.push('This data may be cached - results reflect the state at fetch time.');
      }
      return hints;
    },
  },

  create: {
    opening: (ctx) =>
      `Use this tool to create a new ${ctx.resourceType} in ${ctx.integrationName}.`,
    outputDescription: (ctx) =>
      `Returns the created ${ctx.resourceType} with its assigned ID and any server-generated fields. Save the ID if you need to reference or modify this ${ctx.resourceType} later.`,
    additionalHints: () => [
      'All required fields must be provided - the tool will fail if required data is missing.',
    ],
  },

  update: {
    opening: (ctx) =>
      `Use this tool to update an existing ${ctx.resourceType} in ${ctx.integrationName}.`,
    outputDescription: (ctx) =>
      `Returns the updated ${ctx.resourceType} reflecting the changes made. Only fields you specify will be updated.`,
    additionalHints: () => [
      'You must have the ID of the item to update.',
      'Only include fields you want to change - omitted fields remain unchanged.',
    ],
  },

  delete: {
    opening: (ctx) => `Use this tool to delete a ${ctx.resourceType} from ${ctx.integrationName}.`,
    outputDescription: () =>
      `Returns confirmation of the deletion. This action is typically irreversible.`,
    additionalHints: () => [
      'Ensure you have the correct ID before deleting.',
      'This action cannot be undone in most cases.',
    ],
  },

  search: {
    opening: (ctx) =>
      `Use this tool to search for ${ctx.resourceType}s in ${ctx.integrationName} matching specific criteria.`,
    outputDescription: (ctx) => {
      let desc = `Returns ${ctx.resourceType}s matching your search criteria, ranked by relevance.`;
      if (ctx.isPaginated) {
        desc += ' Results may be paginated for large result sets.';
      }
      return desc;
    },
    additionalHints: () => [
      'Use specific search terms for more accurate results.',
      'Combine multiple filters to narrow down results.',
    ],
  },

  upload: {
    opening: (ctx) => `Use this tool to upload a ${ctx.resourceType} to ${ctx.integrationName}.`,
    outputDescription: (ctx) =>
      `Returns the uploaded ${ctx.resourceType} details including URL or reference for accessing it later.`,
    additionalHints: () => [
      'Ensure the file format is supported.',
      'Large files may take longer to process.',
    ],
  },

  download: {
    opening: (ctx) =>
      `Use this tool to download a ${ctx.resourceType} from ${ctx.integrationName}.`,
    outputDescription: () =>
      `Returns the file content or a download URL depending on the file type.`,
    additionalHints: () => [
      'Large files may be returned as download URLs instead of direct content.',
    ],
  },

  auth: {
    opening: (ctx) =>
      `Use this tool to perform authentication operations with ${ctx.integrationName}.`,
    outputDescription: () =>
      `Returns authentication status and tokens if applicable. Handle these securely.`,
    additionalHints: () => [
      'Authentication tokens should be handled securely.',
      'Tokens may have expiration times.',
    ],
  },

  generic: {
    opening: (ctx) =>
      ctx.originalDescription
        ? `Use this tool to ${ctx.originalDescription.charAt(0).toLowerCase()}${ctx.originalDescription.slice(1).replace(/\.$/, '')}.`
        : `Use this tool to perform a ${ctx.actionName.replace(/([A-Z])/g, ' $1').toLowerCase()} operation with ${ctx.integrationName}.`,
    outputDescription: () =>
      'Returns the operation result. Check the response structure for available data.',
    additionalHints: () => [],
  },
};

// =============================================================================
// Template Application
// =============================================================================

/**
 * Get the description template for an action category.
 */
export function getTemplateForCategory(category: ActionCategory): DescriptionTemplate {
  return DESCRIPTION_TEMPLATES[category];
}

/**
 * Apply a template to generate the opening line.
 */
export function applyOpeningTemplate(
  template: DescriptionTemplate,
  context: TemplateContext
): string {
  return template.opening(context);
}

/**
 * Apply a template to generate the output description.
 */
export function applyOutputTemplate(
  template: DescriptionTemplate,
  context: TemplateContext
): string {
  return template.outputDescription(context);
}

/**
 * Get additional hints from a template.
 */
export function getTemplateHints(
  template: DescriptionTemplate,
  context: TemplateContext
): string[] {
  return template.additionalHints?.(context) || [];
}
