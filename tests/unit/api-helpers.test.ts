import { describe, it, expect } from 'vitest';
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/api/errors';

describe('API Error Classes', () => {
  describe('ApiError', () => {
    it('creates error with correct properties', () => {
      const error = new ApiError('TEST_ERROR', 'Test message', 400, { field: 'value' });

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'value' });
      expect(error.name).toBe('ApiError');
    });

    it('defaults to status 400', () => {
      const error = new ApiError('TEST_ERROR', 'Test message');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ValidationError', () => {
    it('creates validation error with code VALIDATION_ERROR', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('NotFoundError', () => {
    it('creates not found error with resource name', () => {
      const error = new NotFoundError('Integration', '123');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe("Integration with id '123' not found");
      expect(error.statusCode).toBe(404);
    });

    it('creates not found error without id', () => {
      const error = new NotFoundError('Integration');

      expect(error.message).toBe('Integration not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('creates unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
    });

    it('accepts custom message', () => {
      const error = new UnauthorizedError('Invalid API key');
      expect(error.message).toBe('Invalid API key');
    });
  });

  describe('ForbiddenError', () => {
    it('creates forbidden error with default message', () => {
      const error = new ForbiddenError();

      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });
  });
});
