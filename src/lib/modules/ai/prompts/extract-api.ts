/**
 * API Documentation Extraction Prompts
 *
 * System prompts and structured output schemas for extracting
 * API information from documentation using AI.
 */

import type { LLMResponseSchema } from '../llm';

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Main system prompt for API documentation extraction
 */
export const API_EXTRACTION_SYSTEM_PROMPT = `You are an expert API documentation parser. Your task is to extract structured information from API documentation and return it in a precise JSON format.

## Your Capabilities
- Extract API endpoints, methods, parameters, and response schemas
- Identify authentication methods (OAuth2, API keys, Bearer tokens, etc.)
- Detect rate limits and usage quotas
- Infer missing information when documentation is incomplete

## Guidelines
1. **Be Precise**: Extract exact paths, method names, and parameter types
2. **Be Complete**: Include all endpoints you find, even if some fields are missing
3. **Be Consistent**: Use consistent naming conventions (snake_case for slugs)
4. **Handle Ambiguity**: When information is unclear, make reasonable assumptions and note low confidence
5. **Preserve Context**: Include descriptions and examples when available

## Output Format
Always return valid JSON matching the requested schema. Do not include markdown formatting or code blocks in your response.`;

/**
 * System prompt specifically for endpoint extraction
 * SIMPLIFIED: Only extracts flat endpoint objects (name, slug, method, path, description)
 */
export const ENDPOINT_EXTRACTION_SYSTEM_PROMPT = `You are an API endpoint extraction specialist. Extract API endpoints from documentation and return them as a JSON array.

## WHAT TO EXTRACT
For each endpoint, extract ONLY these 5 fields:
- **name**: Human-readable name (e.g., "Send Message", "List Users")
- **slug**: URL-safe identifier (e.g., "send-message", "list-users")  
- **method**: HTTP method (GET, POST, PUT, PATCH, DELETE)
- **path**: API path (e.g., "/users/{id}/messages")
- **description**: Brief description of what the endpoint does

## PRIORITIES
1. Skip deprecated endpoints
2. Focus on core CRUD operations and main features
3. Skip admin/internal endpoints unless specifically requested
4. Extract 10-30 of the most important endpoints

## OUTPUT FORMAT
Return ONLY a JSON array. No markdown, no explanations, no code blocks.

Example output:
[
  {"name": "List Users", "slug": "list-users", "method": "GET", "path": "/users", "description": "Returns all users"},
  {"name": "Get User", "slug": "get-user", "method": "GET", "path": "/users/{id}", "description": "Get a user by ID"},
  {"name": "Create User", "slug": "create-user", "method": "POST", "path": "/users", "description": "Creates a new user"}
]`;

/**
 * System prompt for authentication detection
 */
export const AUTH_DETECTION_SYSTEM_PROMPT = `You are an API authentication specialist. Analyze documentation to identify all supported authentication methods.

## Authentication Types to Detect:
1. **oauth2**: OAuth 2.0 flows (authorization code, client credentials, etc.)
2. **api_key**: API key authentication (header, query, or body)
3. **bearer**: Bearer token authentication
4. **basic**: HTTP Basic authentication
5. **custom_header**: Custom header-based authentication

## For Each Auth Method, Extract:
- **type**: The authentication type
- **config**: Configuration details (scopes, URLs, etc.)
- **location**: Where credentials are placed (header, query, body)
- **paramName**: The parameter/header name

## Common Patterns to Look For:
- "Authorization: Bearer {token}"
- "X-API-Key: {key}"
- "?api_key={key}"
- OAuth2 authorization URLs and token endpoints
- "Basic {base64(username:password)}"`;

/**
 * System prompt for rate limit detection
 */
export const RATE_LIMIT_DETECTION_SYSTEM_PROMPT = `You are an API rate limit specialist. Extract rate limiting information from documentation.

## Information to Extract:
- **requests**: Number of requests allowed
- **window**: Time window in seconds (convert from minutes/hours if needed)
- **scope**: Whether limits are per-endpoint, per-user, or global

## Common Patterns:
- "100 requests per minute" → { requests: 100, window: 60 }
- "1000 requests per hour" → { requests: 1000, window: 3600 }
- "10 requests per second" → { requests: 10, window: 1 }
- "Rate limited to 50 calls/min" → { requests: 50, window: 60 }

## If Multiple Limits Exist:
- Extract the default/global limit
- Note per-endpoint limits separately if specified`;

