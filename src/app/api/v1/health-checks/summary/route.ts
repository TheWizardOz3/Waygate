/**
 * Health Checks Summary Endpoint
 *
 * GET /api/v1/health-checks/summary
 *
 * Returns a summary of health status for all connections in the tenant.
 *
 * @route GET /api/v1/health-checks/summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  getTenantHealthSummary,
  getConnectionsWithHealthStatus,
} from '@/lib/modules/health-checks';
import { HealthCheckStatus } from '@prisma/client';

/**
 * GET /api/v1/health-checks/summary
 *
 * Returns a summary of health status across all connections.
 *
 * Response includes:
 * - Total counts by health status (healthy, degraded, unhealthy)
 * - List of connections with their current health status
 * - Connections needing attention (unhealthy/degraded)
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const includeConnections = url.searchParams.get('includeConnections') !== 'false';
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : undefined;

    // Get health check summary
    const summary = await getTenantHealthSummary(tenant.id, since);

    // Get connections with health status
    let connections: Array<{
      id: string;
      name: string;
      slug: string;
      integrationId: string;
      healthStatus: HealthCheckStatus;
      lastCredentialCheckAt: string | null;
      lastConnectivityCheckAt: string | null;
      lastFullScanAt: string | null;
    }> = [];

    let needsAttention: typeof connections = [];

    if (includeConnections) {
      const rawConnections = await getConnectionsWithHealthStatus(tenant.id);

      connections = rawConnections.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        integrationId: c.integrationId,
        healthStatus: c.healthStatus,
        lastCredentialCheckAt: c.lastCredentialCheckAt?.toISOString() ?? null,
        lastConnectivityCheckAt: c.lastConnectivityCheckAt?.toISOString() ?? null,
        lastFullScanAt: c.lastFullScanAt?.toISOString() ?? null,
      }));

      // Filter connections needing attention
      needsAttention = connections.filter(
        (c) =>
          c.healthStatus === HealthCheckStatus.unhealthy ||
          c.healthStatus === HealthCheckStatus.degraded
      );
    }

    // Calculate health score (0-100)
    const healthScore =
      summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 100; // No connections = healthy by default

    return NextResponse.json(
      {
        success: true,
        data: {
          summary: {
            healthy: summary.healthy,
            degraded: summary.degraded,
            unhealthy: summary.unhealthy,
            total: summary.total,
            healthScore,
          },
          ...(includeConnections && {
            connections,
            needsAttention,
          }),
          meta: {
            generatedAt: new Date().toISOString(),
            ...(since && { since: since.toISOString() }),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[HEALTH_CHECKS_SUMMARY] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : 'An error occurred fetching health summary',
          suggestedResolution: {
            action: 'ESCALATE_TO_ADMIN',
            description: 'An internal error occurred. Please try again or contact support.',
            retryable: false,
          },
        },
      },
      { status: 500 }
    );
  }
});
