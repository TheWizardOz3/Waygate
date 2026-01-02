/**
 * Execution API Helpers
 *
 * Convenience functions for common execution patterns.
 * Provides typed HTTP methods, request builders, and result type guards.
 */

import type {
  HttpClientRequest,
  ExecuteOptions,
  ExecutionResult,
  ExecutionErrorDetails,
  ExecutionErrorCode,
} from './execution.schemas';
import { execute } from './execution.service';

// =============================================================================
// Typed HTTP Method Helpers
// =============================================================================

/**
 * Options for helper HTTP methods
 */
export interface RequestOptions extends Omit<ExecuteOptions, 'passthrough'> {
  /** Request headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build URL with query parameters
 */
function buildUrlWithParams(
  url: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return url;

  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      urlObj.searchParams.set(key, String(value));
    }
  }
  return urlObj.toString();
}

/**
 * Execute a GET request
 *
 * @example
 * ```typescript
 * const result = await get<User[]>('https://api.example.com/users', {
 *   params: { limit: 10 },
 *   circuitBreakerId: 'example-api',
 * });
 * ```
 */
export async function get<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<ExecutionResult<T>> {
  const { headers, params, ...executeOptions } = options;
  const finalUrl = buildUrlWithParams(url, params);

  return execute<T>(
    {
      url: finalUrl,
      method: 'GET',
      headers,
    },
    executeOptions
  );
}

/**
 * Execute a POST request
 *
 * @example
 * ```typescript
 * const result = await post<User>('https://api.example.com/users', {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 * }, {
 *   idempotencyKey: 'create-user-123',
 * });
 * ```
 */
