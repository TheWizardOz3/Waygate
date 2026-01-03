/**
 * Pagination Strategies Unit Tests
 *
 * Tests for cursor, offset, page-number, and link-header pagination strategies.
 */

import { describe, it, expect } from 'vitest';
import {
  cursorStrategy,
  offsetStrategy,
  pageNumberStrategy,
  linkHeaderStrategy,
  getStrategy,
  getAllStrategies,
  type PaginationConfig,
  type PaginationContext,
} from '@/lib/modules/execution/pagination';

// =============================================================================
// Helper Functions
// =============================================================================

function createConfig(overrides: Partial<PaginationConfig> = {}): PaginationConfig {
  return {
    enabled: true,
    strategy: 'auto',
    maxPages: 5,
    maxItems: 500,
    maxCharacters: 100000,
    maxDurationMs: 30000,
    defaultPageSize: 100,
    ...overrides,
  };
}

function createContext(overrides: Partial<PaginationContext> = {}): PaginationContext {
  return {
    config: createConfig(),
    pageNumber: 1,
    cursor: null,
    pageSize: 100,
    originalParams: {},
    ...overrides,
  };
}

// =============================================================================
// Cursor Strategy Tests
// =============================================================================

describe('CursorPaginationStrategy', () => {
  describe('buildRequestParams', () => {
    it('should add cursor param for subsequent pages', () => {
      const context = createContext({
        cursor: 'abc123',
        config: createConfig({ cursorParam: 'cursor', limitParam: 'limit' }),
      });

      const params = cursorStrategy.buildRequestParams(context);

      expect(params.queryParams?.cursor).toBe('abc123');
      expect(params.queryParams?.limit).toBe(100);
    });

    it('should not add cursor for first page', () => {
      const context = createContext({
        cursor: null,
        config: createConfig({ cursorParam: 'cursor', limitParam: 'limit' }),
      });

      const params = cursorStrategy.buildRequestParams(context);

      expect(params.queryParams?.cursor).toBeUndefined();
      expect(params.queryParams?.limit).toBe(100);
    });

    it('should use configured cursor param name', () => {
      const context = createContext({
        cursor: 'token123',
        config: createConfig({ cursorParam: 'page_token' }),
      });

      const params = cursorStrategy.buildRequestParams(context);

      expect(params.queryParams?.page_token).toBe('token123');
    });
  });

  describe('extractPaginationInfo', () => {
    it('should extract cursor from configured path', () => {
      const response = {
        data: [{ id: 1 }, { id: 2 }],
        meta: { next_cursor: 'cursor123' },
      };
      const config = createConfig({
        cursorPath: '$.meta.next_cursor',
        dataPath: '$.data',
      });

      const info = cursorStrategy.extractPaginationInfo(response, config);

      expect(info.items).toEqual([{ id: 1 }, { id: 2 }]);
      expect(info.nextCursor).toBe('cursor123');
      expect(info.hasMore).toBe(true);
    });

    it('should detect no more pages when cursor is null', () => {
      const response = {
        data: [{ id: 1 }],
        meta: { next_cursor: null },
      };
      const config = createConfig({
        cursorPath: '$.meta.next_cursor',
        dataPath: '$.data',
      });

      const info = cursorStrategy.extractPaginationInfo(response, config);

      expect(info.nextCursor).toBeNull();
      expect(info.hasMore).toBe(false);
    });

    it('should respect explicit hasMore path', () => {
      const response = {
        data: [{ id: 1 }],
        next_cursor: 'cursor123',
        has_more: false, // Explicitly false even with cursor
      };
      const config = createConfig({
        cursorPath: '$.next_cursor',
        dataPath: '$.data',
        hasMorePath: '$.has_more',
      });

      const info = cursorStrategy.extractPaginationInfo(response, config);

      expect(info.hasMore).toBe(false);
    });

    it('should find cursor in common locations when no path configured', () => {
      const response = {
        results: [{ id: 1 }],
        nextCursor: 'found_cursor',
      };
      const config = createConfig({
        dataPath: '$.results',
        // No cursorPath configured
      });

      const info = cursorStrategy.extractPaginationInfo(response, config);

      expect(info.nextCursor).toBe('found_cursor');
    });
  });

  describe('detectStrategy', () => {
    it('should detect cursor pagination with high confidence', () => {
      const response = {
        data: [],
        next_cursor: 'abc123',
      };

      const confidence = cursorStrategy.detectStrategy(response);

      expect(confidence).toBeGreaterThanOrEqual(0.3);
    });

    it('should detect cursor in nested meta object', () => {
      const response = {
        data: [],
        meta: { cursor: 'abc123' },
      };

      const confidence = cursorStrategy.detectStrategy(response);

      expect(confidence).toBeGreaterThan(0);
    });

    it('should return 0 for non-cursor responses', () => {
      const response = {
        data: [],
        page: 1,
        total: 100,
      };

      const confidence = cursorStrategy.detectStrategy(response);

      expect(confidence).toBeLessThan(0.3);
    });
  });
});

