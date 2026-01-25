/**
 * Platform Connector Service
 *
 * Business logic for platform connectors.
 * Handles credential encryption/decryption, validation, and connector management.
 *
 * Platform connectors are Waygate's registered OAuth apps with major providers.
 * They enable "one-click connect" experiences for users.
 */

import { encrypt, decrypt } from '@/lib/modules/credentials/encryption';
import { PlatformConnectorStatus, Prisma } from '@prisma/client';
import type { PlatformConnector } from '@prisma/client';

/**
 * Converts a typed object to Prisma InputJsonValue
 * Uses JSON serialization to ensure clean JSON compatible with Prisma
 */
function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

import {
  createPlatformConnector as createPlatformConnectorDb,
  findPlatformConnectorById,
  findPlatformConnectorBySlug,
  findActivePlatformConnectorBySlug,
  findAllPlatformConnectors,
  findAllActivePlatformConnectors,
  isProviderSlugTaken,
  updatePlatformConnector as updatePlatformConnectorDb,
  updatePlatformConnectorStatus,
  getPlatformConnectorUsageCount,
  deprecatePlatformConnector as deprecatePlatformConnectorDb,
  suspendPlatformConnector as suspendPlatformConnectorDb,
} from './platform-connector.repository';

import {
  toPlatformConnectorResponse,
  PlatformConnectorErrorCodes,
  type CreatePlatformConnectorInput,
  type UpdatePlatformConnectorInput,
  type PlatformConnectorFilters,
  type PlatformConnectorResponse,
  type PlatformConnectorWithSecrets,
  type Certifications,
  type RateLimits,
} from './platform-connector.schemas';

// =============================================================================
// Error Class
// =============================================================================

/**
 * Custom error class for platform connector operations
 */
export class PlatformConnectorError extends Error {
  constructor(
    public readonly code: (typeof PlatformConnectorErrorCodes)[keyof typeof PlatformConnectorErrorCodes],
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PlatformConnectorError';
  }
}

// =============================================================================
// Create Operations
// =============================================================================

/**
 * Creates a new platform connector
 * Encrypts client credentials before storage
 */
