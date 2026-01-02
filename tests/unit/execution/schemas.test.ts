import { describe, it, expect } from 'vitest';
import {
  RetryConfigSchema,
  CircuitBreakerConfigSchema,
  HttpClientRequestSchema,
  ExecutionErrorCodeSchema,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_RETRYABLE_STATUSES,
  mergeRetryConfig,
  mergeCircuitBreakerConfig,
  isRetryableStatus,
} from '@/lib/modules/execution';

describe('Execution Schemas', () => {
  describe('RetryConfigSchema', () => {
    it('should use defaults when no values provided', () => {
      const result = RetryConfigSchema.parse({});

      expect(result.maxAttempts).toBe(3);
      expect(result.baseDelayMs).toBe(1000);
      expect(result.maxDelayMs).toBe(30000);
      expect(result.backoffMultiplier).toBe(2);
      expect(result.jitterFactor).toBe(0.1);
      expect(result.retryableStatuses).toEqual([...DEFAULT_RETRYABLE_STATUSES]);
    });

    it('should accept valid custom values', () => {
      const result = RetryConfigSchema.parse({
        maxAttempts: 5,
        baseDelayMs: 500,
        maxDelayMs: 60000,
        backoffMultiplier: 3,
        jitterFactor: 0.2,
        retryableStatuses: [500, 502],
      });

      expect(result.maxAttempts).toBe(5);
      expect(result.baseDelayMs).toBe(500);
      expect(result.retryableStatuses).toEqual([500, 502]);
    });

    it('should reject invalid maxAttempts', () => {
      expect(() => RetryConfigSchema.parse({ maxAttempts: 0 })).toThrow();
      expect(() => RetryConfigSchema.parse({ maxAttempts: 11 })).toThrow();
      expect(() => RetryConfigSchema.parse({ maxAttempts: -1 })).toThrow();
    });

    it('should reject invalid jitterFactor', () => {
      expect(() => RetryConfigSchema.parse({ jitterFactor: -0.1 })).toThrow();
      expect(() => RetryConfigSchema.parse({ jitterFactor: 1.5 })).toThrow();
    });
  });

  describe('CircuitBreakerConfigSchema', () => {
    it('should use defaults when no values provided', () => {
      const result = CircuitBreakerConfigSchema.parse({});

      expect(result.failureThreshold).toBe(5);
      expect(result.failureWindowMs).toBe(30000);
      expect(result.resetTimeoutMs).toBe(60000);
      expect(result.successThreshold).toBe(1);
    });

    it('should accept valid custom values', () => {
      const result = CircuitBreakerConfigSchema.parse({
        failureThreshold: 10,
        failureWindowMs: 60000,
        resetTimeoutMs: 120000,
        successThreshold: 3,
      });

      expect(result.failureThreshold).toBe(10);
      expect(result.resetTimeoutMs).toBe(120000);
    });
  });

  describe('HttpClientRequestSchema', () => {
    it('should validate a valid request', () => {
      const result = HttpClientRequestSchema.parse({
        url: 'https://api.example.com/users',
        method: 'GET',
      });

      expect(result.url).toBe('https://api.example.com/users');
      expect(result.method).toBe('GET');
      expect(result.timeout).toBeUndefined(); // timeout is optional, default applied at runtime
    });

    it('should reject invalid URL', () => {
      expect(() =>
        HttpClientRequestSchema.parse({
          url: 'not-a-url',
          method: 'GET',
        })
      ).toThrow();
    });

    it('should reject invalid method', () => {
      expect(() =>
        HttpClientRequestSchema.parse({
          url: 'https://api.example.com',
          method: 'INVALID',
        })
      ).toThrow();
    });
  });

  describe('ExecutionErrorCodeSchema', () => {
    it('should accept valid error codes', () => {
      const codes = [
        'NETWORK_ERROR',
        'TIMEOUT',
        'RATE_LIMITED',
        'SERVER_ERROR',
        'CLIENT_ERROR',
        'CIRCUIT_OPEN',
        'MAX_RETRIES_EXCEEDED',
        'UNKNOWN_ERROR',
      ];

      codes.forEach((code) => {
        expect(ExecutionErrorCodeSchema.parse(code)).toBe(code);
      });
    });

    it('should reject invalid error codes', () => {
      expect(() => ExecutionErrorCodeSchema.parse('INVALID_CODE')).toThrow();
    });
  });

  describe('mergeRetryConfig', () => {
    it('should return defaults when no partial provided', () => {
      const result = mergeRetryConfig();
      expect(result).toEqual(DEFAULT_RETRY_CONFIG);
    });

    it('should merge partial config with defaults', () => {
      const result = mergeRetryConfig({ maxAttempts: 5 });

      expect(result.maxAttempts).toBe(5);
      expect(result.baseDelayMs).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs);
    });
  });

  describe('mergeCircuitBreakerConfig', () => {
    it('should return defaults when no partial provided', () => {
      const result = mergeCircuitBreakerConfig();
      expect(result).toEqual(DEFAULT_CIRCUIT_BREAKER_CONFIG);
    });

    it('should merge partial config with defaults', () => {
      const result = mergeCircuitBreakerConfig({ failureThreshold: 10 });

      expect(result.failureThreshold).toBe(10);
      expect(result.resetTimeoutMs).toBe(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs);
    });
  });

  describe('isRetryableStatus', () => {
    it('should return true for retryable status codes', () => {
      expect(isRetryableStatus(429, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableStatus(500, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableStatus(502, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableStatus(503, DEFAULT_RETRY_CONFIG)).toBe(true);
    });

    it('should return false for non-retryable status codes', () => {
      expect(isRetryableStatus(200, DEFAULT_RETRY_CONFIG)).toBe(false);
      expect(isRetryableStatus(400, DEFAULT_RETRY_CONFIG)).toBe(false);
      expect(isRetryableStatus(401, DEFAULT_RETRY_CONFIG)).toBe(false);
      expect(isRetryableStatus(404, DEFAULT_RETRY_CONFIG)).toBe(false);
    });
  });
});
