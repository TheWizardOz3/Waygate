/**
 * Pagination Detector
 *
 * Auto-detects pagination strategy from API responses.
 * Analyzes response structure and headers to infer the best pagination approach.
 */

import type { PaginationConfig, PaginationStrategy } from './pagination.schemas';
import { getValueByPath, looksLikePaginatedResponse } from './strategies/base.strategy';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of pagination detection
 */
export interface DetectionResult {
  /** Detected strategy (or null if no pagination detected) */
  strategy: PaginationStrategy | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detected configuration based on response analysis */
  detectedConfig: Partial<PaginationConfig>;
  /** Human-readable explanation of detection */
  explanation: string;
}

/**
 * Pattern definition for detection
 */
interface DetectionPattern {
  name: string;
  strategy: PaginationStrategy;
  /** Fields to check in the response */
  responseFields?: string[];
  /** Fields to check in nested meta/pagination objects */
  metaFields?: string[];
  /** Header to check */
  header?: string;
  /** Weight for this pattern (higher = more confident) */
  weight: number;
}

// =============================================================================
// Detection Patterns
// =============================================================================

/**
 * Common patterns for cursor-based pagination
 */
const CURSOR_PATTERNS: DetectionPattern[] = [
  { name: 'next_cursor', strategy: 'cursor', responseFields: ['next_cursor'], weight: 1.0 },
  { name: 'nextCursor', strategy: 'cursor', responseFields: ['nextCursor'], weight: 1.0 },
  { name: 'cursor', strategy: 'cursor', responseFields: ['cursor'], weight: 0.8 },
  { name: 'after', strategy: 'cursor', responseFields: ['after'], weight: 0.7 },
  {
    name: 'pageToken',
    strategy: 'cursor',
    responseFields: ['pageToken', 'nextPageToken'],
    weight: 1.0,
  },
  {
    name: 'page_token',
    strategy: 'cursor',
    responseFields: ['page_token', 'next_page_token'],
    weight: 1.0,
  },
  {
    name: 'continuation',
    strategy: 'cursor',
    responseFields: ['continuation', 'continuationToken'],
    weight: 0.9,
  },
  {
    name: 'meta.cursor',
    strategy: 'cursor',
    metaFields: ['cursor', 'next_cursor', 'nextCursor'],
    weight: 0.9,
  },
  { name: 'pagination.cursor', strategy: 'cursor', metaFields: ['cursor'], weight: 0.9 },
];

/**
 * Common patterns for offset/limit pagination
 */
const OFFSET_PATTERNS: DetectionPattern[] = [
  { name: 'offset', strategy: 'offset', responseFields: ['offset'], weight: 0.9 },
  { name: 'skip', strategy: 'offset', responseFields: ['skip'], weight: 0.8 },
  { name: 'start', strategy: 'offset', responseFields: ['start'], weight: 0.7 },
  { name: 'from', strategy: 'offset', responseFields: ['from'], weight: 0.6 },
  { name: 'meta.offset', strategy: 'offset', metaFields: ['offset', 'skip'], weight: 0.9 },
];

/**
 * Common patterns for page number pagination
 */
const PAGE_NUMBER_PATTERNS: DetectionPattern[] = [
  { name: 'page', strategy: 'page_number', responseFields: ['page'], weight: 0.9 },
  {
    name: 'pageNumber',
    strategy: 'page_number',
    responseFields: ['pageNumber', 'page_number'],
    weight: 0.9,
  },
  {
    name: 'currentPage',
    strategy: 'page_number',
    responseFields: ['currentPage', 'current_page'],
    weight: 0.9,
  },
  {
    name: 'totalPages',
    strategy: 'page_number',
    responseFields: ['totalPages', 'total_pages'],
    weight: 0.8,
  },
  {
    name: 'meta.page',
    strategy: 'page_number',
    metaFields: ['page', 'pageNumber', 'currentPage'],
    weight: 0.9,
  },
];

// Link header detection is handled via checkLinkHeader function below

// =============================================================================
// Detector Functions
// =============================================================================

/**
 * Detect pagination strategy from response and headers
 */
