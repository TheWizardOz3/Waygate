/**
 * Tool Export Module
 *
 * Export Waygate actions as AI-consumable tool definitions compatible with
 * all major LLMs (OpenAI, Anthropic, Gemini) and tool frameworks (LangChain, MCP).
 *
 * Features:
 * - Universal format: LLM-agnostic tool definitions with flat JSON Schema
 * - Automatic schema flattening (no $ref, oneOf, anyOf)
 * - LLM-optimized descriptions in mini-prompt format
 * - Context type declarations for reference data injection
 * - Templates for common action types (CRUD, messaging, etc.)
 */

// =============================================================================
// Schemas - Export all types and validation schemas
// =============================================================================

export {
  // Schemas
  UniversalToolPropertySchema,
  UniversalToolParametersSchema,
  UniversalToolSchema,
  ToolExportResponseSchema,
  SingleToolExportResponseSchema,
  // Types
  type UniversalToolProperty,
  type UniversalToolParameters,
  type UniversalTool,
  type ToolExportResponse,
  type SingleToolExportResponse,
  type InputJsonSchema,
  type InputJsonSchemaProperty,
  // Error codes
  ToolExportErrorCodes,
  type ToolExportErrorCode,
  // Helpers
  generateToolName,
  isValidUniversalTool,
} from './tool-export.schemas';

// =============================================================================
// Universal Transformer - LLM-agnostic format
// =============================================================================

export {
  // Main transformation functions
  transformActionToUniversalTool,
  transformActionsToUniversalTools,
  transformInputSchemaToParameters,
  flattenSchemaProperty,
  // Types
  type TransformOptions,
  type TransformResult,
  type TransformError,
  // Utilities
  normalizeType,
  buildPropertyDescription,
} from './formats/universal.transformer';

// =============================================================================
// LangChain Transformer - LangChain-compatible format
// =============================================================================

export {
  // Main transformation functions
  transformToLangChainTool,
  transformToLangChainTools,
  transformUniversalExportToLangChain,
  // Code generation
  generateTypeScriptSnippet,
  generatePythonSnippet,
  // Types
  type LangChainTool,
  type LangChainToolSchema,
  type LangChainPropertySchema,
  type LangChainExportResponse,
  type LangChainTransformOptions,
} from './formats/langchain.transformer';

// =============================================================================
// MCP Transformer - Model Context Protocol format
// =============================================================================

export {
  // Main transformation functions
  transformToMCPTool,
  transformToMCPTools,
  transformUniversalExportToMCP,
  generateMCPResources,
  // Code generation
  generateMCPServerFile,
  generatePackageJson,
  generateClaudeDesktopConfig,
  // Types
  type MCPTool,
  type MCPInputSchema,
  type MCPPropertySchema,
  type MCPResource,
  type MCPServerCapabilities,
  type MCPServerDefinition,
  type MCPExportResponse,
  type MCPTransformOptions,
} from './formats/mcp.transformer';

// =============================================================================
// Description Builder - LLM-optimized mini-prompt format
// =============================================================================

export {
  // Main builder functions
  buildToolDescription,
  buildSimpleDescription,
  // Types
  type DescriptionBuilderOptions,
  type ActionCategory,
  // Utilities
  detectActionCategory,
  extractResourceType,
  // Templates
  type TemplateContext,
  type DescriptionTemplate,
  getTemplateForCategory,
  DESCRIPTION_TEMPLATES,
} from './descriptions';

// =============================================================================
// Service - Business logic and API operations
// =============================================================================

export {
  // Error class
  ToolExportError,
  // Types
  type ExportToolsOptions,
  type LangChainExportOptions,
  type MCPExportOptions,
  // Universal export
  exportIntegrationToolsUniversal,
  exportActionToolUniversal,
  // LangChain export
  exportIntegrationToolsLangChain,
  // MCP export
  exportIntegrationToolsMCP,
  // Utilities
  getAvailableExportFormats,
} from './tool-export.service';

// =============================================================================
// Handlers - Context resolution and invocation utilities
// =============================================================================

export {
  // Context resolution
  resolveContextReferences,
  formatResolutionDetails,
  hasResolvableContext,
  getContextTypes,
  generateFieldHints,
  DEFAULT_FIELD_HINTS,
  ResolutionContextSchema,
  // Types
  type ResolutionContext,
  type ContextItem,
  type ResolvedValue,
  type ContextResolutionResult,
} from './handlers';

// =============================================================================
// Response Formatters - Agent-readable response formatting
// =============================================================================

export {
  // Response Schemas
  ToolResponseMetaSchema,
  ResolvedInputFieldSchema,
  ToolResolvedInputsSchema,
  ToolSuccessContextSchema,
  ToolSuccessResponseSchema,
  ToolErrorDetailsSchema,
  ToolErrorContextSchema,
  ToolErrorResponseSchema,
  ToolResponseSchema,
  // Response Types
  type ToolResponseMeta,
  type ResolvedInputField,
  type ToolResolvedInputs,
  type ToolSuccessContext,
  type ToolSuccessResponse,
  type ToolErrorDetails,
  type ToolErrorContext,
  type ToolErrorResponse,
  type ToolResponse,
  // Formatter Input Types
  type SuccessFormatterInput,
  type ErrorFormatterInput,
  // Action Categories
  type ToolActionCategory,
  detectToolActionCategory,
  // Success Formatter
  formatSuccessResponse,
  formatSuccessForLLM,
  // Error Formatter
  formatErrorResponse,
  formatErrorForLLM,
  createErrorInputFromGateway,
  GATEWAY_ERROR_CODES,
} from './responses';
