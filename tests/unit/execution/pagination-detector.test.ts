/**
 * Pagination Detector Unit Tests
 *
 * Tests for auto-detection of pagination strategies from API responses.
 */

import { describe, it, expect } from 'vitest';
import {
  detectPaginationStrategy,
  detectFromSample,
  hasMorePages,
  type PaginationConfig,
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

// =============================================================================
// detectPaginationStrategy Tests
// =============================================================================

describe('detectPaginationStrategy', () => {
  describe('Cursor Detection', () => {
    it('should detect cursor pagination with next_cursor field', () => {
      const response = {
        data: [{ id: 1 }],
        next_cursor: 'abc123',
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('cursor');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.detectedConfig.cursorPath).toBe('$.next_cursor');
    });

    it('should detect cursor pagination with nextCursor field', () => {
      const response = {
        results: [{ id: 1 }],
        nextCursor: 'token123',
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('cursor');
      expect(result.detectedConfig.cursorPath).toBe('$.nextCursor');
    });

    it('should detect cursor in meta object', () => {
      const response = {
        data: [{ id: 1 }],
        meta: {
          next_cursor: 'cursor_value',
        },
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('cursor');
      expect(result.detectedConfig.cursorPath).toBe('$.meta.next_cursor');
    });

    it('should detect cursor with pageToken', () => {
      const response = {
        items: [{ id: 1 }],
        nextPageToken: 'token',
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('cursor');
    });
  });

  describe('Offset Detection', () => {
    it('should detect offset pagination', () => {
      const response = {
        data: [{ id: 1 }],
        offset: 0,
        total: 100,
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('offset');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should detect offset in meta object', () => {
      const response = {
        results: [{ id: 1 }],
        meta: {
          offset: 50,
          total: 100,
        },
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('offset');
    });
  });

  describe('Page Number Detection', () => {
    it('should detect page number pagination', () => {
      const response = {
        data: [{ id: 1 }],
        page: 1,
        totalPages: 10,
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('page_number');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should detect page number with currentPage', () => {
      const response = {
        results: [{ id: 1 }],
        currentPage: 2,
        totalPages: 5,
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBe('page_number');
    });
  });

  describe('Link Header Detection', () => {
    it('should detect Link header pagination', () => {
      const response = { data: [{ id: 1 }] };
      const headers = {
        link: '<https://api.example.com?page=2>; rel="next"',
      };

      const result = detectPaginationStrategy(response, headers);

      expect(result.strategy).toBe('link_header');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should detect Link header when present with rel=next', () => {
      const response = { items: [] };
      const headers = {
        link: '<https://api.example.com?page=2>; rel="next", <https://api.example.com?page=5>; rel="last"',
      };

      const result = detectPaginationStrategy(response, headers);

      // Link header should be detected
      expect(result.strategy).toBe('link_header');
    });
  });

  describe('Data Path Detection', () => {
    it('should detect data path from common field names', () => {
      const testCases = [
        { response: { data: [] }, expected: '$.data' },
        { response: { results: [] }, expected: '$.results' },
        { response: { items: [] }, expected: '$.items' },
        { response: { records: [] }, expected: '$.records' },
      ];

      for (const { response, expected } of testCases) {
        const result = detectPaginationStrategy({ ...response, page: 1 }, {});
        expect(result.detectedConfig.dataPath).toBe(expected);
      }
    });
  });

  describe('Has More Path Detection', () => {
    it('should detect hasMore path when present with pagination indicators', () => {
      const response = {
        data: [{ id: 1 }],
        hasMore: true,
        page: 1, // Add pagination indicator
      };

      const result = detectPaginationStrategy(response, {});

      // hasMorePath is detected when pagination is found
      expect(result.strategy).not.toBeNull();
      expect(result.detectedConfig.hasMorePath).toBe('$.hasMore');
    });

    it('should detect has_more path when present with pagination indicators', () => {
      const response = {
        data: [{ id: 1 }],
        has_more: true,
        next_cursor: 'abc', // Add pagination indicator
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).not.toBeNull();
      expect(result.detectedConfig.hasMorePath).toBe('$.has_more');
    });
  });

  describe('No Pagination Detection', () => {
    it('should return null strategy for non-paginated response', () => {
      const response = {
        id: 1,
        name: 'test',
      };

      const result = detectPaginationStrategy(response, {});

      expect(result.strategy).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return null for empty object', () => {
      const result = detectPaginationStrategy({}, {});

      expect(result.strategy).toBeNull();
    });

    it('should return null for null response', () => {
      const result = detectPaginationStrategy(null, {});

      expect(result.strategy).toBeNull();
    });
  });
});

// =============================================================================
// detectFromSample Tests
// =============================================================================

describe('detectFromSample', () => {
  it('should work without headers', () => {
    const response = {
      data: [],
      next_cursor: 'abc',
    };

    const result = detectFromSample(response);

    expect(result.strategy).toBe('cursor');
  });

  it('should work with headers', () => {
    const response = { data: [] };
    const headers = { link: '<url>; rel="next"' };

    const result = detectFromSample(response, headers);

    expect(result.strategy).toBe('link_header');
  });
});

// =============================================================================
// hasMorePages Tests
// =============================================================================

describe('hasMorePages', () => {
  it('should return true when hasMorePath indicates more', () => {
    const response = {
      data: [],
      has_more: true,
    };
    const config = createConfig({ hasMorePath: '$.has_more' });

    expect(hasMorePages(response, config)).toBe(true);
  });

  it('should return false when hasMorePath indicates no more', () => {
    const response = {
      data: [],
      has_more: false,
    };
    const config = createConfig({ hasMorePath: '$.has_more' });

    expect(hasMorePages(response, config)).toBe(false);
  });

  it('should return true when cursor exists', () => {
    const response = {
      data: [],
      next_cursor: 'abc123',
    };
    const config = createConfig({ cursorPath: '$.next_cursor' });

    expect(hasMorePages(response, config)).toBe(true);
  });

  it('should return true by default when cursor path not found (safe behavior)', () => {
    const response = {
      data: [],
      next_cursor: '',
    };
    const config = createConfig({ cursorPath: '$.next_cursor' });

    // Empty string cursor returns false for "has more"
    // But hasMorePages defaults to true for safety when no clear indicator
    expect(hasMorePages(response, config)).toBe(true);
  });

  it('should return false when data array is empty', () => {
    const response = {
      data: [],
    };
    const config = createConfig({ dataPath: '$.data' });

    expect(hasMorePages(response, config)).toBe(false);
  });
});
