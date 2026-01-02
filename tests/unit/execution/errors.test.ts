import { describe, it, expect } from 'vitest';
import {
  ExecutionError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  ServerError,
  ClientError,
  CircuitOpenError,
  MaxRetriesExceededError,
  isExecutionError,
  isRetryableError,
  isRateLimitError,
  isCircuitOpenError,
  isTimeoutError,
  createErrorFromStatus,
  wrapError,
} from '@/lib/modules/execution';

describe('Execution Errors', () => {
  describe('ExecutionError', () => {
    it('should create error with all properties', () => {
      const error = new ExecutionError('NETWORK_ERROR', 'Connection failed', {
        retryable: true,
        statusCode: undefined,
        details: { host: 'api.example.com' },
      });

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Connection failed');
      expect(error.retryable).toBe(true);
      expect(error.details).toEqual({ host: 'api.example.com' });
    });

    it('should convert to details object', () => {
      const error = new ExecutionError('SERVER_ERROR', 'Server error', {
        statusCode: 500,
        retryable: true,
      });

      const details = error.toDetails();

      expect(details.code).toBe('SERVER_ERROR');
      expect(details.message).toBe('Server error');
      expect(details.statusCode).toBe(500);
      expect(details.retryable).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should be retryable by default', () => {
      const error = new NetworkError('DNS lookup failed');

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should include timeout duration', () => {
      const error = new TimeoutError(30000);

      expect(error.code).toBe('TIMEOUT');
      expect(error.timeoutMs).toBe(30000);
      expect(error.message).toContain('30000');
      expect(error.retryable).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should include retryAfterMs when provided', () => {
      const error = new RateLimitError(60000);

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfterMs).toBe(60000);
      expect(error.retryable).toBe(true);
    });

    it('should work without retryAfterMs', () => {
      const error = new RateLimitError();

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfterMs).toBeUndefined();
    });
  });

  describe('ServerError', () => {
    it('should store status code', () => {
      const error = new ServerError(503, 'Service unavailable');

      expect(error.code).toBe('SERVER_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
    });
  });

  describe('ClientError', () => {
    it('should not be retryable', () => {
      const error = new ClientError(400, 'Bad request', { field: 'email' });

      expect(error.code).toBe('CLIENT_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.responseBody).toEqual({ field: 'email' });
    });
  });

  describe('CircuitOpenError', () => {
    it('should include circuit ID and reset time', () => {
      const error = new CircuitOpenError('api-integration', 30000);

      expect(error.code).toBe('CIRCUIT_OPEN');
      expect(error.circuitId).toBe('api-integration');
      expect(error.resetTimeMs).toBe(30000);
      expect(error.retryable).toBe(false);
    });
  });

  describe('MaxRetriesExceededError', () => {
    it('should include attempt count and last error', () => {
      const lastError = new ServerError(500);
      const error = new MaxRetriesExceededError(3, lastError);

      expect(error.code).toBe('MAX_RETRIES_EXCEEDED');
      expect(error.attempts).toBe(3);
      expect(error.lastError).toBe(lastError);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Type Guards', () => {
    describe('isExecutionError', () => {
      it('should return true for ExecutionError instances', () => {
        expect(isExecutionError(new NetworkError('test'))).toBe(true);
        expect(isExecutionError(new ServerError(500))).toBe(true);
      });

      it('should return false for non-ExecutionError', () => {
        expect(isExecutionError(new Error('test'))).toBe(false);
        expect(isExecutionError('error')).toBe(false);
        expect(isExecutionError(null)).toBe(false);
      });
    });

    describe('isRetryableError', () => {
      it('should return true for retryable errors', () => {
        expect(isRetryableError(new NetworkError('test'))).toBe(true);
        expect(isRetryableError(new ServerError(500))).toBe(true);
        expect(isRetryableError(new RateLimitError())).toBe(true);
      });

      it('should return false for non-retryable errors', () => {
        expect(isRetryableError(new ClientError(400))).toBe(false);
        expect(isRetryableError(new CircuitOpenError('test'))).toBe(false);
      });
    });

    describe('isRateLimitError', () => {
      it('should identify RateLimitError', () => {
        expect(isRateLimitError(new RateLimitError())).toBe(true);
        expect(isRateLimitError(new ServerError(500))).toBe(false);
      });
    });

    describe('isCircuitOpenError', () => {
      it('should identify CircuitOpenError', () => {
        expect(isCircuitOpenError(new CircuitOpenError('test'))).toBe(true);
        expect(isCircuitOpenError(new ServerError(500))).toBe(false);
      });
    });

    describe('isTimeoutError', () => {
      it('should identify TimeoutError', () => {
        expect(isTimeoutError(new TimeoutError(1000))).toBe(true);
        expect(isTimeoutError(new NetworkError('test'))).toBe(false);
      });
    });
  });

  describe('createErrorFromStatus', () => {
    it('should create RateLimitError for 429', () => {
      const error = createErrorFromStatus(429);
      expect(error).toBeInstanceOf(RateLimitError);
    });

    it('should create ServerError for 5xx', () => {
      expect(createErrorFromStatus(500)).toBeInstanceOf(ServerError);
      expect(createErrorFromStatus(502)).toBeInstanceOf(ServerError);
      expect(createErrorFromStatus(503)).toBeInstanceOf(ServerError);
    });

    it('should create ClientError for 4xx', () => {
      expect(createErrorFromStatus(400)).toBeInstanceOf(ClientError);
      expect(createErrorFromStatus(401)).toBeInstanceOf(ClientError);
      expect(createErrorFromStatus(404)).toBeInstanceOf(ClientError);
    });
  });

  describe('wrapError', () => {
    it('should return ExecutionError unchanged', () => {
      const error = new ServerError(500);
      expect(wrapError(error)).toBe(error);
    });

    it('should wrap standard Error', () => {
      const error = new Error('test error');
      const wrapped = wrapError(error);

      expect(isExecutionError(wrapped)).toBe(true);
      expect(wrapped.message).toBe('test error');
    });

    it('should wrap AbortError as TimeoutError', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      const wrapped = wrapError(error);

      expect(wrapped).toBeInstanceOf(TimeoutError);
    });

    it('should wrap TypeError with fetch as NetworkError', () => {
      const error = new TypeError('Failed to fetch');
      const wrapped = wrapError(error);

      expect(wrapped).toBeInstanceOf(NetworkError);
    });

    it('should wrap non-Error values', () => {
      const wrapped = wrapError('string error');

      expect(isExecutionError(wrapped)).toBe(true);
      expect(wrapped.message).toBe('string error');
    });
  });
});
