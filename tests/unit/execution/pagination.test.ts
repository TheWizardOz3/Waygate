/**
 * Pagination Module Unit Tests
 *
 * Tests for pagination schemas, strategies, detector, and aggregator.
 */

import { describe, it, expect } from 'vitest';
import {
  // Schemas
  PaginationConfigSchema,
  PaginationRequestSchema,
  PaginationMetadataSchema,
  DEFAULT_PAGINATION_LIMITS,
  ABSOLUTE_PAGINATION_LIMITS,
  PaginationPresets,
  // Schema helpers
  mergePaginationConfig,
  estimateTokens,
  calculateCharacterCount,
  checkLimitExceeded,
  createInitialPaginationState,
  encodeContinuationToken,
  decodeContinuationToken,
  applyPreset,
  hasHighLimits,
  describeLimits,
  // Types
  type PaginationConfig,
} from '@/lib/modules/execution/pagination';

// =============================================================================
// Schema Tests
// =============================================================================

describe('PaginationConfigSchema', () => {
  it('should parse valid config with defaults', () => {
    const result = PaginationConfigSchema.parse({ enabled: true });

    expect(result.enabled).toBe(true);
    expect(result.strategy).toBe('auto');
    expect(result.maxPages).toBe(DEFAULT_PAGINATION_LIMITS.maxPages);
    expect(result.maxItems).toBe(DEFAULT_PAGINATION_LIMITS.maxItems);
    expect(result.maxCharacters).toBe(DEFAULT_PAGINATION_LIMITS.maxCharacters);
    expect(result.maxDurationMs).toBe(DEFAULT_PAGINATION_LIMITS.maxDurationMs);
    expect(result.defaultPageSize).toBe(DEFAULT_PAGINATION_LIMITS.defaultPageSize);
  });

  it('should parse full config', () => {
    const config = {
      enabled: true,
      strategy: 'cursor' as const,
      cursorParam: 'cursor',
      cursorPath: '$.meta.next_cursor',
      limitParam: 'limit',
      dataPath: '$.data',
      hasMorePath: '$.meta.has_more',
      maxPages: 10,
      maxItems: 1000,
      maxCharacters: 200000,
      maxDurationMs: 60000,
      defaultPageSize: 50,
    };

    const result = PaginationConfigSchema.parse(config);

    expect(result).toEqual(config);
  });

  it('should enforce absolute limits', () => {
    expect(() =>
      PaginationConfigSchema.parse({
        enabled: true,
        maxPages: 200, // Exceeds ABSOLUTE_PAGINATION_LIMITS.maxPages
      })
    ).toThrow();

    expect(() =>
      PaginationConfigSchema.parse({
        enabled: true,
        maxItems: 20000, // Exceeds ABSOLUTE_PAGINATION_LIMITS.maxItems
      })
    ).toThrow();
  });

  it('should accept all strategy types', () => {
    const strategies = ['cursor', 'offset', 'page_number', 'link_header', 'auto'] as const;

    for (const strategy of strategies) {
      const result = PaginationConfigSchema.parse({ enabled: true, strategy });
      expect(result.strategy).toBe(strategy);
    }
  });
});

describe('PaginationRequestSchema', () => {
  it('should parse request with fetchAll', () => {
    const result = PaginationRequestSchema.parse({ fetchAll: true });
    expect(result.fetchAll).toBe(true);
  });

  it('should parse request with overrides', () => {
    const request = {
      fetchAll: true,
      maxPages: 10,
      maxItems: 200,
      maxCharacters: 50000,
      pageSize: 25,
      continuationToken: 'abc123',
    };

    const result = PaginationRequestSchema.parse(request);
    expect(result).toMatchObject(request);
  });
});