// =============================================================================
// Offset Strategy Tests
// =============================================================================

describe('OffsetPaginationStrategy', () => {
  describe('buildRequestParams', () => {
    it('should calculate offset from cursor', () => {
      const context = createContext({
        cursor: '100',
        pageSize: 50,
        config: createConfig({ offsetParam: 'offset', limitParam: 'limit' }),
      });

      const params = offsetStrategy.buildRequestParams(context);

      expect(params.queryParams?.offset).toBe(100);
      expect(params.queryParams?.limit).toBe(50);
    });

    it('should calculate offset from page number when no cursor', () => {
      const context = createContext({
        cursor: null,
        pageNumber: 3,
        pageSize: 50,
        config: createConfig({ offsetParam: 'offset', limitParam: 'limit' }),
      });

      const params = offsetStrategy.buildRequestParams(context);

      expect(params.queryParams?.offset).toBe(100); // (3-1) * 50
    });

    it('should start at 0 for first page', () => {
      const context = createContext({
        cursor: null,
        pageNumber: 1,
        config: createConfig({ offsetParam: 'offset', limitParam: 'limit' }),
      });

      const params = offsetStrategy.buildRequestParams(context);

      expect(params.queryParams?.offset).toBe(0);
    });
  });

  describe('extractPaginationInfo', () => {
    it('should calculate next offset based on items', () => {
      const response = {
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        total: 10,
        offset: 0,
      };
      const config = createConfig({
        dataPath: '$.data',
        totalPath: '$.total',
      });

      const info = offsetStrategy.extractPaginationInfo(response, config);

      expect(info.items.length).toBe(3);
      expect(info.nextCursor).toBe('3'); // Next offset
      expect(info.hasMore).toBe(true);
      expect(info.totalItems).toBe(10);
    });

    it('should detect no more pages when total reached', () => {
      const response = {
        data: [{ id: 8 }, { id: 9 }, { id: 10 }],
        total: 10,
        offset: 7,
      };
      const config = createConfig({
        dataPath: '$.data',
        totalPath: '$.total',
      });

      const info = offsetStrategy.extractPaginationInfo(response, config);

      expect(info.hasMore).toBe(false);
    });
  });

  describe('detectStrategy', () => {
    it('should detect offset pagination', () => {
      const response = {
        data: [],
        offset: 0,
        total: 100,
      };

      const confidence = offsetStrategy.detectStrategy(response);

      expect(confidence).toBeGreaterThan(0.3);
    });
  });
});

// =============================================================================
// Page Number Strategy Tests
// =============================================================================

describe('PageNumberPaginationStrategy', () => {
  describe('buildRequestParams', () => {
    it('should use page number from cursor', () => {
      const context = createContext({
        cursor: '3',
        config: createConfig({ pageParam: 'page', limitParam: 'per_page' }),
      });

      const params = pageNumberStrategy.buildRequestParams(context);

      expect(params.queryParams?.page).toBe(3);
      expect(params.queryParams?.per_page).toBe(100);
    });

    it('should use pageNumber when no cursor', () => {
      const context = createContext({
        cursor: null,
        pageNumber: 2,
        config: createConfig({ pageParam: 'page' }),
      });

      const params = pageNumberStrategy.buildRequestParams(context);

      expect(params.queryParams?.page).toBe(2);
    });
  });

  describe('extractPaginationInfo', () => {
    it('should calculate next page and detect hasMore from totalPages', () => {
      const response = {
        data: [{ id: 1 }],
        page: 1,
        totalPages: 5,
      };
      const config = createConfig({
        dataPath: '$.data',
        totalPagesPath: '$.totalPages',
      });

      const info = pageNumberStrategy.extractPaginationInfo(response, config);

      expect(info.nextCursor).toBe('2');
      expect(info.hasMore).toBe(true);
      expect(info.totalPages).toBe(5);
    });

    it('should detect last page', () => {
      const response = {
        data: [{ id: 1 }],
        page: 5,
        totalPages: 5,
      };
      const config = createConfig({
        dataPath: '$.data',
        totalPagesPath: '$.totalPages',
      });

      const info = pageNumberStrategy.extractPaginationInfo(response, config);

      expect(info.hasMore).toBe(false);
      expect(info.nextCursor).toBeNull();
    });
  });

  describe('detectStrategy', () => {
    it('should detect page number pagination', () => {
      const response = {
        data: [],
        page: 1,
        totalPages: 10,
      };

      const confidence = pageNumberStrategy.detectStrategy(response);

      expect(confidence).toBeGreaterThan(0.3);
    });
  });
});

