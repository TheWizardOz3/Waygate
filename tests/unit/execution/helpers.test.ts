import { describe, it, expect } from 'vitest';
import {
  request,
  isSuccess,
  isFailure,
  hasErrorCode,
  isRateLimited,
  isCircuitOpen,
  unwrap,
  unwrapOr,
  mapResult,
  RetryPresets,
  jsonHeaders,
  bearerHeaders,
  apiKeyHeaders,
  type ExecutionResult,
} from '@/lib/modules/execution';

describe('Execution Helpers', () => {
  describe('RequestBuilder', () => {
    it('should build a basic request', () => {
      const { request: req } = request().url('https://api.example.com/users').method('GET').build();

      expect(req.url).toBe('https://api.example.com/users');
      expect(req.method).toBe('GET');
    });

    it('should set headers', () => {
      const { request: req } = request()
        .url('https://api.example.com')
        .method('GET')
        .headers({ 'X-Custom': 'value' })
        .header('X-Another', 'another')
        .build();

      expect(req.headers).toEqual({
        'X-Custom': 'value',
        'X-Another': 'another',
      });
    });

    it('should set bearer token', () => {
      const { request: req } = request()
        .url('https://api.example.com')
        .method('GET')
        .bearerToken('my-token')
        .build();

      expect(req.headers?.['Authorization']).toBe('Bearer my-token');
    });

    it('should set API key', () => {
      const { request: req } = request()
        .url('https://api.example.com')
        .method('GET')
        .apiKey('my-key')
        .build();

      expect(req.headers?.['X-API-Key']).toBe('my-key');
    });

    it('should set basic auth', () => {
      const { request: req } = request()
        .url('https://api.example.com')
        .method('GET')
        .basicAuth('user', 'pass')
        .build();

      const expected = Buffer.from('user:pass').toString('base64');
      expect(req.headers?.['Authorization']).toBe(`Basic ${expected}`);
    });

    it('should set JSON body', () => {
      const { request: req } = request()
        .url('https://api.example.com')
        .method('POST')
        .json({ name: 'John' })
        .build();

      expect(req.body).toEqual({ name: 'John' });
      expect(req.headers?.['Content-Type']).toBe('application/json');
    });

    it('should set circuit breaker and retry options', () => {
      const { options } = request()
        .url('https://api.example.com')
        .method('GET')
        .circuitBreaker('my-circuit')
        .idempotency('my-key')
        .retry({ maxAttempts: 5 })
        .build();

      expect(options.circuitBreakerId).toBe('my-circuit');
      expect(options.idempotencyKey).toBe('my-key');
      expect(options.retryConfig?.maxAttempts).toBe(5);
    });

    it('should set no retry mode', () => {
      const { options } = request().url('https://api.example.com').method('GET').noRetry().build();

      expect(options.passthrough).toBe(true);
    });

    it('should throw if URL is missing', () => {
      expect(() => request().method('GET').build()).toThrow('URL is required');
    });

    it('should throw if method is missing', () => {
      expect(() => request().url('https://api.example.com').build()).toThrow('Method is required');
    });
  });

  describe('Result Type Guards', () => {
    const successResult: ExecutionResult<string> = {
      success: true,
      data: 'test data',
      attempts: 1,
      totalDurationMs: 100,
    };

    const failureResult: ExecutionResult<string> = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
        retryable: true,
        statusCode: 500,
      },
      attempts: 3,
      totalDurationMs: 5000,
    };

    describe('isSuccess', () => {
      it('should return true for successful results', () => {
        expect(isSuccess(successResult)).toBe(true);
      });

      it('should return false for failed results', () => {
        expect(isSuccess(failureResult)).toBe(false);
      });
    });

    describe('isFailure', () => {
      it('should return true for failed results', () => {
        expect(isFailure(failureResult)).toBe(true);
      });

      it('should return false for successful results', () => {
        expect(isFailure(successResult)).toBe(false);
      });
    });

    describe('hasErrorCode', () => {
      it('should return true when error code matches', () => {
        expect(hasErrorCode(failureResult, 'SERVER_ERROR')).toBe(true);
      });

      it('should return false when error code does not match', () => {
        expect(hasErrorCode(failureResult, 'TIMEOUT')).toBe(false);
      });

      it('should return false for successful results', () => {
        expect(hasErrorCode(successResult, 'SERVER_ERROR')).toBe(false);
      });
    });

    describe('isRateLimited', () => {
      it('should identify rate limit errors', () => {
        const rateLimitedResult: ExecutionResult<string> = {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limited',
            retryable: true,
            statusCode: 429,
          },
          attempts: 1,
          totalDurationMs: 100,
        };

        expect(isRateLimited(rateLimitedResult)).toBe(true);
        expect(isRateLimited(failureResult)).toBe(false);
      });
    });

    describe('isCircuitOpen', () => {
      it('should identify circuit open errors', () => {
        const circuitOpenResult: ExecutionResult<string> = {
          success: false,
          error: {
            code: 'CIRCUIT_OPEN',
            message: 'Circuit open',
            retryable: false,
          },
          attempts: 0,
          totalDurationMs: 0,
        };

        expect(isCircuitOpen(circuitOpenResult)).toBe(true);
        expect(isCircuitOpen(failureResult)).toBe(false);
      });
    });
  });

  describe('Result Utilities', () => {
    const successResult: ExecutionResult<number> = {
      success: true,
      data: 42,
      attempts: 1,
      totalDurationMs: 100,
    };

    const failureResult: ExecutionResult<number> = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server error',
        retryable: true,
      },
      attempts: 3,
      totalDurationMs: 5000,
    };

    describe('unwrap', () => {
      it('should return data for successful results', () => {
        expect(unwrap(successResult)).toBe(42);
      });

      it('should throw for failed results', () => {
        expect(() => unwrap(failureResult)).toThrow('Server error');
      });
    });

    describe('unwrapOr', () => {
      it('should return data for successful results', () => {
        expect(unwrapOr(successResult, 0)).toBe(42);
      });

      it('should return default for failed results', () => {
        expect(unwrapOr(failureResult, 0)).toBe(0);
      });
    });

    describe('mapResult', () => {
      it('should transform successful results', () => {
        const mapped = mapResult(successResult, (n) => n * 2);

        expect(isSuccess(mapped)).toBe(true);
        if (isSuccess(mapped)) {
          expect(mapped.data).toBe(84);
        }
      });

      it('should pass through failed results', () => {
        const mapped = mapResult(failureResult, (n) => n * 2);

        expect(isFailure(mapped)).toBe(true);
      });
    });
  });

  describe('RetryPresets', () => {
    it('should have none preset with single attempt', () => {
      expect(RetryPresets.none.maxAttempts).toBe(1);
    });

    it('should have standard preset with 3 attempts', () => {
      expect(RetryPresets.standard.maxAttempts).toBe(3);
      expect(RetryPresets.standard.baseDelayMs).toBe(1000);
    });

    it('should have aggressive preset with more attempts', () => {
      expect(RetryPresets.aggressive.maxAttempts).toBe(5);
    });

    it('should have rateLimited preset with longer delays', () => {
      expect(RetryPresets.rateLimited.baseDelayMs).toBe(5000);
    });
  });

  describe('Header Helpers', () => {
    describe('jsonHeaders', () => {
      it('should create JSON headers', () => {
        const headers = jsonHeaders();

        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['Accept']).toBe('application/json');
      });

      it('should merge additional headers', () => {
        const headers = jsonHeaders({ 'X-Custom': 'value' });

        expect(headers['X-Custom']).toBe('value');
        expect(headers['Content-Type']).toBe('application/json');
      });
    });

    describe('bearerHeaders', () => {
      it('should include bearer token', () => {
        const headers = bearerHeaders('my-token');

        expect(headers['Authorization']).toBe('Bearer my-token');
        expect(headers['Content-Type']).toBe('application/json');
      });
    });

    describe('apiKeyHeaders', () => {
      it('should include API key with default header name', () => {
        const headers = apiKeyHeaders('my-key');

        expect(headers['X-API-Key']).toBe('my-key');
      });

      it('should use custom header name', () => {
        const headers = apiKeyHeaders('my-key', 'Authorization');

        expect(headers['Authorization']).toBe('my-key');
      });
    });
  });
});
