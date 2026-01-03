/**
 * Cursor-Based Pagination Strategy
 *
 * Handles cursor/token-based pagination where each response includes
 * a cursor (next_cursor, pageToken, after, etc.) to fetch the next page.
 */

import type { PaginationConfig } from '../pagination.schemas';
import {
  BasePaginationStrategy,
  type PaginationContext,
  type PaginationParams,
  type ExtractedPaginationInfo,
  getArrayByPath,
  getStringByPath,
  getNumberByPath,
  getBooleanByPath,
} from './base.strategy';

// =============================================================================
// Cursor Strategy Implementation
// =============================================================================

export class CursorPaginationStrategy extends BasePaginationStrategy {
  readonly strategyType = 'cursor' as const;
  readonly displayName = 'Cursor-based Pagination';

  /**
   * Build request parameters for cursor pagination
   */
  buildRequestParams(context: PaginationContext): PaginationParams {
    const { config, cursor, pageSize } = context;
    const queryParams: Record<string, string | number> = {};

    // Add page size if configured
    if (config.limitParam) {
      queryParams[config.limitParam] = pageSize;
    }

    // Add cursor for subsequent pages
    if (cursor) {
      const cursorParam = config.cursorParam || 'cursor';
      queryParams[cursorParam] = cursor;
    }

    return { queryParams };
  }

  /**
   * Extract pagination info from cursor-based response
   */
  extractPaginationInfo(response: unknown, config: PaginationConfig): ExtractedPaginationInfo {
    // Extract data array
    const items = getArrayByPath(response, config.dataPath);

    // Extract next cursor
    let nextCursor = getStringByPath(response, config.cursorPath);

    // If no explicit cursor path configured, try common patterns
    if (nextCursor === null && !config.cursorPath) {
      nextCursor = this.findCursorInResponse(response);
    }

    // Determine if more pages exist
    let hasMore = nextCursor !== null && nextCursor !== '';

    // Check explicit hasMore path if configured
    if (config.hasMorePath) {
      const explicitHasMore = getBooleanByPath(response, config.hasMorePath);
      if (explicitHasMore !== undefined) {
        hasMore = explicitHasMore;
      }
    }

    // Extract total if available
    const totalItems = getNumberByPath(response, config.totalPath);

    return {
      items,
      nextCursor,
      hasMore,
      totalItems,
    };
  }

  /**
   * Detect if response uses cursor pagination
   * Returns confidence score 0-1
   */
  detectStrategy(response: unknown): number {
    if (!response || typeof response !== 'object') {
      return 0;
    }

    let confidence = 0;
    const obj = response as Record<string, unknown>;

    // Check for cursor indicators at root level
    const cursorFields = [
      'next_cursor',
      'nextCursor',
      'cursor',
      'after',
      'pageToken',
      'nextPageToken',
      'page_token',
      'next_page_token',
      'continuation',
      'continuationToken',
      'continuation_token',
    ];

    for (const field of cursorFields) {
      if (field in obj && obj[field] !== null && obj[field] !== undefined) {
        confidence += 0.4;
        break;
      }
    }

    // Check in meta/pagination objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta', 'page_info', 'pageInfo'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        for (const field of cursorFields) {
          if (field in (metaObj as Record<string, unknown>)) {
            confidence += 0.3;
            break;
          }
        }
      }
    }

    // Check for hasMore indicator (common with cursor pagination)
    if ('hasMore' in obj || 'has_more' in obj || 'hasNextPage' in obj) {
      confidence += 0.2;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Find cursor value in response by checking common locations
   */
  private findCursorInResponse(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const obj = response as Record<string, unknown>;

    // Direct cursor fields
    const directFields = [
      'next_cursor',
      'nextCursor',
      'cursor',
      'after',
      'pageToken',
      'nextPageToken',
      'page_token',
      'next_page_token',
      'continuation',
      'continuationToken',
    ];

    for (const field of directFields) {
      const value = obj[field];
      if (typeof value === 'string' && value !== '') {
        return value;
      }
    }

    // Check in meta objects
    const metaObjects = ['meta', 'pagination', 'paging', '_meta', 'page_info', 'pageInfo'];
    for (const metaKey of metaObjects) {
      const metaObj = obj[metaKey];
      if (metaObj && typeof metaObj === 'object') {
        for (const field of directFields) {
          const value = (metaObj as Record<string, unknown>)[field];
          if (typeof value === 'string' && value !== '') {
            return value;
          }
        }
      }
    }

    return null;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const cursorStrategy = new CursorPaginationStrategy();