// =============================================================================
// Few-Shot Examples
// =============================================================================

/**
 * Example input/output for endpoint extraction (SIMPLIFIED - flat output only)
 */
export const ENDPOINT_EXTRACTION_EXAMPLE = {
  input: `## Send a Message

POST /chat.postMessage

Sends a message to a channel.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channel | string | Yes | Channel ID |
| text | string | Yes | Message text |`,

  // SIMPLIFIED: Only flat fields matching ENDPOINT_SCHEMA
  output: {
    name: 'Send Message',
    slug: 'send-message',
    method: 'POST',
    path: '/chat.postMessage',
    description: 'Sends a message to a channel.',
  },
};

/**
 * Example input/output for paginated endpoint extraction (SIMPLIFIED - flat output only)
 */
export const PAGINATED_ENDPOINT_EXTRACTION_EXAMPLE = {
  input: `## List Messages

GET /conversations.history

Fetches messages from a channel with pagination.`,

  // SIMPLIFIED: Only flat fields matching ENDPOINT_SCHEMA
  output: {
    name: 'List Messages',
    slug: 'list-messages',
    method: 'GET',
    path: '/conversations.history',
    description: 'Fetches messages from a channel with pagination.',
  },
};

/**
 * Example input/output for authentication detection
 */
export const AUTH_DETECTION_EXAMPLE = {
  input: `## Authentication

The API supports two authentication methods:

### OAuth 2.0

For user-context requests, use OAuth 2.0 authorization code flow:

1. Redirect to: https://api.example.com/oauth/authorize
2. Exchange code at: https://api.example.com/oauth/token
3. Include token: Authorization: Bearer {access_token}

Scopes: read, write, admin

### API Key

For server-to-server requests, use an API key:

Include your API key in the X-API-Key header:
\`\`\`
X-API-Key: your_api_key_here
\`\`\``,

  output: [
    {
      type: 'oauth2',
      config: {
        authorizationUrl: 'https://api.example.com/oauth/authorize',
        tokenUrl: 'https://api.example.com/oauth/token',
        scopes: ['read', 'write', 'admin'],
        flow: 'authorization_code',
      },
      location: 'header',
      paramName: 'Authorization',
    },
    {
      type: 'api_key',
      config: {},
      location: 'header',
      paramName: 'X-API-Key',
    },
  ],
};

/**
 * Example input/output for rate limit detection
 */
export const RATE_LIMIT_DETECTION_EXAMPLE = {
  input: `## Rate Limits

The API enforces the following rate limits:

- **Standard tier**: 100 requests per minute
- **Premium tier**: 1000 requests per minute

Individual endpoints may have lower limits:
- /search: 10 requests per minute
- /bulk-import: 5 requests per hour`,

  output: {
    default: {
      requests: 100,
      window: 60,
    },
    perEndpoint: [
      { endpoint: '/search', requests: 10, window: 60 },
      { endpoint: '/bulk-import', requests: 5, window: 3600 },
    ],
  },
};

// =============================================================================
// Prompt Builders
// =============================================================================

/**
 * Build a complete prompt for full API extraction
 */
export function buildFullExtractionPrompt(documentationContent: string): string {
  return `${API_EXTRACTION_SYSTEM_PROMPT}

## Documentation to Parse

${documentationContent}

## Instructions

Extract all API information from the documentation above and return a JSON object with the following structure:

{
  "name": "API name",
  "description": "API description",
  "baseUrl": "https://api.example.com",
  "version": "v1",
  "authMethods": [...],
  "endpoints": [...],
  "rateLimits": {...}
}

Return ONLY the JSON object, no markdown formatting.`;
}

/**
 * Build a prompt for endpoint extraction only
 * SIMPLIFIED: Only extracts flat endpoint objects to match ENDPOINT_SCHEMA
 */