// =============================================================================
// Link Header Strategy Tests
// =============================================================================

describe('LinkHeaderPaginationStrategy', () => {
  describe('extractPaginationInfo', () => {
    it('should parse Link header with next relation', () => {
      linkHeaderStrategy.setHeaders({
        link: '<https://api.example.com/items?page=2>; rel="next", <https://api.example.com/items?page=5>; rel="last"',
      });

      const response = [{ id: 1 }, { id: 2 }];
      const config = createConfig();

      const info = linkHeaderStrategy.extractPaginationInfo(response, config);

      expect(info.nextCursor).toBe('https://api.example.com/items?page=2');
      expect(info.hasMore).toBe(true);
    });

    it('should detect no more pages when no next link', () => {
      linkHeaderStrategy.setHeaders({
        link: '<https://api.example.com/items?page=1>; rel="first"',
      });

      const response = [{ id: 1 }];
      const config = createConfig();

      const info = linkHeaderStrategy.extractPaginationInfo(response, config);

      expect(info.nextCursor).toBeNull();
      expect(info.hasMore).toBe(false);
    });

    it('should extract total from X-Total-Count header', () => {
      linkHeaderStrategy.setHeaders({
        link: '<https://api.example.com/items?page=2>; rel="next"',
        'x-total-count': '100',
      });

      const response = [{ id: 1 }];
      const config = createConfig();

      const info = linkHeaderStrategy.extractPaginationInfo(response, config);

      expect(info.totalItems).toBe(100);
    });
  });

  describe('detectStrategy', () => {
    it('should detect Link header pagination with high confidence', () => {
      const response = { data: [] };
      const headers = {
        link: '<https://api.example.com?page=2>; rel="next"',
      };

      const confidence = linkHeaderStrategy.detectStrategy(response, headers);

      expect(confidence).toBe(1.0);
    });

    it('should return 0 when no Link header', () => {
      const response = { data: [] };
      const headers = {};

      const confidence = linkHeaderStrategy.detectStrategy(response, headers);

      expect(confidence).toBe(0);
    });
  });

  describe('isValidNextUrl', () => {
    it('should validate absolute URLs', () => {
      expect(linkHeaderStrategy.isValidNextUrl('https://api.example.com/page2')).toBe(true);
      expect(linkHeaderStrategy.isValidNextUrl('http://api.example.com/page2')).toBe(true);
    });

    it('should validate relative URLs', () => {
      expect(linkHeaderStrategy.isValidNextUrl('/api/items?page=2')).toBe(true);
      expect(linkHeaderStrategy.isValidNextUrl('?page=2')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(linkHeaderStrategy.isValidNextUrl(null)).toBe(false);
      expect(linkHeaderStrategy.isValidNextUrl('')).toBe(false);
    });
  });

  describe('extractPageFromUrl', () => {
    it('should extract page number from URL', () => {
      expect(linkHeaderStrategy.extractPageFromUrl('https://api.com?page=5')).toBe(5);
      expect(linkHeaderStrategy.extractPageFromUrl('/items?foo=bar&page=3')).toBe(3);
    });

    it('should return null when no page param', () => {
      expect(linkHeaderStrategy.extractPageFromUrl('https://api.com?cursor=abc')).toBeNull();
    });
  });
});

// =============================================================================
// Strategy Registry Tests
// =============================================================================

describe('Strategy Registry', () => {
  describe('getStrategy', () => {
    it('should return correct strategy for each type', () => {
      expect(getStrategy('cursor')).toBe(cursorStrategy);
      expect(getStrategy('offset')).toBe(offsetStrategy);
      expect(getStrategy('page_number')).toBe(pageNumberStrategy);
      expect(getStrategy('link_header')).toBe(linkHeaderStrategy);
    });

    it('should return null for auto strategy', () => {
      expect(getStrategy('auto')).toBeNull();
    });
  });

  describe('getAllStrategies', () => {
    it('should return all strategy instances', () => {
      const strategies = getAllStrategies();

      expect(strategies.length).toBe(4);
      expect(strategies).toContain(cursorStrategy);
      expect(strategies).toContain(offsetStrategy);
      expect(strategies).toContain(pageNumberStrategy);
      expect(strategies).toContain(linkHeaderStrategy);
    });
  });
});
