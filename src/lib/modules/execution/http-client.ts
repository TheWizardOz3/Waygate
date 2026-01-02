/**
 * HTTP Client Wrapper
 *
 * A fetch wrapper with timeout handling, response parsing,
 * and rate limit header extraction.
 */

import type { HttpClientRequest } from './execution.schemas';
import { NetworkError, TimeoutError, RateLimitError, ServerError, ClientError } from './errors';
import { parseRetryAfterHeader } from './retry';

// =============================================================================
// Types
// =============================================================================

/**
 * HTTP client response with parsed data and metadata
 */
export interface HttpClientResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Headers;
  /** Parsed response body */
  data: T;
  /** Parsed Retry-After value in milliseconds (if present) */
  retryAfterMs?: number;
  /** Rate limit info extracted from headers */
  rateLimit?: RateLimitInfo;
  /** Response time in milliseconds */
  durationMs: number;
}

/**
 * Rate limit information from response headers
 */
export interface RateLimitInfo {
  /** Maximum requests allowed */
  limit?: number;
  /** Remaining requests in current window */
  remaining?: number;
  /** When the rate limit resets (Unix timestamp or ms) */
  reset?: number;
  /** Retry-After value in milliseconds */
  retryAfterMs?: number;
}

/**
 * Options for HTTP client request
 */
export interface HttpClientOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to parse response body as JSON (default: auto-detect) */
  parseJson?: boolean;
  /** Custom headers to merge */
  headers?: Record<string, string>;
  /** Idempotency key to include in request */
  idempotencyKey?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30000;

// =============================================================================
// Rate Limit Header Parsing
// =============================================================================

/**
 * Extract rate limit information from response headers
 *
 * Supports common rate limit header formats:
 * - X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * - RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
 * - Retry-After
 */
export function extractRateLimitInfo(headers: Headers): RateLimitInfo | undefined {
  const info: RateLimitInfo = {};
  let hasInfo = false;

  // Try X-RateLimit-* headers (GitHub, etc.)
  const xLimit = headers.get('X-RateLimit-Limit');
  const xRemaining = headers.get('X-RateLimit-Remaining');
  const xReset = headers.get('X-RateLimit-Reset');

  // Try RateLimit-* headers (IETF draft standard)
  const limit = headers.get('RateLimit-Limit') || xLimit;
  const remaining = headers.get('RateLimit-Remaining') || xRemaining;
  const reset = headers.get('RateLimit-Reset') || xReset;

  if (limit) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed)) {
      info.limit = parsed;
      hasInfo = true;
    }
  }

  if (remaining) {
    const parsed = parseInt(remaining, 10);
    if (!isNaN(parsed)) {
      info.remaining = parsed;
      hasInfo = true;
    }
  }

  if (reset) {
    const parsed = parseInt(reset, 10);
    if (!isNaN(parsed)) {
      // Could be Unix timestamp (seconds) or milliseconds
      // If it's a small number, assume seconds and convert
      info.reset = parsed < 10000000000 ? parsed * 1000 : parsed;
      hasInfo = true;
    }
  }

  // Parse Retry-After header
  const retryAfter = parseRetryAfterHeader(headers.get('Retry-After'));
  if (retryAfter !== undefined) {
    info.retryAfterMs = retryAfter;
    hasInfo = true;
  }

  return hasInfo ? info : undefined;
}

// =============================================================================
// Response Body Parsing
// =============================================================================

/**
 * Determine if response should be parsed as JSON based on content-type
 */
function shouldParseAsJson(headers: Headers): boolean {
  const contentType = headers.get('Content-Type') || '';
  return contentType.includes('application/json') || contentType.includes('+json');
}

/**
 * Parse response body based on content type
 */