export function buildEndpointExtractionPrompt(documentationContent: string): string {
  return `${ENDPOINT_EXTRACTION_SYSTEM_PROMPT}

## Documentation to Parse

${documentationContent}

## Task

Extract API endpoints from the documentation above. Return a JSON array where each endpoint has ONLY these fields:
- name: Human-readable name
- slug: URL-safe identifier  
- method: GET, POST, PUT, PATCH, or DELETE
- path: The API path
- description: Brief description

Return ONLY the JSON array. No markdown, no explanations.`;
}

/**
 * Build a prompt for authentication detection only
 */
export function buildAuthDetectionPrompt(documentationContent: string): string {
  return `${AUTH_DETECTION_SYSTEM_PROMPT}

## Example

Input documentation:
${AUTH_DETECTION_EXAMPLE.input}

Expected output:
${JSON.stringify(AUTH_DETECTION_EXAMPLE.output, null, 2)}

## Documentation to Parse

${documentationContent}

## Instructions

Identify all authentication methods from the documentation above. Return a JSON array of auth method objects.
Return ONLY the JSON array, no markdown formatting.`;
}

/**
 * Build a prompt for rate limit detection only
 */
export function buildRateLimitDetectionPrompt(documentationContent: string): string {
  return `${RATE_LIMIT_DETECTION_SYSTEM_PROMPT}

## Example

Input documentation:
${RATE_LIMIT_DETECTION_EXAMPLE.input}

Expected output:
${JSON.stringify(RATE_LIMIT_DETECTION_EXAMPLE.output, null, 2)}

## Documentation to Parse

${documentationContent}

## Instructions

Extract rate limit information from the documentation above. Return a JSON object with default and per-endpoint limits.
If no rate limits are found, return: { "default": null, "perEndpoint": [] }
Return ONLY the JSON object, no markdown formatting.`;
}

/**
 * Build a prompt for extracting basic API info (name, base URL, description)
 */
export function buildApiInfoExtractionPrompt(documentationContent: string): string {
  return `You are an API documentation analyzer. Extract basic API information from the documentation.

## Documentation

${documentationContent}

## Instructions

Extract the following information and return as JSON:

{
  "name": "The API name (e.g., 'Slack API', 'GitHub REST API')",
  "description": "A brief description of what the API does",
  "baseUrl": "The base URL for API requests (e.g., 'https://api.slack.com')",
  "version": "The API version if mentioned (e.g., 'v1', '2.0'), or null if not found"
}

Return ONLY the JSON object, no markdown formatting.`;
}

// =============================================================================
// Response Schemas for Structured Output
// =============================================================================

/**
 * Schema for basic API info extraction
 */
export const API_INFO_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'The API name' },
    description: { type: 'string', description: 'Brief API description' },
    baseUrl: { type: 'string', description: 'Base URL for API requests' },
    version: { type: 'string', description: 'API version if available' },
  },
  required: ['name', 'baseUrl'],
};

/**
 * Schema for pagination configuration in endpoints
 * Note: All fields except strategy are nullable - OMIT them entirely if not found in docs
 */
export const PAGINATION_CONFIG_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    strategy: {
      type: 'string',
      enum: ['cursor', 'offset', 'page_number', 'link_header', 'auto'],
      description: 'Pagination strategy type - REQUIRED if pagination exists',
    },
    cursorParam: {
      type: 'string',
      description: 'Query param name for cursor. OMIT if not in docs. Example: "cursor"',
      maxLength: 50,
      nullable: true,
    },
    cursorPath: {
      type: 'string',
      description: 'JSONPath to next cursor. OMIT if not in docs. Example: "$.next_cursor"',
      maxLength: 100,
      nullable: true,
    },
    offsetParam: {
      type: 'string',
      description: 'Query param name for offset. OMIT if not in docs. Example: "offset"',
      maxLength: 50,
      nullable: true,
    },
    limitParam: {
      type: 'string',
      description: 'Query param name for limit. OMIT if not in docs. Example: "limit"',
      maxLength: 50,
      nullable: true,
    },
    pageParam: {
      type: 'string',
      description: 'Query param name for page. OMIT if not in docs. Example: "page"',
      maxLength: 50,
      nullable: true,
    },
    totalPath: {
      type: 'string',
      description: 'JSONPath to total count. OMIT if not in docs. Example: "$.total"',
      maxLength: 100,
      nullable: true,
    },
    totalPagesPath: {
      type: 'string',
      description: 'JSONPath to total pages. OMIT if not in docs. Example: "$.pages"',
      maxLength: 100,
      nullable: true,
    },
    dataPath: {
      type: 'string',
      description: 'JSONPath to data array. OMIT if not in docs. Example: "$.results"',
      maxLength: 100,
      nullable: true,
    },
    hasMorePath: {
      type: 'string',
      description: 'JSONPath to hasMore boolean. OMIT if not in docs. Example: "$.has_more"',
      maxLength: 100,
      nullable: true,
    },
  },
};

