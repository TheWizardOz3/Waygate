/**
 * Platform Connector Schemas
 *
 * Zod schemas for platform connector validation and API responses.
 * Platform connectors represent Waygate's registered OAuth apps with major providers.
 */

import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

/**
 * Platform connector status
 */
export const PlatformConnectorStatusSchema = z.enum(['active', 'suspended', 'deprecated']);
export type PlatformConnectorStatus = z.infer<typeof PlatformConnectorStatusSchema>;

/**
 * Auth type (matching Prisma enum)
 */
export const AuthTypeSchema = z.enum([
  'none',
  'oauth2',
  'api_key',
  'basic',
  'bearer',
  'custom_header',
]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

// =============================================================================
// Certification Schemas
// =============================================================================

/**
 * CASA certification status
 */
export const CasaCertificationSchema = z.object({
  status: z.enum(['active', 'expired', 'pending', 'none']),
  tier: z.number().int().min(1).max(3).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  certifiedAt: z.string().datetime().optional().nullable(),
});

/**
 * App review/publisher verification status
 */
export const AppReviewCertificationSchema = z.object({
  status: z.enum(['approved', 'pending', 'rejected', 'none']),
  approvedAt: z.string().datetime().optional().nullable(),
});

/**
 * All certifications for a platform connector
 */
export const CertificationsSchema = z.object({
  casa: CasaCertificationSchema.optional(),
  appReview: AppReviewCertificationSchema.optional(),
  publisherVerification: AppReviewCertificationSchema.optional(),
});

export type Certifications = z.infer<typeof CertificationsSchema>;

// =============================================================================
// Rate Limit Schemas
// =============================================================================

/**
 * Rate limit configuration for a platform connector
 */
export const RateLimitsSchema = z.object({
  requestsPerMinute: z.number().int().positive().optional(),
  requestsPerDay: z.number().int().positive().optional(),
  shared: z.boolean().optional().default(true),
});

export type RateLimits = z.infer<typeof RateLimitsSchema>;

// =============================================================================
// Platform Connector CRUD Schemas
// =============================================================================

/**
 * Input for creating a new platform connector (admin only)
 * Note: In V0.75, platform connectors are managed via seed/admin only
 */
export const CreatePlatformConnectorInputSchema = z.object({
  providerSlug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Provider slug must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  authType: AuthTypeSchema.default('oauth2'),
  clientId: z.string().min(1), // Will be encrypted before storage
  clientSecret: z.string().min(1), // Will be encrypted before storage
  authorizationUrl: z.string().url(),
  tokenUrl: z.string().url(),
  defaultScopes: z.array(z.string()).default([]),
  callbackPath: z.string().min(1).max(255),
  certifications: CertificationsSchema.optional().default({}),
  rateLimits: RateLimitsSchema.optional().default({ shared: true }),
  status: PlatformConnectorStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreatePlatformConnectorInput = z.infer<typeof CreatePlatformConnectorInputSchema>;

/**
 * Input for updating a platform connector (admin only)
 */
export const UpdatePlatformConnectorInputSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  clientId: z.string().min(1).optional(), // Will be encrypted if changed
  clientSecret: z.string().min(1).optional(), // Will be encrypted if changed
  authorizationUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  defaultScopes: z.array(z.string()).optional(),
  callbackPath: z.string().min(1).max(255).optional(),
  certifications: CertificationsSchema.optional(),
  rateLimits: RateLimitsSchema.optional(),
  status: PlatformConnectorStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdatePlatformConnectorInput = z.infer<typeof UpdatePlatformConnectorInputSchema>;

// =============================================================================
// Query Schemas
// =============================================================================

/**
 * Filters for querying platform connectors
 */
export const PlatformConnectorFiltersSchema = z.object({
  status: PlatformConnectorStatusSchema.optional(),
  authType: AuthTypeSchema.optional(),
});

export type PlatformConnectorFilters = z.infer<typeof PlatformConnectorFiltersSchema>;

/**
 * Query parameters for listing platform connectors (API)
 */
export const ListPlatformConnectorsQuerySchema = z.object({
  status: PlatformConnectorStatusSchema.optional(),
  authType: AuthTypeSchema.optional(),
});

export type ListPlatformConnectorsQuery = z.infer<typeof ListPlatformConnectorsQuerySchema>;

// =============================================================================
// API Response Schemas
// =============================================================================

/**
 * Platform connector as returned by the API (no secrets!)
 */
export const PlatformConnectorResponseSchema = z.object({
  id: z.string().uuid(),
  providerSlug: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  authType: AuthTypeSchema,
  authorizationUrl: z.string(),
  tokenUrl: z.string(),
  defaultScopes: z.array(z.string()),
  callbackPath: z.string(),
  certifications: CertificationsSchema,
  rateLimits: RateLimitsSchema,
  status: PlatformConnectorStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlatformConnectorResponse = z.infer<typeof PlatformConnectorResponseSchema>;

/**
 * List of platform connectors
 */
export const ListPlatformConnectorsResponseSchema = z.object({
  connectors: z.array(PlatformConnectorResponseSchema),
});

export type ListPlatformConnectorsResponse = z.infer<typeof ListPlatformConnectorsResponseSchema>;

// =============================================================================
// Internal Types (with decrypted secrets)
// =============================================================================

/**
 * Platform connector with decrypted OAuth credentials
 * Only used internally during OAuth flows - NEVER expose to API!
 */
export interface PlatformConnectorWithSecrets {
  id: string;
  providerSlug: string;
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  authType: AuthType;
  clientId: string; // Decrypted
  clientSecret: string; // Decrypted
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
  callbackPath: string;
  certifications: Certifications;
  rateLimits: RateLimits;
  status: PlatformConnectorStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Converts a database PlatformConnector to API response format (no secrets)
 */
export function toPlatformConnectorResponse(connector: {
  id: string;
  providerSlug: string;
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  authType: string;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
  callbackPath: string;
  certifications: unknown;
  rateLimits: unknown;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PlatformConnectorResponse {
  return {
    id: connector.id,
    providerSlug: connector.providerSlug,
    displayName: connector.displayName,
    description: connector.description,
    logoUrl: connector.logoUrl,
    authType: connector.authType as AuthType,
    authorizationUrl: connector.authorizationUrl,
    tokenUrl: connector.tokenUrl,
    defaultScopes: connector.defaultScopes,
    callbackPath: connector.callbackPath,
    certifications: (connector.certifications as Certifications) ?? {},
    rateLimits: (connector.rateLimits as RateLimits) ?? {},
    status: connector.status as PlatformConnectorStatus,
    metadata: (connector.metadata as Record<string, unknown>) ?? {},
    createdAt: connector.createdAt.toISOString(),
    updatedAt: connector.updatedAt.toISOString(),
  };
}

// =============================================================================
// Error Codes
// =============================================================================

export const PlatformConnectorErrorCodes = {
  CONNECTOR_NOT_FOUND: 'CONNECTOR_NOT_FOUND',
  DUPLICATE_PROVIDER_SLUG: 'DUPLICATE_PROVIDER_SLUG',
  CONNECTOR_NOT_ACTIVE: 'CONNECTOR_NOT_ACTIVE',
  CONNECTOR_SUSPENDED: 'CONNECTOR_SUSPENDED',
  CONNECTOR_DEPRECATED: 'CONNECTOR_DEPRECATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
} as const;
