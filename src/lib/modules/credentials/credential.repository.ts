/**
 * Credential Repository
 *
 * Data access layer for IntegrationCredential model.
 * Handles CRUD operations for encrypted credential storage.
 *
 * Note: This repository stores/retrieves encrypted data as-is.
 * Encryption/decryption is handled by the credential service layer.
 */

import { prisma } from '@/lib/db/client';
import { CredentialStatus, CredentialType } from '@prisma/client';

import type { IntegrationCredential, Prisma } from '@prisma/client';

/**
 * Input for creating a new credential
 */
export interface CreateCredentialInput {
  integrationId: string;
  tenantId: string;
  credentialType: CredentialType;
  encryptedData: Buffer | Uint8Array;
  encryptedRefreshToken?: Buffer | Uint8Array;
  expiresAt?: Date;
  scopes?: string[];
}

/**
 * Input for updating an existing credential
 */
export interface UpdateCredentialInput {
  encryptedData?: Buffer | Uint8Array;
  encryptedRefreshToken?: Buffer | Uint8Array;
  expiresAt?: Date;
  scopes?: string[];
  status?: CredentialStatus;
}

/**
 * Filters for querying credentials
 */
export interface CredentialFilters {
  integrationId?: string;
  tenantId?: string;
  credentialType?: CredentialType;
  status?: CredentialStatus;
  expiringBefore?: Date;
}

/**
 * Creates a new integration credential
 */
export async function createCredential(
  input: CreateCredentialInput
): Promise<IntegrationCredential> {
  return prisma.integrationCredential.create({
    data: {
      integrationId: input.integrationId,
      tenantId: input.tenantId,
      credentialType: input.credentialType,
      encryptedData: new Uint8Array(input.encryptedData),
      encryptedRefreshToken: input.encryptedRefreshToken
        ? new Uint8Array(input.encryptedRefreshToken)
        : null,
      expiresAt: input.expiresAt,
      scopes: input.scopes ?? [],
      status: CredentialStatus.active,
    },
  });
}

/**
 * Finds a credential by ID
 */
export async function findCredentialById(id: string): Promise<IntegrationCredential | null> {
  return prisma.integrationCredential.findUnique({
    where: { id },
  });
}

/**
 * Finds a credential by ID with tenant verification
 * Returns null if credential doesn't belong to tenant (security check)
 */
export async function findCredentialByIdAndTenant(
  id: string,
  tenantId: string
): Promise<IntegrationCredential | null> {
  return prisma.integrationCredential.findFirst({
    where: {
      id,
      tenantId,
    },
  });
}

/**
 * Finds the active credential for an integration
 * Returns the most recently created active credential
 */
export async function findActiveCredentialForIntegration(
  integrationId: string,
  tenantId: string
): Promise<IntegrationCredential | null> {
  return prisma.integrationCredential.findFirst({
    where: {
      integrationId,
      tenantId,
      status: CredentialStatus.active,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Finds all credentials for an integration
 */
export async function findCredentialsByIntegration(
  integrationId: string,
  tenantId: string
): Promise<IntegrationCredential[]> {
  return prisma.integrationCredential.findMany({
    where: {
      integrationId,
      tenantId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Finds all credentials for a tenant
 */
export async function findCredentialsByTenant(
  tenantId: string,
  filters?: Pick<CredentialFilters, 'status' | 'credentialType'>
): Promise<IntegrationCredential[]> {
  const where: Prisma.IntegrationCredentialWhereInput = {
    tenantId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.credentialType) {
    where.credentialType = filters.credentialType;
  }

  return prisma.integrationCredential.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Finds credentials that are expiring soon
 * Used by the token refresh background job
 */
export async function findExpiringCredentials(
  expiringBefore: Date
): Promise<IntegrationCredential[]> {
  return prisma.integrationCredential.findMany({
    where: {
      status: CredentialStatus.active,
      expiresAt: {
        lte: expiringBefore,
        not: null,
      },
    },
    orderBy: {
      expiresAt: 'asc',
    },
  });
}

/**
 * Updates a credential
 */
export async function updateCredential(
  id: string,
  input: UpdateCredentialInput
): Promise<IntegrationCredential> {
  return prisma.integrationCredential.update({
    where: { id },
    data: {
      ...(input.encryptedData !== undefined && {
        encryptedData: new Uint8Array(input.encryptedData),
      }),
      ...(input.encryptedRefreshToken !== undefined && {
        encryptedRefreshToken: input.encryptedRefreshToken
          ? new Uint8Array(input.encryptedRefreshToken)
          : null,
      }),
      ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
      ...(input.scopes !== undefined && { scopes: input.scopes }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });
}

/**
 * Updates a credential with tenant verification
 * Returns null if credential doesn't belong to tenant
 */
export async function updateCredentialForTenant(
  id: string,
  tenantId: string,
  input: UpdateCredentialInput
): Promise<IntegrationCredential | null> {
  // First verify ownership
  const existing = await findCredentialByIdAndTenant(id, tenantId);
  if (!existing) {
    return null;
  }

  return updateCredential(id, input);
}

/**
 * Marks a credential as revoked
 */
export async function revokeCredential(id: string): Promise<IntegrationCredential> {
  return prisma.integrationCredential.update({
    where: { id },
    data: {
      status: CredentialStatus.revoked,
    },
  });
}

/**
 * Marks a credential as needing re-authentication
 */
export async function markCredentialNeedsReauth(id: string): Promise<IntegrationCredential> {
  return prisma.integrationCredential.update({
    where: { id },
    data: {
      status: CredentialStatus.needs_reauth,
    },
  });
}

/**
 * Marks a credential as expired
 */
export async function markCredentialExpired(id: string): Promise<IntegrationCredential> {
  return prisma.integrationCredential.update({
    where: { id },
    data: {
      status: CredentialStatus.expired,
    },
  });
}

/**
 * Deletes a credential (hard delete)
 * Use sparingly - prefer revokeCredential for audit trail
 */
export async function deleteCredential(id: string): Promise<void> {
  await prisma.integrationCredential.delete({
    where: { id },
  });
}

/**
 * Deletes all credentials for an integration
 * Used when deleting an integration
 */
export async function deleteCredentialsByIntegration(integrationId: string): Promise<number> {
  const result = await prisma.integrationCredential.deleteMany({
    where: { integrationId },
  });
  return result.count;
}

/**
 * Counts credentials by status for a tenant
 * Useful for dashboard statistics
 */
export async function countCredentialsByStatus(
  tenantId: string
): Promise<Record<CredentialStatus, number>> {
  const counts = await prisma.integrationCredential.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: true,
  });

  // Initialize all statuses to 0
  const result: Record<CredentialStatus, number> = {
    [CredentialStatus.active]: 0,
    [CredentialStatus.expired]: 0,
    [CredentialStatus.revoked]: 0,
    [CredentialStatus.needs_reauth]: 0,
  };

  // Fill in actual counts
  for (const count of counts) {
    result[count.status] = count._count;
  }

  return result;
}