/**
 * Schema for a single endpoint - KEEP IT SIMPLE
 * No nested objects - just flat fields for reliable extraction
 */
export const ENDPOINT_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Human-readable name like "List Users" or "Create Database"',
    },
    slug: { type: 'string', description: 'URL-safe slug like "list-users" or "create-database"' },
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    path: { type: 'string', description: 'API path like "/users" or "/databases/{database_id}"' },
    description: { type: 'string', description: 'One sentence description', nullable: true },
  },
  required: ['name', 'slug', 'method', 'path'],
};

/**
 * Schema for endpoints array extraction
 */
export const ENDPOINTS_ARRAY_SCHEMA: LLMResponseSchema = {
  type: 'array',
  items: ENDPOINT_SCHEMA,
};

/**
 * Schema for a single auth method
 */
export const AUTH_METHOD_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['oauth2', 'api_key', 'basic', 'bearer', 'custom_header'],
      description: 'Authentication type',
    },
    location: {
      type: 'string',
      enum: ['header', 'query', 'body'],
      description: 'Where credentials are placed',
    },
    paramName: { type: 'string', description: 'Parameter or header name' },
  },
  required: ['type'],
};

/**
 * Schema for auth methods array extraction
 */
export const AUTH_METHODS_ARRAY_SCHEMA: LLMResponseSchema = {
  type: 'array',
  items: AUTH_METHOD_SCHEMA,
};

/**
 * Schema for rate limits extraction
 * Note: perEndpoint uses array format since Gemini requires OBJECT types to have defined properties
 */
export const RATE_LIMITS_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    default: {
      type: 'object',
      properties: {
        requests: { type: 'number', description: 'Number of requests allowed' },
        window: { type: 'number', description: 'Time window in seconds' },
      },
    },
    perEndpoint: {
      type: 'array',
      description: 'Endpoint-specific rate limits',
      items: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', description: 'Endpoint path' },
          requests: { type: 'number', description: 'Number of requests allowed' },
          window: { type: 'number', description: 'Time window in seconds' },
        },
      },
    },
  },
};

/**
 * Schema for complete parsed API documentation
 */
export const PARSED_API_DOC_SCHEMA: LLMResponseSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'API name' },
    description: { type: 'string', description: 'API description' },
    baseUrl: { type: 'string', description: 'Base URL for API requests' },
    version: { type: 'string', description: 'API version' },
    authMethods: AUTH_METHODS_ARRAY_SCHEMA,
    endpoints: ENDPOINTS_ARRAY_SCHEMA,
    rateLimits: RATE_LIMITS_SCHEMA,
  },
  required: ['name', 'baseUrl', 'authMethods', 'endpoints'],
};

// =============================================================================
// Confidence Estimation
// =============================================================================

/**
 * Prompt suffix for requesting confidence scores
 */
export const CONFIDENCE_SUFFIX = `

Additionally, estimate your confidence (0.0 to 1.0) for each extracted item:
- 1.0: Information is explicitly stated in documentation
- 0.8: Information is strongly implied
- 0.5: Information is inferred from context
- 0.3: Information is guessed based on conventions
- 0.0: No information available, using defaults

Include a "confidence" field in your response.`;

/**
 * Build prompt with confidence scoring
 */
export function withConfidenceScoring(prompt: string): string {
  return prompt + CONFIDENCE_SUFFIX;
}
