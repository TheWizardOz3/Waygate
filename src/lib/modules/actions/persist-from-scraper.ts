/**
 * Persist Actions from Scraper
 *
 * Connects AI scraper output to the action database.
 * Handles integration creation/lookup and batch action persistence.
 */

import { prisma } from '@/lib/db/client';
import { AuthType, Prisma } from '@prisma/client';
import { generateActions, type GenerateActionsOptions } from '../ai/action-generator';
import { persistGeneratedActions, ActionError } from './action.service';
import { ActionErrorCodes } from './action.schemas';
import type { ParsedApiDoc } from '../ai/scrape-job.schemas';
import type { BatchCreateActionsResponse } from './action.schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for persisting actions from a scrape result
 */
export interface PersistFromScrapeOptions {
  /** Wishlist terms for prioritization */
  wishlist?: string[];
  /** Replace existing actions (delete all first) */
  replaceExisting?: boolean;
  /** Default cache TTL for GET requests (seconds) */
  defaultCacheTtl?: number;
  /** Include deprecated endpoints */
  includeDeprecated?: boolean;
}

/**
 * Result of persisting actions from a scrape
 */
export interface PersistFromScrapeResult {
  /** The integration ID */
  integrationId: string;
  /** The integration slug */
  integrationSlug: string;
  /** Whether integration was created (false = already existed) */
  integrationCreated: boolean;
  /** Batch create result */
  actions: BatchCreateActionsResponse;
  /** Generation statistics */
  generationStats: {
    totalEndpoints: number;
    generatedActions: number;
    skippedDeprecated: number;
    skippedDuplicates: number;
    matchedWishlist: number;
  };
  /** Any warnings during generation/persistence */
  warnings: string[];
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Persists actions from a completed scrape job result
 *
 * This function:
 * 1. Generates ActionDefinitions from parsed API documentation
 * 2. Finds or creates an integration for the API
 * 3. Persists all generated actions to the database
 *
 * @param tenantId - The tenant ID
 * @param parsedDoc - The parsed API documentation from the scraper
 * @param options - Options for generation and persistence
 * @returns Result including integration info and created actions
 *
 * @example
 * ```ts
 * // After a successful scrape job
 * const result = await persistActionsFromScrape(
 *   tenantId,
 *   scrapeJob.result,
 *   { wishlist: ['send message', 'list users'], replaceExisting: true }
 * );
 *
 * console.log(`Created ${result.actions.created} actions for ${result.integrationSlug}`);
 * ```
 */
export async function persistActionsFromScrape(
  tenantId: string,
  parsedDoc: ParsedApiDoc,
  options: PersistFromScrapeOptions = {}
): Promise<PersistFromScrapeResult> {
  const {
    wishlist = [],
    replaceExisting = false,
    defaultCacheTtl = 300,
    includeDeprecated = false,
  } = options;

  const warnings: string[] = [];

  // ==========================================================================
  // Step 1: Generate actions from parsed documentation
  // ==========================================================================
  const generateOptions: GenerateActionsOptions = {
    wishlist,
    sourceUrl: parsedDoc.metadata?.sourceUrls?.[0],
    aiConfidence: parsedDoc.metadata?.aiConfidence,
    defaultCacheTtl,
    includeDeprecated,
  };

  const generationResult = generateActions(parsedDoc, generateOptions);

  if (generationResult.warnings.length > 0) {
    warnings.push(...generationResult.warnings);
  }

  if (generationResult.actions.length === 0) {
    throw new ActionError(
      ActionErrorCodes.INVALID_SCHEMA,
      'No actions could be generated from the API documentation. The documentation may not contain any valid endpoints.',
      400
    );
  }

  // ==========================================================================
  // Step 2: Find or create integration
  // ==========================================================================
  const integrationSlug = generateIntegrationSlug(parsedDoc.name);

  let integration = await prisma.integration.findFirst({
    where: {
      tenantId,
      slug: integrationSlug,
    },
  });

  const integrationCreated = !integration;

  if (!integration) {
    // Create new integration
    const authConfig = buildAuthConfig(parsedDoc.authMethods);
    const metadata = {
      baseUrl: parsedDoc.baseUrl,
      version: parsedDoc.version,
      scrapedAt: parsedDoc.metadata?.scrapedAt,
      sourceUrls: parsedDoc.metadata?.sourceUrls,
      aiConfidence: parsedDoc.metadata?.aiConfidence,
      rateLimits: parsedDoc.rateLimits,
    };

    integration = await prisma.integration.create({
      data: {
        tenantId,
        name: parsedDoc.name,
        slug: integrationSlug,
        description: parsedDoc.description,
        status: 'draft', // Start as draft until configured
        authType: mapAuthType(parsedDoc.authMethods),
        authConfig: authConfig as Prisma.InputJsonValue,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    warnings.push(`Created new integration '${integrationSlug}' in draft status`);
  } else {
    // Update existing integration metadata
    const existingMetadata = (integration.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      baseUrl: parsedDoc.baseUrl,
      version: parsedDoc.version,
      lastScrapedAt: parsedDoc.metadata?.scrapedAt,
      sourceUrls: parsedDoc.metadata?.sourceUrls,
      aiConfidence: parsedDoc.metadata?.aiConfidence,
      rateLimits: parsedDoc.rateLimits,
    };

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        description: parsedDoc.description || integration.description,
        metadata: updatedMetadata as Prisma.InputJsonValue,
      },
    });

    if (replaceExisting) {
      warnings.push(`Replacing existing actions for integration '${integrationSlug}'`);
    } else {
      warnings.push(`Adding actions to existing integration '${integrationSlug}'`);
    }
  }

  // ==========================================================================
  // Step 3: Persist generated actions
  // ==========================================================================
  const actionsResult = await persistGeneratedActions(
    tenantId,
    integration.id,
    generationResult.actions,
    { replaceExisting }
  );

  // Combine warnings
  if (actionsResult.warnings) {
    warnings.push(...actionsResult.warnings);
  }

  return {
    integrationId: integration.id,
    integrationSlug: integration.slug,
    integrationCreated,
    actions: actionsResult,
    generationStats: {
      totalEndpoints: generationResult.stats.totalEndpoints,
      generatedActions: generationResult.stats.generatedActions,
      skippedDeprecated: generationResult.stats.skippedDeprecated,
      skippedDuplicates: generationResult.stats.skippedDuplicates,
      matchedWishlist: generationResult.matchedActions.length,
    },
    warnings,
  };
}

/**
 * Persists actions for an existing integration from a scrape result
 *
 * Use this when you already have an integration ID and just want to
 * update/add actions from a new scrape.
 *
 * @param tenantId - The tenant ID
 * @param integrationId - The existing integration ID
 * @param parsedDoc - The parsed API documentation
 * @param options - Options for generation and persistence
 * @returns Batch create result
 */
export async function persistActionsForIntegration(
  tenantId: string,
  integrationId: string,
  parsedDoc: ParsedApiDoc,
  options: Omit<PersistFromScrapeOptions, 'replaceExisting'> & { replaceExisting?: boolean } = {}
): Promise<
  BatchCreateActionsResponse & { generationStats: PersistFromScrapeResult['generationStats'] }
> {
  const {
    wishlist = [],
    replaceExisting = false,
    defaultCacheTtl = 300,
    includeDeprecated = false,
  } = options;

  // Verify integration exists and belongs to tenant
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      tenantId,
    },
  });

  if (!integration) {
    throw new ActionError(ActionErrorCodes.INTEGRATION_NOT_FOUND, 'Integration not found', 404);
  }

  // Generate actions
  const generateOptions: GenerateActionsOptions = {
    wishlist,
    sourceUrl: parsedDoc.metadata?.sourceUrls?.[0],
    aiConfidence: parsedDoc.metadata?.aiConfidence,
    defaultCacheTtl,
    includeDeprecated,
  };

  const generationResult = generateActions(parsedDoc, generateOptions);

  if (generationResult.actions.length === 0) {
    throw new ActionError(
      ActionErrorCodes.INVALID_SCHEMA,
      'No actions could be generated from the API documentation',
      400
    );
  }

  // Persist actions
  const actionsResult = await persistGeneratedActions(
    tenantId,
    integrationId,
    generationResult.actions,
    { replaceExisting }
  );

  return {
    ...actionsResult,
    generationStats: {
      totalEndpoints: generationResult.stats.totalEndpoints,
      generatedActions: generationResult.stats.generatedActions,
      skippedDeprecated: generationResult.stats.skippedDeprecated,
      skippedDuplicates: generationResult.stats.skippedDuplicates,
      matchedWishlist: generationResult.matchedActions.length,
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generates a URL-safe slug from an API name
 */
function generateIntegrationSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+api$/i, '') // Remove trailing "API"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Maps parsed auth methods to Prisma AuthType enum
 */
function mapAuthType(authMethods: ParsedApiDoc['authMethods']): AuthType {
  if (!authMethods || authMethods.length === 0) {
    // Default to api_key if no auth method specified
    return AuthType.api_key;
  }

  // Use the first auth method as primary
  const primary = authMethods[0];

  switch (primary.type) {
    case 'oauth2':
      return AuthType.oauth2;
    case 'api_key':
      return AuthType.api_key;
    case 'basic':
      return AuthType.basic;
    case 'bearer':
      return AuthType.bearer;
    case 'custom_header':
      return AuthType.custom_header;
    default:
      return AuthType.api_key;
  }
}

/**
 * Builds auth config object from parsed auth methods
 */
function buildAuthConfig(authMethods: ParsedApiDoc['authMethods']): Record<string, unknown> {
  if (!authMethods || authMethods.length === 0) {
    return {};
  }

  const primary = authMethods[0];

  return {
    type: primary.type,
    location: primary.location,
    paramName: primary.paramName,
    ...primary.config,
    // Include all auth methods if multiple are supported
    allMethods: authMethods.length > 1 ? authMethods : undefined,
  };
}