export async function createPlatformConnector(
  input: CreatePlatformConnectorInput
): Promise<PlatformConnectorResponse> {
  // Check for duplicate provider slug
  const slugTaken = await isProviderSlugTaken(input.providerSlug);
  if (slugTaken) {
    throw new PlatformConnectorError(
      PlatformConnectorErrorCodes.DUPLICATE_PROVIDER_SLUG,
      `A platform connector with provider slug '${input.providerSlug}' already exists`,
      409
    );
  }

  // Encrypt client credentials
  const encryptedClientId = encrypt(input.clientId);
  const encryptedClientSecret = encrypt(input.clientSecret);

  // Create the platform connector
  const connector = await createPlatformConnectorDb({
    providerSlug: input.providerSlug,
    displayName: input.displayName,
    description: input.description ?? null,
    logoUrl: input.logoUrl ?? null,
    authType: input.authType,
    encryptedClientId,
    encryptedClientSecret,
    authorizationUrl: input.authorizationUrl,
    tokenUrl: input.tokenUrl,
    defaultScopes: input.defaultScopes ?? [],
    callbackPath: input.callbackPath,
    certifications: toJsonValue(input.certifications ?? {}),
    rateLimits: toJsonValue(input.rateLimits ?? { shared: true }),
    status: input.status ?? 'active',
    metadata: toJsonValue(input.metadata ?? {}),
  });

  return toPlatformConnectorResponse(connector);
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Gets a platform connector by ID (no secrets)
 */
export async function getPlatformConnectorById(
  id: string
): Promise<PlatformConnectorResponse | null> {
  const connector = await findPlatformConnectorById(id);
  if (!connector) {
    return null;
  }
  return toPlatformConnectorResponse(connector);
}

/**
 * Gets a platform connector by ID, throws if not found
 */
export async function getPlatformConnectorByIdOrThrow(
  id: string
): Promise<PlatformConnectorResponse> {
  const connector = await getPlatformConnectorById(id);
  if (!connector) {
    throw new PlatformConnectorError(
      PlatformConnectorErrorCodes.CONNECTOR_NOT_FOUND,
      `Platform connector with ID '${id}' not found`,
      404
    );
  }
  return connector;
}

/**
 * Gets a platform connector by provider slug (no secrets)
 */
export async function getPlatformConnectorBySlug(
  providerSlug: string
): Promise<PlatformConnectorResponse | null> {
  const connector = await findPlatformConnectorBySlug(providerSlug);
  if (!connector) {
    return null;
  }
  return toPlatformConnectorResponse(connector);
}

/**
 * Gets a platform connector by provider slug, throws if not found
 */
export async function getPlatformConnectorBySlugOrThrow(
  providerSlug: string
): Promise<PlatformConnectorResponse> {
  const connector = await getPlatformConnectorBySlug(providerSlug);
  if (!connector) {
    throw new PlatformConnectorError(
      PlatformConnectorErrorCodes.CONNECTOR_NOT_FOUND,
      `Platform connector '${providerSlug}' not found`,
      404
    );
  }
  return connector;
}

/**
 * Gets an active platform connector by provider slug, throws if not found or not active
 */
export async function getActivePlatformConnectorBySlug(
  providerSlug: string
): Promise<PlatformConnectorResponse> {
  const connector = await findActivePlatformConnectorBySlug(providerSlug);
  if (!connector) {
    // Check if connector exists but isn't active
    const existing = await findPlatformConnectorBySlug(providerSlug);
    if (existing) {
      if (existing.status === PlatformConnectorStatus.suspended) {
        throw new PlatformConnectorError(
          PlatformConnectorErrorCodes.CONNECTOR_SUSPENDED,
          `Platform connector '${providerSlug}' is temporarily suspended`,
          503
        );
      }
      if (existing.status === PlatformConnectorStatus.deprecated) {
        throw new PlatformConnectorError(
          PlatformConnectorErrorCodes.CONNECTOR_DEPRECATED,
          `Platform connector '${providerSlug}' is deprecated and no longer available`,
          410
        );
      }
    }
    throw new PlatformConnectorError(
      PlatformConnectorErrorCodes.CONNECTOR_NOT_FOUND,
      `Platform connector '${providerSlug}' not found`,
      404
    );
  }
  return toPlatformConnectorResponse(connector);
}

/**
 * Lists all platform connectors (no secrets)
 */
export async function listPlatformConnectors(
  filters: PlatformConnectorFilters = {}
): Promise<PlatformConnectorResponse[]> {
  const connectors = await findAllPlatformConnectors(filters);
  return connectors.map(toPlatformConnectorResponse);
}

/**
 * Lists all active platform connectors (no secrets)
 */
export async function listActivePlatformConnectors(): Promise<PlatformConnectorResponse[]> {
  const connectors = await findAllActivePlatformConnectors();
  return connectors.map(toPlatformConnectorResponse);
}

// =============================================================================
// Secret Access (Internal Only)
// =============================================================================

/**
 * Gets a platform connector with decrypted secrets
 * WARNING: Only use this internally during OAuth flows!
 * NEVER expose these secrets to API responses!
 */
export async function getPlatformConnectorWithSecrets(
  providerSlug: string
): Promise<PlatformConnectorWithSecrets | null> {
  const connector = await findActivePlatformConnectorBySlug(providerSlug);
  if (!connector) {
    return null;
  }

  return decryptPlatformConnectorSecrets(connector);
}

/**
 * Gets a platform connector with decrypted secrets by ID
 * WARNING: Only use this internally during OAuth flows!
 */
export async function getPlatformConnectorWithSecretsById(
  id: string
): Promise<PlatformConnectorWithSecrets | null> {
  const connector = await findPlatformConnectorById(id);
  if (!connector) {
    return null;
  }

  return decryptPlatformConnectorSecrets(connector);
}

/**
 * Decrypts platform connector secrets
 * Internal helper function
 */
function decryptPlatformConnectorSecrets(
  connector: PlatformConnector
): PlatformConnectorWithSecrets {
  try {
    const clientId = decrypt(Buffer.from(connector.encryptedClientId));
    const clientSecret = decrypt(Buffer.from(connector.encryptedClientSecret));

    return {
      id: connector.id,
      providerSlug: connector.providerSlug,
      displayName: connector.displayName,
      description: connector.description,
      logoUrl: connector.logoUrl,
      authType: connector.authType,
      clientId,
      clientSecret,
      authorizationUrl: connector.authorizationUrl,
      tokenUrl: connector.tokenUrl,
      defaultScopes: connector.defaultScopes,
      callbackPath: connector.callbackPath,
      certifications: (connector.certifications as Certifications) ?? {},
      rateLimits: (connector.rateLimits as RateLimits) ?? {},
      status: connector.status,
      metadata: (connector.metadata as Record<string, unknown>) ?? {},
      createdAt: connector.createdAt,
      updatedAt: connector.updatedAt,
    };
  } catch {
    throw new PlatformConnectorError(
      PlatformConnectorErrorCodes.DECRYPTION_FAILED,
      'Failed to decrypt platform connector credentials',
      500
    );
  }
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Updates a platform connector
 * Re-encrypts credentials if changed
 */
export async function updatePlatformConnector(
  id: string,
  input: UpdatePlatformConnectorInput
): Promise<PlatformConnectorResponse> {
  // Verify connector exists
  const existing = await findPlatformConnectorById(id);
  if (!existing) {
    throw new PlatformConnectorError(
      PlatformConnectorErrorCodes.CONNECTOR_NOT_FOUND,
      `Platform connector with ID '${id}' not found`,
      404
    );
  }

  // Build update input
  const updateData: Parameters<typeof updatePlatformConnectorDb>[1] = {};

  if (input.displayName !== undefined) updateData.displayName = input.displayName;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
  if (input.authorizationUrl !== undefined) updateData.authorizationUrl = input.authorizationUrl;
  if (input.tokenUrl !== undefined) updateData.tokenUrl = input.tokenUrl;
  if (input.defaultScopes !== undefined) updateData.defaultScopes = input.defaultScopes;
  if (input.callbackPath !== undefined) updateData.callbackPath = input.callbackPath;
  if (input.certifications !== undefined)
    updateData.certifications = toJsonValue(input.certifications);
  if (input.rateLimits !== undefined) updateData.rateLimits = toJsonValue(input.rateLimits);
  if (input.status !== undefined) updateData.status = input.status;
  if (input.metadata !== undefined) updateData.metadata = toJsonValue(input.metadata);

  // Re-encrypt credentials if changed
  if (input.clientId !== undefined) {
    updateData.encryptedClientId = encrypt(input.clientId);
  }
  if (input.clientSecret !== undefined) {
    updateData.encryptedClientSecret = encrypt(input.clientSecret);
  }

  const connector = await updatePlatformConnectorDb(id, updateData);
  return toPlatformConnectorResponse(connector);
}

/**
 * Activates a platform connector
 */
export async function activatePlatformConnector(id: string): Promise<PlatformConnectorResponse> {
  const connector = await updatePlatformConnectorStatus(id, PlatformConnectorStatus.active);
  return toPlatformConnectorResponse(connector);
}

/**
 * Suspends a platform connector
 */
export async function suspendPlatformConnector(id: string): Promise<PlatformConnectorResponse> {
  const connector = await suspendPlatformConnectorDb(id);
  return toPlatformConnectorResponse(connector);
}

/**
 * Deprecates a platform connector
 */
export async function deprecatePlatformConnector(id: string): Promise<PlatformConnectorResponse> {
  const connector = await deprecatePlatformConnectorDb(id);
  return toPlatformConnectorResponse(connector);
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates that a platform connector is available for use
 */
export async function validatePlatformConnectorAvailable(providerSlug: string): Promise<void> {
  await getActivePlatformConnectorBySlug(providerSlug);
}

/**
 * Checks if a platform connector exists and is active
 */
export async function isPlatformConnectorAvailable(providerSlug: string): Promise<boolean> {
  const connector = await findActivePlatformConnectorBySlug(providerSlug);
  return connector !== null;
}

/**
 * Gets the usage count for a platform connector
 */
export async function getPlatformConnectorUsage(id: string): Promise<number> {
  return getPlatformConnectorUsageCount(id);
}
