/**
 * Connection Platform Mode Tests
 *
 * Tests for connection creation with platform vs custom connector types.
 */

import { describe, it, expect } from 'vitest';
import {
  CreateConnectionInputSchema,
  ConnectionResponseSchema,
  ConnectorTypeSchema,
  toConnectionResponse,
  ConnectionErrorCodes,
} from '@/lib/modules/connections/connection.schemas';

describe('Connection Platform Mode', () => {
  describe('ConnectorTypeSchema', () => {
    it('should accept platform type', () => {
      const result = ConnectorTypeSchema.safeParse('platform');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('platform');
      }
    });

    it('should accept custom type', () => {
      const result = ConnectorTypeSchema.safeParse('custom');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('custom');
      }
    });

    it('should reject invalid type', () => {
      const result = ConnectorTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('CreateConnectionInputSchema', () => {
    const baseInput = {
      name: 'Test Connection',
      slug: 'test-connection',
      isPrimary: false,
      metadata: {},
    };

    it('should default connectorType to custom', () => {
      const result = CreateConnectionInputSchema.safeParse(baseInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.connectorType).toBe('custom');
      }
    });

    it('should accept explicit custom connectorType', () => {
      const result = CreateConnectionInputSchema.safeParse({
        ...baseInput,
        connectorType: 'custom',
      });
      expect(result.success).toBe(true);
    });

    it('should require platformConnectorSlug when connectorType is platform', () => {
      const result = CreateConnectionInputSchema.safeParse({
        ...baseInput,
        connectorType: 'platform',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('platformConnectorSlug'))).toBe(
          true
        );
      }
    });

    it('should accept platform type with platformConnectorSlug', () => {
      const result = CreateConnectionInputSchema.safeParse({
        ...baseInput,
        connectorType: 'platform',
        platformConnectorSlug: 'slack',
      });
      expect(result.success).toBe(true);
    });

    it('should reject platformConnectorSlug when connectorType is custom', () => {
      const result = CreateConnectionInputSchema.safeParse({
        ...baseInput,
        connectorType: 'custom',
        platformConnectorSlug: 'slack',
      });
      expect(result.success).toBe(false);
    });

    it('should allow omitting platformConnectorSlug for custom type', () => {
      const result = CreateConnectionInputSchema.safeParse({
        ...baseInput,
        connectorType: 'custom',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platformConnectorSlug).toBeUndefined();
      }
    });
  });

  describe('ConnectionResponseSchema', () => {
    const validResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      integrationId: '123e4567-e89b-12d3-a456-426614174002',
      name: 'Test Connection',
      slug: 'test-connection',
      baseUrl: null,
      isPrimary: true,
      connectorType: 'custom',
      platformConnectorId: null,
      status: 'active',
      metadata: {},
      createdAt: '2026-01-25T00:00:00.000Z',
      updatedAt: '2026-01-25T00:00:00.000Z',
    };

    it('should validate custom connection response', () => {
      const result = ConnectionResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate platform connection response', () => {
      const result = ConnectionResponseSchema.safeParse({
        ...validResponse,
        connectorType: 'platform',
        platformConnectorId: '123e4567-e89b-12d3-a456-426614174003',
      });
      expect(result.success).toBe(true);
    });

    it('should allow null platformConnectorId for custom type', () => {
      const result = ConnectionResponseSchema.safeParse({
        ...validResponse,
        connectorType: 'custom',
        platformConnectorId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('toConnectionResponse', () => {
    it('should convert database model to response with custom type', () => {
      const dbModel = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        integrationId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Test Connection',
        slug: 'test',
        baseUrl: null,
        isPrimary: true,
        connectorType: 'custom',
        platformConnectorId: null,
        status: 'active',
        metadata: {},
        createdAt: new Date('2026-01-25T00:00:00.000Z'),
        updatedAt: new Date('2026-01-25T00:00:00.000Z'),
      };

      const response = toConnectionResponse(dbModel);

      expect(response.connectorType).toBe('custom');
      expect(response.platformConnectorId).toBeNull();
    });

    it('should convert database model to response with platform type', () => {
      const dbModel = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        integrationId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Platform Connection',
        slug: 'platform',
        baseUrl: null,
        isPrimary: false,
        connectorType: 'platform',
        platformConnectorId: '123e4567-e89b-12d3-a456-426614174003',
        status: 'active',
        metadata: {},
        createdAt: new Date('2026-01-25T00:00:00.000Z'),
        updatedAt: new Date('2026-01-25T00:00:00.000Z'),
      };

      const response = toConnectionResponse(dbModel);

      expect(response.connectorType).toBe('platform');
      expect(response.platformConnectorId).toBe('123e4567-e89b-12d3-a456-426614174003');
    });

    it('should default null connectorType to custom', () => {
      const dbModel = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        integrationId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Legacy Connection',
        slug: 'legacy',
        baseUrl: null,
        isPrimary: false,
        connectorType: null, // Legacy data before migration
        platformConnectorId: null,
        status: 'active',
        metadata: {},
        createdAt: new Date('2026-01-25T00:00:00.000Z'),
        updatedAt: new Date('2026-01-25T00:00:00.000Z'),
      };

      const response = toConnectionResponse(dbModel);

      expect(response.connectorType).toBe('custom');
    });
  });

  describe('ConnectionErrorCodes', () => {
    it('should have platform connector error codes', () => {
      expect(ConnectionErrorCodes.PLATFORM_CONNECTOR_NOT_FOUND).toBe(
        'PLATFORM_CONNECTOR_NOT_FOUND'
      );
      expect(ConnectionErrorCodes.PLATFORM_CONNECTOR_NOT_ACTIVE).toBe(
        'PLATFORM_CONNECTOR_NOT_ACTIVE'
      );
      expect(ConnectionErrorCodes.INVALID_CONNECTOR_TYPE).toBe('INVALID_CONNECTOR_TYPE');
    });
  });
});
