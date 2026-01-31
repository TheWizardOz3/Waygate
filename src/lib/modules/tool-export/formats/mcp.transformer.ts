/**
 * MCP Tool Transformer
 *
 * Transforms Waygate universal tools into MCP (Model Context Protocol) compatible
 * tool definitions. MCP tools work with Claude Desktop and other MCP clients.
 *
 * Key features:
 * - MCP tool definitions with inputSchema
 * - Resources for reference data (channels, users, etc.)
 * - Server configuration generation
 * - Ready-to-use MCP server file generation
 */

import type {
  UniversalTool,
  UniversalToolParameters,
  ToolExportResponse,
} from '../tool-export.schemas';

// =============================================================================
// MCP Types (Based on @modelcontextprotocol/sdk)
// =============================================================================

/**
 * MCP tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: MCPInputSchema;
}

/**
 * MCP input schema (JSON Schema format)
 */
export interface MCPInputSchema {
  type: 'object';
  properties: Record<string, MCPPropertySchema>;
  required: string[];
}

/**
 * MCP property schema
 */
export interface MCPPropertySchema {
  type: string;
  description: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
  required?: string[];
}

/**
 * MCP resource definition for reference data
 */
export interface MCPResource {
  /** Resource URI (e.g., "waygate://slack/channels") */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description: string;
  /** MIME type */
  mimeType: string;
}

/**
 * MCP server capabilities
 */
export interface MCPServerCapabilities {
  tools: Record<string, never>;
  resources?: Record<string, never>;
}

/**
 * MCP server definition
 */
export interface MCPServerDefinition {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Server capabilities */
  capabilities: MCPServerCapabilities;
  /** Tool definitions */
  tools: MCPTool[];
  /** Resource definitions */
  resources: MCPResource[];
}

/**
 * MCP export response
 */
export interface MCPExportResponse {
  /** Integration metadata */
  integration: {
    id: string;
    slug: string;
    name: string;
  };
  /** MCP server definition */
  server: MCPServerDefinition;
  /** Export format metadata */
  format: {
    name: 'mcp';
    version: '1.0';
    compatibleWith: string[];
  };
  /** Generated server file content */
  serverFile: {
    /** TypeScript server file content */
    typescript: string;
    /** package.json content for the server */
    packageJson: string;
    /** Claude Desktop config snippet */
    claudeDesktopConfig: string;
  };
}

// =============================================================================
// Transform Options
// =============================================================================

/**
 * Options for MCP transformation
 */
export interface MCPTransformOptions {
  /** Waygate API base URL */
  apiBaseUrl?: string;
  /** Include server file generation */
  includeServerFile?: boolean;
  /** Include resources for reference data */
  includeResources?: boolean;
  /** Server version */
  serverVersion?: string;
}

// =============================================================================
// Main Transformer
// =============================================================================

/**
 * Transform a universal tool to MCP format.
 *
 * @param tool - Universal tool to transform
 * @returns MCP tool definition
 */
export function transformToMCPTool(tool: UniversalTool): MCPTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: transformParametersToInputSchema(tool.parameters),
  };
}

/**
 * Transform multiple universal tools to MCP format.
 *
 * @param tools - Array of universal tools
 * @returns Array of MCP tools
 */
export function transformToMCPTools(tools: UniversalTool[]): MCPTool[] {
  return tools.map(transformToMCPTool);
}

/**
 * Generate MCP resources from context types.
 *
 * @param integrationSlug - Integration slug for resource URIs
 * @param contextTypes - Available context types
 * @returns Array of MCP resources
 */
export function generateMCPResources(
  integrationSlug: string,
  contextTypes: string[]
): MCPResource[] {
  return contextTypes.map((contextType) => ({
    uri: `waygate://${integrationSlug}/${contextType}`,
    name: `${formatContextTypeName(contextType)} Reference Data`,
    description: `Reference data for ${contextType} - includes names and IDs for context resolution`,
    mimeType: 'application/json',
  }));
}

/**
 * Transform a universal tool export response to MCP format.
 *
 * @param universalExport - Universal format export response
 * @param options - Transform options
 * @returns MCP export response
 */
