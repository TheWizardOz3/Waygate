/**
 * Pagination Module
 *
 * Automatic pagination handling for API actions.
 * Supports cursor, offset, page number, and Link header pagination strategies
 * with LLM-friendly limits (character/token estimation).
 */

// =============================================================================
// Schemas & Types
// =============================================================================

export {
  // Strategy types
  PaginationStrategySchema,
  TruncationReasonSchema,
  // Config schemas
  PaginationConfigSchema,
  PartialPaginationConfigSchema,
  PaginationRequestSchema,
  PaginationMetadataSchema,
  // Internal schemas
  PaginationStateSchema,
  PageFetchResultSchema,
  ContinuationTokenDataSchema,
  // Constants
  DEFAULT_PAGINATION_LIMITS,
  ABSOLUTE_PAGINATION_LIMITS,
  CHARS_PER_TOKEN,
  // Presets
  PaginationPresets,
  // Helper functions
  mergePaginationConfig,
  estimateTokens,
  calculateCharacterCount,
  checkLimitExceeded,
  createInitialPaginationState,
  createPaginationMetadata,
  encodeContinuationToken,
  decodeContinuationToken,
  applyPreset,
  hasHighLimits,
  describeLimits,
} from './pagination.schemas';

export type {
  PaginationStrategy,
  TruncationReason,
  PaginationConfig,
  PartialPaginationConfig,
  PaginationRequest,
  PaginationMetadata,
  PaginationState,
  PageFetchResult,
  ContinuationTokenData,
  PaginationPreset,
} from './pagination.schemas';

// =============================================================================
// Strategies
// =============================================================================

export {
  // Base strategy
  BasePaginationStrategy,
  // Strategy implementations
  CursorPaginationStrategy,
  OffsetPaginationStrategy,
  PageNumberPaginationStrategy,
  LinkHeaderPaginationStrategy,
  cursorStrategy,
  offsetStrategy,
  pageNumberStrategy,
  linkHeaderStrategy,
  // Registry
  strategyRegistry,
  getStrategy,
  getAllStrategies,
  // Helpers
  getValueByPath,
  getArrayByPath,
  getStringByPath,
  getNumberByPath,
  getBooleanByPath,
  looksLikePaginatedResponse,
} from './strategies';

export type {
  PaginationContext,
  PaginationParams,
  ExtractedPaginationInfo,
  BuildRequestOptions,
} from './strategies';

// =============================================================================
// Detector
// =============================================================================

export { detectPaginationStrategy, detectFromSample, hasMorePages } from './detector';

export type { DetectionResult } from './detector';

// =============================================================================
// Aggregator
// =============================================================================

export {
  PaginationAggregator,
  aggregatePages,
  calculateTotalCharacterCount,
  wouldExceedCharacterLimit,
  calculateLimitUsage,
  mergeDataArrays,
  createAggregationSummary,
} from './aggregator';

export type { AggregatorOptions, AggregationResult } from './aggregator';

// =============================================================================
// Service
// =============================================================================

export {
  PaginationService,
  paginationService,
  fetchPaginated,
  detectStrategy,
  createDefaultPaginationConfig,
} from './pagination.service';

export type {
  PageFetcher,
  PageFetchResponse,
  PaginatedFetchOptions,
  PaginatedFetchResult,
} from './pagination.service';
