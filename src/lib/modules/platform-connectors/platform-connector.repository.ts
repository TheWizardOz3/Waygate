/**
 * Platform Connector Repository
 *
 * Data access layer for PlatformConnector model.
 * Handles CRUD operations and queries for platform connectors.
 *
 * Platform connectors store Waygate's registered OAuth apps with major providers.
 * Secrets are stored encrypted and must be decrypted before use.
 */

import { prisma } from '@/lib/db/client';
import { AuthType, PlatformConnectorStatus, Prisma } from '@prisma/client';

import type { PlatformConnector } from '@prisma/client';
import type { PlatformConnectorFilters } from './platform-connector.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Input for creating a new platform connector (repository layer)
 * Note: encryptedClientId and encryptedClientSecret should already be encrypted
 */
export interface CreatePlatformConnectorDbInput {
  providerSlug: string;
  displayName: string;
  description?: string | null;
  logoUrl?: string | null;
  authType: AuthType;
  encryptedClientId: Buffer | Uint8Array;
  encryptedClientSecret: Buffer | Uint8Array;
  authorizationUrl: string;
  tokenUrl: string;
  defaultScopes?: string[];
  callbackPath: string;
  certifications?: Prisma.InputJsonValue;
  rateLimits?: Prisma.InputJsonValue;
  status?: PlatformConnectorStatus;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Input for updating a platform connector (repository layer)
 */
export interface UpdatePlatformConnectorDbInput {
  displayName?: string;
  description?: string | null;
  logoUrl?: string | null;
  encryptedClientId?: Buffer | Uint8Array;
  encryptedClientSecret?: Buffer | Uint8Array;
  authorizationUrl?: string;
  tokenUrl?: string;
  defaultScopes?: string[];
  callbackPath?: string;
  certifications?: Prisma.InputJsonValue;
  rateLimits?: Prisma.InputJsonValue;
  status?: PlatformConnectorStatus;
  metadata?: Prisma.InputJsonValue;
}

// =============================================================================
// Create Operations
// =============================================================================

/**
 * Creates a new platform connector
 */
export async function createPlatformConnector(
  input: CreatePlatformConnectorDbInput
): Promise<PlatformConnector> {
  return prisma.platformConnector.create({
    data: {
      providerSlug: input.providerSlug,
      displayName: input.displayName,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      authType: input.authType,
      encryptedClientId: new Uint8Array(input.encryptedClientId),
      encryptedClientSecret: new Uint8Array(input.encryptedClientSecret),
      authorizationUrl: input.authorizationUrl,
      tokenUrl: input.tokenUrl,
      defaultScopes: input.defaultScopes ?? [],
      callbackPath: input.callbackPath,
      certifications: input.certifications ?? {},
      rateLimits: input.rateLimits ?? {},
      status: input.status ?? PlatformConnectorStatus.active,
      metadata: input.metadata ?? {},
    },
  });
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Finds a platform connector by ID
 */
export async function findPlatformConnectorById(id: string): Promise<PlatformConnector | null> {
  return prisma.platformConnector.findUnique({
    where: { id },
  });
}

/**
 * Finds a platform connector by provider slug
 */
export async function findPlatformConnectorBySlug(
  providerSlug: string
): Promise<PlatformConnector | null> {
  return prisma.platformConnector.findUnique({
    where: { providerSlug },
  });
}

/**
 * Finds an active platform connector by provider slug
 */
export async function findActivePlatformConnectorBySlug(
  providerSlug: string
): Promise<PlatformConnector | null> {
  return prisma.platformConnector.findFirst({
    where: {
      providerSlug,
      status: PlatformConnectorStatus.active,
    },
  });
}

/**
 * Lists all platform connectors with optional filters
 */
export async function findAllPlatformConnectors(
  filters: PlatformConnectorFilters = {}
): Promise<PlatformConnector[]> {
  const where: Prisma.PlatformConnectorWhereInput = {};

  if (filters.status) {
    where.status = filters.status as PlatformConnectorStatus;
  }

  if (filters.authType) {
    where.authType = filters.authType as AuthType;
  }

  return prisma.platformConnector.findMany({
    where,
    orderBy: { displayName: 'asc' },
  });
}

/**
 * Lists all active platform connectors
 */
export async function findAllActivePlatformConnectors(): Promise<PlatformConnector[]> {
  return prisma.platformConnector.findMany({
    where: { status: PlatformConnectorStatus.active },
    orderBy: { displayName: 'asc' },
  });
}

/**
 * Checks if a provider slug is already used
 */
export async function isProviderSlugTaken(
  providerSlug: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.platformConnector.findFirst({
    where: {
      providerSlug,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Counts platform connectors by status
 */
export async function countPlatformConnectorsByStatus(): Promise<
  Record<PlatformConnectorStatus, number>
> {
  const counts = await prisma.platformConnector.groupBy({
    by: ['status'],
    _count: true,
  });

  // Initialize all statuses to 0
  const result: Record<PlatformConnectorStatus, number> = {
    [PlatformConnectorStatus.active]: 0,
    [PlatformConnectorStatus.suspended]: 0,
    [PlatformConnectorStatus.deprecated]: 0,
  };

  // Fill in actual counts
  for (const item of counts) {
    result[item.status] = item._count;
  }

  return result;
}

/**
 * Gets usage count for a platform connector (how many connections use it)
 */
export async function getPlatformConnectorUsageCount(platformConnectorId: string): Promise<number> {
  return prisma.connection.count({
    where: { platformConnectorId },
  });
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Updates a platform connector
 */
export async function updatePlatformConnector(
  id: string,
  input: UpdatePlatformConnectorDbInput
): Promise<PlatformConnector> {
  const data: Prisma.PlatformConnectorUpdateInput = {};

  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.description !== undefined) data.description = input.description;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.encryptedClientId !== undefined)
    data.encryptedClientId = new Uint8Array(input.encryptedClientId);
  if (input.encryptedClientSecret !== undefined)
    data.encryptedClientSecret = new Uint8Array(input.encryptedClientSecret);
  if (input.authorizationUrl !== undefined) data.authorizationUrl = input.authorizationUrl;
  if (input.tokenUrl !== undefined) data.tokenUrl = input.tokenUrl;
  if (input.defaultScopes !== undefined) data.defaultScopes = input.defaultScopes;
  if (input.callbackPath !== undefined) data.callbackPath = input.callbackPath;
  if (input.certifications !== undefined) data.certifications = input.certifications;
  if (input.rateLimits !== undefined) data.rateLimits = input.rateLimits;
  if (input.status !== undefined) data.status = input.status;
  if (input.metadata !== undefined) data.metadata = input.metadata;

  return prisma.platformConnector.update({
    where: { id },
    data,
  });
}

/**
 * Updates platform connector status
 */
export async function updatePlatformConnectorStatus(
  id: string,
  status: PlatformConnectorStatus
): Promise<PlatformConnector> {
  return prisma.platformConnector.update({
    where: { id },
    data: { status },
  });
}

/**
 * Updates platform connector certifications
 */
export async function updatePlatformConnectorCertifications(
  id: string,
  certifications: Prisma.InputJsonValue
): Promise<PlatformConnector> {
  return prisma.platformConnector.update({
    where: { id },
    data: { certifications },
  });
}

// =============================================================================
// Delete Operations
// =============================================================================

/**
 * Deletes a platform connector
 * Note: Should only be used when no connections reference it
 */
export async function deletePlatformConnector(id: string): Promise<PlatformConnector> {
  return prisma.platformConnector.delete({
    where: { id },
  });
}

/**
 * Soft-deprecates a platform connector
 * Prevents new connections but keeps existing ones working
 */
export async function deprecatePlatformConnector(id: string): Promise<PlatformConnector> {
  return prisma.platformConnector.update({
    where: { id },
    data: { status: PlatformConnectorStatus.deprecated },
  });
}

/**
 * Suspends a platform connector
 * Temporarily disables the connector (e.g., for maintenance)
 */
export async function suspendPlatformConnector(id: string): Promise<PlatformConnector> {
  return prisma.platformConnector.update({
    where: { id },
    data: { status: PlatformConnectorStatus.suspended },
  });
}
