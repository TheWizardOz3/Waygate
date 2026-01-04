/**
 * Drift Detection Service
 *
 * Tracks validation failures over time to detect schema drift.
 * Alerts when failure patterns suggest the external API has changed.
 */

import { driftRepository, type FailureStats } from './drift.repository';
import type {
  ValidationResult,
  ValidationIssue,
  DriftStatus,
  DriftDetectionConfig,
} from '../validation.schemas';

// =============================================================================
// Types
// =============================================================================

export interface DriftCheckResult {
  status: DriftStatus;
  message?: string;
  stats: FailureStats;
  shouldAlert: boolean;
}

export interface TrackValidationParams {
  actionId: string;
  tenantId: string;
  result: ValidationResult;
  config: DriftDetectionConfig;
}

// =============================================================================
// Service
// =============================================================================

/**
 * Service for detecting schema drift via validation failure patterns
 */
export class DriftDetectionService {
  /**
   * Track validation issues for drift detection
   */
  async trackValidation(params: TrackValidationParams): Promise<void> {
    const { actionId, tenantId, result, config } = params;

    // Skip if drift detection is disabled
    if (!config.enabled) {
      return;
    }

    // Skip if no issues
    if (!result.issues || result.issues.length === 0) {
      return;
    }

    // Record each issue
    await Promise.all(result.issues.map((issue) => this.recordIssue(actionId, tenantId, issue)));
  }

  /**
   * Record a single validation issue
   */
  private async recordIssue(
    actionId: string,
    tenantId: string,
    issue: ValidationIssue
  ): Promise<void> {
    try {
      await driftRepository.recordFailure({
        actionId,
        tenantId,
        issueCode: issue.code,
        fieldPath: issue.path,
        expectedType: issue.expected,
        receivedType: issue.received,
      });
    } catch (error) {
      console.error('[DriftDetectionService] Failed to record issue:', error);
    }
  }

  /**
   * Check drift status for an action
   */
  async checkDriftStatus(
    actionId: string,
    tenantId: string,
    config: DriftDetectionConfig
  ): Promise<DriftCheckResult> {
    // Get failure stats within the configured window
    const stats = await driftRepository.getFailureStats({
      actionId,
      tenantId,
      windowMinutes: config.windowMinutes,
    });

    // Determine status based on failure count
    let status: DriftStatus = 'normal';
    let message: string | undefined;
    let shouldAlert = false;

    if (stats.totalFailures >= config.failureThreshold) {
      // Check if we've already sent an alert
      const alertSent = await driftRepository.hasDriftAlertBeenSent(
        actionId,
        tenantId,
        config.windowMinutes
      );

      if (alertSent) {
        status = 'alert';
        message = `Schema drift detected. ${stats.uniqueIssues} unique issues with ${stats.totalFailures} total failures in the last ${config.windowMinutes} minutes.`;
      } else {
        status = 'alert';
        message = `Schema drift threshold reached. ${stats.uniqueIssues} unique issues with ${stats.totalFailures} total failures.`;
        shouldAlert = config.alertOnDrift;
      }
    } else if (stats.totalFailures > 0) {
      status = 'warning';
      message = `${stats.totalFailures} validation failure(s) detected in the last ${config.windowMinutes} minutes. Monitoring for drift.`;
    }

    return { status, message, stats, shouldAlert };
  }

  /**
   * Send drift alert (logs for MVP, could be email/webhook in future)
   */
  async sendDriftAlert(actionId: string, tenantId: string, stats: FailureStats): Promise<void> {
    // Log the alert
    console.warn(`[DRIFT ALERT] Action ${actionId} for tenant ${tenantId}`);
    console.warn(`  Total failures: ${stats.totalFailures}`);
    console.warn(`  Unique issues: ${stats.uniqueIssues}`);
    console.warn(`  Issues by code:`, Object.fromEntries(stats.failuresByCode));
    console.warn(`  Issues by path:`, Object.fromEntries(stats.failuresByPath));

    // Mark alert as sent
    await driftRepository.markDriftAlertSent(actionId, tenantId);
  }

  /**
   * Get drift summary for an action (for UI display)
   */
  async getDriftSummary(
    actionId: string,
    tenantId: string,
    windowMinutes: number = 60
  ): Promise<{
    status: DriftStatus;
    failureCount: number;
    uniqueIssues: number;
    topIssues: { code: string; path: string; count: number }[];
  }> {
    const stats = await driftRepository.getFailureStats({
      actionId,
      tenantId,
      windowMinutes,
    });

    // Get top issues
    const topIssues: { code: string; path: string; count: number }[] = [];
    const failures = await driftRepository.getRecentFailures({
      actionId,
      tenantId,
      windowMinutes,
    });

    for (const failure of failures.slice(0, 5)) {
      topIssues.push({
        code: failure.issueCode,
        path: failure.fieldPath,
        count: failure.failureCount,
      });
    }

    // Determine status
    let status: DriftStatus = 'normal';
    if (stats.totalFailures >= 5) {
      status = 'alert';
    } else if (stats.totalFailures > 0) {
      status = 'warning';
    }

    return {
      status,
      failureCount: stats.totalFailures,
      uniqueIssues: stats.uniqueIssues,
      topIssues,
    };
  }

  /**
   * Reset drift tracking for an action (e.g., after fixing schema)
   */
  async resetDriftTracking(actionId: string, tenantId: string): Promise<void> {
    await driftRepository.resetDriftTracking(actionId, tenantId);
    console.info(`[DriftDetectionService] Reset drift tracking for action ${actionId}`);
  }

  /**
   * Cleanup old drift records (for scheduled job)
   */
  async cleanupOldRecords(olderThanDays: number = 30): Promise<number> {
    const count = await driftRepository.clearOldFailures(olderThanDays);
    console.info(`[DriftDetectionService] Cleaned up ${count} old drift records`);
    return count;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const driftDetectionService = new DriftDetectionService();
