/**
 * Drift Detection Module Exports
 */

export {
  driftRepository,
  type RecordFailureParams,
  type GetFailuresParams,
  type FailureStats,
} from './drift.repository';
export {
  driftDetectionService,
  DriftDetectionService,
  type DriftCheckResult,
  type TrackValidationParams,
} from './drift.service';
