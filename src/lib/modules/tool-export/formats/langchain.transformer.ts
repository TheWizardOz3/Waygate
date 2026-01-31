/**
 * LangChain Tool Transformer
 *
 * Transforms Waygate universal tools into LangChain-compatible tool definitions.
 * LangChain tools use JSON Schema for parameter definitions and can be used with
 * DynamicStructuredTool or StructuredTool classes.
 *
 * Key features:
 * - JSON Schema parameters compatible with LangChain's schema validation
 * - Handler code generation for invoking Waygate Gateway API
 * - TypeScript type definitions for better DX
 */

import type {
  UniversalTool,
  UniversalToolParameters,
  ToolExportResponse,
} from '../tool-export.schemas';

// =============================================================================
// LangChain Tool Types
// =============================================================================

/**
 * LangChain-compatible tool definition
 */
export interface LangChainTool {
  /** Tool name (same as universal format) */
  name: string;
  /** Tool description (same as universal format) */
  description: string;
  /** JSON Schema for input parameters */
  schema: LangChainToolSchema;
  /** Context types this tool can use */
  contextTypes?: string[];
}

/**
 * JSON Schema format for LangChain parameters
 */
export interface LangChainToolSchema {
  type: 'object';
  properties: Record<string, LangChainPropertySchema>;
  required: string[];
  additionalProperties?: boolean;
}

/**
 * Property schema in LangChain format
 */
export interface LangChainPropertySchema {
  type: string;
  description: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: LangChainPropertySchema;
  properties?: Record<string, LangChainPropertySchema>;
  required?: string[];
}

/**
 * LangChain export response
 */
export interface LangChainExportResponse {
  /** Integration metadata */
  integration: {
    id: string;
    slug: string;
    name: string;
  };
  /** Exported tools in LangChain format */
  tools: LangChainTool[];
  /** Available context types for this integration */
  contextTypes: string[];
  /** Export format metadata */
  format: {
    name: 'langchain';
    version: '1.0';
    compatibleWith: string[];
  };
  /** Code snippets for integration */
  codeSnippets: {
    /** TypeScript/JavaScript usage example */
    typescript: string;
    /** Python usage example */
    python: string;
  };
}

// =============================================================================
// Transform Options
// =============================================================================

/**
 * Options for LangChain transformation
 */
export interface LangChainTransformOptions {
  /** Waygate API base URL for code generation */
  apiBaseUrl?: string;
  /** Include code snippets in response */
  includeCodeSnippets?: boolean;
}

// =============================================================================
// Main Transformer
// =============================================================================

/**
 * Transform a universal tool to LangChain format.
 *
 * @param tool - Universal tool to transform
 * @returns LangChain-compatible tool
 */
export function transformToLangChainTool(tool: UniversalTool): LangChainTool {
  return {
    name: tool.name,
    description: tool.description,
    schema: transformParametersToSchema(tool.parameters),
    ...(tool.contextTypes && tool.contextTypes.length > 0
      ? { contextTypes: tool.contextTypes }
      : {}),
  };
}

/**
 * Transform multiple universal tools to LangChain format.
 *
 * @param tools - Array of universal tools
 * @returns Array of LangChain tools
 */
export function transformToLangChainTools(tools: UniversalTool[]): LangChainTool[] {
  return tools.map(transformToLangChainTool);
}

/**
 * Transform a universal tool export response to LangChain format.
 *
 * @param universalExport - Universal format export response
 * @param options - Transform options
 * @returns LangChain export response
 */
export function transformUniversalExportToLangChain(
  universalExport: ToolExportResponse,
  options: LangChainTransformOptions = {}
): LangChainExportResponse {
  const { apiBaseUrl = 'https://app.waygate.dev', includeCodeSnippets = true } = options;

  const langchainTools = transformToLangChainTools(universalExport.tools);

  return {
    integration: universalExport.integration,
    tools: langchainTools,
    contextTypes: universalExport.contextTypes,
    format: {
      name: 'langchain',
      version: '1.0',
      compatibleWith: ['langchain-js', 'langchain-python', 'llamaindex'],
    },
    codeSnippets: includeCodeSnippets
      ? {
          typescript: generateTypeScriptSnippet(universalExport.integration.slug, apiBaseUrl),
          python: generatePythonSnippet(universalExport.integration.slug, apiBaseUrl),
        }
      : { typescript: '', python: '' },
  };
}

