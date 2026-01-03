/**
 * Pagination Schemas
 *
 * Zod schemas for pagination configuration, request options, and response metadata.
 * Supports cursor, offset, page number, and Link header pagination strategies
 * with LLM-friendly limits (character/token estimation).
 */

import { z } from 'zod';

// =============================================================================
// Enums & Constants
// =============================================================================

/**
 * Pagination strategy types
 */
export const PaginationStrategySchema = z.enum([
  'cursor',
  'offset',
  'page_number',
  'link_header',
  'auto',
]);
export type PaginationStrategy = z.infer<typeof PaginationStrategySchema>;

/**
 * Reasons why pagination was truncated
 */
export const TruncationReasonSchema = z.enum([
  'maxPages',
  'maxItems',
  'maxCharacters',
  'maxDuration',
  'error',
  'circular',
]);
export type TruncationReason = z.infer<typeof TruncationReasonSchema>;

// =============================================================================
// Default Limits (Conservative, LLM-Friendly)
// =============================================================================

/**
 * Default pagination limits - conservative to prevent runaway fetches
 * These are designed for LLM use cases where response size matters
 */
export const DEFAULT_PAGINATION_LIMITS = {
  /** Default max pages to fetch (prevents runaway pagination) */
  maxPages: 5,
  /** Default max items to fetch */
  maxItems: 500,
  /** Default page size when making requests */
  defaultPageSize: 100,
  /** Default max characters (~25K tokens, fits most LLM context windows) */
  maxCharacters: 100_000,
  /** Default max duration in milliseconds (30 seconds) */
  maxDurationMs: 30_000,
} as const;

/**
 * Absolute limits (hard caps that cannot be exceeded)
 */
export const ABSOLUTE_PAGINATION_LIMITS = {
  maxPages: 100,
  maxItems: 10_000,
  maxPageSize: 500,
  maxCharacters: 1_000_000,
  maxDurationMs: 300_000, // 5 minutes
} as const;

/**
 * Characters per token estimation (GPT-style approximation)
 * Used for estimatedTokens calculation
 */
export const CHARS_PER_TOKEN = 4;

// =============================================================================
// Pagination Configuration (Per-Action Settings)
// =============================================================================

/**
 * Full pagination configuration schema for action definitions
 * Stored in action.paginationConfig (JSONB column)
 */
export const PaginationConfigSchema = z.object({
  /** Whether pagination is enabled for this action */
  enabled: z.boolean().default(false),

  /** Pagination strategy to use */
  strategy: PaginationStrategySchema.default('auto'),

  // ─────────────────────────────────────────────────────────────────────────
  // Cursor-based Pagination
  // ─────────────────────────────────────────────────────────────────────────

  /** Request parameter name for cursor (e.g., "cursor", "after", "pageToken") */
  cursorParam: z.string().optional(),
  /** JSONPath to cursor in response (e.g., "$.meta.next_cursor", "$.nextPageToken") */
  cursorPath: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Offset/Limit Pagination
  // ─────────────────────────────────────────────────────────────────────────

  /** Request parameter name for offset (e.g., "offset", "skip", "start") */
  offsetParam: z.string().optional(),
  /** Request parameter name for limit (e.g., "limit", "take", "count", "per_page") */
  limitParam: z.string().optional(),
  /** JSONPath to total count in response (e.g., "$.meta.total", "$.total_count") */
  totalPath: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Page Number Pagination
  // ─────────────────────────────────────────────────────────────────────────

  /** Request parameter name for page number (e.g., "page", "pageNumber", "p") */
  pageParam: z.string().optional(),
  /** JSONPath to total pages in response (e.g., "$.meta.totalPages", "$.pages") */
  totalPagesPath: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Common Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /** JSONPath to data array in response (e.g., "$.data", "$.results", "$.items") */
  dataPath: z.string().optional(),
  /** JSONPath to hasMore boolean in response (e.g., "$.meta.hasMore", "$.has_more") */
  hasMorePath: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Safety Limits (all enforced - first limit reached stops pagination)
  // ─────────────────────────────────────────────────────────────────────────

  /** Maximum pages to fetch (default: 5) */
  maxPages: z
    .number()
    .int()
    .min(1)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxPages)
    .default(DEFAULT_PAGINATION_LIMITS.maxPages),

  /** Maximum items to fetch (default: 500) */
  maxItems: z
    .number()
    .int()
    .min(1)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxItems)
    .default(DEFAULT_PAGINATION_LIMITS.maxItems),

  /** Default page size for requests (default: 100) */
  defaultPageSize: z
    .number()
    .int()
    .min(1)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxPageSize)
    .default(DEFAULT_PAGINATION_LIMITS.defaultPageSize),

  /** Maximum response characters to fetch (default: 100,000 ~25K tokens) */
  maxCharacters: z
    .number()
    .int()
    .min(1000)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxCharacters)
    .default(DEFAULT_PAGINATION_LIMITS.maxCharacters),

  /** Maximum total pagination duration in milliseconds (default: 30,000) */
  maxDurationMs: z
    .number()
    .int()
    .min(1000)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxDurationMs)
    .default(DEFAULT_PAGINATION_LIMITS.maxDurationMs),
});

