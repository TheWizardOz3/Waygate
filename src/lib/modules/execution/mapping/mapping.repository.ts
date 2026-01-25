/**
 * Mapping Repository
 *
 * Data access layer for field mappings with in-memory caching.
 * Handles CRUD operations and provides efficient mapping retrieval.
 *
 * Supports connection-level mapping overrides:
 * - connectionId = null: Action-level default mappings
 * - connectionId = uuid: Connection-specific overrides
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
  type ResolvedMapping,
  type MappingSource,
  type FieldMappingWithConnection,
} from './mapping.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Cached mappings for an action (or action + connection)
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
 * Cached resolved mappings for a connection
 */
export interface CachedResolvedMappings {
  /** Resolved mappings (defaults + overrides merged) */
  resolvedMappings: ResolvedMapping[];
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
  /** Filter by connection (null = action-level defaults only) */
  connectionId?: string | null;
}

// =============================================================================
// Cache Implementation
// =============================================================================

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** In-memory mapping cache - key format: "actionId" or "actionId:connectionId" */
const mappingCache = new Map<string, CachedMappings>();

/** In-memory resolved mapping cache - key format: "actionId:connectionId" */
const resolvedMappingCache = new Map<string, CachedResolvedMappings>();

/**
 * Build cache key for action (default mappings)
 */
function buildCacheKey(actionId: string, connectionId?: string | null): string {
  if (connectionId) {
    return `${actionId}:${connectionId}`;
  }
  return actionId;
}

/**
 * Build cache key for resolved mappings
 */
function buildResolvedCacheKey(actionId: string, connectionId: string): string {
  return `resolved:${actionId}:${connectionId}`;
}

/**
 * Get cached mappings for an action (or action + connection)
 */
function getCached(actionId: string, connectionId?: string | null): CachedMappings | undefined {
  const key = buildCacheKey(actionId, connectionId);
  const cached = mappingCache.get(key);
  if (!cached) {
    return undefined;
  }

  // Check if cache has expired
  if (Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    mappingCache.delete(key);
    return undefined;
  }

  return cached;
}

/**
 * Get cached resolved mappings for a connection
 */
function getCachedResolved(
  actionId: string,
  connectionId: string
): CachedResolvedMappings | undefined {
  const key = buildResolvedCacheKey(actionId, connectionId);
  const cached = resolvedMappingCache.get(key);
  if (!cached) {
    return undefined;
  }

  // Check if cache has expired
  if (Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    resolvedMappingCache.delete(key);
    return undefined;
  }

  return cached;
}

/**
 * Set cached mappings for an action (or action + connection)
 */
function setCached(actionId: string, mappings: CachedMappings, connectionId?: string | null): void {
  const key = buildCacheKey(actionId, connectionId);
  mappingCache.set(key, mappings);
}

/**
 * Set cached resolved mappings for a connection
 */
function setCachedResolved(
  actionId: string,
  connectionId: string,
  resolved: CachedResolvedMappings
): void {
  const key = buildResolvedCacheKey(actionId, connectionId);
  resolvedMappingCache.set(key, resolved);
}

/**
 * Invalidate cache for an action
 * Also invalidates all connection-specific caches for this action
 */
export function invalidateCache(actionId: string): void {
  // Remove action-level cache
  mappingCache.delete(actionId);

  // Remove all connection-specific caches for this action
  const mappingKeys = Array.from(mappingCache.keys());
  for (const key of mappingKeys) {
    if (key.startsWith(`${actionId}:`)) {
      mappingCache.delete(key);
    }
  }

  // Remove all resolved caches for this action
  const resolvedKeys = Array.from(resolvedMappingCache.keys());
  for (const key of resolvedKeys) {
    if (key.includes(`:${actionId}:`)) {
      resolvedMappingCache.delete(key);
    }
  }
}

/**
 * Invalidate cache for a specific connection
 */
export function invalidateConnectionCache(actionId: string, connectionId: string): void {
  // Remove connection-specific cache
  const key = buildCacheKey(actionId, connectionId);
  mappingCache.delete(key);

  // Remove resolved cache for this connection
  const resolvedKey = buildResolvedCacheKey(actionId, connectionId);
  resolvedMappingCache.delete(resolvedKey);
}

/**
 * Clear entire cache (for testing)
 */
