/**
 * Pagination Aggregator
 *
 * Aggregates results from multiple paginated API responses.
 * Tracks character count for LLM-friendly limits and handles deduplication.
 */

import type {
  PageFetchResult,
  PaginationState,
  PaginationConfig,
  TruncationReason,
} from './pagination.schemas';
import {
  calculateCharacterCount,
  checkLimitExceeded,
  createPaginationMetadata,
  type PaginationMetadata,
} from './pagination.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the aggregator
 */
export interface AggregatorOptions {
  /** Pagination configuration with limits */
  config: PaginationConfig;
  /** Optional ID field for deduplication */
  idField?: string;
  /** Whether to store raw responses (for debugging) */
  storeRawResponses?: boolean;
}

/**
 * Result of aggregation
 */
export interface AggregationResult {
  /** Aggregated data items */
  data: unknown[];
  /** Pagination metadata for the response */
  metadata: PaginationMetadata;
  /** Raw responses (if storeRawResponses was true) */
  rawResponses?: unknown[];
  /** IDs seen during aggregation (for deduplication tracking) */
  seenIds?: Set<string>;
}

// =============================================================================
// Aggregator Class
// =============================================================================

/**
 * Aggregates paginated results with character tracking and deduplication
 */
export class PaginationAggregator {
  private readonly config: PaginationConfig;
  private readonly idField?: string;
  private readonly storeRawResponses: boolean;

  private state: PaginationState;
  private seenIds: Set<string> = new Set();
  private rawResponses: unknown[] = [];
  private truncationReason: TruncationReason | null = null;

