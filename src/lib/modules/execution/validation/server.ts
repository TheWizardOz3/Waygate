/**
 * Validation Module - Server-Only Exports
 *
 * These exports include database access and should only be used in server-side code.
 * For client-safe exports, use the main index.ts
 */

// Re-export all client-safe exports
export * from './index';

// Service (server-only - uses internal imports that may include Prisma)
export {
  validationService,
  ValidationService,
  validateResponseData,
  isResponseValid,
  type ValidateResponseOptions,
  type ValidateResponseResult,
} from './validation.service';

// Drift detection (server-only - uses Prisma)
export {
  driftRepository,
  driftDetectionService,
  DriftDetectionService,
  type RecordFailureParams,
  type GetFailuresParams,
  type FailureStats,
  type DriftCheckResult,
  type TrackValidationParams,
} from './drift';