export type PaginationConfig = z.infer<typeof PaginationConfigSchema>;

/**
 * Partial pagination config for updates (all fields optional)
 */
export const PartialPaginationConfigSchema = PaginationConfigSchema.partial();
export type PartialPaginationConfig = z.infer<typeof PartialPaginationConfigSchema>;

// =============================================================================
// Request-Level Pagination Options
// =============================================================================

/**
 * Pagination options that can be passed with each action invocation
 * These override the action's default pagination config
 */
export const PaginationRequestSchema = z.object({
  /** Whether to fetch all pages (default: false = single page only) */
  fetchAll: z.boolean().default(false),

  /** Override max pages limit */
  maxPages: z.number().int().min(1).max(ABSOLUTE_PAGINATION_LIMITS.maxPages).optional(),

  /** Override max items limit */
  maxItems: z.number().int().min(1).max(ABSOLUTE_PAGINATION_LIMITS.maxItems).optional(),

  /** Override max characters limit */
  maxCharacters: z
    .number()
    .int()
    .min(1000)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxCharacters)
    .optional(),

  /** Override max duration limit */
  maxDurationMs: z
    .number()
    .int()
    .min(1000)
    .max(ABSOLUTE_PAGINATION_LIMITS.maxDurationMs)
    .optional(),

  /** Override page size for this request */
  pageSize: z.number().int().min(1).max(ABSOLUTE_PAGINATION_LIMITS.maxPageSize).optional(),

  /** Resume pagination from a previous partial fetch */
  continuationToken: z.string().optional(),
});

export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;

// =============================================================================
// Pagination Response Metadata
// =============================================================================

/**
 * Pagination metadata included in action responses
 * Provides LLM-friendly information about what was fetched
 */
export const PaginationMetadataSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // What was fetched
  // ─────────────────────────────────────────────────────────────────────────

  /** Number of items fetched across all pages */
  fetchedItems: z.number().int().min(0),
  /** Number of pages fetched */
  pagesFetched: z.number().int().min(0),
  /** Total items available (if API provides this) */
  totalItems: z.number().int().min(0).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // LLM-Friendly Metrics
  // ─────────────────────────────────────────────────────────────────────────

  /** Total characters in the aggregated response */
  fetchedCharacters: z.number().int().min(0),
  /** Estimated token count (~fetchedCharacters / 4) */
  estimatedTokens: z.number().int().min(0),

  // ─────────────────────────────────────────────────────────────────────────
  // Continuation Info
  // ─────────────────────────────────────────────────────────────────────────

  /** Whether more data exists beyond what was fetched */
  hasMore: z.boolean(),
  /** Whether pagination was stopped due to a limit being reached */
  truncated: z.boolean(),
  /** Why pagination was truncated (if truncated is true) */
  truncationReason: TruncationReasonSchema.optional(),
  /** Token to resume pagination from where it stopped */
  continuationToken: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Timing
  // ─────────────────────────────────────────────────────────────────────────

  /** Total time spent paginating in milliseconds */
  durationMs: z.number().int().min(0),
});