export function clearCache(): void {
  mappingCache.clear();
  resolvedMappingCache.clear();
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
 * Convert Prisma FieldMapping to domain FieldMappingWithConnection
 */
function toDomainMappingWithConnection(
  prismaMapping: PrismaFieldMapping
): FieldMappingWithConnection {
  const base = toDomainMapping(prismaMapping);
  return {
    ...base,
    connectionId: prismaMapping.connectionId,
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
 * @param actionId - The action ID
 * @param tenantId - Optional tenant ID filter (null = no tenant filter)
 * @param connectionId - Optional connection ID filter (null = action-level defaults only)
 */
export async function getMappingsForAction(
  actionId: string,
  tenantId?: string | null,
  connectionId?: string | null
): Promise<CachedMappings> {
  // Try cache first (for action-level mappings only when no tenant/connection specified)
  if (tenantId === undefined && connectionId === undefined) {
    const cached = getCached(actionId);
    if (cached) {
      return cached;
    }
  } else if (connectionId) {
    const cached = getCached(actionId, connectionId);
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
      // connectionId filter for per-connection mappings
      connectionId: connectionId ?? null,
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

  // Cache based on context
  if (tenantId === undefined && connectionId === undefined) {
    setCached(actionId, result);
  } else if (connectionId) {
    setCached(actionId, result, connectionId);
  }

  return result;
}

/**
 * Get mappings specifically for a connection (overrides only)
 */
export async function getMappingsByConnection(
  actionId: string,
  connectionId: string
): Promise<FieldMappingWithConnection[]> {
  const prismaMappings = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      connectionId,
    },
    orderBy: { createdAt: 'asc' },
  });

  return prismaMappings.map(toDomainMappingWithConnection);
}

/**
 * Get resolved mappings for a connection (defaults + overrides merged)
 * Connection overrides take precedence over action defaults.
 */
export async function getResolvedMappings(
  actionId: string,
  connectionId: string | null
): Promise<{ resolvedMappings: ResolvedMapping[]; config: MappingConfig }> {
  // If no connection, just return defaults
  if (!connectionId) {
    const defaults = await getMappingsForAction(actionId);
    const resolvedMappings: ResolvedMapping[] = [
      ...defaults.inputMappings,
      ...defaults.outputMappings,
    ].map((m) => ({
      mapping: m,
      source: 'default' as MappingSource,
      connectionId: null,
      overridden: false,
    }));

    return { resolvedMappings, config: defaults.config };
  }

  // Try resolved cache
  const cached = getCachedResolved(actionId, connectionId);
  if (cached) {
    return { resolvedMappings: cached.resolvedMappings, config: cached.config };
  }

  // Load defaults (connectionId = null)
  const defaultMappings = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      connectionId: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Load connection overrides
  const connectionMappings = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      connectionId,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Load config
  const config = await getActionMappingConfig(actionId);

  // Build merged mappings - connection overrides win
  // Key format: "sourcePath:direction"
  const mergedMap = new Map<string, ResolvedMapping>();

  // Add defaults first
  for (const prismaMapping of defaultMappings) {
    const key = `${prismaMapping.sourcePath}:${prismaMapping.direction}`;
    const mapping = toDomainMapping(prismaMapping);
    mergedMap.set(key, {
      mapping,
      source: 'default',
      connectionId: null,
      overridden: false,
    });
  }

  // Override with connection mappings
  for (const prismaMapping of connectionMappings) {
    const key = `${prismaMapping.sourcePath}:${prismaMapping.direction}`;
    const mapping = toDomainMapping(prismaMapping);

    const existingDefault = mergedMap.get(key);
    mergedMap.set(key, {
      mapping,
      source: 'connection',
      connectionId,
      overridden: !!existingDefault,
      defaultMapping: existingDefault?.mapping,
    });
  }

  const resolvedMappings = Array.from(mergedMap.values());

  // Cache the result
  setCachedResolved(actionId, connectionId, {
    resolvedMappings,
    config,
    loadedAt: Date.now(),
  });

  return { resolvedMappings, config };
}

/**
 * Count how many connections have overrides for an action
 */
export async function countConnectionsWithOverrides(actionId: string): Promise<number> {
  const result = await prisma.fieldMapping.groupBy({
    by: ['connectionId'],
    where: {
      actionId,
      connectionId: { not: null },
    },
  });

  return result.length;
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
      ...(options.connectionId !== undefined && { connectionId: options.connectionId }),
    },
    orderBy: { createdAt: 'asc' },
  });

  return prismaMappings.map(toDomainMapping);
}

/**
 * List mappings with connection info
 */
export async function listMappingsWithConnection(
  actionId: string,
  options: ListMappingsOptions = {}
): Promise<FieldMappingWithConnection[]> {
  const prismaMappings = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      ...(options.direction && {
        direction: options.direction.toUpperCase() as MappingDirection,
      }),
      ...(options.tenantId !== undefined && { tenantId: options.tenantId }),
      ...(options.connectionId !== undefined && { connectionId: options.connectionId }),
    },
    orderBy: { createdAt: 'asc' },
  });

  return prismaMappings.map(toDomainMappingWithConnection);
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
 * @param actionId - The action ID
 * @param mapping - The mapping definition
 * @param tenantId - Optional tenant ID (null = no tenant)
 * @param connectionId - Optional connection ID (null = action-level default)
 */
