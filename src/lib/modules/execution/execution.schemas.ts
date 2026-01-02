/**
 * Execution Schemas
 *
 * Zod schemas for execution configuration validation.
 * Defines retry policies, circuit breaker settings, and execution options.
 */

import { z } from 'zod';

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Default HTTP status codes that should trigger a retry
 */
export const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504] as const;

/**
 * Retry configuration schema
 */
export const RetryConfigSchema = z.object({
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: z.number().int().min(1).max(10).default(3),

  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs: z.number().int().min(0).max(60000).default(1000),

  /** Maximum delay in milliseconds between retries (default: 30000) */
  maxDelayMs: z.number().int().min(0).max(300000).default(30000),

  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: z.number().min(1).max(5).default(2),

  /** Jitter factor to randomize delays (0-1, default: 0.1 = 10%) */
  jitterFactor: z.number().min(0).max(1).default(0.1),

  /** HTTP status codes that should trigger a retry */
  retryableStatuses: z
    .array(z.number().int().min(100).max(599))
    .default([...DEFAULT_RETRYABLE_STATUSES]),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * Partial retry config for overrides
 */
export const PartialRetryConfigSchema = RetryConfigSchema.partial();
export type PartialRetryConfig = z.infer<typeof PartialRetryConfigSchema>;

// =============================================================================
// Circuit Breaker Configuration
// =============================================================================

/**
 * Circuit breaker state enum
 */
export const CircuitStateSchema = z.enum(['closed', 'open', 'half-open']);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

/**
 * Circuit breaker configuration schema
 */
export const CircuitBreakerConfigSchema = z.object({
  /** Number of failures before circuit opens (default: 5) */
  failureThreshold: z.number().int().min(1).max(100).default(5),

  /** Time window in ms to count failures (default: 30000 = 30s) */
  failureWindowMs: z.number().int().min(1000).max(300000).default(30000),

  /** Time in ms before attempting to close circuit (default: 60000 = 60s) */
  resetTimeoutMs: z.number().int().min(1000).max(600000).default(60000),

  /** Number of successful requests needed in half-open to close circuit (default: 1) */
  successThreshold: z.number().int().min(1).max(10).default(1),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

/**
 * Partial circuit breaker config for overrides
 */
export const PartialCircuitBreakerConfigSchema = CircuitBreakerConfigSchema.partial();
export type PartialCircuitBreakerConfig = z.infer<typeof PartialCircuitBreakerConfigSchema>;

// =============================================================================
// HTTP Client Types
// =============================================================================

/**
 * HTTP methods supported by the execution engine
 */
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/**
 * HTTP client request schema
 */
export const HttpClientRequestSchema = z.object({
  /** Full URL to request */
  url: z.string().url(),

  /** HTTP method */
  method: HttpMethodSchema,

  /** Request headers */
  headers: z.record(z.string(), z.string()).optional(),

  /** Request body (will be JSON stringified if object) */
  body: z.unknown().optional(),

  /** Request timeout in milliseconds (default: 30000) */
  timeout: z.number().int().min(0).max(300000).optional(),
});

export type HttpClientRequest = z.infer<typeof HttpClientRequestSchema>;

/**
 * HTTP client response schema (for validation, not runtime)
 */
export const HttpClientResponseSchema = z.object({
  /** HTTP status code */
  status: z.number().int().min(100).max(599),

  /** Response headers (as plain object for serialization) */
  headers: z.record(z.string(), z.string()),

  /** Parsed response data */
  data: z.unknown(),

  /** Parsed Retry-After value in milliseconds (if present) */
  retryAfterMs: z.number().int().min(0).optional(),
});

export type HttpClientResponse<T = unknown> = Omit<
  z.infer<typeof HttpClientResponseSchema>,
  'data'
> & {
  data: T;
};

// =============================================================================
// Execution Options
// =============================================================================

/**
 * Execution options schema - controls retry and circuit breaker behavior
 */
export const ExecuteOptionsSchema = z.object({
  /** Custom retry configuration (merged with defaults) */
  retryConfig: PartialRetryConfigSchema.optional(),

  /** Circuit breaker ID to group requests (e.g., integration ID) */
  circuitBreakerId: z.string().min(1).optional(),

  /** Idempotency key to forward to external API */
  idempotencyKey: z.string().min(1).optional(),

  /** Request timeout override in milliseconds */
  timeout: z.number().int().min(0).max(300000).optional(),

  /** If true, don't retry and return raw errors (default: false) */
  passthrough: z.boolean().optional(),

  /** Custom circuit breaker config (merged with defaults) */
  circuitBreakerConfig: PartialCircuitBreakerConfigSchema.optional(),
});

export type ExecuteOptions = z.infer<typeof ExecuteOptionsSchema>;

// =============================================================================
// Execution Result
// =============================================================================

/**
 * Execution error codes
 */
export const ExecutionErrorCodeSchema = z.enum([
  'NETWORK_ERROR',
  'TIMEOUT',
  'RATE_LIMITED',
  'SERVER_ERROR',
  'CLIENT_ERROR',
  'CIRCUIT_OPEN',
  'MAX_RETRIES_EXCEEDED',
  'UNKNOWN_ERROR',
]);

export type ExecutionErrorCode = z.infer<typeof ExecutionErrorCodeSchema>;

/**
 * Execution error details schema
 */
export const ExecutionErrorSchema = z.object({
  /** Error code for programmatic handling */
  code: ExecutionErrorCodeSchema,

  /** Human-readable error message */
  message: z.string(),

  /** Whether this error is retryable */
  retryable: z.boolean(),

  /** HTTP status code if applicable */
  statusCode: z.number().int().optional(),

  /** Suggested retry delay in ms (for rate limits) */
  retryAfterMs: z.number().int().optional(),

  /** Additional error details */
  details: z.record(z.string(), z.unknown()).optional(),

  /** Original error (for debugging) */
  cause: z.unknown().optional(),
});

export type ExecutionErrorDetails = z.infer<typeof ExecutionErrorSchema>;

/**
 * Execution result schema
 */
export const ExecutionResultSchema = z.object({
  /** Whether the request succeeded */
  success: z.boolean(),

  /** Response data (if successful) */
  data: z.unknown().optional(),

  /** Error details (if failed) */
  error: ExecutionErrorSchema.optional(),

  /** Number of attempts made */
  attempts: z.number().int().min(1),

  /** Total duration in milliseconds (including retries) */
  totalDurationMs: z.number().int().min(0),

  /** Duration of final (successful/failed) request in ms */
  lastRequestDurationMs: z.number().int().min(0).optional(),
});

export type ExecutionResult<T = unknown> = Omit<z.infer<typeof ExecutionResultSchema>, 'data'> & {
  data?: T;
};

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = RetryConfigSchema.parse({});

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig =
  CircuitBreakerConfigSchema.parse({});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge partial retry config with defaults
 */
export function mergeRetryConfig(partial?: PartialRetryConfig): RetryConfig {
  if (!partial) return DEFAULT_RETRY_CONFIG;
  return RetryConfigSchema.parse({ ...DEFAULT_RETRY_CONFIG, ...partial });
}

/**
 * Merge partial circuit breaker config with defaults
 */
export function mergeCircuitBreakerConfig(
  partial?: PartialCircuitBreakerConfig
): CircuitBreakerConfig {
  if (!partial) return DEFAULT_CIRCUIT_BREAKER_CONFIG;
  return CircuitBreakerConfigSchema.parse({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...partial });
}

/**
 * Check if an HTTP status code is retryable based on config
 */
export function isRetryableStatus(status: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(status);
}
