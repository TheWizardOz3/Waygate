/**
 * Execution Service
 *
 * Orchestrates HTTP client, retry logic, and circuit breaker
 * to provide resilient API request execution.
 */

import type {
  HttpClientRequest,
  ExecuteOptions,
  ExecutionResult,
  RetryConfig,
  CircuitBreakerConfig,
} from './execution.schemas';
import { mergeRetryConfig, mergeCircuitBreakerConfig } from './execution.schemas';
import { CircuitOpenError, MaxRetriesExceededError, isExecutionError, wrapError } from './errors';
import { withRetry } from './retry';
import { CircuitBreaker, createCircuitBreaker } from './circuit-breaker';
import { httpRequest } from './http-client';

// =============================================================================
// Types
// =============================================================================

/**
 * Execution context for tracking request metadata
 */
export interface ExecutionContext {
  /** Unique request ID for tracing */
  requestId: string;
  /** Circuit breaker ID (usually integration ID) */
  circuitId?: string;
  /** Idempotency key */
  idempotencyKey?: string;
  /** Start timestamp */
  startedAt: number;
}

/**
 * Metrics collected during execution
 */
export interface ExecutionMetrics {
  /** Number of attempts made */
  attempts: number;
  /** Total duration including retries (ms) */
  totalDurationMs: number;
  /** Duration of final request only (ms) */
  lastRequestDurationMs?: number;
  /** Whether circuit breaker was checked */
  circuitBreakerChecked: boolean;
  /** Circuit state at time of request */
  circuitState?: 'closed' | 'open' | 'half-open';
}

/**
 * Extended execution result with full metadata
 */
export interface ExecutionResultWithMetrics<T> extends ExecutionResult<T> {
  /** Execution metrics */
  metrics: ExecutionMetrics;
  /** Request context */
  context: ExecutionContext;
}

// =============================================================================
// Execution Service Class
// =============================================================================