export function transformUniversalExportToMCP(
  universalExport: ToolExportResponse,
  options: MCPTransformOptions = {}
): MCPExportResponse {
  const {
    apiBaseUrl = 'https://app.waygate.dev',
    includeServerFile = true,
    includeResources = true,
    serverVersion = '1.0.0',
  } = options;

  const mcpTools = transformToMCPTools(universalExport.tools);
  const resources = includeResources
    ? generateMCPResources(universalExport.integration.slug, universalExport.contextTypes)
    : [];

  const server: MCPServerDefinition = {
    name: `waygate-${universalExport.integration.slug}`,
    version: serverVersion,
    capabilities: {
      tools: {},
      ...(resources.length > 0 ? { resources: {} } : {}),
    },
    tools: mcpTools,
    resources,
  };

  return {
    integration: universalExport.integration,
    server,
    format: {
      name: 'mcp',
      version: '1.0',
      compatibleWith: ['claude-desktop', 'mcp-client'],
    },
    serverFile: includeServerFile
      ? {
          typescript: generateMCPServerFile(
            universalExport.integration.slug,
            universalExport.integration.name,
            mcpTools,
            resources,
            apiBaseUrl,
            serverVersion
          ),
          packageJson: generatePackageJson(
            universalExport.integration.slug,
            universalExport.integration.name,
            serverVersion
          ),
          claudeDesktopConfig: generateClaudeDesktopConfig(universalExport.integration.slug),
        }
      : { typescript: '', packageJson: '', claudeDesktopConfig: '' },
  };
}

// =============================================================================
// Schema Transformation
// =============================================================================

/**
 * Transform universal parameters to MCP input schema format.
 */
function transformParametersToInputSchema(params: UniversalToolParameters): MCPInputSchema {
  const properties: Record<string, MCPPropertySchema> = {};

  for (const [propName, propSchema] of Object.entries(params.properties)) {
    properties[propName] = transformPropertySchema(propSchema);
  }

  return {
    type: 'object',
    properties,
    required: params.required,
  };
}

/**
 * Transform a universal property to MCP property schema.
 */
function transformPropertySchema(prop: {
  type: string;
  description: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: { type: string; description?: string };
  properties?: Record<string, unknown>;
  required?: string[];
}): MCPPropertySchema {
  const schema: MCPPropertySchema = {
    type: prop.type,
    description: prop.description,
  };

  if (prop.enum) {
    schema.enum = prop.enum;
  }

  if (prop.default !== undefined) {
    schema.default = prop.default;
  }

  // Handle array items
  if (prop.type === 'array' && prop.items) {
    schema.items = {
      type: prop.items.type,
      description: prop.items.description || '',
    };
  }

  // Handle nested objects
  if (prop.type === 'object' && prop.properties) {
    const nestedProps: Record<string, MCPPropertySchema> = {};
    for (const [nestedName, nestedSchema] of Object.entries(prop.properties)) {
      const nested = nestedSchema as {
        type: string;
        description: string;
        enum?: (string | number | boolean)[];
        default?: unknown;
      };
      nestedProps[nestedName] = transformPropertySchema(nested);
    }
    schema.properties = nestedProps;

    if (prop.required) {
      schema.required = prop.required;
    }
  }

  return schema;
}

// =============================================================================
// Code Generation
// =============================================================================

/**
 * Generate a complete MCP server file.
 */
