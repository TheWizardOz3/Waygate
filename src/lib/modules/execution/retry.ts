/**
 * Retry Logic with Exponential Backoff
 *
 * Provides retry mechanisms with configurable backoff, jitter,
 * and Retry-After header support for resilient API calls.
 */

import type { RetryConfig } from './execution.schemas';
import { DEFAULT_RETRY_CONFIG, mergeRetryConfig, isRetryableStatus } from './execution.schemas';
import {
  ExecutionError,
  MaxRetriesExceededError,
  isExecutionError,
  isRateLimitError,
  wrapError,
} from './errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Context passed to retry operations
 */
export interface RetryContext {
  /** Idempotency key to maintain across retries */
  idempotencyKey?: string;
  /** Current attempt number (1-indexed) */
  attempt: number;
  /** Total attempts allowed */
  maxAttempts: number;
}

/**
 * Result of a retry operation with metadata
 */
export interface RetryResult<T> {
  /** The successful result */
  data: T;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent (including delays) in ms */
  totalTimeMs: number;
}

/**
 * Options for the withRetry function
 */
export interface WithRetryOptions {
  /** Retry configuration (merged with defaults) */
  config?: Partial<RetryConfig>;
  /** Idempotency key to forward */
  idempotencyKey?: string;
  /** Callback called before each retry attempt */
  onRetry?: (error: ExecutionError, attempt: number, delayMs: number) => void;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: ExecutionError) => boolean;
}

// =============================================================================
// Backoff Calculation
// =============================================================================

/**
 * Calculate delay for a given retry attempt using exponential backoff with jitter
 *
 * Formula: min(maxDelay, baseDelay * (multiplier ^ attempt)) * (1 ± jitter)
 *
 * @param attempt - Current attempt number (0-indexed for calculation)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Calculate base exponential delay
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Apply jitter: random value between (1 - jitter) and (1 + jitter)
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * config.jitterFactor;

  return Math.round(cappedDelay * jitterMultiplier);
}

/**
 * Calculate delay without jitter (for testing/deterministic scenarios)
 */
export function calculateBackoffDelayDeterministic(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(exponentialDelay, config.maxDelayMs);
}

// =============================================================================
// Retry-After Header Parsing
// =============================================================================

/**
 * Parse Retry-After header value
 *
 * Supports two formats per RFC 7231:
 * - Seconds: "120" (number of seconds to wait)
 * - HTTP-date: "Wed, 21 Oct 2015 07:28:00 GMT"
 *
 * @param headerValue - The Retry-After header value
 * @returns Delay in milliseconds, or undefined if parsing fails
 */
export function parseRetryAfterHeader(headerValue: string | null | undefined): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const trimmed = headerValue.trim();

  // Try parsing as seconds (integer)
  const seconds = parseInt(trimmed, 10);
  if (!isNaN(seconds) && seconds >= 0 && String(seconds) === trimmed) {
    return seconds * 1000;
  }

  // Try parsing as HTTP-date
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    // Return positive delay or 0 if date is in the past
    return Math.max(0, delayMs);
  }

  return undefined;
}

/**
 * Extract Retry-After from various header formats
 */
export function extractRetryAfterMs(headers: Headers | Record<string, string>): number | undefined {
  let value: string | null | undefined;

  if (headers instanceof Headers) {
    value = headers.get('Retry-After') || headers.get('retry-after');
  } else {
    value = headers['Retry-After'] || headers['retry-after'];
  }

  return parseRetryAfterHeader(value);
}

// =============================================================================
// Sleep Utility
// =============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Retry Logic
// =============================================================================

/**
 * Determine the delay before the next retry attempt
 *
 * Uses Retry-After header if available, otherwise falls back to exponential backoff
 */
export function getRetryDelay(error: ExecutionError, attempt: number, config: RetryConfig): number {
  // If we have a rate limit error with explicit retry-after, use that
  if (isRateLimitError(error) && error.retryAfterMs !== undefined) {
    // Still cap at maxDelay to prevent extremely long waits
    return Math.min(error.retryAfterMs, config.maxDelayMs);
  }

  // Otherwise use exponential backoff
  return calculateBackoffDelay(attempt, config);
}

/**
 * Default function to determine if an error should trigger a retry
 */
export function defaultIsRetryable(error: ExecutionError, config: RetryConfig): boolean {
  // Check if error itself is marked retryable
  if (!error.retryable) {
    return false;
  }

  // If there's a status code, check if it's in our retryable list
  if (error.statusCode !== undefined) {
    return isRetryableStatus(error.statusCode, config);
  }

  // Default to the error's retryable flag
  return error.retryable;
}

/**
 * Execute a function with automatic retry on failure
 *
 * @param fn - Async function to execute (receives retry context)
 * @param options - Retry options
 * @returns The successful result with retry metadata
 * @throws MaxRetriesExceededError if all attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async (ctx) => {
 *     const response = await fetch(url, {
 *       headers: ctx.idempotencyKey
 *         ? { 'Idempotency-Key': ctx.idempotencyKey }
 *         : undefined
 *     });
 *     if (!response.ok) throw createErrorFromStatus(response.status);
 *     return response.json();
 *   },
 *   { config: { maxAttempts: 3 }, idempotencyKey: 'unique-key' }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: (context: RetryContext) => Promise<T>,
  options: WithRetryOptions = {}
): Promise<RetryResult<T>> {
  const config = mergeRetryConfig(options.config);
  const startTime = Date.now();

  let lastError: ExecutionError | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const context: RetryContext = {
      idempotencyKey: options.idempotencyKey,
      attempt,
      maxAttempts: config.maxAttempts,
    };

    try {
      const data = await fn(context);
      return {
        data,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      // Wrap error if needed
      lastError = isExecutionError(error) ? error : wrapError(error);

      // Check if we should retry
      const shouldRetry = options.isRetryable
        ? options.isRetryable(lastError)
        : defaultIsRetryable(lastError, config);

      // If not retryable or this was the last attempt, throw
      if (!shouldRetry || attempt >= config.maxAttempts) {
        break;
      }

      // Calculate delay
      const delayMs = getRetryDelay(lastError, attempt - 1, config);

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(lastError, attempt, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // All attempts exhausted
  throw new MaxRetriesExceededError(config.maxAttempts, lastError);
}

/**
 * Simple retry wrapper that uses default configuration
 *
 * @param fn - Async function to execute
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @returns The successful result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = DEFAULT_RETRY_CONFIG.maxAttempts
): Promise<T> {
  const result = await withRetry(() => fn(), { config: { maxAttempts } });
  return result.data;
}

// =============================================================================
// Retry Predicate Helpers
// =============================================================================

/**
 * Create a retry predicate that only retries specific error codes
 */
export function retryOnCodes(codes: string[]): (error: ExecutionError) => boolean {
  return (error) => error.retryable && codes.includes(error.code);
}

/**
 * Create a retry predicate that only retries specific HTTP status codes
 */
export function retryOnStatuses(statuses: number[]): (error: ExecutionError) => boolean {
  return (error) =>
    error.retryable && error.statusCode !== undefined && statuses.includes(error.statusCode);
}

/**
 * Create a retry predicate that never retries (useful for passthrough mode)
 */
export function noRetry(): (error: ExecutionError) => boolean {
  return () => false;
}
