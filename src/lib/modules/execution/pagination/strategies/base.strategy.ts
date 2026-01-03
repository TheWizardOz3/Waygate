/**
 * Base Pagination Strategy
 *
 * Abstract interface that all pagination strategies must implement.
 * Provides common structure for cursor, offset, page number, and Link header strategies.
 */

import type { PaginationConfig, PaginationStrategy, PageFetchResult } from '../pagination.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Context passed to pagination strategies for building requests
 */
export interface PaginationContext {
  /** The pagination configuration for this action */
  config: PaginationConfig;
  /** Current page number (1-indexed) */
  pageNumber: number;
  /** Current cursor/offset/page value (null for first page) */
  cursor: string | null;
  /** Page size to request */
  pageSize: number;
  /** Original request parameters (to merge with pagination params) */
  originalParams: Record<string, unknown>;
}

/**
 * Parameters to add to the request for pagination
 */
export interface PaginationParams {
  /** Query parameters to add */
  queryParams?: Record<string, string | number>;
  /** Body parameters to add (for POST-based pagination) */
  bodyParams?: Record<string, unknown>;
  /** Headers to add */
  headers?: Record<string, string>;
}

/**
 * Result of extracting pagination info from a response
 */
export interface ExtractedPaginationInfo {
  /** Data items from the response */
  items: unknown[];
  /** Next cursor/offset/page value (null if no more pages) */
  nextCursor: string | null;
  /** Whether more pages exist */
  hasMore: boolean;
  /** Total items (if API provides this) */
  totalItems?: number;
  /** Total pages (if API provides this) */
  totalPages?: number;
}

/**
 * Options for building a page request
 */
export interface BuildRequestOptions {
  /** Whether this is the first page */
  isFirstPage: boolean;
  /** The cursor from the previous page (null for first page) */
  previousCursor: string | null;
  /** The page size to request */
  pageSize: number;
}

// =============================================================================
// Abstract Base Strategy
// =============================================================================

/**
 * Abstract base class for pagination strategies
 *
 * Each strategy implements:
 * - buildRequestParams: Add pagination parameters to the request
 * - extractPaginationInfo: Extract pagination info from the response
 * - detectStrategy: Check if this strategy matches a response pattern
 */
export abstract class BasePaginationStrategy {
  /** The strategy type identifier */
  abstract readonly strategyType: PaginationStrategy;

  /** Display name for the strategy */
  abstract readonly displayName: string;

  /**
   * Build request parameters for fetching a page
   *
   * @param context - Pagination context with config and current state
   * @returns Parameters to add to the request
   */
  abstract buildRequestParams(context: PaginationContext): PaginationParams;

  /**
   * Extract pagination information from an API response
   *
   * @param response - The raw API response
   * @param config - The pagination configuration
   * @returns Extracted pagination info including items and next cursor
   */
  abstract extractPaginationInfo(
    response: unknown,
    config: PaginationConfig
  ): ExtractedPaginationInfo;

  /**
   * Check if this strategy can handle a given response
   * Used for auto-detection
   *
   * @param response - The raw API response
   * @param headers - Response headers (optional, only needed for Link header strategy)
   * @returns Confidence score (0-1) that this strategy matches
   */
  abstract detectStrategy(response: unknown, headers?: Record<string, string>): number;

  /**
   * Convert a page fetch result to the standard format
   *
   * @param info - Extracted pagination info
   * @param responseCharCount - Character count of the response
   * @param rawResponse - The raw response (for debugging)
   */
  toPageFetchResult(
    info: ExtractedPaginationInfo,
    responseCharCount: number,
    rawResponse?: unknown
  ): PageFetchResult {
    return {
      items: info.items,
      itemCount: info.items.length,
      characterCount: responseCharCount,
      nextCursor: info.nextCursor,
      hasMore: info.hasMore,
      totalItems: info.totalItems,
      rawResponse,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely get a value from an object using a simple dot-notation path
 * Supports basic JSONPath-like syntax: $.data.items or data.items
 *
 * @param obj - The object to extract from
 * @param path - Dot-notation path (e.g., "data.items" or "$.data.items")
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath(obj: unknown, path: string | undefined): unknown {
  if (!path || obj === null || obj === undefined) {
    return undefined;
  }

  // Remove leading $. if present (JSONPath style)
  const cleanPath = path.startsWith('$.') ? path.slice(2) : path;

  // Handle empty path (return root)
  if (!cleanPath) {
    return obj;
  }

  const parts = cleanPath.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array index notation: items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Safely extract an array from an object using a path
 * Returns empty array if not found or not an array
 */
export function getArrayByPath(obj: unknown, path: string | undefined): unknown[] {
  const value = getValueByPath(obj, path);
  return Array.isArray(value) ? value : [];
}

/**
 * Safely extract a string from an object using a path
 * Returns null if not found or not a string
 */
export function getStringByPath(obj: unknown, path: string | undefined): string | null {
  const value = getValueByPath(obj, path);
  if (typeof value === 'string') {
    return value;
  }
  // Handle numbers/booleans that should be stringified
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

/**
 * Safely extract a number from an object using a path
 * Returns undefined if not found or not a number
 */
export function getNumberByPath(obj: unknown, path: string | undefined): number | undefined {
  const value = getValueByPath(obj, path);
  if (typeof value === 'number') {
    return value;
  }
  // Handle string numbers
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Safely extract a boolean from an object using a path
 * Returns undefined if not found or not a boolean
 */
export function getBooleanByPath(obj: unknown, path: string | undefined): boolean | undefined {
  const value = getValueByPath(obj, path);
  if (typeof value === 'boolean') {
    return value;
  }
  // Handle common string representations
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

/**
 * Check if a response looks like it contains paginated data
 * (has array data and some pagination indicator)
 */
export function looksLikePaginatedResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const obj = response as Record<string, unknown>;

  // Check for common data array patterns
  const hasDataArray =
    Array.isArray(obj.data) ||
    Array.isArray(obj.results) ||
    Array.isArray(obj.items) ||
    Array.isArray(obj.records) ||
    Array.isArray(obj.entries) ||
    Array.isArray(obj.list);

  // Check for pagination indicators
  const hasPaginationIndicator =
    'next_cursor' in obj ||
    'nextCursor' in obj ||
    'cursor' in obj ||
    'next' in obj ||
    'nextPage' in obj ||
    'next_page' in obj ||
    'page' in obj ||
    'offset' in obj ||
    'total' in obj ||
    'totalCount' in obj ||
    'total_count' in obj ||
    'hasMore' in obj ||
    'has_more' in obj ||
    'meta' in obj ||
    'pagination' in obj;

  return hasDataArray || hasPaginationIndicator;
}
