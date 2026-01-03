/**
 * Pagination Aggregator Unit Tests
 *
 * Tests for result aggregation across paginated requests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaginationAggregator,
  aggregatePages,
  calculateTotalCharacterCount,
  wouldExceedCharacterLimit,
  calculateLimitUsage,
  createAggregationSummary,
  type PaginationConfig,
  type PageFetchResult,
} from '@/lib/modules/execution/pagination';

// =============================================================================
// Helper Functions
// =============================================================================

function createConfig(overrides: Partial<PaginationConfig> = {}): PaginationConfig {
  return {
    enabled: true,
    strategy: 'cursor',
    maxPages: 5,
    maxItems: 100,
    maxCharacters: 10000,
    maxDurationMs: 30000,
    defaultPageSize: 20,
    ...overrides,
  };
}

// Counter for unique cursors
let cursorCounter = 0;

function createPageResult(overrides: Partial<PageFetchResult> = {}): PageFetchResult {
  cursorCounter++;
  return {
    items: [{ id: 1 }, { id: 2 }],
    itemCount: 2,
    characterCount: 50,
    nextCursor: `cursor_${cursorCounter}`, // Unique cursor each time
    hasMore: true,
    ...overrides,
  };
}

// =============================================================================
// PaginationAggregator Tests
// =============================================================================

describe('PaginationAggregator', () => {
  let aggregator: PaginationAggregator;

  beforeEach(() => {
    cursorCounter = 0; // Reset cursor counter
    aggregator = new PaginationAggregator({ config: createConfig() });
  });

  describe('addPage', () => {
    it('should aggregate items from pages', () => {
      aggregator.addPage(createPageResult({ items: [{ id: 1 }], itemCount: 1, nextCursor: 'c1' }));
      aggregator.addPage(createPageResult({ items: [{ id: 2 }], itemCount: 1, nextCursor: 'c2' }));

      const result = aggregator.getResult();

      expect(result.data.length).toBe(2);
      expect(result.metadata.fetchedItems).toBe(2);
      expect(result.metadata.pagesFetched).toBe(2);
    });

    it('should track character count', () => {
      aggregator.addPage(createPageResult({ characterCount: 100, nextCursor: 'c1' }));
      aggregator.addPage(createPageResult({ characterCount: 150, nextCursor: 'c2' }));

      expect(aggregator.getCharacterCount()).toBe(250);
    });

    it('should detect circular pagination', () => {
      aggregator.addPage(createPageResult({ nextCursor: 'cursor1' }));
      const shouldContinue = aggregator.addPage(createPageResult({ nextCursor: 'cursor1' })); // Same cursor

      expect(shouldContinue).toBe(false);
      expect(aggregator.getTruncationReason()).toBe('circular');
    });

    it('should stop when maxPages reached', () => {
      const config = createConfig({ maxPages: 2 });
      aggregator = new PaginationAggregator({ config });

      aggregator.addPage(createPageResult({ nextCursor: 'c1' }));
      aggregator.addPage(createPageResult({ nextCursor: 'c2' }));
      const shouldContinue = aggregator.addPage(createPageResult({ nextCursor: 'c3' }));

      expect(shouldContinue).toBe(false);
      expect(aggregator.getTruncationReason()).toBe('maxPages');
    });

    it('should stop when maxItems reached', () => {
      const config = createConfig({ maxItems: 3 });
      aggregator = new PaginationAggregator({ config });

      aggregator.addPage(createPageResult({ items: [1, 2], itemCount: 2, nextCursor: 'c1' }));
      const shouldContinue = aggregator.addPage(
        createPageResult({ items: [3, 4], itemCount: 2, nextCursor: 'c2' })
      );

      expect(shouldContinue).toBe(false);
      expect(aggregator.getTruncationReason()).toBe('maxItems');
    });

    it('should stop when maxCharacters reached', () => {
      const config = createConfig({ maxCharacters: 100 });
      aggregator = new PaginationAggregator({ config });

      aggregator.addPage(createPageResult({ characterCount: 60, nextCursor: 'c1' }));
      const shouldContinue = aggregator.addPage(
        createPageResult({ characterCount: 60, nextCursor: 'c2' })
      );

      expect(shouldContinue).toBe(false);
      expect(aggregator.getTruncationReason()).toBe('maxCharacters');
    });

    it('should return false when hasMore is false', () => {
      const shouldContinue = aggregator.addPage(
        createPageResult({
          hasMore: false,
          nextCursor: null,
        })
      );

      expect(shouldContinue).toBe(false);
    });
  });

  describe('shouldContinue', () => {
    it('should return true when no limits hit', () => {
      aggregator.addPage(createPageResult());

      expect(aggregator.shouldContinue()).toBe(true);
    });

    it('should return false after truncation', () => {
      const config = createConfig({ maxPages: 1 });
      aggregator = new PaginationAggregator({ config });

      aggregator.addPage(createPageResult());
      aggregator.addPage(createPageResult()); // Exceeds limit

      expect(aggregator.shouldContinue()).toBe(false);
    });

    it('should return false when hasMore is false', () => {
      aggregator.addPage(createPageResult({ hasMore: false, nextCursor: null }));

      expect(aggregator.shouldContinue()).toBe(false);
    });
  });

  describe('markError', () => {
    it('should set truncation reason to error', () => {
      aggregator.addPage(createPageResult());
      aggregator.markError();

      expect(aggregator.getTruncationReason()).toBe('error');
    });
  });

  describe('deduplication', () => {
    it('should deduplicate items by id field', () => {
      aggregator = new PaginationAggregator({
        config: createConfig(),
        idField: 'id',
      });

      aggregator.addPage(
        createPageResult({ items: [{ id: 1 }, { id: 2 }], itemCount: 2, nextCursor: 'c1' })
      );
      aggregator.addPage(
        createPageResult({ items: [{ id: 2 }, { id: 3 }], itemCount: 2, nextCursor: 'c2' })
      ); // id: 2 duplicate

      const result = aggregator.getResult();

      expect(result.data.length).toBe(3);
      expect(result.metadata.fetchedItems).toBe(3);
    });
  });

  describe('getResult', () => {
    it('should return complete aggregation result', () => {
      aggregator.addPage(
        createPageResult({
          items: [{ id: 1 }],
          itemCount: 1,
          characterCount: 50,
        })
      );

      const result = aggregator.getResult('continuation_token', 100);

      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.metadata.fetchedItems).toBe(1);
      expect(result.metadata.pagesFetched).toBe(1);
      expect(result.metadata.fetchedCharacters).toBe(50);
      expect(result.metadata.estimatedTokens).toBe(13); // 50 / 4 rounded up
      expect(result.metadata.totalItems).toBe(100);
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include continuation token when truncated', () => {
      const config = createConfig({ maxPages: 1 });
      aggregator = new PaginationAggregator({ config });

      aggregator.addPage(createPageResult());
      aggregator.addPage(createPageResult()); // Triggers truncation

      const result = aggregator.getResult('token123');

      expect(result.metadata.truncated).toBe(true);
      expect(result.metadata.continuationToken).toBe('token123');
    });

    it('should set hasMore correctly', () => {
      aggregator.addPage(createPageResult({ hasMore: true }));

      let result = aggregator.getResult();
      expect(result.metadata.hasMore).toBe(true);

      aggregator = new PaginationAggregator({ config: createConfig() });
      aggregator.addPage(createPageResult({ hasMore: false, nextCursor: null }));

      result = aggregator.getResult();
      expect(result.metadata.hasMore).toBe(false);
    });
  });
});

// =============================================================================
// Standalone Function Tests
// =============================================================================

describe('aggregatePages', () => {
  beforeEach(() => {
    cursorCounter = 0;
  });

  it('should aggregate multiple pages', () => {
    const pages: PageFetchResult[] = [
      { items: [1, 2], itemCount: 2, characterCount: 10, nextCursor: 'c1', hasMore: true },
      { items: [3, 4], itemCount: 2, characterCount: 10, hasMore: false, nextCursor: null },
    ];

    const result = aggregatePages(pages, createConfig());

    expect(result.data).toEqual([1, 2, 3, 4]);
    expect(result.metadata.fetchedItems).toBe(4);
    expect(result.metadata.pagesFetched).toBe(2);
  });

  it('should stop at limit', () => {
    const pages: PageFetchResult[] = [
      { items: [1], itemCount: 1, characterCount: 10, nextCursor: 'c1', hasMore: true },
      { items: [2], itemCount: 1, characterCount: 10, nextCursor: 'c2', hasMore: true },
      { items: [3], itemCount: 1, characterCount: 10, nextCursor: 'c3', hasMore: true },
    ];

    const result = aggregatePages(pages, createConfig({ maxPages: 2 }));

    expect(result.metadata.pagesFetched).toBe(2);
    expect(result.metadata.truncated).toBe(true);
  });
});

describe('calculateTotalCharacterCount', () => {
  it('should calculate character count of items array', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const count = calculateTotalCharacterCount(items);

    expect(count).toBe(JSON.stringify(items).length);
  });
});

describe('wouldExceedCharacterLimit', () => {
  it('should return true when limit would be exceeded', () => {
    expect(wouldExceedCharacterLimit(80000, 30000, 100000)).toBe(true);
  });

  it('should return false when under limit', () => {
    expect(wouldExceedCharacterLimit(50000, 30000, 100000)).toBe(false);
  });

  it('should return false when exactly at limit', () => {
    expect(wouldExceedCharacterLimit(50000, 50000, 100000)).toBe(false);
  });
});

describe('calculateLimitUsage', () => {
  it('should calculate percentage of each limit used', () => {
    const state = {
      currentPage: 3,
      totalItemsFetched: 250,
      totalCharactersFetched: 50000,
      startTime: Date.now() - 15000, // 15 seconds ago
    };
    const config = createConfig({
      maxPages: 5,
      maxItems: 500,
      maxCharacters: 100000,
      maxDurationMs: 30000,
    });

    const usage = calculateLimitUsage(state, config);

    expect(usage.pagesUsed).toBe(60); // 3/5 * 100
    expect(usage.itemsUsed).toBe(50); // 250/500 * 100
    expect(usage.charactersUsed).toBe(50); // 50000/100000 * 100
    expect(usage.durationUsed).toBe(50); // 15000/30000 * 100
  });
});

describe('createAggregationSummary', () => {
  it('should create human-readable summary', () => {
    const result = {
      data: [1, 2, 3],
      metadata: {
        fetchedItems: 3,
        pagesFetched: 1,
        fetchedCharacters: 100,
        estimatedTokens: 25,
        hasMore: false,
        truncated: false,
        durationMs: 500,
      },
    };

    const summary = createAggregationSummary(result);

    expect(summary).toContain('3 items');
    expect(summary).toContain('1 pages');
    expect(summary).toContain('100 chars');
    expect(summary).toContain('500ms');
  });

  it('should include truncation info', () => {
    const result = {
      data: [1, 2],
      metadata: {
        fetchedItems: 2,
        pagesFetched: 5,
        fetchedCharacters: 100000,
        estimatedTokens: 25000,
        hasMore: true,
        truncated: true,
        truncationReason: 'maxCharacters' as const,
        durationMs: 1000,
      },
    };

    const summary = createAggregationSummary(result);

    expect(summary).toContain('truncated: maxCharacters');
    expect(summary).toContain('more available');
  });
});