export function detectPaginationStrategy(
  response: unknown,
  headers: Record<string, string>
): DetectionResult {
  // Check if response looks like it could be paginated
  if (!looksLikePaginatedResponse(response)) {
    return {
      strategy: null,
      confidence: 0,
      detectedConfig: {},
      explanation: 'Response does not appear to contain paginated data',
    };
  }

  const scores: Map<
    PaginationStrategy,
    { score: number; config: Partial<PaginationConfig>; patterns: string[] }
  > = new Map();

  // Initialize scores
  for (const strategy of [
    'cursor',
    'offset',
    'page_number',
    'link_header',
  ] as PaginationStrategy[]) {
    scores.set(strategy, { score: 0, config: {}, patterns: [] });
  }

  // Check Link header first (most definitive)
  const linkResult = checkLinkHeader(headers);
  if (linkResult) {
    const current = scores.get('link_header')!;
    current.score += 1.0;
    current.patterns.push('Link header present');
    current.config = linkResult;
  }

  // Check response patterns
  if (response && typeof response === 'object') {
    // Check cursor patterns
    for (const pattern of CURSOR_PATTERNS) {
      const result = checkPattern(response, pattern);
      if (result.found) {
        const current = scores.get('cursor')!;
        current.score += pattern.weight;
        current.patterns.push(pattern.name);
        Object.assign(current.config, result.config);
      }
    }

    // Check offset patterns
    for (const pattern of OFFSET_PATTERNS) {
      const result = checkPattern(response, pattern);
      if (result.found) {
        const current = scores.get('offset')!;
        current.score += pattern.weight;
        current.patterns.push(pattern.name);
        Object.assign(current.config, result.config);
      }
    }

    // Check page number patterns
    for (const pattern of PAGE_NUMBER_PATTERNS) {
      const result = checkPattern(response, pattern);
      if (result.found) {
        const current = scores.get('page_number')!;
        current.score += pattern.weight;
        current.patterns.push(pattern.name);
        Object.assign(current.config, result.config);
      }
    }

    // Additional heuristics
    const heuristics = applyHeuristics(response);
    for (const [strategy, boost] of Object.entries(heuristics)) {
      const current = scores.get(strategy as PaginationStrategy);
      if (current) {
        current.score += boost;
      }
    }
  }

  // Find the best strategy
  let bestStrategy: PaginationStrategy | null = null;
  let bestScore = 0;
  let bestConfig: Partial<PaginationConfig> = {};
  let bestPatterns: string[] = [];

  scores.forEach((data, strategy) => {
    if (data.score > bestScore) {
      bestStrategy = strategy;
      bestScore = data.score;
      bestConfig = data.config;
      bestPatterns = data.patterns;
    }
  });

  // Normalize confidence to 0-1 range
  const confidence = Math.min(bestScore / 2.0, 1.0);

  // If confidence is too low, return no detection
  if (confidence < 0.3 || !bestStrategy) {
    return {
      strategy: null,
      confidence: 0,
      detectedConfig: {},
      explanation: 'No clear pagination pattern detected',
    };
  }

  // Detect data path
  const dataPath = detectDataPath(response);
  if (dataPath) {
    bestConfig.dataPath = dataPath;
  }

  // Detect hasMore path
  const hasMorePath = detectHasMorePath(response);
  if (hasMorePath) {
    bestConfig.hasMorePath = hasMorePath;
  }

  return {
    strategy: bestStrategy,
    confidence,
    detectedConfig: {
      ...bestConfig,
      strategy: bestStrategy,
      enabled: true,
    },
    explanation: `Detected ${bestStrategy} pagination based on: ${bestPatterns.join(', ')}`,
  };
}

/**
 * Check a single pattern against the response
 */
function checkPattern(
  response: unknown,
  pattern: DetectionPattern
): { found: boolean; config: Partial<PaginationConfig> } {
  const config: Partial<PaginationConfig> = {};
  let found = false;

  // Check response-level fields
  if (pattern.responseFields) {
    for (const field of pattern.responseFields) {
      const value = getValueByPath(response, field);
      if (value !== undefined && value !== null) {
        found = true;
        // Map field to config
        if (pattern.strategy === 'cursor') {
          config.cursorPath = `$.${field}`;
        } else if (pattern.strategy === 'offset') {
          // offset patterns indicate the current offset
        } else if (pattern.strategy === 'page_number') {
          if (field.includes('total') || field.includes('Total')) {
            config.totalPagesPath = `$.${field}`;
          }
        }
        break;
      }
    }
  }

  // Check meta/pagination nested fields
  if (pattern.metaFields && !found) {
    const metaObjects = ['meta', 'pagination', 'paging', '_meta', 'page_info', 'pageInfo'];
    for (const metaKey of metaObjects) {
      const metaObj = getValueByPath(response, metaKey);
      if (metaObj && typeof metaObj === 'object') {
        for (const field of pattern.metaFields) {
          const value = getValueByPath(metaObj, field);
          if (value !== undefined && value !== null) {
            found = true;
            // Map field to config
            if (pattern.strategy === 'cursor') {
              config.cursorPath = `$.${metaKey}.${field}`;
            } else if (pattern.strategy === 'page_number') {
              if (field.includes('total') || field.includes('Total')) {
                config.totalPagesPath = `$.${metaKey}.${field}`;
              }
            }
            break;
          }
        }
        if (found) break;
      }
    }
  }

  return { found, config };
}