export async function post<T = unknown>(
  url: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ExecutionResult<T>> {
  const { headers, params, ...executeOptions } = options;
  const finalUrl = buildUrlWithParams(url, params);

  return execute<T>(
    {
      url: finalUrl,
      method: 'POST',
      headers,
      body,
    },
    executeOptions
  );
}

/**
 * Execute a PUT request
 */
export async function put<T = unknown>(
  url: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ExecutionResult<T>> {
  const { headers, params, ...executeOptions } = options;
  const finalUrl = buildUrlWithParams(url, params);

  return execute<T>(
    {
      url: finalUrl,
      method: 'PUT',
      headers,
      body,
    },
    executeOptions
  );
}

/**
 * Execute a PATCH request
 */
export async function patch<T = unknown>(
  url: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ExecutionResult<T>> {
  const { headers, params, ...executeOptions } = options;
  const finalUrl = buildUrlWithParams(url, params);

  return execute<T>(
    {
      url: finalUrl,
      method: 'PATCH',
      headers,
      body,
    },
    executeOptions
  );
}

/**
 * Execute a DELETE request
 */
export async function del<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<ExecutionResult<T>> {
  const { headers, params, ...executeOptions } = options;
  const finalUrl = buildUrlWithParams(url, params);

  return execute<T>(
    {
      url: finalUrl,
      method: 'DELETE',
      headers,
    },
    executeOptions
  );
}

// =============================================================================
// Request Building Utilities
// =============================================================================

/**
 * Builder for creating HTTP requests with fluent API
 */
export class RequestBuilder {
  private request: Partial<HttpClientRequest> = {};
  private options: ExecuteOptions = {};

  /**
   * Set the request URL
   */
  url(url: string): this {
    this.request.url = url;
    return this;
  }

  /**
   * Set the HTTP method
   */
  method(method: HttpClientRequest['method']): this {
    this.request.method = method;
    return this;
  }

  /**
   * Set request headers
   */
  headers(headers: Record<string, string>): this {
    this.request.headers = { ...this.request.headers, ...headers };
    return this;
  }

  /**
   * Set a single header
   */
  header(name: string, value: string): this {
    this.request.headers = { ...this.request.headers, [name]: value };
    return this;
  }

  /**
   * Set Bearer token authentication
   */
  bearerToken(token: string): this {
    return this.header('Authorization', `Bearer ${token}`);
  }

  /**
   * Set API key authentication (in header)
   */
  apiKey(key: string, headerName = 'X-API-Key'): this {
    return this.header(headerName, key);
  }

  /**
   * Set Basic authentication
   */
  basicAuth(username: string, password: string): this {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    return this.header('Authorization', `Basic ${credentials}`);
  }

  /**
   * Set request body
   */
  body(body: unknown): this {
    this.request.body = body;
    return this;
  }

  /**
   * Set JSON body with Content-Type header
   */
  json(data: unknown): this {
    this.request.body = data;
    return this.header('Content-Type', 'application/json');
  }

  /**
   * Set request timeout
   */
  timeout(ms: number): this {
    this.request.timeout = ms;
    this.options.timeout = ms;
    return this;
  }

  /**
   * Set circuit breaker ID
   */
  circuitBreaker(id: string): this {
    this.options.circuitBreakerId = id;
    return this;
  }

  /**
   * Set idempotency key
   */
  idempotency(key: string): this {
    this.options.idempotencyKey = key;
    return this;
  }

  /**
   * Set retry configuration
   */
  retry(config: ExecuteOptions['retryConfig']): this {
    this.options.retryConfig = config;
    return this;
  }

  /**
   * Disable retries (passthrough mode)
   */
  noRetry(): this {
    this.options.passthrough = true;
    return this;
  }

  /**
   * Build the request object
   */
  build(): { request: HttpClientRequest; options: ExecuteOptions } {
    if (!this.request.url) {
      throw new Error('URL is required');
    }
    if (!this.request.method) {
      throw new Error('Method is required');
    }

    return {
      request: this.request as HttpClientRequest,
      options: this.options,
    };
  }

  /**
   * Execute the request
   */
  async execute<T = unknown>(): Promise<ExecutionResult<T>> {
    const { request, options } = this.build();
    return execute<T>(request, options);
  }
}

/**
 * Create a new request builder
 *
 * @example
 * ```typescript
 * const result = await request()
 *   .url('https://api.example.com/users')
 *   .method('POST')
 *   .bearerToken('my-token')
 *   .json({ name: 'John' })
 *   .circuitBreaker('example-api')
 *   .execute<User>();
 * ```
 */
export function request(): RequestBuilder {
  return new RequestBuilder();
}

// =============================================================================
// Result Type Guards & Utilities
// =============================================================================

/**
 * Check if an execution result was successful
 */
export function isSuccess<T>(
  result: ExecutionResult<T>
): result is ExecutionResult<T> & { success: true; data: T } {
  return result.success === true && result.data !== undefined;
}

/**
 * Check if an execution result was a failure
 */
export function isFailure<T>(
  result: ExecutionResult<T>
): result is ExecutionResult<T> & { success: false; error: ExecutionErrorDetails } {
  return result.success === false && result.error !== undefined;
}

/**
 * Check if the error is of a specific code
 */
export function hasErrorCode<T>(result: ExecutionResult<T>, code: ExecutionErrorCode): boolean {
  return isFailure(result) && result.error.code === code;
}

/**
 * Check if the error is retryable
 */
export function isRetryableResult<T>(result: ExecutionResult<T>): boolean {
  return isFailure(result) && result.error.retryable;
}

/**
 * Check if the error is a rate limit error
 */
export function isRateLimited<T>(result: ExecutionResult<T>): boolean {
  return hasErrorCode(result, 'RATE_LIMITED');
}

/**
 * Check if the error is a circuit breaker error
 */
export function isCircuitOpen<T>(result: ExecutionResult<T>): boolean {
  return hasErrorCode(result, 'CIRCUIT_OPEN');
}

/**
 * Check if the error is a timeout
 */
export function isTimeout<T>(result: ExecutionResult<T>): boolean {
  return hasErrorCode(result, 'TIMEOUT');
}

/**
 * Check if the error is a network error
 */
export function isNetworkError<T>(result: ExecutionResult<T>): boolean {
  return hasErrorCode(result, 'NETWORK_ERROR');
}

/**
 * Unwrap a successful result or throw the error
 *
 * @throws Error with the execution error message if result is a failure
 */
export function unwrap<T>(result: ExecutionResult<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(result.error?.message || 'Execution failed');
}

/**
 * Unwrap a successful result or return a default value
 */
export function unwrapOr<T>(result: ExecutionResult<T>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Map over a successful result
 */
export function mapResult<T, U>(
  result: ExecutionResult<T>,
  fn: (data: T) => U
): ExecutionResult<U> {
  if (isSuccess(result)) {
    return {
      ...result,
      data: fn(result.data),
    };
  }
  return result as ExecutionResult<U>;
}

// =============================================================================
// Retry Helpers
// =============================================================================

/**
 * Common retry configurations
 */
export const RetryPresets = {
  /** No retries */
  none: { maxAttempts: 1 },

  /** Light retry (2 attempts, fast backoff) */
  light: { maxAttempts: 2, baseDelayMs: 500 },

  /** Standard retry (3 attempts, 1s base) */
  standard: { maxAttempts: 3, baseDelayMs: 1000 },

  /** Aggressive retry (5 attempts, longer delays) */
  aggressive: { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60000 },

  /** For rate-limited APIs (respect longer delays) */
  rateLimited: { maxAttempts: 3, baseDelayMs: 5000, maxDelayMs: 120000 },
} as const;

// =============================================================================
// Common Header Helpers
// =============================================================================

/**
 * Create standard JSON API headers
 */
export function jsonHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...additionalHeaders,
  };
}

/**
 * Create headers with Bearer token
 */
export function bearerHeaders(
  token: string,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    ...jsonHeaders(),
    Authorization: `Bearer ${token}`,
    ...additionalHeaders,
  };
}

/**
 * Create headers with API key
 */
export function apiKeyHeaders(
  apiKey: string,
  headerName = 'X-API-Key',
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    ...jsonHeaders(),
    [headerName]: apiKey,
    ...additionalHeaders,
  };
}
