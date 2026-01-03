/**
 * Page Number Pagination Strategy
 *
 * Handles page number-based pagination where requests use a page parameter
 * to fetch pages (e.g., page=2, pageNumber=3).
 */

import type { PaginationConfig } from '../pagination.schemas';
import {
  BasePaginationStrategy,
  type PaginationContext,
  type PaginationParams,
  type ExtractedPaginationInfo,
  getArrayByPath,
  getNumberByPath,
  getBooleanByPath,
} from './base.strategy';

// =============================================================================
// Page Number Strategy Implementation
// =============================================================================

export class PageNumberPaginationStrategy extends BasePaginationStrategy {
  readonly strategyType = 'page_number' as const;
  readonly displayName = 'Page Number Pagination';

  /**
   * Build request parameters for page number pagination
   */
  buildRequestParams(context: PaginationContext): PaginationParams {
    const { config, cursor, pageSize, pageNumber } = context;
    const queryParams: Record<string, string | number> = {};

    // Determine which page to request
    let page = pageNumber;
    if (cursor !== null) {
      page = parseInt(cursor, 10);
      if (isNaN(page)) page = pageNumber;
    }

    // Add page parameter
    const pageParam = config.pageParam || 'page';
    queryParams[pageParam] = page;

    // Add page size if configured
    if (config.limitParam) {
      queryParams[config.limitParam] = pageSize;
    }

    return { queryParams };
  }

  /**
   * Extract pagination info from page number-based response
   */
  extractPaginationInfo(response: unknown, config: PaginationConfig): ExtractedPaginationInfo {
    // Extract data array
    const items = getArrayByPath(response, config.dataPath);

    // Get pagination info
    const currentPage = this.findCurrentPage(response) ?? 1;
    const totalPages =
      getNumberByPath(response, config.totalPagesPath) ?? this.findTotalPages(response);
    const totalItems = getNumberByPath(response, config.totalPath) ?? this.findTotalItems(response);

    // Calculate next page
    const nextPage = currentPage + 1;

    // Determine if more pages exist
    let hasMore = false;

    // Check explicit hasMore
    if (config.hasMorePath) {
      const explicitHasMore = getBooleanByPath(response, config.hasMorePath);
      if (explicitHasMore !== undefined) {
        hasMore = explicitHasMore;
      }
    } else if (totalPages !== undefined) {
      hasMore = currentPage < totalPages;
    } else if (totalItems !== undefined && config.defaultPageSize) {
      const calculatedTotalPages = Math.ceil(totalItems / config.defaultPageSize);
      hasMore = currentPage < calculatedTotalPages;
    } else {
      // If we got a full page of results, assume there might be more
      hasMore = items.length >= (config.defaultPageSize || 100);
    }

    // The "cursor" for page number pagination is the next page number
    const nextCursor = hasMore ? String(nextPage) : null;

    return {
      items,
      nextCursor,
      hasMore,
      totalItems,
      totalPages,
    };
  }

  /**
   * Detect if response uses page number pagination
   */
  detectStrategy(response: unknown): number {
    if (!response || typeof response !== 'object') {
      return 0;
    }

    let confidence = 0;
    const obj = response as Record<string, unknown>;

    // Check for page indicators
    const pageFields = ['page', 'pageNumber', 'page_number', 'currentPage', 'current_page'];
    for (const field of pageFields) {
      if (field in obj && typeof obj[field] === 'number') {
        confidence += 0.4;
        break;
      }
    }

    // Check for total pages
    const totalPagesFields = ['totalPages', 'total_pages', 'pages', 'pageCount', 'page_count'];
    for (const field of totalPagesFields) {
      if (field in obj && typeof obj[field] === 'number') {
        confidence += 0.4;
        break;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        const meta = metaObj as Record<string, unknown>;
        for (const field of [...pageFields, ...totalPagesFields]) {
          if (field in meta && typeof meta[field] === 'number') {
            confidence += 0.2;
            break;
          }
        }
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Find current page in response
   */
  private findCurrentPage(response: unknown): number | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const obj = response as Record<string, unknown>;
    const pageFields = ['page', 'pageNumber', 'page_number', 'currentPage', 'current_page'];

    // Check root level
    for (const field of pageFields) {
      if (typeof obj[field] === 'number') {
        return obj[field] as number;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        for (const field of pageFields) {
          const value = (metaObj as Record<string, unknown>)[field];
          if (typeof value === 'number') {
            return value;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Find total pages in response
   */
  private findTotalPages(response: unknown): number | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const obj = response as Record<string, unknown>;
    const totalPagesFields = [
      'totalPages',
      'total_pages',
      'pages',
      'pageCount',
      'page_count',
      'lastPage',
      'last_page',
    ];

    // Check root level
    for (const field of totalPagesFields) {
      if (typeof obj[field] === 'number') {
        return obj[field] as number;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        for (const field of totalPagesFields) {
          const value = (metaObj as Record<string, unknown>)[field];
          if (typeof value === 'number') {
            return value;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Find total items in response
   */
  private findTotalItems(response: unknown): number | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const obj = response as Record<string, unknown>;
    const totalFields = [
      'total',
      'totalCount',
      'total_count',
      'totalResults',
      'total_results',
      'count',
    ];

    // Check root level
    for (const field of totalFields) {
      if (typeof obj[field] === 'number') {
        return obj[field] as number;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        for (const field of totalFields) {
          const value = (metaObj as Record<string, unknown>)[field];
          if (typeof value === 'number') {
            return value;
          }
        }
      }
    }

    return undefined;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const pageNumberStrategy = new PageNumberPaginationStrategy();
