/**
 * Pagination Service
 *
 * Orchestrates paginated API requests with automatic strategy detection,
 * limit enforcement, and result aggregation.
 */

import type {
  PaginationConfig,
  PaginationRequest,
  PaginationMetadata,
  ContinuationTokenData,
} from './pagination.schemas';
import {
  mergePaginationConfig,
  calculateCharacterCount,
  encodeContinuationToken,
  decodeContinuationToken,
  DEFAULT_PAGINATION_LIMITS,
} from './pagination.schemas';
import { PaginationAggregator } from './aggregator';
import { detectPaginationStrategy, hasMorePages } from './detector';
import {
  type BasePaginationStrategy,
  type PaginationContext,
  getStrategy,
  linkHeaderStrategy,
} from './strategies';

// =============================================================================
// Types
// =============================================================================

/**
 * Function type for fetching a single page
 */
export type PageFetcher = (
  params: Record<string, unknown>,
  headers?: Record<string, string>
) => Promise<PageFetchResponse>;

/**
 * Response from fetching a single page
 */
export interface PageFetchResponse {
  /** Response data (parsed JSON) */
  data: unknown;
  /** Response headers */
  headers: Record<string, string>;
  /** HTTP status code */
  status: number;
}

/**
 * Options for paginated fetch
 */
export interface PaginatedFetchOptions {
  /** Action's pagination configuration */
  actionConfig: PaginationConfig | null;
  /** Request-level pagination options */
  requestOptions?: PaginationRequest;
  /** Function to fetch a single page */
  fetcher: PageFetcher;
  /** Original request parameters */
  originalParams: Record<string, unknown>;
  /** Action ID for continuation tokens */
  actionId: string;
  /** Optional ID field for deduplication */
  idField?: string;
  /** Callback for each page fetched (for progress tracking) */
  onPageFetched?: (pageNumber: number, itemCount: number) => void;
}

/**
 * Result of paginated fetch
 */
export interface PaginatedFetchResult {
  /** Aggregated data from all pages */
  data: unknown[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
  /** Whether pagination was used */
  isPaginated: boolean;
}

// =============================================================================
// Pagination Service
// =============================================================================

/**
 * Main pagination service for orchestrating paginated requests
 */
export class PaginationService {
  /**
   * Fetch paginated data with automatic handling
   */
  async fetchPaginated(options: PaginatedFetchOptions): Promise<PaginatedFetchResult> {
    const {
      actionConfig,
      requestOptions,
      fetcher,
      originalParams,
      actionId,
      idField,
      onPageFetched,
    } = options;

    // Merge config with request options
    const config = mergePaginationConfig(actionConfig, requestOptions);

    // If pagination not enabled or fetchAll not requested, return single page
    if (!config.enabled || !requestOptions?.fetchAll) {
      return this.fetchSinglePage(fetcher, originalParams, config);
    }

    // Handle continuation token if provided
    let startCursor: string | null = null;
    let startItemsFetched = 0;
    let startCharactersFetched = 0;

    if (requestOptions?.continuationToken) {
      const tokenData = decodeContinuationToken(requestOptions.continuationToken);
      if (tokenData && tokenData.actionId === actionId) {
        startCursor = tokenData.cursor;
        startItemsFetched = tokenData.itemsFetched;
        startCharactersFetched = tokenData.charactersFetched;
      }
    }

    // Initialize aggregator
    const aggregator = new PaginationAggregator({
      config,
      idField,
    });

    // Fetch first page to detect strategy if needed
    let strategy: BasePaginationStrategy | null = null;
    let currentCursor = startCursor;
    let pageNumber = 1;

    try {
      // Fetch first page
      const firstPageParams = this.buildPageParams(
        originalParams,
        config,
        strategy,
        currentCursor,
        pageNumber
      );

      const firstResponse = await fetcher(firstPageParams);
      const firstCharCount = calculateCharacterCount(firstResponse.data);

      // Detect or get strategy
      if (config.strategy === 'auto') {
        const detection = detectPaginationStrategy(firstResponse.data, firstResponse.headers);
        if (detection.strategy) {
          strategy = getStrategy(detection.strategy);
          // Merge detected config
          Object.assign(config, detection.detectedConfig);
        } else {
          // No pagination detected, return single page result
          return this.createSinglePageResult(firstResponse.data, firstCharCount);
        }
      } else {
        strategy = getStrategy(config.strategy);
      }

      if (!strategy) {
        // Fallback to single page if no strategy
        return this.createSinglePageResult(firstResponse.data, firstCharCount);
      }

      // Set headers for Link header strategy
      if (strategy.strategyType === 'link_header') {
        linkHeaderStrategy.setHeaders(firstResponse.headers);
      }

      // Extract pagination info from first page
      const firstPageInfo = strategy.extractPaginationInfo(firstResponse.data, config);
      const firstPageResult = strategy.toPageFetchResult(
        firstPageInfo,
        firstCharCount,
        firstResponse.data
      );

      // Add first page to aggregator
      const shouldContinue = aggregator.addPage(firstPageResult);
      onPageFetched?.(pageNumber, firstPageResult.itemCount);

      // Fetch remaining pages
      currentCursor = firstPageInfo.nextCursor;
      pageNumber++;

      while (shouldContinue && aggregator.shouldContinue() && currentCursor) {
        // Build params for next page
        const pageParams = this.buildPageParams(
          originalParams,
          config,
          strategy,
          currentCursor,
          pageNumber
        );

        // Fetch next page
        const response = await fetcher(pageParams);
        const charCount = calculateCharacterCount(response.data);

        // Set headers for Link header strategy
        if (strategy.strategyType === 'link_header') {
          linkHeaderStrategy.setHeaders(response.headers);
        }

        // Extract pagination info
        const pageInfo = strategy.extractPaginationInfo(response.data, config);
        const pageResult = strategy.toPageFetchResult(pageInfo, charCount, response.data);

        // Add to aggregator
        const continueAfterThisPage = aggregator.addPage(pageResult);
        onPageFetched?.(pageNumber, pageResult.itemCount);

        if (!continueAfterThisPage) {
          break;
        }

        currentCursor = pageInfo.nextCursor;
        pageNumber++;
      }

      // Generate continuation token if truncated and more data exists
      let continuationToken: string | null = null;
      if (aggregator.getTruncationReason() && currentCursor) {
        const tokenData: ContinuationTokenData = {
          strategy: strategy.strategyType,
          cursor: currentCursor,
          itemsFetched: aggregator.getItemCount() + startItemsFetched,
          charactersFetched: aggregator.getCharacterCount() + startCharactersFetched,
          createdAt: Date.now(),
          actionId,
        };
        continuationToken = encodeContinuationToken(tokenData);
      }

      // Get final result
      const result = aggregator.getResult(continuationToken, firstPageInfo.totalItems);

      return {
        data: result.data,
        pagination: result.metadata,
        isPaginated: true,
      };
    } catch (error) {
      // Mark error and return partial results
      aggregator.markError();
      const result = aggregator.getResult();

      // If we have some data, return it with error flag
      if (result.data.length > 0) {
        return {
          data: result.data,
          pagination: {
            ...result.metadata,
            truncated: true,
            truncationReason: 'error',
          },
          isPaginated: true,
        };
      }

      // Re-throw if no data collected
      throw error;
    }
  }