export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;

// =============================================================================
// Internal Types for Pagination Processing
// =============================================================================

/**
 * State tracked during pagination iteration
 */
export const PaginationStateSchema = z.object({
  /** Current page number (1-indexed) */
  currentPage: z.number().int().min(1),
  /** Total items fetched so far */
  totalItemsFetched: z.number().int().min(0),
  /** Total characters fetched so far */
  totalCharactersFetched: z.number().int().min(0),
  /** Pagination start time */
  startTime: z.number().int(),
  /** Current cursor/offset/page value */
  currentCursor: z.string().nullable(),
  /** Previous cursors (for circular detection) */
  seenCursors: z.set(z.string()),
  /** Aggregated data from all pages */
  aggregatedData: z.array(z.unknown()),
  /** Whether more data exists */
  hasMore: z.boolean(),
  /** Detected strategy (if auto-detecting) */
  detectedStrategy: PaginationStrategySchema.nullable(),
});

export type PaginationState = z.infer<typeof PaginationStateSchema>;

/**
 * Result of a single page fetch
 */
export const PageFetchResultSchema = z.object({
  /** Data items from this page */
  items: z.array(z.unknown()),
  /** Number of items in this page */
  itemCount: z.number().int().min(0),
  /** Character count of this page's response */
  characterCount: z.number().int().min(0),
  /** Next cursor/offset/page value (null if no more pages) */
  nextCursor: z.string().nullable(),
  /** Whether more pages exist */
  hasMore: z.boolean(),
  /** Total items (if API provides this) */
  totalItems: z.number().int().min(0).optional(),
  /** Raw response for debugging */
  rawResponse: z.unknown().optional(),
});

export type PageFetchResult = z.infer<typeof PageFetchResultSchema>;

// =============================================================================
// Continuation Token
// =============================================================================

/**
 * Structure encoded in continuation tokens
 * Base64-encoded JSON for resumable pagination
 */
export const ContinuationTokenDataSchema = z.object({
  /** Pagination strategy used */
  strategy: PaginationStrategySchema,
  /** Cursor/offset/page value to resume from */
  cursor: z.string(),
  /** Items fetched before this token */
  itemsFetched: z.number().int().min(0),
  /** Characters fetched before this token */
  charactersFetched: z.number().int().min(0),
  /** Timestamp when token was created */
  createdAt: z.number().int(),
  /** Action ID for validation */
  actionId: z.string(),
});

export type ContinuationTokenData = z.infer<typeof ContinuationTokenDataSchema>;

// =============================================================================
// Preset Configurations
// =============================================================================

/**
 * Pagination limit presets for quick configuration
 */
export const PaginationPresets = {
  /** LLM-Optimized: Conservative limits that fit in most context windows */
  LLM_OPTIMIZED: {
    maxPages: 5,
    maxItems: 500,
    maxCharacters: 100_000, // ~25K tokens
    maxDurationMs: 30_000,
  },
  /** Full Dataset: Higher limits for data sync/export use cases */
  FULL_DATASET: {
    maxPages: 50,
    maxItems: 5000,
    maxCharacters: 1_000_000, // ~250K tokens
    maxDurationMs: 120_000,
  },
  /** Quick Sample: Minimal limits for testing/previews */
  QUICK_SAMPLE: {
    maxPages: 1,
    maxItems: 50,
    maxCharacters: 10_000, // ~2.5K tokens
    maxDurationMs: 10_000,
  },
} as const;

export type PaginationPreset = keyof typeof PaginationPresets;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge request pagination options with action's default config
 */
