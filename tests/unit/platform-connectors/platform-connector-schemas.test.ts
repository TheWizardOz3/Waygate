/**
 * Platform Connector Schemas Tests
 *
 * Tests for Zod validation schemas used in the platform connector module.
 */

import { describe, it, expect } from 'vitest';
import { AuthType, PlatformConnectorStatus } from '@prisma/client';
import {
  CreatePlatformConnectorInputSchema,
  UpdatePlatformConnectorInputSchema,
  PlatformConnectorResponseSchema,
  CertificationsSchema,
  RateLimitsSchema,
  toPlatformConnectorResponse,
  PlatformConnectorErrorCodes,
} from '@/lib/modules/platform-connectors/platform-connector.schemas';

describe('Platform Connector Schemas', () => {
  describe('CreatePlatformConnectorInputSchema', () => {
    const validInput = {
      providerSlug: 'slack',
      displayName: 'Slack',
      description: 'Connect to Slack workspaces',
      logoUrl: 'https://example.com/slack.svg',
      authType: AuthType.oauth2,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      defaultScopes: ['chat:write', 'channels:read'],
      callbackPath: '/api/v1/auth/callback/slack',
    };

    it('should validate a valid create input', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider slug format', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse({
        ...validInput,
        providerSlug: 'Invalid Slug',
      });
      expect(result.success).toBe(false);
    });

    it('should reject slug with uppercase', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse({
        ...validInput,
        providerSlug: 'Slack',
      });
      expect(result.success).toBe(false);
    });

    it('should accept slug with hyphens', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse({
        ...validInput,
        providerSlug: 'google-workspace',
      });
      expect(result.success).toBe(true);
    });

    it('should require clientId', () => {
      const inputWithoutClientId = {
        providerSlug: validInput.providerSlug,
        displayName: validInput.displayName,
        description: validInput.description,
        logoUrl: validInput.logoUrl,
        authType: validInput.authType,
        clientSecret: validInput.clientSecret,
        authorizationUrl: validInput.authorizationUrl,
        tokenUrl: validInput.tokenUrl,
        defaultScopes: validInput.defaultScopes,
        callbackPath: validInput.callbackPath,
      };
      const result = CreatePlatformConnectorInputSchema.safeParse(inputWithoutClientId);
      expect(result.success).toBe(false);
    });

    it('should require clientSecret', () => {
      const inputWithoutSecret = {
        providerSlug: validInput.providerSlug,
        displayName: validInput.displayName,
        description: validInput.description,
        logoUrl: validInput.logoUrl,
        authType: validInput.authType,
        clientId: validInput.clientId,
        authorizationUrl: validInput.authorizationUrl,
        tokenUrl: validInput.tokenUrl,
        defaultScopes: validInput.defaultScopes,
        callbackPath: validInput.callbackPath,
      };
      const result = CreatePlatformConnectorInputSchema.safeParse(inputWithoutSecret);
      expect(result.success).toBe(false);
    });

    it('should require valid URL for authorizationUrl', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse({
        ...validInput,
        authorizationUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should require valid URL for tokenUrl', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse({
        ...validInput,
        tokenUrl: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should default status to active', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(PlatformConnectorStatus.active);
      }
    });

    it('should default certifications to empty object', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.certifications).toEqual({});
      }
    });

    it('should default rateLimits to shared=true', () => {
      const result = CreatePlatformConnectorInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rateLimits).toEqual({ shared: true });
      }
    });
  });

  describe('UpdatePlatformConnectorInputSchema', () => {
    it('should validate partial updates', () => {
      const result = UpdatePlatformConnectorInputSchema.safeParse({
        displayName: 'Updated Slack',
      });
      expect(result.success).toBe(true);
    });

    it('should allow updating status', () => {
      const result = UpdatePlatformConnectorInputSchema.safeParse({
        status: PlatformConnectorStatus.suspended,
      });
      expect(result.success).toBe(true);
    });

    it('should allow updating credentials', () => {
      const result = UpdatePlatformConnectorInputSchema.safeParse({
        clientId: 'new-client-id',
        clientSecret: 'new-client-secret',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL in update', () => {
      const result = UpdatePlatformConnectorInputSchema.safeParse({
        authorizationUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CertificationsSchema', () => {
    it('should validate CASA certification', () => {
      const result = CertificationsSchema.safeParse({
        casa: {
          status: 'active',
          tier: 2,
          expiresAt: '2026-12-01T00:00:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate app review certification', () => {
      const result = CertificationsSchema.safeParse({
        appReview: {
          status: 'approved',
          approvedAt: '2026-01-01T00:00:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate multiple certifications', () => {
      // CertificationsSchema uses specific sub-schemas that require exact field names
      const result = CertificationsSchema.safeParse({
        casa: { status: 'active', tier: 2 },
        appReview: { status: 'approved', approvedAt: '2026-01-01T00:00:00Z' },
        publisherVerification: { status: 'approved', approvedAt: '2026-01-01T00:00:00Z' },
      });
      expect(result.success).toBe(true);
    });

    it('should allow empty certifications', () => {
      const result = CertificationsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('RateLimitsSchema', () => {
    it('should validate rate limits with all fields', () => {
      const result = RateLimitsSchema.safeParse({
        requestsPerMinute: 100,
        requestsPerDay: 10000,
        shared: true,
      });
      expect(result.success).toBe(true);
    });

    it('should default shared to true', () => {
      const result = RateLimitsSchema.safeParse({
        requestsPerMinute: 50,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shared).toBe(true);
      }
    });

    it('should allow non-shared rate limits', () => {
      const result = RateLimitsSchema.safeParse({
        shared: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PlatformConnectorResponseSchema', () => {
    const validResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      providerSlug: 'slack',
      displayName: 'Slack',
      description: 'Connect to Slack',
      logoUrl: 'https://example.com/slack.svg',
      authType: AuthType.oauth2,
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      defaultScopes: ['chat:write'],
      callbackPath: '/api/v1/auth/callback/slack',
      certifications: {},
      rateLimits: { shared: true },
      status: PlatformConnectorStatus.active,
      metadata: {},
      createdAt: '2026-01-25T00:00:00.000Z',
      updatedAt: '2026-01-25T00:00:00.000Z',
    };

    it('should validate a valid response', () => {
      const result = PlatformConnectorResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should NOT include encrypted fields', () => {
      // Response schema should NOT have encryptedClientId or encryptedClientSecret
      const responseWithSecrets = {
        ...validResponse,
        encryptedClientId: Buffer.from('secret'),
        encryptedClientSecret: Buffer.from('secret'),
      };
      const result = PlatformConnectorResponseSchema.safeParse(responseWithSecrets);
      // Should pass but strip the extra fields
      expect(result.success).toBe(true);
      if (result.success) {
        expect('encryptedClientId' in result.data).toBe(false);
        expect('encryptedClientSecret' in result.data).toBe(false);
      }
    });
  });

  describe('toPlatformConnectorResponse', () => {
    it('should convert database model to response format', () => {
      const dbModel = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        providerSlug: 'slack',
        displayName: 'Slack',
        description: 'Connect to Slack',
        logoUrl: 'https://example.com/slack.svg',
        authType: AuthType.oauth2,
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        defaultScopes: ['chat:write'],
        callbackPath: '/api/v1/auth/callback/slack',
        certifications: { appReview: { status: 'approved' } },
        rateLimits: { requestsPerMinute: 50, shared: true },
        status: PlatformConnectorStatus.active,
        metadata: { provider: 'Slack' },
        createdAt: new Date('2026-01-25T00:00:00.000Z'),
        updatedAt: new Date('2026-01-25T00:00:00.000Z'),
      };

      const response = toPlatformConnectorResponse(dbModel);

      expect(response.id).toBe(dbModel.id);
      expect(response.providerSlug).toBe('slack');
      expect(response.displayName).toBe('Slack');
      expect(response.createdAt).toBe('2026-01-25T00:00:00.000Z');
      expect(response.updatedAt).toBe('2026-01-25T00:00:00.000Z');
      // Should NOT have encrypted fields
      expect('encryptedClientId' in response).toBe(false);
      expect('encryptedClientSecret' in response).toBe(false);
    });

    it('should handle null description and logoUrl', () => {
      const dbModel = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        providerSlug: 'custom',
        displayName: 'Custom',
        description: null,
        logoUrl: null,
        authType: AuthType.oauth2,
        authorizationUrl: 'https://example.com/auth',
        tokenUrl: 'https://example.com/token',
        defaultScopes: [],
        callbackPath: '/callback',
        certifications: {},
        rateLimits: { shared: true },
        status: PlatformConnectorStatus.active,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = toPlatformConnectorResponse(dbModel);

      expect(response.description).toBeNull();
      expect(response.logoUrl).toBeNull();
    });
  });

  describe('PlatformConnectorErrorCodes', () => {
    it('should have expected error codes', () => {
      expect(PlatformConnectorErrorCodes.CONNECTOR_NOT_FOUND).toBe('CONNECTOR_NOT_FOUND');
      expect(PlatformConnectorErrorCodes.DUPLICATE_PROVIDER_SLUG).toBe('DUPLICATE_PROVIDER_SLUG');
      expect(PlatformConnectorErrorCodes.CONNECTOR_SUSPENDED).toBe('CONNECTOR_SUSPENDED');
      expect(PlatformConnectorErrorCodes.CONNECTOR_DEPRECATED).toBe('CONNECTOR_DEPRECATED');
      expect(PlatformConnectorErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
      expect(PlatformConnectorErrorCodes.DECRYPTION_FAILED).toBe('DECRYPTION_FAILED');
    });
  });
});