  /**
   * Fetch a single page without pagination
   */
  private async fetchSinglePage(
    fetcher: PageFetcher,
    params: Record<string, unknown>,
    config: PaginationConfig
  ): Promise<PaginatedFetchResult> {
    const response = await fetcher(params);
    const charCount = calculateCharacterCount(response.data);

    // Try to extract data array and pagination info
    let data: unknown[] = [];
    let hasMore = false;

    if (config.enabled) {
      const strategy = getStrategy(config.strategy === 'auto' ? 'cursor' : config.strategy);
      if (strategy) {
        const info = strategy.extractPaginationInfo(response.data, config);
        data = info.items;
        hasMore = info.hasMore;
      } else {
        data = Array.isArray(response.data) ? response.data : [response.data];
      }
    } else {
      data = Array.isArray(response.data) ? response.data : [response.data];
    }

    return this.createSinglePageResult(data, charCount, hasMore);
  }

  /**
   * Create a result for single page fetch
   */
  private createSinglePageResult(
    data: unknown,
    characterCount: number,
    hasMore: boolean = false
  ): PaginatedFetchResult {
    const items = Array.isArray(data) ? data : [data];

    return {
      data: items,
      pagination: {
        fetchedItems: items.length,
        pagesFetched: 1,
        fetchedCharacters: characterCount,
        estimatedTokens: Math.ceil(characterCount / 4),
        hasMore,
        truncated: false,
        durationMs: 0,
      },
      isPaginated: false,
    };
  }

  /**
   * Build parameters for a page request
   */
  private buildPageParams(
    originalParams: Record<string, unknown>,
    config: PaginationConfig,
    strategy: BasePaginationStrategy | null,
    cursor: string | null,
    pageNumber: number
  ): Record<string, unknown> {
    if (!strategy) {
      return { ...originalParams };
    }

    const context: PaginationContext = {
      config,
      pageNumber,
      cursor,
      pageSize: config.defaultPageSize,
      originalParams,
    };

    const paginationParams = strategy.buildRequestParams(context);

    // Merge pagination params with original params
    return {
      ...originalParams,
      ...paginationParams.queryParams,
    };
  }

  /**
   * Auto-detect pagination strategy from a sample response
   */
  detectStrategy(
    sampleResponse: unknown,
    headers: Record<string, string> = {}
  ): {
    strategy: string | null;
    confidence: number;
    config: Partial<PaginationConfig>;
  } {
    const result = detectPaginationStrategy(sampleResponse, headers);
    return {
      strategy: result.strategy,
      confidence: result.confidence,
      config: result.detectedConfig,
    };
  }

  /**
   * Check if more pages are available
   */
  hasMorePages(response: unknown, config: PaginationConfig): boolean {
    return hasMorePages(response, config);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const paginationService = new PaginationService();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Fetch paginated data (convenience function)
 */
export async function fetchPaginated(
  options: PaginatedFetchOptions
): Promise<PaginatedFetchResult> {
  return paginationService.fetchPaginated(options);
}

/**
 * Detect pagination strategy from sample response
 */
export function detectStrategy(
  sampleResponse: unknown,
  headers?: Record<string, string>
): {
  strategy: string | null;
  confidence: number;
  config: Partial<PaginationConfig>;
} {
  return paginationService.detectStrategy(sampleResponse, headers);
}

/**
 * Create default pagination config
 */
export function createDefaultPaginationConfig(): PaginationConfig {
  return {
    enabled: false,
    strategy: 'auto',
    maxPages: DEFAULT_PAGINATION_LIMITS.maxPages,
    maxItems: DEFAULT_PAGINATION_LIMITS.maxItems,
    maxCharacters: DEFAULT_PAGINATION_LIMITS.maxCharacters,
    maxDurationMs: DEFAULT_PAGINATION_LIMITS.maxDurationMs,
    defaultPageSize: DEFAULT_PAGINATION_LIMITS.defaultPageSize,
  };
}