export function mergePaginationConfig(
  actionConfig: PaginationConfig | null | undefined,
  requestOptions: PaginationRequest | null | undefined
): PaginationConfig {
  // Start with defaults
  const base = actionConfig ?? PaginationConfigSchema.parse({ enabled: false });

  if (!requestOptions) {
    return base;
  }

  // Merge request options (they override action config)
  return {
    ...base,
    maxPages: requestOptions.maxPages ?? base.maxPages,
    maxItems: requestOptions.maxItems ?? base.maxItems,
    maxCharacters: requestOptions.maxCharacters ?? base.maxCharacters,
    maxDurationMs: requestOptions.maxDurationMs ?? base.maxDurationMs,
    defaultPageSize: requestOptions.pageSize ?? base.defaultPageSize,
  };
}

/**
 * Estimate token count from character count
 * Uses ~4 characters per token (GPT-style approximation)
 */
export function estimateTokens(characterCount: number): number {
  return Math.ceil(characterCount / CHARS_PER_TOKEN);
}

/**
 * Calculate character count of a value (JSON stringified)
 */
export function calculateCharacterCount(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

/**
 * Check if a limit has been exceeded
 */
export function checkLimitExceeded(
  state: {
    currentPage: number;
    totalItemsFetched: number;
    totalCharactersFetched: number;
    startTime: number;
  },
  config: PaginationConfig
): TruncationReason | null {
  // Check in order of most likely to hit
  if (state.currentPage > config.maxPages) {
    return 'maxPages';
  }
  if (state.totalItemsFetched >= config.maxItems) {
    return 'maxItems';
  }
  if (state.totalCharactersFetched >= config.maxCharacters) {
    return 'maxCharacters';
  }
  if (Date.now() - state.startTime >= config.maxDurationMs) {
    return 'maxDuration';
  }
  return null;
}

/**
 * Create initial pagination state
 */
export function createInitialPaginationState(): PaginationState {
  return {
    currentPage: 1,
    totalItemsFetched: 0,
    totalCharactersFetched: 0,
    startTime: Date.now(),
    currentCursor: null,
    seenCursors: new Set(),
    aggregatedData: [],
    hasMore: true,
    detectedStrategy: null,
  };
}

/**
 * Create pagination metadata from final state
 */
export function createPaginationMetadata(
  state: PaginationState,
  truncationReason: TruncationReason | null,
  continuationToken: string | null,
  totalItems?: number
): PaginationMetadata {
  return {
    fetchedItems: state.totalItemsFetched,
    pagesFetched: state.currentPage - 1, // currentPage is 1-indexed and incremented after fetch
    totalItems,
    fetchedCharacters: state.totalCharactersFetched,
    estimatedTokens: estimateTokens(state.totalCharactersFetched),
    hasMore: state.hasMore,
    truncated: truncationReason !== null,
    truncationReason: truncationReason ?? undefined,
    continuationToken: continuationToken ?? undefined,
    durationMs: Date.now() - state.startTime,
  };
}

/**
 * Encode continuation token data to base64 string
 */
export function encodeContinuationToken(data: ContinuationTokenData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode continuation token from base64 string
 */
export function decodeContinuationToken(token: string): ContinuationTokenData | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return ContinuationTokenDataSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Apply a preset to a pagination config
 */
export function applyPreset(
  config: PartialPaginationConfig,
  preset: PaginationPreset
): PaginationConfig {
  const presetLimits = PaginationPresets[preset];
  return PaginationConfigSchema.parse({
    ...config,
    ...presetLimits,
  });
}

/**
 * Check if config has high limits that warrant a warning
 */
export function hasHighLimits(config: PaginationConfig): boolean {
  return (
    config.maxPages > 10 ||
    config.maxItems > 1000 ||
    config.maxCharacters > 500_000 ||
    config.maxDurationMs > 60_000
  );
}

/**
 * Get human-readable limit description
 */
export function describeLimits(config: PaginationConfig): string {
  const parts: string[] = [];
  parts.push(`${config.maxPages} pages`);
  parts.push(`${config.maxItems.toLocaleString()} items`);
  parts.push(`~${estimateTokens(config.maxCharacters).toLocaleString()} tokens`);
  parts.push(`${config.maxDurationMs / 1000}s timeout`);
  return parts.join(', ');
}
