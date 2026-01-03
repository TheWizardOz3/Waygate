/**
 * GET /api/v1/integrations/:id/cached-actions
 *
 * Retrieves available actions from cached scrape results for an integration.
 * Returns actions that exist in the scrape results but haven't been added to the integration yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { getIntegrationById, IntegrationError } from '@/lib/modules/integrations';
import { listActions } from '@/lib/modules/actions';
import { findAllScrapeJobsByUrl } from '@/lib/modules/ai/scrape-job.repository';
import type { ApiEndpoint } from '@/lib/modules/ai/scrape-job.schemas';

interface CachedAction extends ApiEndpoint {
  alreadyAdded: boolean;
}

interface CachedActionsResponse {
  success: boolean;
  data: {
    actions: CachedAction[];
    scrapeJobId: string | null;
    documentationUrl: string | null;
    canRescrape: boolean;
  };
}

export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Extract integration ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const integrationIdIndex = pathParts.indexOf('integrations') + 1;
    const integrationId = pathParts[integrationIdIndex];

    if (!integrationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Integration ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Get the integration
    const integration = await getIntegrationById(tenant.id, integrationId);

    if (!integration.documentationUrl) {
      return NextResponse.json<CachedActionsResponse>(
        {
          success: true,
          data: {
            actions: [],
            scrapeJobId: null,
            documentationUrl: null,
            canRescrape: false,
          },
        },
        { status: 200 }
      );
    }

    // Find ALL cached scrape jobs for this documentation URL
    // This aggregates endpoints from multiple scrape runs, never destroying previous results
    const scrapeJobs = await findAllScrapeJobsByUrl(tenant.id, integration.documentationUrl);

    if (scrapeJobs.length === 0) {
      return NextResponse.json<CachedActionsResponse>(
        {
          success: true,
          data: {
            actions: [],
            scrapeJobId: null,
            documentationUrl: integration.documentationUrl,
            canRescrape: true,
          },
        },
        { status: 200 }
      );
    }

    // Get existing actions for this integration
    const existingActions = await listActions(tenant.id, integrationId);
    const existingActionSlugs = new Set(
      existingActions.actions.map((a: { slug: string }) => a.slug)
    );

    // Aggregate endpoints from ALL scrape jobs, deduplicating by slug
    // This ensures that new discoveries add to existing ones, never replacing
    const endpointsBySlug = new Map<string, ApiEndpoint>();

    for (const job of scrapeJobs) {
      const scrapeResult = job.result as { endpoints?: ApiEndpoint[] } | null;
      const endpoints = scrapeResult?.endpoints ?? [];

      for (const endpoint of endpoints) {
        // Only add if we haven't seen this slug before
        // Newer jobs are processed first (ordered by completedAt desc), so newer versions win
        if (!endpointsBySlug.has(endpoint.slug)) {
          endpointsBySlug.set(endpoint.slug, endpoint);
        }
      }
    }

    const allEndpoints = Array.from(endpointsBySlug.values());

    // Mark which actions are already added
    const cachedActions: CachedAction[] = allEndpoints.map((endpoint) => ({
      ...endpoint,
      alreadyAdded: existingActionSlugs.has(endpoint.slug),
    }));

    return NextResponse.json<CachedActionsResponse>(
      {
        success: true,
        data: {
          actions: cachedActions,
          scrapeJobId: scrapeJobs[0].id, // Most recent job ID
          documentationUrl: integration.documentationUrl,
          canRescrape: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof IntegrationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('Get cached actions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching cached actions',
        },
      },
      { status: 500 }
    );
  }
});
