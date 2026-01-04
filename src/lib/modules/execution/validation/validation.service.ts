/**
 * Validation Service
 *
 * Main orchestration service for response validation.
 * Handles validation flow, drift detection integration, and logging.
 */

import {
  type ValidationConfig,
  type ValidationResult,
  type ValidationResponseMetadata,
  type ValidationRequest,
  type DriftStatus,
  ValidationConfigSchema,
  mergeValidationConfig,
  shouldSkipValidation,
  createValidationResponseMetadata,
  createEmptyValidationMeta,
} from './validation.schemas';
import { validate, parseOutputSchema } from './zod-validator';
import { formatIssuesAsText, formatIssueForLog } from './reporter';

// =============================================================================
// Types
// =============================================================================

export interface ValidateResponseOptions {
  /** Response data from external API */
  data: unknown;

  /** The action's output schema (JSON Schema stored in database) */
  outputSchema: unknown;

  /** Action's validation config (from database) */
  validationConfig?: unknown;

  /** Request-level validation overrides */
  requestOptions?: ValidationRequest;

  /** Action ID (for drift tracking) */
  actionId?: string;

  /** Tenant ID (for drift tracking) */
  tenantId?: string;
}

export interface ValidateResponseResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validated/processed data */
  data: unknown;

  /** Validation metadata for response */
  metadata: ValidationResponseMetadata;

  /** Full validation result (for debugging) */
  fullResult: ValidationResult;
}

// =============================================================================
// Service
// =============================================================================

/**
 * Validation service for response validation
 */
export class ValidationService {
  /**
   * Validate an API response against the action's output schema
   */
  async validateResponse(options: ValidateResponseOptions): Promise<ValidateResponseResult> {
    const startTime = Date.now();

    // Parse and merge validation config
    const actionConfig = this.parseValidationConfig(options.validationConfig);
    const config = mergeValidationConfig(actionConfig, options.requestOptions);

    // Check if validation should be skipped
    if (shouldSkipValidation(config)) {
      const meta = createEmptyValidationMeta();
      meta.validationDurationMs = Date.now() - startTime;

      const result: ValidationResult = {
        valid: true,
        mode: config.mode,
        data: options.data,
        meta,
      };

      return {
        valid: true,
        data: options.data,
        metadata: createValidationResponseMetadata(result),
        fullResult: result,
      };
    }

    // Parse the output schema
    const zodSchema = parseOutputSchema(options.outputSchema);

    // If no schema defined, skip validation with a note
    if (!zodSchema) {
      const meta = createEmptyValidationMeta();
      meta.validationDurationMs = Date.now() - startTime;

      const result: ValidationResult = {
        valid: true,
        mode: config.mode,
        data: options.data,
        meta,
      };

      // Log warning that no schema is defined
      console.warn(
        `[ValidationService] No output schema defined for action ${options.actionId ?? 'unknown'}, skipping validation`
      );

      return {
        valid: true,
        data: options.data,
        metadata: createValidationResponseMetadata(result),
        fullResult: result,
      };
    }

    // Perform validation
    const result = validate({
      data: options.data,
      schema: zodSchema,
      config,
      startTime,
    });

    // Log validation issues if any
    if (result.issues && result.issues.length > 0) {
      this.logValidationIssues(result, options.actionId);
    }

    // Track for drift detection (async, don't block response)
    if (options.actionId && options.tenantId && config.driftDetection.enabled) {
      this.trackForDrift(result, options.actionId, options.tenantId).catch((err) => {
        console.error('[ValidationService] Failed to track drift:', err);
      });
    }

    // Determine drift status (placeholder - will be enhanced with drift service)
    const driftStatus = this.getDriftStatus(result, config);
    const driftMessage = driftStatus !== 'normal' ? this.getDriftMessage(driftStatus) : undefined;

    return {
      valid: result.valid,
      data: result.data ?? options.data,
      metadata: createValidationResponseMetadata(result, driftStatus, driftMessage),
      fullResult: result,
    };
  }

  /**
   * Parse validation config from database storage
   */
  private parseValidationConfig(config: unknown): ValidationConfig | null {
    if (!config || typeof config !== 'object') {
      return null;
    }

    try {
      return ValidationConfigSchema.parse(config);
    } catch {
      console.warn('[ValidationService] Invalid validation config, using defaults');
      return null;
    }
  }

  /**
   * Log validation issues for debugging
   */
  private logValidationIssues(result: ValidationResult, actionId?: string): void {
    const prefix = actionId ? `[Action: ${actionId}]` : '[ValidationService]';

    if (result.mode === 'strict' && !result.valid) {
      console.error(`${prefix} Validation failed (strict mode):`);
      console.error(formatIssuesAsText(result.issues ?? []));
    } else {
      // Log at info level for warn/lenient modes
      for (const issue of result.issues ?? []) {
        console.info(`${prefix} ${formatIssueForLog(issue)}`);
      }
    }
  }

  /**
   * Track validation failures for drift detection
   * This is a placeholder - will be implemented with the drift service
   */
  private async trackForDrift(
    result: ValidationResult,
    actionId: string,
    tenantId: string
  ): Promise<void> {
    // Only track if there are issues
    if (!result.issues || result.issues.length === 0) {
      return;
    }

    // This will be implemented in drift.service.ts
    // For now, just log
    console.debug(
      `[ValidationService] Would track ${result.issues.length} issues for drift detection`,
      {
        actionId,
        tenantId,
        issueCodes: result.issues.map((i) => i.code),
      }
    );
  }

  /**
   * Get current drift status based on validation result
   * This is a placeholder - will be enhanced with drift service
   */
  private getDriftStatus(result: ValidationResult, config: ValidationConfig): DriftStatus {
    // If drift detection is disabled, always return normal
    if (!config.driftDetection.enabled) {
      return 'normal';
    }

    // Simple heuristic for now - will be replaced with actual drift tracking
    const issueCount = result.issues?.length ?? 0;
    if (issueCount === 0) {
      return 'normal';
    }

    // Will be replaced with actual threshold checking from database
    return 'normal';
  }

  /**
   * Get drift status message
   */
  private getDriftMessage(status: DriftStatus): string {
    switch (status) {
      case 'warning':
        return 'Validation failures detected. Monitor for potential schema drift.';
      case 'alert':
        return 'Schema drift detected! The API response format may have changed.';
      default:
        return '';
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const validationService = new ValidationService();

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Quick validation helper for use outside the service
 */
export function validateResponseData(
  data: unknown,
  outputSchema: unknown,
  config?: Partial<ValidationConfig>
): ValidationResult {
  const fullConfig = ValidationConfigSchema.parse(config ?? {});
  const zodSchema = parseOutputSchema(outputSchema);

  return validate({
    data,
    schema: zodSchema,
    config: fullConfig,
  });
}

/**
 * Check if response data is valid (quick check)
 */
export function isResponseValid(
  data: unknown,
  outputSchema: unknown,
  mode: 'strict' | 'warn' | 'lenient' = 'warn'
): boolean {
  const result = validateResponseData(data, outputSchema, { mode });
  return result.valid;
}
