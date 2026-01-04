/**
 * Mapping Repository
 *
 * Data access layer for field mappings with in-memory caching.
 * Handles CRUD operations and provides efficient mapping retrieval.
 */

import { prisma } from '@/lib/db/client';
import {
  Prisma,
  type FieldMapping as PrismaFieldMapping,
  type MappingDirection,
} from '@prisma/client';
import {
  FieldMappingSchema,
  MappingConfigSchema,
  type FieldMapping,
  type CreateFieldMapping,
  type UpdateFieldMapping,
  type MappingConfig,
  type PartialMappingConfig,
} from './mapping.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Cached mappings for an action
 */
export interface CachedMappings {
  /** Input direction mappings */
  inputMappings: FieldMapping[];
  /** Output direction mappings */
  outputMappings: FieldMapping[];
  /** Mapping configuration */
  config: MappingConfig;
  /** When the cache was loaded */
  loadedAt: number;
}

/**
 * Mapping list options
 */
export interface ListMappingsOptions {
  /** Filter by direction */
  direction?: 'input' | 'output';
  /** Filter by tenant (null = action-level mappings only) */
  tenantId?: string | null;
}

// =============================================================================
// Cache Implementation
// =============================================================================

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** In-memory mapping cache */
const mappingCache = new Map<string, CachedMappings>();

/**
 * Get cached mappings for an action
 */
function getCached(actionId: string): CachedMappings | undefined {
  const cached = mappingCache.get(actionId);
  if (!cached) {
    return undefined;
  }

  // Check if cache has expired
  if (Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    mappingCache.delete(actionId);
    return undefined;
  }

  return cached;
}

/**
 * Set cached mappings for an action
 */
function setCached(actionId: string, mappings: CachedMappings): void {
  mappingCache.set(actionId, mappings);
}

/**
 * Invalidate cache for an action
 */
export function invalidateCache(actionId: string): void {
  mappingCache.delete(actionId);
}

/**
 * Clear entire cache (for testing)
 */
export function clearCache(): void {
  mappingCache.clear();
}

// =============================================================================
// Conversion Helpers
// =============================================================================

/**
 * Convert Prisma FieldMapping to domain FieldMapping
 */
function toDomainMapping(prismaMapping: PrismaFieldMapping): FieldMapping {
  // Default transform config values
  const defaultTransformConfig: FieldMapping['transformConfig'] = {
    omitIfNull: false,
    omitIfEmpty: false,
    arrayMode: 'all',
  };

  return {
    id: prismaMapping.id,
    sourcePath: prismaMapping.sourcePath,
    targetPath: prismaMapping.targetPath,
    direction: prismaMapping.direction.toLowerCase() as 'input' | 'output',
    transformConfig: prismaMapping.transformConfig
      ? {
          ...defaultTransformConfig,
          ...(prismaMapping.transformConfig as Partial<FieldMapping['transformConfig']>),
        }
      : defaultTransformConfig,
  };
}

/**
 * Get mapping config from action metadata
 */
async function getActionMappingConfig(actionId: string): Promise<MappingConfig> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    select: { metadata: true },
  });

  if (!action?.metadata) {
    return MappingConfigSchema.parse({});
  }

  const metadata = action.metadata as Record<string, unknown>;
  const mappingConfig = metadata.mappingConfig;

  if (!mappingConfig) {
    return MappingConfigSchema.parse({});
  }

  return MappingConfigSchema.parse(mappingConfig);
}

/**
 * Save mapping config to action metadata
 */
async function saveActionMappingConfig(
  actionId: string,
  config: PartialMappingConfig
): Promise<MappingConfig> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    select: { metadata: true },
  });

  const existingMetadata = (action?.metadata as Record<string, unknown>) ?? {};
  const existingConfig = existingMetadata.mappingConfig ?? {};

  const newConfig = MappingConfigSchema.parse({
    ...existingConfig,
    ...config,
  });

  await prisma.action.update({
    where: { id: actionId },
    data: {
      metadata: {
        ...existingMetadata,
        mappingConfig: newConfig,
      },
    },
  });

  // Invalidate cache
  invalidateCache(actionId);

  return newConfig;
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Get all mappings for an action (with caching)
 */
export async function getMappingsForAction(
  actionId: string,
  tenantId?: string | null
): Promise<CachedMappings> {
  // Try cache first (for action-level mappings only when no tenant specified)
  if (tenantId === undefined) {
    const cached = getCached(actionId);
    if (cached) {
      return cached;
    }
  }

  // Load from database
  const prismaMappings = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      // If tenantId is specified, get tenant-specific mappings
      // If null, get action-level mappings (tenantId IS NULL)
      // If undefined, get action-level mappings
      tenantId: tenantId ?? null,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Load config
  const config = await getActionMappingConfig(actionId);

  // Convert to domain objects
  const mappings = prismaMappings.map(toDomainMapping);

  const result: CachedMappings = {
    inputMappings: mappings.filter((m) => m.direction === 'input'),
    outputMappings: mappings.filter((m) => m.direction === 'output'),
    config,
    loadedAt: Date.now(),
  };

  // Cache action-level mappings
  if (tenantId === undefined) {
    setCached(actionId, result);
  }

  return result;
}

/**
 * List mappings for an action with optional filters
 */