describe('PaginationMetadataSchema', () => {
  it('should parse complete metadata', () => {
    const metadata = {
      fetchedItems: 150,
      pagesFetched: 3,
      totalItems: 500,
      fetchedCharacters: 45000,
      estimatedTokens: 11250,
      hasMore: true,
      truncated: true,
      truncationReason: 'maxPages' as const,
      continuationToken: 'token123',
      durationMs: 2500,
    };

    const result = PaginationMetadataSchema.parse(metadata);
    expect(result).toEqual(metadata);
  });

  it('should accept all truncation reasons', () => {
    const reasons = [
      'maxPages',
      'maxItems',
      'maxCharacters',
      'maxDuration',
      'error',
      'circular',
    ] as const;

    for (const reason of reasons) {
      const result = PaginationMetadataSchema.parse({
        fetchedItems: 0,
        pagesFetched: 0,
        fetchedCharacters: 0,
        estimatedTokens: 0,
        hasMore: false,
        truncated: true,
        truncationReason: reason,
        durationMs: 0,
      });
      expect(result.truncationReason).toBe(reason);
    }
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('mergePaginationConfig', () => {
  it('should return defaults when no config provided', () => {
    const result = mergePaginationConfig(null, null);

    expect(result.enabled).toBe(false);
    expect(result.maxPages).toBe(DEFAULT_PAGINATION_LIMITS.maxPages);
  });

  it('should use action config values', () => {
    const actionConfig: PaginationConfig = {
      enabled: true,
      strategy: 'cursor',
      maxPages: 10,
      maxItems: 1000,
      maxCharacters: 200000,
      maxDurationMs: 60000,
      defaultPageSize: 50,
    };

    const result = mergePaginationConfig(actionConfig, null);

    expect(result.maxPages).toBe(10);
    expect(result.maxItems).toBe(1000);
  });

  it('should override with request options', () => {
    const actionConfig: PaginationConfig = {
      enabled: true,
      strategy: 'cursor',
      maxPages: 10,
      maxItems: 1000,
      maxCharacters: 200000,
      maxDurationMs: 60000,
      defaultPageSize: 50,
    };

    const requestOptions = {
      fetchAll: true,
      maxPages: 5,
      maxItems: 500,
      pageSize: 25,
    };

    const result = mergePaginationConfig(actionConfig, requestOptions);

    expect(result.maxPages).toBe(5);
    expect(result.maxItems).toBe(500);
    expect(result.defaultPageSize).toBe(25);
    // Non-overridden values should come from action config
    expect(result.maxCharacters).toBe(200000);
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens at ~4 chars per token', () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(100)).toBe(25);
    expect(estimateTokens(100000)).toBe(25000);
    expect(estimateTokens(1000000)).toBe(250000);
  });

  it('should round up partial tokens', () => {
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(5)).toBe(2);
    expect(estimateTokens(7)).toBe(2);
  });
});

describe('calculateCharacterCount', () => {
  it('should count characters in JSON stringified values', () => {
    expect(calculateCharacterCount('hello')).toBe(7); // "hello" with quotes
    expect(calculateCharacterCount({ a: 1 })).toBe(7); // {"a":1}
    expect(calculateCharacterCount([1, 2, 3])).toBe(7); // [1,2,3]
    expect(calculateCharacterCount(null)).toBe(0);
    expect(calculateCharacterCount(undefined)).toBe(0);
  });

  it('should handle complex objects', () => {
    const obj = { data: [{ id: 1, name: 'test' }], meta: { page: 1 } };
    const count = calculateCharacterCount(obj);
    expect(count).toBe(JSON.stringify(obj).length);
  });
});

describe('checkLimitExceeded', () => {
  const config: PaginationConfig = {
    enabled: true,
    strategy: 'auto',
    maxPages: 5,
    maxItems: 100,
    maxCharacters: 10000,
    maxDurationMs: 5000,
    defaultPageSize: 20,
  };

  it('should return null when no limits exceeded', () => {
    const state = {
      currentPage: 1,
      totalItemsFetched: 50,
      totalCharactersFetched: 5000,
      startTime: Date.now(),
    };

    expect(checkLimitExceeded(state, config)).toBeNull();
  });

  it('should detect maxPages exceeded', () => {
    const state = {
      currentPage: 6,
      totalItemsFetched: 50,
      totalCharactersFetched: 5000,
      startTime: Date.now(),
    };

    expect(checkLimitExceeded(state, config)).toBe('maxPages');
  });

  it('should detect maxItems exceeded', () => {
    const state = {
      currentPage: 3,
      totalItemsFetched: 100,
      totalCharactersFetched: 5000,
      startTime: Date.now(),
    };

    expect(checkLimitExceeded(state, config)).toBe('maxItems');
  });

  it('should detect maxCharacters exceeded', () => {
    const state = {
      currentPage: 3,
      totalItemsFetched: 50,
      totalCharactersFetched: 10000,
      startTime: Date.now(),
    };

    expect(checkLimitExceeded(state, config)).toBe('maxCharacters');
  });

  it('should detect maxDuration exceeded', () => {
    const state = {
      currentPage: 3,
      totalItemsFetched: 50,
      totalCharactersFetched: 5000,
      startTime: Date.now() - 6000, // 6 seconds ago
    };

    expect(checkLimitExceeded(state, config)).toBe('maxDuration');
  });
});

describe('createInitialPaginationState', () => {
  it('should create initial state with correct defaults', () => {
    const state = createInitialPaginationState();

    expect(state.currentPage).toBe(1);
    expect(state.totalItemsFetched).toBe(0);
    expect(state.totalCharactersFetched).toBe(0);
    expect(state.currentCursor).toBeNull();
    expect(state.seenCursors.size).toBe(0);
    expect(state.aggregatedData).toEqual([]);
    expect(state.hasMore).toBe(true);
    expect(state.detectedStrategy).toBeNull();
    expect(state.startTime).toBeGreaterThan(0);
  });
});

describe('encodeContinuationToken / decodeContinuationToken', () => {
  it('should encode and decode token data', () => {
    const data = {
      strategy: 'cursor' as const,
      cursor: 'abc123',
      itemsFetched: 100,
      charactersFetched: 50000,
      createdAt: Date.now(),
      actionId: 'action-123',
    };

    const token = encodeContinuationToken(data);
    expect(typeof token).toBe('string');

    const decoded = decodeContinuationToken(token);
    expect(decoded).toEqual(data);
  });

  it('should return null for invalid token', () => {
    expect(decodeContinuationToken('invalid')).toBeNull();
    expect(decodeContinuationToken('')).toBeNull();
  });
});

describe('applyPreset', () => {
  it('should apply LLM_OPTIMIZED preset', () => {
    const config = applyPreset({ enabled: true }, 'LLM_OPTIMIZED');

    expect(config.maxPages).toBe(PaginationPresets.LLM_OPTIMIZED.maxPages);
    expect(config.maxItems).toBe(PaginationPresets.LLM_OPTIMIZED.maxItems);
    expect(config.maxCharacters).toBe(PaginationPresets.LLM_OPTIMIZED.maxCharacters);
    expect(config.maxDurationMs).toBe(PaginationPresets.LLM_OPTIMIZED.maxDurationMs);
  });

  it('should apply FULL_DATASET preset', () => {
    const config = applyPreset({ enabled: true }, 'FULL_DATASET');

    expect(config.maxPages).toBe(PaginationPresets.FULL_DATASET.maxPages);
    expect(config.maxItems).toBe(PaginationPresets.FULL_DATASET.maxItems);
  });

  it('should apply QUICK_SAMPLE preset', () => {
    const config = applyPreset({ enabled: true }, 'QUICK_SAMPLE');

    expect(config.maxPages).toBe(PaginationPresets.QUICK_SAMPLE.maxPages);
    expect(config.maxItems).toBe(PaginationPresets.QUICK_SAMPLE.maxItems);
  });
});

describe('hasHighLimits', () => {
  it('should return false for LLM-optimized limits', () => {
    const config: PaginationConfig = {
      enabled: true,
      strategy: 'auto',
      maxPages: 5,
      maxItems: 500,
      maxCharacters: 100000,
      maxDurationMs: 30000,
      defaultPageSize: 100,
    };

    expect(hasHighLimits(config)).toBe(false);
  });

  it('should return true for high maxPages', () => {
    const config: PaginationConfig = {
      enabled: true,
      strategy: 'auto',
      maxPages: 15,
      maxItems: 500,
      maxCharacters: 100000,
      maxDurationMs: 30000,
      defaultPageSize: 100,
    };

    expect(hasHighLimits(config)).toBe(true);
  });

  it('should return true for high maxItems', () => {
    const config: PaginationConfig = {
      enabled: true,
      strategy: 'auto',
      maxPages: 5,
      maxItems: 2000,
      maxCharacters: 100000,
      maxDurationMs: 30000,
      defaultPageSize: 100,
    };

    expect(hasHighLimits(config)).toBe(true);
  });

  it('should return true for high maxCharacters', () => {
    const config: PaginationConfig = {
      enabled: true,
      strategy: 'auto',
      maxPages: 5,
      maxItems: 500,
      maxCharacters: 600000,
      maxDurationMs: 30000,
      defaultPageSize: 100,
    };

    expect(hasHighLimits(config)).toBe(true);
  });
});

describe('describeLimits', () => {
  it('should describe limits in human-readable format', () => {
    const config: PaginationConfig = {
      enabled: true,
      strategy: 'auto',
      maxPages: 5,
      maxItems: 500,
      maxCharacters: 100000,
      maxDurationMs: 30000,
      defaultPageSize: 100,
    };

    const description = describeLimits(config);

    expect(description).toContain('5 pages');
    expect(description).toContain('500 items');
    expect(description).toContain('25,000 tokens');
    expect(description).toContain('30s timeout');
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('DEFAULT_PAGINATION_LIMITS', () => {
  it('should have LLM-friendly defaults', () => {
    expect(DEFAULT_PAGINATION_LIMITS.maxPages).toBe(5);
    expect(DEFAULT_PAGINATION_LIMITS.maxItems).toBe(500);
    expect(DEFAULT_PAGINATION_LIMITS.maxCharacters).toBe(100000); // ~25K tokens
    expect(DEFAULT_PAGINATION_LIMITS.maxDurationMs).toBe(30000);
    expect(DEFAULT_PAGINATION_LIMITS.defaultPageSize).toBe(100);
  });
});

describe('ABSOLUTE_PAGINATION_LIMITS', () => {
  it('should have reasonable hard caps', () => {
    expect(ABSOLUTE_PAGINATION_LIMITS.maxPages).toBe(100);
    expect(ABSOLUTE_PAGINATION_LIMITS.maxItems).toBe(10000);
    expect(ABSOLUTE_PAGINATION_LIMITS.maxCharacters).toBe(1000000);
    expect(ABSOLUTE_PAGINATION_LIMITS.maxDurationMs).toBe(300000);
  });
});

describe('PaginationPresets', () => {
  it('LLM_OPTIMIZED should fit typical context windows', () => {
    const preset = PaginationPresets.LLM_OPTIMIZED;
    const estimatedTokens = estimateTokens(preset.maxCharacters);

    expect(estimatedTokens).toBeLessThanOrEqual(30000); // Fits in most LLM context windows
    expect(preset.maxPages).toBeLessThanOrEqual(10);
    expect(preset.maxDurationMs).toBeLessThanOrEqual(60000);
  });

  it('QUICK_SAMPLE should be minimal', () => {
    const preset = PaginationPresets.QUICK_SAMPLE;

    expect(preset.maxPages).toBe(1);
    expect(preset.maxItems).toBeLessThanOrEqual(100);
    expect(preset.maxDurationMs).toBeLessThanOrEqual(15000);
  });

  it('FULL_DATASET should allow more data', () => {
    const preset = PaginationPresets.FULL_DATASET;

    expect(preset.maxPages).toBeGreaterThan(10);
    expect(preset.maxItems).toBeGreaterThan(1000);
    expect(preset.maxCharacters).toBeGreaterThan(500000);
  });
});