/**
 * Execution Service
 *
 * Provides resilient HTTP request execution with:
 * - Automatic retries with exponential backoff
 * - Circuit breaker for fail-fast behavior
 * - Request/response logging hooks
 * - Metrics collection
 *
 * @example
 * ```typescript
 * const executor = new ExecutionService();
 *
 * const result = await executor.execute({
 *   url: 'https://api.example.com/users',
 *   method: 'GET',
 * }, {
 *   circuitBreakerId: 'example-api',
 *   retryConfig: { maxAttempts: 3 },
 * });
 *
 * if (result.success) {
 *   console.log('Users:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export class ExecutionService {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly defaultRetryConfig: RetryConfig;
  private readonly defaultCircuitBreakerConfig: CircuitBreakerConfig;

  constructor(options?: {
    retryConfig?: Partial<RetryConfig>;
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  }) {
    this.defaultRetryConfig = mergeRetryConfig(options?.retryConfig);
    this.defaultCircuitBreakerConfig = mergeCircuitBreakerConfig(options?.circuitBreakerConfig);
    this.circuitBreaker = createCircuitBreaker(this.defaultCircuitBreakerConfig);
  }

  /**
   * Execute an HTTP request with retry and circuit breaker protection
   *
   * @param request - HTTP request configuration
   * @param options - Execution options
   * @returns Execution result with success/error status
   */
  async execute<T = unknown>(
    request: HttpClientRequest,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const context = this.createContext(options);

    // Check circuit breaker first (if circuit ID provided)
    if (options.circuitBreakerId) {
      if (!this.circuitBreaker.canExecute(options.circuitBreakerId)) {
        const status = this.circuitBreaker.getStatus(options.circuitBreakerId);
        const error = new CircuitOpenError(options.circuitBreakerId, status.timeUntilResetMs);

        return {
          success: false,
          error: error.toDetails(),
          attempts: 0,
          totalDurationMs: Date.now() - startTime,
        };
      }
    }

    // Passthrough mode - no retries, raw errors
    if (options.passthrough) {
      return this.executeOnce<T>(request, options, context, startTime);
    }

    // Execute with retry logic
    return this.executeWithRetry<T>(request, options, context, startTime);
  }

  /**
   * Execute with full metrics tracking
   */
  async executeWithMetrics<T = unknown>(
    request: HttpClientRequest,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResultWithMetrics<T>> {
    const startTime = Date.now();
    const context = this.createContext(options);
    let circuitState: 'closed' | 'open' | 'half-open' | undefined;

    // Check circuit breaker
    if (options.circuitBreakerId) {
      circuitState = this.circuitBreaker.getState(options.circuitBreakerId);

      if (!this.circuitBreaker.canExecute(options.circuitBreakerId)) {
        const status = this.circuitBreaker.getStatus(options.circuitBreakerId);
        const error = new CircuitOpenError(options.circuitBreakerId, status.timeUntilResetMs);

        return {
          success: false,
          error: error.toDetails(),
          attempts: 0,
          totalDurationMs: Date.now() - startTime,
          metrics: {
            attempts: 0,
            totalDurationMs: Date.now() - startTime,
            circuitBreakerChecked: true,
            circuitState: 'open',
          },
          context,
        };
      }
    }

    const result = options.passthrough
      ? await this.executeOnce<T>(request, options, context, startTime)
      : await this.executeWithRetry<T>(request, options, context, startTime);

    return {
      ...result,
      metrics: {
        attempts: result.attempts,
        totalDurationMs: result.totalDurationMs,
        lastRequestDurationMs: result.lastRequestDurationMs,
        circuitBreakerChecked: !!options.circuitBreakerId,
        circuitState,
      },
      context,
    };
  }

  /**
   * Get the circuit breaker instance for direct access
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create execution context
   */
  private createContext(options: ExecuteOptions): ExecutionContext {
    return {
      requestId: this.generateRequestId(),
      circuitId: options.circuitBreakerId,
      idempotencyKey: options.idempotencyKey,
      startedAt: Date.now(),
    };
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Execute a single request without retry
   */
  private async executeOnce<T>(
    request: HttpClientRequest,
    options: ExecuteOptions,
    _context: ExecutionContext,
    startTime: number
  ): Promise<ExecutionResult<T>> {
    try {
      const response = await httpRequest<T>(request, {
        timeout: options.timeout,
        idempotencyKey: options.idempotencyKey,
      });

      // Record success with circuit breaker
      if (options.circuitBreakerId) {
        this.circuitBreaker.recordSuccess(options.circuitBreakerId);
      }

      return {
        success: true,
        data: response.data,
        attempts: 1,
        totalDurationMs: Date.now() - startTime,
        lastRequestDurationMs: response.durationMs,
      };
    } catch (error) {
      const execError = isExecutionError(error) ? error : wrapError(error);

      // Record failure with circuit breaker
      if (options.circuitBreakerId) {
        this.circuitBreaker.recordFailure(options.circuitBreakerId);
      }

      return {
        success: false,
        error: execError.toDetails(),
        attempts: 1,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    request: HttpClientRequest,
    options: ExecuteOptions,
    _context: ExecutionContext,
    startTime: number
  ): Promise<ExecutionResult<T>> {
    const retryConfig = mergeRetryConfig(options.retryConfig);

    try {
      const result = await withRetry(
        async () => {
          const response = await httpRequest<T>(request, {
            timeout: options.timeout,
            idempotencyKey: options.idempotencyKey,
          });

          // Record success with circuit breaker
          if (options.circuitBreakerId) {
            this.circuitBreaker.recordSuccess(options.circuitBreakerId);
          }

          return response;
        },
        {
          config: retryConfig,
          idempotencyKey: options.idempotencyKey,
          onRetry: () => {
            // Record failure with circuit breaker on each retry
            if (options.circuitBreakerId) {
              this.circuitBreaker.recordFailure(options.circuitBreakerId);
            }
          },
        }
      );

      return {
        success: true,
        data: result.data.data,
        attempts: result.attempts,
        totalDurationMs: Date.now() - startTime,
        lastRequestDurationMs: result.data.durationMs,
      };
    } catch (error) {
      // Record final failure with circuit breaker
      if (options.circuitBreakerId) {
        this.circuitBreaker.recordFailure(options.circuitBreakerId);
      }

      const execError = isExecutionError(error) ? error : wrapError(error);

      // Extract attempt count from MaxRetriesExceededError
      const attempts = error instanceof MaxRetriesExceededError ? error.attempts : 1;

      return {
        success: false,
        error: execError.toDetails(),
        attempts,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }
}

// =============================================================================
// Default Instance & Convenience Functions
// =============================================================================

/**
 * Default execution service instance
 */
export const defaultExecutionService = new ExecutionService();

/**
 * Execute an HTTP request with default configuration
 *
 * @param request - HTTP request configuration
 * @param options - Execution options
 * @returns Execution result
 */
export async function execute<T = unknown>(
  request: HttpClientRequest,
  options?: ExecuteOptions
): Promise<ExecutionResult<T>> {
  return defaultExecutionService.execute<T>(request, options);
}

/**
 * Execute an HTTP request with metrics tracking
 *
 * @param request - HTTP request configuration
 * @param options - Execution options
 * @returns Execution result with metrics
 */
export async function executeWithMetrics<T = unknown>(
  request: HttpClientRequest,
  options?: ExecuteOptions
): Promise<ExecutionResultWithMetrics<T>> {
  return defaultExecutionService.executeWithMetrics<T>(request, options);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an execution service with custom configuration
 */
export function createExecutionService(options?: {
  retryConfig?: Partial<RetryConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}): ExecutionService {
  return new ExecutionService(options);
}