export async function listMappings(
  actionId: string,
  options: ListMappingsOptions = {}
): Promise<FieldMapping[]> {
  const prismaMappings = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      ...(options.direction && {
        direction: options.direction.toUpperCase() as MappingDirection,
      }),
      ...(options.tenantId !== undefined && { tenantId: options.tenantId }),
    },
    orderBy: { createdAt: 'asc' },
  });

  return prismaMappings.map(toDomainMapping);
}

/**
 * Get a single mapping by ID
 */
export async function getMappingById(mappingId: string): Promise<FieldMapping | null> {
  const prismaMapping = await prisma.fieldMapping.findUnique({
    where: { id: mappingId },
  });

  if (!prismaMapping) {
    return null;
  }

  return toDomainMapping(prismaMapping);
}

/**
 * Create a new mapping
 */
export async function createMapping(
  actionId: string,
  mapping: CreateFieldMapping,
  tenantId?: string | null
): Promise<FieldMapping> {
  // Validate mapping
  const validated = FieldMappingSchema.omit({ id: true }).parse(mapping);

  // Serialize transform config for Prisma (remove undefined values)
  const transformConfigForDb = validated.transformConfig
    ? JSON.parse(JSON.stringify(validated.transformConfig))
    : {};

  const prismaMapping = await prisma.fieldMapping.create({
    data: {
      actionId,
      tenantId: tenantId ?? null,
      sourcePath: validated.sourcePath,
      targetPath: validated.targetPath,
      direction: validated.direction.toUpperCase() as MappingDirection,
      transformConfig: transformConfigForDb,
    },
  });

  // Invalidate cache
  invalidateCache(actionId);

  // Auto-enable mapping if this is the first mapping
  const count = await prisma.fieldMapping.count({ where: { actionId } });
  if (count === 1) {
    await saveActionMappingConfig(actionId, { enabled: true });
  }

  return toDomainMapping(prismaMapping);
}

/**
 * Update an existing mapping
 */
export async function updateMapping(
  mappingId: string,
  updates: UpdateFieldMapping
): Promise<FieldMapping | null> {
  // Get existing mapping to find actionId for cache invalidation
  const existing = await prisma.fieldMapping.findUnique({
    where: { id: mappingId },
  });

  if (!existing) {
    return null;
  }

  // Build update data with proper serialization for Prisma
  const updateData: Prisma.FieldMappingUpdateInput = {};

  if (updates.sourcePath) {
    updateData.sourcePath = updates.sourcePath;
  }
  if (updates.targetPath) {
    updateData.targetPath = updates.targetPath;
  }
  if (updates.direction) {
    updateData.direction = updates.direction.toUpperCase() as MappingDirection;
  }
  if (updates.transformConfig) {
    // Merge with existing and serialize for Prisma (remove undefined values)
    const merged = {
      ...(existing.transformConfig as Record<string, unknown>),
      ...updates.transformConfig,
    };
    updateData.transformConfig = JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue;
  }

  const prismaMapping = await prisma.fieldMapping.update({
    where: { id: mappingId },
    data: updateData,
  });

  // Invalidate cache
  invalidateCache(existing.actionId);

  return toDomainMapping(prismaMapping);
}

/**
 * Delete a mapping
 */
export async function deleteMapping(mappingId: string): Promise<boolean> {
  // Get existing mapping to find actionId for cache invalidation
  const existing = await prisma.fieldMapping.findUnique({
    where: { id: mappingId },
  });

  if (!existing) {
    return false;
  }

  await prisma.fieldMapping.delete({
    where: { id: mappingId },
  });

  // Invalidate cache
  invalidateCache(existing.actionId);

  return true;
}

/**
 * Bulk create or update mappings
 */
export async function bulkUpsertMappings(
  actionId: string,
  mappings: FieldMapping[],
  replace: boolean = false,
  tenantId?: string | null
): Promise<FieldMapping[]> {
  // If replace mode, delete all existing mappings first
  if (replace) {
    await prisma.fieldMapping.deleteMany({
      where: {
        actionId,
        tenantId: tenantId ?? null,
      },
    });
  }

  const results: FieldMapping[] = [];

  for (const mapping of mappings) {
    if (mapping.id && !replace) {
      // Update existing
      const updated = await updateMapping(mapping.id, mapping);
      if (updated) {
        results.push(updated);
      }
    } else {
      // Create new
      const created = await createMapping(
        actionId,
        {
          sourcePath: mapping.sourcePath,
          targetPath: mapping.targetPath,
          direction: mapping.direction,
          transformConfig: mapping.transformConfig,
        },
        tenantId
      );
      results.push(created);
    }
  }

  // Invalidate cache
  invalidateCache(actionId);

  return results;
}

/**
 * Delete all mappings for an action
 */
export async function deleteAllMappings(
  actionId: string,
  tenantId?: string | null
): Promise<number> {
  const result = await prisma.fieldMapping.deleteMany({
    where: {
      actionId,
      tenantId: tenantId ?? null,
    },
  });

  // Invalidate cache
  invalidateCache(actionId);

  return result.count;
}

// =============================================================================
// Config Operations
// =============================================================================

/**
 * Get mapping configuration for an action
 */
export async function getMappingConfig(actionId: string): Promise<MappingConfig> {
  return getActionMappingConfig(actionId);
}

/**
 * Update mapping configuration for an action
 */
export async function updateMappingConfig(
  actionId: string,
  config: PartialMappingConfig
): Promise<MappingConfig> {
  return saveActionMappingConfig(actionId, config);
}
