/**
 * Log Statistics Endpoint
 *
 * GET /api/v1/logs/stats
 *
 * Returns aggregated log statistics for the authenticated tenant.
 * Supports filtering by integration.
 *
 * @route GET /api/v1/logs/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { getLogStatsForTenant, getLogStatsForIntegration } from '@/lib/modules/logging';

/**
 * GET /api/v1/logs/stats
 *
 * Returns log statistics for the authenticated tenant.
 *
 * Query Parameters:
 * - `startDate` (optional): Filter logs after this date (ISO 8601)
 * - `endDate` (optional): Filter logs before this date (ISO 8601)
 * - `integrationId` (optional): Filter by integration UUID
 *
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "totalRequests": 1234,
 *     "successRate": 98.5,
 *     "averageLatency": 145,
 *     "errorCount": 18,
 *     "requestsByIntegration": [...],
 *     "requestsByStatus": [...],
 *     "latencyPercentiles": { "p50": 120, "p90": 280, "p99": 450 }
 *   }
 * }
 * ```
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const integrationId = url.searchParams.get('integrationId');

    // Default to last 7 days if no start date provided
    const since = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // If filtering by integration, use integration-specific stats
    if (integrationId) {
      const stats = await getLogStatsForIntegration(integrationId, tenant.id, since);
      const successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

      return NextResponse.json({
        success: true,
        data: {
          totalRequests: stats.total,
          successRate,
          averageLatency: stats.avgLatencyMs,
          errorCount: stats.failed,
          // Simplified response for integration-specific stats
          requestsByIntegration: [],
          requestsByStatus: [],
          latencyPercentiles: { p50: 0, p90: 0, p99: 0 },
        },
      });
    }

    // Otherwise, get tenant-wide stats
    const stats = await getLogStatsForTenant(tenant.id, since);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Log Stats API] Error fetching stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch log statistics',
        },
      },
      { status: 500 }
    );
  }
});
