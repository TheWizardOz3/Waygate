import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateBackoffDelay,
  calculateBackoffDelayDeterministic,
  parseRetryAfterHeader,
  extractRetryAfterMs,
  withRetry,
  retry,
  DEFAULT_RETRY_CONFIG,
  MaxRetriesExceededError,
  ServerError,
} from '@/lib/modules/execution';

describe('Retry Logic', () => {
  describe('calculateBackoffDelayDeterministic', () => {
    it('should calculate exponential backoff correctly', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 };

      // First retry (attempt 0): 1000ms
      expect(calculateBackoffDelayDeterministic(0, config)).toBe(1000);
      // Second retry (attempt 1): 2000ms
      expect(calculateBackoffDelayDeterministic(1, config)).toBe(2000);
      // Third retry (attempt 2): 4000ms
      expect(calculateBackoffDelayDeterministic(2, config)).toBe(4000);
      // Fourth retry (attempt 3): 8000ms
      expect(calculateBackoffDelayDeterministic(3, config)).toBe(8000);
    });

    it('should cap at maxDelayMs', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, maxDelayMs: 5000 };

      // Would be 8000ms but capped at 5000ms
      expect(calculateBackoffDelayDeterministic(3, config)).toBe(5000);
    });

    it('should respect custom baseDelayMs', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 500 };

      expect(calculateBackoffDelayDeterministic(0, config)).toBe(500);
      expect(calculateBackoffDelayDeterministic(1, config)).toBe(1000);
    });

    it('should respect custom backoffMultiplier', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, backoffMultiplier: 3 };

      expect(calculateBackoffDelayDeterministic(0, config)).toBe(1000);
      expect(calculateBackoffDelayDeterministic(1, config)).toBe(3000);
      expect(calculateBackoffDelayDeterministic(2, config)).toBe(9000);
    });
  });

  describe('calculateBackoffDelay (with jitter)', () => {
    it('should add jitter within expected range', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0.1 };
      const baseDelay = calculateBackoffDelayDeterministic(0, config);

      // Run multiple times and check range
      for (let i = 0; i < 20; i++) {
        const delay = calculateBackoffDelay(0, config);
        // Should be within ±10% of base delay
        expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.9);
        expect(delay).toBeLessThanOrEqual(baseDelay * 1.1);
      }
    });
  });

  describe('parseRetryAfterHeader', () => {
    it('should parse seconds format', () => {
      expect(parseRetryAfterHeader('120')).toBe(120000);
      expect(parseRetryAfterHeader('0')).toBe(0);
      expect(parseRetryAfterHeader('1')).toBe(1000);
    });

    it('should parse HTTP-date format', () => {
      const futureDate = new Date(Date.now() + 60000); // 60 seconds from now
      const httpDate = futureDate.toUTCString();

      const result = parseRetryAfterHeader(httpDate);

      // Should be approximately 60000ms (allow some tolerance)
      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(55000);
      expect(result!).toBeLessThan(65000);
    });

    it('should return 0 for past dates', () => {
      const pastDate = new Date(Date.now() - 60000).toUTCString();
      expect(parseRetryAfterHeader(pastDate)).toBe(0);
    });

    it('should return undefined for invalid values', () => {
      expect(parseRetryAfterHeader(null)).toBeUndefined();
      expect(parseRetryAfterHeader(undefined)).toBeUndefined();
      expect(parseRetryAfterHeader('')).toBeUndefined();
      expect(parseRetryAfterHeader('invalid')).toBeUndefined();
    });
  });

  describe('extractRetryAfterMs', () => {
    it('should extract from Headers object', () => {
      const headers = new Headers();
      headers.set('Retry-After', '60');

      expect(extractRetryAfterMs(headers)).toBe(60000);
    });

    it('should extract from plain object', () => {
      const headers = { 'Retry-After': '30' };
      expect(extractRetryAfterMs(headers)).toBe(30000);
    });

    it('should handle case-insensitive header names', () => {
      const headers = { 'retry-after': '45' };
      expect(extractRetryAfterMs(headers)).toBe(45000);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ServerError(500, 'Server error'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { config: { maxAttempts: 3 } });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.data).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw MaxRetriesExceededError after all attempts fail', async () => {
      // Use real timers with minimal delays for this test
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValue(new ServerError(500, 'Server error'));

      await expect(
        withRetry(fn, { config: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 } })
      ).rejects.toThrow(MaxRetriesExceededError);
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useFakeTimers();
    });

    it('should call onRetry callback before each retry', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ServerError(500))
        .mockRejectedValueOnce(new ServerError(500))
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      const resultPromise = withRetry(fn, {
        config: { maxAttempts: 3 },
        onRetry,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should pass idempotency key in context', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withRetry(fn, { idempotencyKey: 'test-key' });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'test-key' }));
    });
  });

  describe('retry (simple helper)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return data on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
    });

    it('should respect maxAttempts parameter', async () => {
      // Use real timers with minimal delays for this test
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValue(new ServerError(500));

      await expect(retry(fn, 2)).rejects.toThrow(MaxRetriesExceededError);
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useFakeTimers();
    });
  });
});
