/**
 * Offset/Limit Pagination Strategy
 *
 * Handles offset-based pagination where requests use offset+limit parameters
 * to fetch slices of data (e.g., offset=100&limit=50).
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
// Offset Strategy Implementation
// =============================================================================

export class OffsetPaginationStrategy extends BasePaginationStrategy {
  readonly strategyType = 'offset' as const;
  readonly displayName = 'Offset/Limit Pagination';

  /**
   * Build request parameters for offset pagination
   */
  buildRequestParams(context: PaginationContext): PaginationParams {
    const { config, cursor, pageSize, pageNumber } = context;
    const queryParams: Record<string, string | number> = {};

    // Calculate offset from cursor or page number
    let offset = 0;
    if (cursor !== null) {
      offset = parseInt(cursor, 10);
      if (isNaN(offset)) offset = 0;
    } else if (pageNumber > 1) {
      // Calculate offset from page number (0-indexed offset)
      offset = (pageNumber - 1) * pageSize;
    }

    // Add offset parameter
    const offsetParam = config.offsetParam || 'offset';
    queryParams[offsetParam] = offset;

    // Add limit parameter
    const limitParam = config.limitParam || 'limit';
    queryParams[limitParam] = pageSize;

    return { queryParams };
  }

  /**
   * Extract pagination info from offset-based response
   */
  extractPaginationInfo(response: unknown, config: PaginationConfig): ExtractedPaginationInfo {
    // Extract data array
    const items = getArrayByPath(response, config.dataPath);

    // Get total count if available
    const totalItems =
      getNumberByPath(response, config.totalPath) ?? this.findTotalInResponse(response);

    // Calculate next offset
    // We need to know the current offset to calculate the next one
    // This is typically passed in the response or we track it ourselves
    const currentOffset = this.findOffsetInResponse(response) ?? 0;
    const nextOffset = currentOffset + items.length;

    // Determine if more pages exist
    let hasMore = false;

    // Check explicit hasMore
    if (config.hasMorePath) {
      const explicitHasMore = getBooleanByPath(response, config.hasMorePath);
      if (explicitHasMore !== undefined) {
        hasMore = explicitHasMore;
      }
    } else if (totalItems !== undefined) {
      // Calculate from total
      hasMore = nextOffset < totalItems;
    } else {
      // If we got a full page of results, assume there might be more
      hasMore = items.length >= (config.defaultPageSize || 100);
    }

    // The "cursor" for offset pagination is the next offset value
    const nextCursor = hasMore ? String(nextOffset) : null;

    return {
      items,
      nextCursor,
      hasMore,
      totalItems,
    };
  }

  /**
   * Detect if response uses offset pagination
   */
  detectStrategy(response: unknown): number {
    if (!response || typeof response !== 'object') {
      return 0;
    }

    let confidence = 0;
    const obj = response as Record<string, unknown>;

    // Check for offset/skip indicators
    const offsetFields = ['offset', 'skip', 'start', 'from'];
    for (const field of offsetFields) {
      if (field in obj && typeof obj[field] === 'number') {
        confidence += 0.4;
        break;
      }
    }

    // Check for total/count (common with offset pagination)
    const totalFields = ['total', 'totalCount', 'total_count', 'count', 'totalResults'];
    for (const field of totalFields) {
      if (field in obj && typeof obj[field] === 'number') {
        confidence += 0.3;
        break;
      }
    }

    // Check for limit indicator
    const limitFields = ['limit', 'per_page', 'perPage', 'pageSize', 'size'];
    for (const field of limitFields) {
      if (field in obj && typeof obj[field] === 'number') {
        confidence += 0.2;
        break;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        const meta = metaObj as Record<string, unknown>;
        if ('offset' in meta || 'skip' in meta || 'total' in meta) {
          confidence += 0.2;
          break;
        }
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Find total count in response
   */
  private findTotalInResponse(response: unknown): number | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const obj = response as Record<string, unknown>;
    const totalFields = [
      'total',
      'totalCount',
      'total_count',
      'count',
      'totalResults',
      'total_results',
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

  /**
   * Find current offset in response
   */
  private findOffsetInResponse(response: unknown): number | undefined {
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const obj = response as Record<string, unknown>;
    const offsetFields = ['offset', 'skip', 'start', 'from'];

    // Check root level
    for (const field of offsetFields) {
      if (typeof obj[field] === 'number') {
        return obj[field] as number;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        for (const field of offsetFields) {
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

export const offsetStrategy = new OffsetPaginationStrategy();