// =============================================================================
// Schema Transformation
// =============================================================================

/**
 * Transform universal parameters to LangChain schema format.
 */
function transformParametersToSchema(params: UniversalToolParameters): LangChainToolSchema {
  const properties: Record<string, LangChainPropertySchema> = {};

  for (const [propName, propSchema] of Object.entries(params.properties)) {
    properties[propName] = transformPropertySchema(propSchema);
  }

  return {
    type: 'object',
    properties,
    required: params.required,
    additionalProperties: false,
  };
}

/**
 * Transform a universal property to LangChain property schema.
 */
function transformPropertySchema(prop: {
  type: string;
  description: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: { type: string; description?: string };
  properties?: Record<string, unknown>;
  required?: string[];
}): LangChainPropertySchema {
  const schema: LangChainPropertySchema = {
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
    const nestedProps: Record<string, LangChainPropertySchema> = {};
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
 * Generate TypeScript usage snippet for LangChain integration.
 */
export function generateTypeScriptSnippet(integrationSlug: string, apiBaseUrl: string): string {
  return `// LangChain TypeScript Integration for ${integrationSlug}
import { DynamicStructuredTool } from '@langchain/core/tools';

// Fetch tools from Waygate
const response = await fetch(
  '${apiBaseUrl}/api/v1/integrations/${integrationSlug}/tools/langchain',
  { headers: { Authorization: \`Bearer \${WAYGATE_API_KEY}\` } }
);
const { tools, contextTypes } = await response.json();

// Optionally fetch reference data for context injection
const refDataResponse = await fetch(
  '${apiBaseUrl}/api/v1/integrations/${integrationSlug}/reference-data',
  { headers: { Authorization: \`Bearer \${WAYGATE_API_KEY}\` } }
);
const referenceData = await refDataResponse.json();

// Create LangChain tools with Waygate invocation
const langchainTools = tools.map((tool) =>
  new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema, // JSON Schema format
    func: async (params) => {
      const result = await fetch('${apiBaseUrl}/api/v1/tools/invoke', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${WAYGATE_API_KEY}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: tool.name,
          params,
          context: referenceData, // Inject reference data for name resolution
        }),
      });
      const response = await result.json();

      // Return agent-readable message with next steps
      return response.success
        ? \`\${response.message}\\n\\n\${response.nextSteps}\`
        : \`\${response.message}\\n\\n\${response.remediation}\`;
    },
  })
);

// Use with your agent
// agent.tools = langchainTools;`;
}

/**
 * Generate Python usage snippet for LangChain integration.
 */
export function generatePythonSnippet(integrationSlug: string, apiBaseUrl: string): string {
  return `# LangChain Python Integration for ${integrationSlug}
import requests
from langchain.tools import StructuredTool
from pydantic import BaseModel, create_model
from typing import Any, Dict

# Fetch tools from Waygate
response = requests.get(
    "${apiBaseUrl}/api/v1/integrations/${integrationSlug}/tools/langchain",
    headers={"Authorization": f"Bearer {WAYGATE_API_KEY}"}
)
tools_data = response.json()

# Optionally fetch reference data for context injection
ref_response = requests.get(
    "${apiBaseUrl}/api/v1/integrations/${integrationSlug}/reference-data",
    headers={"Authorization": f"Bearer {WAYGATE_API_KEY}"}
)
reference_data = ref_response.json()

def create_waygate_tool(tool_def: Dict[str, Any]) -> StructuredTool:
    """Create a LangChain tool from a Waygate tool definition."""

    def invoke_tool(**kwargs) -> str:
        result = requests.post(
            "${apiBaseUrl}/api/v1/tools/invoke",
            headers={
                "Authorization": f"Bearer {WAYGATE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "tool": tool_def["name"],
                "params": kwargs,
                "context": reference_data,
            },
        )
        response = result.json()

        # Return agent-readable message with next steps
        if response.get("success"):
            return f"{response['message']}\\n\\n{response['nextSteps']}"
        else:
            return f"{response['message']}\\n\\n{response['remediation']}"

    return StructuredTool.from_function(
        func=invoke_tool,
        name=tool_def["name"],
        description=tool_def["description"],
    )

# Create LangChain tools
langchain_tools = [create_waygate_tool(tool) for tool in tools_data["tools"]]

# Use with your agent
# agent = create_react_agent(llm, langchain_tools, ...)`;
}