async function parseResponseBody<T>(response: Response, forceJson?: boolean): Promise<T> {
  // Empty responses
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') || '';

  // JSON parsing
  if (forceJson === true || (forceJson !== false && shouldParseAsJson(response.headers))) {
    try {
      return await response.json();
    } catch {
      // If JSON parsing fails, return text
      const text = await response.text();
      return text as T;
    }
  }

  // Text content
  if (
    contentType.includes('text/') ||
    contentType.includes('application/xml') ||
    contentType.includes('+xml')
  ) {
    return (await response.text()) as T;
  }

  // For other content types (binary, etc.), return the response body as-is
  // Caller can handle blob/arrayBuffer as needed
  try {
    return await response.json();
  } catch {
    return (await response.text()) as T;
  }
}

// =============================================================================
// HTTP Client
// =============================================================================

/**
 * Make an HTTP request with timeout and error handling
 *
 * @param request - Request configuration
 * @param options - Additional options
 * @returns Parsed response with metadata
 * @throws NetworkError on connection failures
 * @throws TimeoutError on timeout
 * @throws RateLimitError on 429 responses
 * @throws ServerError on 5xx responses
 * @throws ClientError on 4xx responses
 */
export async function httpRequest<T = unknown>(
  request: HttpClientRequest,
  options: HttpClientOptions = {}
): Promise<HttpClientResponse<T>> {
  const timeout = options.timeout ?? request.timeout ?? DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Build headers
    const headers = new Headers(request.headers);

    // Merge additional headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }

    // Add idempotency key if provided
    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }

    // Set Content-Type for JSON bodies
    if (request.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      signal: controller.signal,
    };

    // Add body for non-GET requests
    if (request.body !== undefined && request.method !== 'GET') {
      fetchOptions.body =
        typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }

    // Make the request
    const response = await fetch(request.url, fetchOptions);
    const durationMs = Date.now() - startTime;

    // Extract rate limit info
    const rateLimit = extractRateLimitInfo(response.headers);
    const retryAfterMs = rateLimit?.retryAfterMs;

    // Handle error responses
    if (!response.ok) {
      // Try to parse error body for better error messages
      let errorBody: unknown;
      let errorMessage: string | undefined;

      try {
        errorBody = await parseResponseBody(response);
        if (typeof errorBody === 'object' && errorBody !== null) {
          const body = errorBody as Record<string, unknown>;
          errorMessage =
            (body.message as string) ||
            (body.error as string) ||
            (body.error_description as string);
        }
      } catch {
        // Ignore parsing errors
      }

      // Throw appropriate error type
      if (response.status === 429) {
        throw new RateLimitError(retryAfterMs);
      }
      if (response.status >= 500) {
        throw new ServerError(response.status, errorMessage);
      }
      throw new ClientError(response.status, errorMessage, errorBody);
    }

    // Parse successful response
    const data = await parseResponseBody<T>(response, options.parseJson);

    return {
      status: response.status,
      headers: response.headers,
      data,
      retryAfterMs,
      rateLimit,
      durationMs,
    };
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new NetworkError(`Network error: ${error.message}`, error);
    }

    // Re-throw execution errors
    if (
      error instanceof RateLimitError ||
      error instanceof ServerError ||
      error instanceof ClientError ||
      error instanceof TimeoutError ||
      error instanceof NetworkError
    ) {
      throw error;
    }

    // Wrap unknown errors
    throw new NetworkError(error instanceof Error ? error.message : 'Unknown network error', error);
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// Convenience Methods
// =============================================================================

/**
 * HTTP client with convenience methods
 */
export const httpClient = {
  /**
   * Make a request with full configuration
   */
  request: httpRequest,

  /**
   * Make a GET request
   */
  async get<T = unknown>(url: string, options?: HttpClientOptions): Promise<HttpClientResponse<T>> {
    return httpRequest<T>({ url, method: 'GET' }, options);
  },

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return httpRequest<T>({ url, method: 'POST', body }, options);
  },

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return httpRequest<T>({ url, method: 'PUT', body }, options);
  },

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return httpRequest<T>({ url, method: 'PATCH', body }, options);
  },

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(
    url: string,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return httpRequest<T>({ url, method: 'DELETE' }, options);
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a URL with query parameters
 */
export function buildUrl(
  baseUrl: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return baseUrl;

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Create default headers for API requests
 */
export function createDefaultHeaders(
  apiKey?: string,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  return headers;
}