export async function createMapping(
  actionId: string,
  mapping: CreateFieldMapping,
  tenantId?: string | null,
  connectionId?: string | null
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
      connectionId: connectionId ?? null,
      sourcePath: validated.sourcePath,
      targetPath: validated.targetPath,
      direction: validated.direction.toUpperCase() as MappingDirection,
      transformConfig: transformConfigForDb,
    },
  });

  // Invalidate cache based on context
  if (connectionId) {
    invalidateConnectionCache(actionId, connectionId);
  } else {
    invalidateCache(actionId);
  }

  // Auto-enable mapping if this is the first mapping (for action-level only)
  if (!connectionId) {
    const count = await prisma.fieldMapping.count({
      where: { actionId, connectionId: null },
    });
    if (count === 1) {
      await saveActionMappingConfig(actionId, { enabled: true });
    }
  }

  return toDomainMapping(prismaMapping);
}

/**
 * Create a connection-specific mapping override
 */
export async function createConnectionMapping(
  actionId: string,
  connectionId: string,
  mapping: CreateFieldMapping,
  tenantId?: string | null
): Promise<FieldMappingWithConnection> {
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
      connectionId,
      sourcePath: validated.sourcePath,
      targetPath: validated.targetPath,
      direction: validated.direction.toUpperCase() as MappingDirection,
      transformConfig: transformConfigForDb,
    },
  });

  // Invalidate connection-specific cache
  invalidateConnectionCache(actionId, connectionId);

  return toDomainMappingWithConnection(prismaMapping);
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

  // Invalidate cache based on context
  if (existing.connectionId) {
    invalidateConnectionCache(existing.actionId, existing.connectionId);
  } else {
    invalidateCache(existing.actionId);
  }

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

  // Invalidate cache based on context
  if (existing.connectionId) {
    invalidateConnectionCache(existing.actionId, existing.connectionId);
  } else {
    invalidateCache(existing.actionId);
  }

  return true;
}

/**
 * Bulk create or update mappings
 */
export async function bulkUpsertMappings(
  actionId: string,
  mappings: FieldMapping[],
  replace: boolean = false,
  tenantId?: string | null,
  connectionId?: string | null
): Promise<FieldMapping[]> {
  // If replace mode, delete all existing mappings first
  if (replace) {
    await prisma.fieldMapping.deleteMany({
      where: {
        actionId,
        tenantId: tenantId ?? null,
        connectionId: connectionId ?? null,
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
        tenantId,
        connectionId
      );
      results.push(created);
    }
  }

  // Invalidate cache based on context
  if (connectionId) {
    invalidateConnectionCache(actionId, connectionId);
  } else {
    invalidateCache(actionId);
  }

  return results;
}

/**
 * Delete all mappings for an action (optionally for a specific connection)
 */
export async function deleteAllMappings(
  actionId: string,
  tenantId?: string | null,
  connectionId?: string | null
): Promise<number> {
  const result = await prisma.fieldMapping.deleteMany({
    where: {
      actionId,
      tenantId: tenantId ?? null,
      connectionId: connectionId ?? null,
    },
  });

  // Invalidate cache based on context
  if (connectionId) {
    invalidateConnectionCache(actionId, connectionId);
  } else {
    invalidateCache(actionId);
  }

  return result.count;
}

/**
 * Delete all connection-specific overrides for a connection
 * (resets to action-level defaults)
 */
export async function resetConnectionMappings(
  actionId: string,
  connectionId: string
): Promise<number> {
  const result = await prisma.fieldMapping.deleteMany({
    where: {
      actionId,
      connectionId,
    },
  });

  // Invalidate connection-specific cache
  invalidateConnectionCache(actionId, connectionId);

  return result.count;
}

/**
 * Copy action-level defaults to a connection as overrides
 */
export async function copyDefaultsToConnection(
  actionId: string,
  connectionId: string,
  tenantId?: string | null
): Promise<FieldMappingWithConnection[]> {
  // Get action-level defaults
  const defaults = await prisma.fieldMapping.findMany({
    where: {
      actionId,
      connectionId: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  const results: FieldMappingWithConnection[] = [];

  for (const defaultMapping of defaults) {
    const prismaMapping = await prisma.fieldMapping.create({
      data: {
        actionId,
        tenantId: tenantId ?? null,
        connectionId,
        sourcePath: defaultMapping.sourcePath,
        targetPath: defaultMapping.targetPath,
        direction: defaultMapping.direction,
        transformConfig: defaultMapping.transformConfig as Prisma.InputJsonValue,
      },
    });
    results.push(toDomainMappingWithConnection(prismaMapping));
  }

  // Invalidate connection-specific cache
  invalidateConnectionCache(actionId, connectionId);

  return results;
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