/**
 * Check for Link header pagination
 */
function checkLinkHeader(headers: Record<string, string>): Partial<PaginationConfig> | null {
  const linkHeader = headers['link'] || headers['Link'];
  if (!linkHeader) return null;

  // Check if it contains pagination links
  if (
    linkHeader.includes('rel="next"') ||
    linkHeader.includes("rel='next'") ||
    linkHeader.includes('rel=next')
  ) {
    return {
      strategy: 'link_header',
      enabled: true,
    };
  }

  return null;
}

/**
 * Apply additional heuristics based on response structure
 */
function applyHeuristics(response: unknown): Record<string, number> {
  const boosts: Record<string, number> = {};

  if (!response || typeof response !== 'object') {
    return boosts;
  }

  const obj = response as Record<string, unknown>;

  // If there's a 'total' or 'count' field, slightly boost offset/page_number
  if ('total' in obj || 'totalCount' in obj || 'total_count' in obj || 'count' in obj) {
    boosts['offset'] = (boosts['offset'] || 0) + 0.3;
    boosts['page_number'] = (boosts['page_number'] || 0) + 0.3;
  }

  // If there's a 'hasMore' or 'has_more' field, boost cursor
  if ('hasMore' in obj || 'has_more' in obj || 'hasNextPage' in obj || 'has_next_page' in obj) {
    boosts['cursor'] = (boosts['cursor'] || 0) + 0.3;
  }

  // If there's an explicit 'next' URL, boost cursor
  if ('next' in obj && typeof obj['next'] === 'string') {
    boosts['cursor'] = (boosts['cursor'] || 0) + 0.2;
  }

  return boosts;
}

/**
 * Detect the path to the data array in the response
 */
function detectDataPath(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const obj = response as Record<string, unknown>;

  // Check common data array field names
  const dataFields = [
    'data',
    'results',
    'items',
    'records',
    'entries',
    'list',
    'rows',
    'objects',
    'values',
  ];

  for (const field of dataFields) {
    if (Array.isArray(obj[field])) {
      return `$.${field}`;
    }
  }

  // Check if root is an array
  if (Array.isArray(response)) {
    return '$';
  }

  // Check nested in meta/response/body
  const wrappers = ['response', 'body', 'result', 'content'];
  for (const wrapper of wrappers) {
    const wrapped = obj[wrapper];
    if (wrapped && typeof wrapped === 'object') {
      for (const field of dataFields) {
        if (Array.isArray((wrapped as Record<string, unknown>)[field])) {
          return `$.${wrapper}.${field}`;
        }
      }
    }
  }

  return undefined;
}

/**
 * Detect the path to the hasMore indicator
 */
function detectHasMorePath(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const obj = response as Record<string, unknown>;

  // Check common hasMore field names at root
  const hasMoreFields = [
    'hasMore',
    'has_more',
    'hasNextPage',
    'has_next_page',
    'moreAvailable',
    'more',
  ];
  for (const field of hasMoreFields) {
    if (typeof obj[field] === 'boolean') {
      return `$.${field}`;
    }
  }

  // Check in meta/pagination objects
  const metaObjects = ['meta', 'pagination', 'paging', '_meta', 'page_info', 'pageInfo'];
  for (const metaKey of metaObjects) {
    const metaObj = obj[metaKey];
    if (metaObj && typeof metaObj === 'object') {
      for (const field of hasMoreFields) {
        if (typeof (metaObj as Record<string, unknown>)[field] === 'boolean') {
          return `$.${metaKey}.${field}`;
        }
      }
    }
  }

  return undefined;
}

/**
 * Detect pagination from a sample response (convenience function)
 */
export function detectFromSample(
  sampleResponse: unknown,
  sampleHeaders?: Record<string, string>
): DetectionResult {
  return detectPaginationStrategy(sampleResponse, sampleHeaders ?? {});
}

/**
 * Check if a response indicates more pages are available
 */
export function hasMorePages(response: unknown, config: PaginationConfig): boolean {
  // Check explicit hasMore path
  if (config.hasMorePath) {
    const hasMore = getValueByPath(response, config.hasMorePath);
    if (typeof hasMore === 'boolean') {
      return hasMore;
    }
  }

  // Check for next cursor
  if (config.cursorPath) {
    const cursor = getValueByPath(response, config.cursorPath);
    if (cursor !== null && cursor !== undefined && cursor !== '') {
      return true;
    }
  }

  // Check data array - if it's empty or less than expected, assume no more
  if (config.dataPath) {
    const data = getValueByPath(response, config.dataPath);
    if (Array.isArray(data) && data.length === 0) {
      return false;
    }
  }

  // Default to true (safer to try another page than to stop early)
  return true;
}
