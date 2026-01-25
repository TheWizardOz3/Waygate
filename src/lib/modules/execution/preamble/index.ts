/**
 * LLM Response Preamble Module
 *
 * Re-exports all preamble utilities for easy importing.
 */

export {
  // Types
  type PreambleContext,
  type PreambleResult,
  type PreambleTemplate,
  type TemplateVariable,
  // Constants
  VALID_TEMPLATE_VARIABLES,
  MAX_PREAMBLE_LENGTH,
  // Schemas
  PreambleTemplateSchema,
  // Validation
  validatePreambleTemplate,
  isPreambleTemplateValid,
  // Interpolation
  interpolatePreamble,
  calculateResultCount,
  // Main API
  applyPreamble,
  getAvailableVariablesHelp,
} from './preamble';
