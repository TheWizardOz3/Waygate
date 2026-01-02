/**
 * Execution Error Classes
 *
 * Typed error classes for the execution engine.
 * These provide structured error handling with retry and circuit breaker context.
 */

import type { ExecutionErrorCode, ExecutionErrorDetails } from './execution.schemas';

/**
 * Base error class for execution-related errors
 */
export class ExecutionError extends Error {
  public readonly code: ExecutionErrorCode;
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly retryAfterMs?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ExecutionErrorCode,
    message: string,
    options?: {
      retryable?: boolean;
      statusCode?: number;
      retryAfterMs?: number;
      details?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ExecutionError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.statusCode = options?.statusCode;
    this.retryAfterMs = options?.retryAfterMs;
    this.details = options?.details;
  }

  /**
   * Convert to ExecutionErrorDetails for API responses
   */
  toDetails(): ExecutionErrorDetails {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      statusCode: this.statusCode,
      retryAfterMs: this.retryAfterMs,
      details: this.details,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

/**
 * Network-related errors (connection failed, DNS errors, etc.)
 */
export class NetworkError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super('NETWORK_ERROR', message, {
      retryable: true,
      cause,
      details: { type: 'network' },
    });
    this.name = 'NetworkError';
  }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends ExecutionError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, cause?: unknown) {
    super('TIMEOUT', `Request timed out after ${timeoutMs}ms`, {
      retryable: true,
      cause,
      details: { timeoutMs },
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Rate limit errors (HTTP 429)
 */
export class RateLimitError extends ExecutionError {
  constructor(retryAfterMs?: number, cause?: unknown) {
    super(
      'RATE_LIMITED',
      retryAfterMs ? `Rate limited. Retry after ${retryAfterMs}ms` : 'Rate limited',
      {
        retryable: true,
        statusCode: 429,
        retryAfterMs,
        cause,
        details: { retryAfterMs },
      }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Server errors (5xx responses)
 */
export class ServerError extends ExecutionError {
  constructor(statusCode: number, message?: string, cause?: unknown) {
    super('SERVER_ERROR', message || `Server error: ${statusCode}`, {
      retryable: true,
      statusCode,
      cause,
      details: { statusCode },
    });
    this.name = 'ServerError';
  }
}

/**
 * Client errors (4xx responses, excluding 429)
 */
export class ClientError extends ExecutionError {
  public readonly responseBody?: unknown;

  constructor(statusCode: number, message?: string, responseBody?: unknown, cause?: unknown) {
    super('CLIENT_ERROR', message || `Client error: ${statusCode}`, {
      retryable: false,
      statusCode,
      cause,
      details: { statusCode, responseBody },
    });
    this.name = 'ClientError';
    this.responseBody = responseBody;
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitOpenError extends ExecutionError {
  public readonly circuitId: string;
  public readonly resetTimeMs?: number;

  constructor(circuitId: string, resetTimeMs?: number) {
    const message = resetTimeMs
      ? `Circuit '${circuitId}' is open. Reset in ${resetTimeMs}ms`
      : `Circuit '${circuitId}' is open`;

    super('CIRCUIT_OPEN', message, {
      retryable: false, // Not immediately retryable, wait for circuit reset
      details: { circuitId, resetTimeMs },
    });
    this.name = 'CircuitOpenError';
    this.circuitId = circuitId;
    this.resetTimeMs = resetTimeMs;
  }
}

/**
 * Max retries exceeded error
 */
export class MaxRetriesExceededError extends ExecutionError {
  public readonly attempts: number;
  public readonly lastError?: ExecutionError;

  constructor(attempts: number, lastError?: ExecutionError) {
    super('MAX_RETRIES_EXCEEDED', `Max retries exceeded after ${attempts} attempts`, {
      retryable: false,
      statusCode: lastError?.statusCode,
      cause: lastError,
      details: {
        attempts,
        lastErrorCode: lastError?.code,
        lastErrorMessage: lastError?.message,
      },
    });
    this.name = 'MaxRetriesExceededError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Unknown/unexpected errors
 */
export class UnknownExecutionError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super('UNKNOWN_ERROR', message, {
      retryable: false,
      cause,
    });
    this.name = 'UnknownExecutionError';
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an error is an ExecutionError
 */
export function isExecutionError(error: unknown): error is ExecutionError {
  return error instanceof ExecutionError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isExecutionError(error)) {
    return error.retryable;
  }
  // Network errors from fetch are generally retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  return false;
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Check if an error is a circuit open error
 */
export function isCircuitOpenError(error: unknown): error is CircuitOpenError {
  return error instanceof CircuitOpenError;
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

// =============================================================================
// Error Factory
// =============================================================================

/**
 * Create an ExecutionError from an HTTP status code
 */
export function createErrorFromStatus(
  status: number,
  message?: string,
  responseBody?: unknown,
  cause?: unknown
): ExecutionError {
  if (status === 429) {
    return new RateLimitError(undefined, cause);
  }
  if (status >= 500) {
    return new ServerError(status, message, cause);
  }
  if (status >= 400) {
    return new ClientError(status, message, responseBody, cause);
  }
  return new UnknownExecutionError(message || `Unexpected status: ${status}`, cause);
}

/**
 * Wrap an unknown error as an ExecutionError
 */
export function wrapError(error: unknown): ExecutionError {
  if (isExecutionError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common fetch/network error patterns
    if (error.name === 'AbortError') {
      return new TimeoutError(0, error);
    }
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError(error.message, error);
    }
    return new UnknownExecutionError(error.message, error);
  }

  return new UnknownExecutionError(String(error), error);
}
