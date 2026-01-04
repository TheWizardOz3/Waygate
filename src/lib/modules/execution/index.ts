/**
 * Execution Module
 *
 * Core execution infrastructure for the Waygate Gateway.
 * Provides retry logic, circuit breaker, and HTTP client with resilience patterns.
 */

// =============================================================================
// Schemas & Types
// =============================================================================

export {
  // Retry config
  RetryConfigSchema,
  PartialRetryConfigSchema,
  DEFAULT_RETRYABLE_STATUSES,
  DEFAULT_RETRY_CONFIG,
  mergeRetryConfig,
  isRetryableStatus,
  // Circuit breaker config
  CircuitBreakerConfigSchema,
  PartialCircuitBreakerConfigSchema,
  CircuitStateSchema,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  mergeCircuitBreakerConfig,
  // HTTP types
  HttpMethodSchema,
  HttpClientRequestSchema,
  HttpClientResponseSchema,
  // Execution options & results
  ExecuteOptionsSchema,
  ExecutionErrorCodeSchema,
  ExecutionErrorSchema,
  ExecutionResultSchema,
} from './execution.schemas';

export type {
  RetryConfig,
  PartialRetryConfig,
  CircuitBreakerConfig,
  PartialCircuitBreakerConfig,
  CircuitState,
  HttpMethod,
  HttpClientRequest,
  ExecuteOptions,
  ExecutionErrorCode,
  ExecutionErrorDetails,
  ExecutionResult,
} from './execution.schemas';

// =============================================================================
// Error Classes
// =============================================================================

export {
  ExecutionError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  ServerError,
  ClientError,
  CircuitOpenError,
  MaxRetriesExceededError,
  UnknownExecutionError,
  // Type guards
  isExecutionError,
  isRetryableError,
  isRateLimitError,
  isCircuitOpenError,
  isTimeoutError,
  // Factory functions
  createErrorFromStatus,
  wrapError,
} from './errors';

// =============================================================================
// Retry Logic
// =============================================================================

export {
  // Core retry function
  withRetry,
  retry,
  // Backoff calculation
  calculateBackoffDelay,
  calculateBackoffDelayDeterministic,
  // Retry-After parsing
  parseRetryAfterHeader,
  extractRetryAfterMs,
  // Delay helpers
  getRetryDelay,
  sleep,
  // Retry predicates
  defaultIsRetryable,
  retryOnCodes,
  retryOnStatuses,
  noRetry,
} from './retry';

export type { RetryContext, RetryResult, WithRetryOptions } from './retry';

// =============================================================================
// Circuit Breaker
// =============================================================================

export {
  CircuitBreaker,
  defaultCircuitBreaker,
  createCircuitBreaker,
  withCircuitBreaker,
} from './circuit-breaker';

export type { CircuitStatus } from './circuit-breaker';

// =============================================================================
// HTTP Client
// =============================================================================

export {
  httpRequest,
  httpClient,
  extractRateLimitInfo,
  buildUrl,
  createDefaultHeaders,
} from './http-client';

export type { HttpClientResponse, RateLimitInfo, HttpClientOptions } from './http-client';

// =============================================================================
// Execution Service
// =============================================================================

export {
  ExecutionService,
  defaultExecutionService,
  execute,
  executeWithMetrics,
  createExecutionService,
} from './execution.service';

export type {
  ExecutionContext,
  ExecutionMetrics,
  ExecutionResultWithMetrics,
} from './execution.service';

// =============================================================================
// Helpers & Utilities
// =============================================================================

export {
  // HTTP method helpers
  get,
  post,
  put,
  patch,
  del,
  // Request builder
  RequestBuilder,
  request,
  // Result type guards
  isSuccess,
  isFailure,
  hasErrorCode,
  isRetryableResult,
  isRateLimited,
  isCircuitOpen,
  isTimeout,
  isNetworkError,
  // Result utilities
  unwrap,
  unwrapOr,
  mapResult,
  // Presets & header helpers
  RetryPresets,
  jsonHeaders,
  bearerHeaders,
  apiKeyHeaders,
} from './helpers';

export type { RequestOptions } from './helpers';

// =============================================================================
// Validation (client-safe schemas and types)
// =============================================================================

export {
  // Schemas & Types
  ValidationModeSchema,
  ValidationConfigSchema,
  ValidationRequestSchema,
  ValidationResultSchema,
  ValidationResponseMetadataSchema,
  ValidationIssueSchema,
  // Constants & Presets
  DEFAULT_VALIDATION_CONFIG,
  ValidationPresets,
  // Helpers
  mergeValidationConfig,
  applyValidationPreset,
  shouldSkipValidation,
  createValidationResponseMetadata,
} from './validation';

export type {
  ValidationMode,
  ValidationConfig,
  PartialValidationConfig,
  ValidationRequest,
  ValidationResult,
  ValidationResponseMetadata,
  ValidationIssue,
  ValidationIssueCode,
  DriftStatus,
} from './validation';

// Server-only validation exports (service, drift detection)
// Import from './validation/server' in server-side code:
// import { validationService, driftDetectionService } from '@/lib/modules/execution/validation/server';

// =============================================================================
// Pagination
// =============================================================================

export {
  // Schemas
  PaginationConfigSchema,
  PaginationRequestSchema,
  PaginationMetadataSchema,
  PaginationStrategySchema,
  TruncationReasonSchema,
  // Constants & Presets
  DEFAULT_PAGINATION_LIMITS,
  ABSOLUTE_PAGINATION_LIMITS,
  PaginationPresets,
  CHARS_PER_TOKEN,
  // Service
  PaginationService,
  paginationService,
  fetchPaginated,
  createDefaultPaginationConfig,
  // Detection
  detectPaginationStrategy,
  detectFromSample,
  detectStrategy,
  hasMorePages,
  // Strategies
  getStrategy,
  getAllStrategies,
  cursorStrategy,
  offsetStrategy,
  pageNumberStrategy,
  linkHeaderStrategy,
  // Aggregation
  PaginationAggregator,
  aggregatePages,
  // Schema helpers
  mergePaginationConfig,
  estimateTokens,
  calculateCharacterCount,
  applyPreset,
  hasHighLimits,
  describeLimits,
  encodeContinuationToken,
  decodeContinuationToken,
} from './pagination';

export type {
  PaginationConfig,
  PartialPaginationConfig,
  PaginationRequest,
  PaginationMetadata,
  PaginationStrategy,
  TruncationReason,
  PaginationPreset,
  PageFetcher,
  PageFetchResponse,
  PaginatedFetchOptions,
  PaginatedFetchResult,
  DetectionResult,
  AggregationResult,
} from './pagination';