  constructor(options: AggregatorOptions) {
    this.config = options.config;
    this.idField = options.idField;
    this.storeRawResponses = options.storeRawResponses ?? false;

    this.state = {
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
   * Add a page of results to the aggregator
   *
   * @returns Whether to continue fetching more pages
   */
  addPage(result: PageFetchResult): boolean {
    // Check for circular pagination (same cursor seen before)
    if (result.nextCursor && this.state.seenCursors.has(result.nextCursor)) {
      this.truncationReason = 'circular';
      this.state.hasMore = false;
      return false;
    }

    // Track seen cursors
    if (result.nextCursor) {
      this.state.seenCursors.add(result.nextCursor);
    }

    // Store raw response if requested
    if (this.storeRawResponses && result.rawResponse !== undefined) {
      this.rawResponses.push(result.rawResponse);
    }

    // Deduplicate and add items
    const newItems = this.deduplicateItems(result.items);
    this.state.aggregatedData.push(...newItems);
    this.state.totalItemsFetched += newItems.length;
    this.state.totalCharactersFetched += result.characterCount;

    // Update cursor
    this.state.currentCursor = result.nextCursor;
    this.state.hasMore = result.hasMore;
    this.state.currentPage++;

    // Check limits
    const limitExceeded = checkLimitExceeded(
      {
        currentPage: this.state.currentPage,
        totalItemsFetched: this.state.totalItemsFetched,
        totalCharactersFetched: this.state.totalCharactersFetched,
        startTime: this.state.startTime,
      },
      this.config
    );

    if (limitExceeded) {
      this.truncationReason = limitExceeded;
      return false;
    }

    // Check if more pages exist
    if (!result.hasMore || result.nextCursor === null) {
      return false;
    }

    return true;
  }

  /**
   * Check if we should continue fetching
   */
  shouldContinue(): boolean {
    if (this.truncationReason) return false;
    if (!this.state.hasMore) return false;

    // Pre-check limits before next fetch
    const limitExceeded = checkLimitExceeded(
      {
        currentPage: this.state.currentPage,
        totalItemsFetched: this.state.totalItemsFetched,
        totalCharactersFetched: this.state.totalCharactersFetched,
        startTime: this.state.startTime,
      },
      this.config
    );

    if (limitExceeded) {
      this.truncationReason = limitExceeded;
      return false;
    }

    return true;
  }

  /**
   * Mark aggregation as stopped due to an error
   */
  markError(): void {
    this.truncationReason = 'error';
  }

  /**
   * Get the current cursor for the next page
   */
  getCurrentCursor(): string | null {
    return this.state.currentCursor;
  }

  /**
   * Get current page number
   */
  getCurrentPage(): number {
    return this.state.currentPage;
  }

  /**
   * Get current item count
   */
  getItemCount(): number {
    return this.state.totalItemsFetched;
  }

  /**
   * Get current character count
   */
  getCharacterCount(): number {
    return this.state.totalCharactersFetched;
  }

  /**
   * Get the final aggregation result
   */
  getResult(continuationToken: string | null = null, totalItems?: number): AggregationResult {
    const metadata = createPaginationMetadata(
      this.state,
      this.truncationReason,
      continuationToken,
      totalItems
    );

    // Fix pagesFetched (it's currentPage - 1 because we increment before checking)
    metadata.pagesFetched = this.state.currentPage - 1;

    return {
      data: this.state.aggregatedData,
      metadata,
      rawResponses: this.storeRawResponses ? this.rawResponses : undefined,
      seenIds: this.idField ? this.seenIds : undefined,
    };
  }

  /**
   * Get the current state (for debugging/logging)
   */
  getState(): Readonly<PaginationState> {
    return this.state;
  }

  /**
   * Get truncation reason if any
   */
  getTruncationReason(): TruncationReason | null {
    return this.truncationReason;
  }

  /**
   * Deduplicate items based on idField
   */
  private deduplicateItems(items: unknown[]): unknown[] {
    if (!this.idField) {
      return items;
    }

    const newItems: unknown[] = [];

    for (const item of items) {
      if (item && typeof item === 'object') {
        const id = (item as Record<string, unknown>)[this.idField];
        const idString = String(id);

        if (!this.seenIds.has(idString)) {
          this.seenIds.add(idString);
          newItems.push(item);
        }
      } else {
        // Non-object items can't be deduplicated, include as-is
        newItems.push(item);
      }
    }

    return newItems;
  }
}

// =============================================================================
// Standalone Functions
// =============================================================================

/**
 * Aggregate multiple page results into a single result
 *
 * @param pages - Array of page fetch results
 * @param config - Pagination configuration
 * @param options - Additional options
 */
export function aggregatePages(
  pages: PageFetchResult[],
  config: PaginationConfig,
  options?: { idField?: string }
): AggregationResult {
  const aggregator = new PaginationAggregator({
    config,
    idField: options?.idField,
  });

  for (const page of pages) {
    const shouldContinue = aggregator.addPage(page);
    if (!shouldContinue) break;
  }

  return aggregator.getResult();
}

/**
 * Calculate the total character count of an array of items
 */
export function calculateTotalCharacterCount(items: unknown[]): number {
  return calculateCharacterCount(items);
}

/**
 * Estimate if adding more items would exceed character limit
 */
export function wouldExceedCharacterLimit(
  currentCharCount: number,
  estimatedNextPageChars: number,
  maxCharacters: number
): boolean {
  return currentCharCount + estimatedNextPageChars > maxCharacters;
}

/**
 * Calculate percentage of limit used
 */
export function calculateLimitUsage(
  state: Pick<
    PaginationState,
    'currentPage' | 'totalItemsFetched' | 'totalCharactersFetched' | 'startTime'
  >,
  config: PaginationConfig
): {
  pagesUsed: number;
  itemsUsed: number;
  charactersUsed: number;
  durationUsed: number;
} {
  const elapsed = Date.now() - state.startTime;

  return {
    pagesUsed: (state.currentPage / config.maxPages) * 100,
    itemsUsed: (state.totalItemsFetched / config.maxItems) * 100,
    charactersUsed: (state.totalCharactersFetched / config.maxCharacters) * 100,
    durationUsed: (elapsed / config.maxDurationMs) * 100,
  };
}

/**
 * Merge arrays from multiple responses, handling different shapes
 */
export function mergeDataArrays(...arrays: unknown[][]): unknown[] {
  return arrays.flat();
}

/**
 * Create a summary of aggregation for logging
 */
export function createAggregationSummary(result: AggregationResult): string {
  const { metadata } = result;
  const parts: string[] = [
    `${metadata.fetchedItems} items`,
    `${metadata.pagesFetched} pages`,
    `${metadata.fetchedCharacters.toLocaleString()} chars (~${metadata.estimatedTokens.toLocaleString()} tokens)`,
    `${metadata.durationMs}ms`,
  ];

  if (metadata.truncated) {
    parts.push(`truncated: ${metadata.truncationReason}`);
  }

  if (metadata.hasMore) {
    parts.push('more available');
  }

  return parts.join(', ');
}