export function generateMCPServerFile(
  integrationSlug: string,
  integrationName: string,
  tools: MCPTool[],
  resources: MCPResource[],
  apiBaseUrl: string,
  serverVersion: string
): string {
  const toolNames = tools.map((t) => t.name);

  return `/**
 * MCP Server for Waygate ${integrationName} Integration
 *
 * This server exposes ${integrationName} actions as MCP tools for use with
 * Claude Desktop and other MCP-compatible clients.
 *
 * Generated by Waygate Tool Export
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// Configuration
// =============================================================================

const WAYGATE_API_KEY = process.env.WAYGATE_API_KEY;
const WAYGATE_API_BASE = '${apiBaseUrl}';

if (!WAYGATE_API_KEY) {
  console.error('Error: WAYGATE_API_KEY environment variable is required');
  process.exit(1);
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS = ${JSON.stringify(tools, null, 2)};

const TOOL_NAMES = ${JSON.stringify(toolNames)};

// =============================================================================
// Resource Definitions
// =============================================================================

const RESOURCES = ${JSON.stringify(resources, null, 2)};

// Reference data cache
let referenceDataCache: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// API Functions
// =============================================================================

async function fetchReferenceData(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (referenceDataCache && now - cacheTimestamp < CACHE_TTL) {
    return referenceDataCache;
  }

  const response = await fetch(
    \`\${WAYGATE_API_BASE}/api/v1/integrations/${integrationSlug}/reference-data\`,
    {
      headers: { Authorization: \`Bearer \${WAYGATE_API_KEY}\` },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch reference data:', response.statusText);
    return {};
  }

  referenceDataCache = await response.json();
  cacheTimestamp = now;
  return referenceDataCache || {};
}

async function invokeWaygateAction(
  toolName: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; message: string; data?: unknown; nextSteps?: string; remediation?: string }> {
  const context = await fetchReferenceData();

  const response = await fetch(\`\${WAYGATE_API_BASE}/api/v1/tools/invoke\`, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${WAYGATE_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool: toolName,
      params,
      context,
    }),
  });

  if (!response.ok) {
    return {
      success: false,
      message: \`API request failed: \${response.statusText}\`,
      remediation: 'Check your Waygate API key and try again.',
    };
  }

  return response.json();
}

// =============================================================================
// MCP Server
// =============================================================================

const server = new Server(
  {
    name: 'waygate-${integrationSlug}',
    version: '${serverVersion}',
  },
  {
    capabilities: {
      tools: {},
      ${resources.length > 0 ? 'resources: {},' : ''}
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool invocation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!TOOL_NAMES.includes(name)) {
    return {
      content: [
        {
          type: 'text',
          text: \`Unknown tool: \${name}. Available tools: \${TOOL_NAMES.join(', ')}\`,
        },
      ],
      isError: true,
    };
  }

  const result = await invokeWaygateAction(name, args || {});

  // Format response for Claude
  const text = result.success
    ? \`\${result.message}\\n\\n\${result.nextSteps || ''}\`
    : \`\${result.message}\\n\\n\${result.remediation || ''}\`;

  return {
    content: [{ type: 'text', text: text.trim() }],
    isError: !result.success,
  };
});

${
  resources.length > 0
    ? `// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: RESOURCES };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Extract context type from URI (e.g., "waygate://slack/channels" -> "channels")
  const match = uri.match(/waygate:\\/\\/[^/]+\\/(.+)/);
  if (!match) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: 'Invalid resource URI format',
        },
      ],
    };
  }

  const contextType = match[1];
  const referenceData = await fetchReferenceData();
  const data = referenceData[contextType] || [];

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
});
`
    : ''
}
// =============================================================================
// Start Server
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Waygate ${integrationName} MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
`;
}

/**
 * Generate package.json for the MCP server.
 */
export function generatePackageJson(
  integrationSlug: string,
  integrationName: string,
  version: string
): string {
  const packageObj = {
    name: `waygate-${integrationSlug}-mcp`,
    version,
    description: `MCP server for Waygate ${integrationName} integration`,
    type: 'module',
    main: 'server.js',
    scripts: {
      build: 'tsc',
      start: 'node server.js',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  };

  return JSON.stringify(packageObj, null, 2);
}

/**
 * Generate Claude Desktop configuration snippet.
 */
export function generateClaudeDesktopConfig(integrationSlug: string): string {
  const config = {
    mcpServers: {
      [`waygate-${integrationSlug}`]: {
        command: 'node',
        args: ['server.js'],
        env: {
          WAYGATE_API_KEY: '${WAYGATE_API_KEY}',
        },
      },
    },
  };

  return `// Add this to your Claude Desktop config file:
// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
// Windows: %APPDATA%/Claude/claude_desktop_config.json

${JSON.stringify(config, null, 2)}

// Replace \${WAYGATE_API_KEY} with your actual Waygate API key`;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format context type name for display.
 */
function formatContextTypeName(contextType: string): string {
  // Handle common context types
  const specialCases: Record<string, string> = {
    users: 'Users',
    channels: 'Channels',
    teams: 'Teams',
    projects: 'Projects',
    repositories: 'Repositories',
    workspaces: 'Workspaces',
    folders: 'Folders',
    lists: 'Lists',
    boards: 'Boards',
  };

  if (specialCases[contextType.toLowerCase()]) {
    return specialCases[contextType.toLowerCase()];
  }

  // Default: capitalize first letter
  return contextType.charAt(0).toUpperCase() + contextType.slice(1);
}
