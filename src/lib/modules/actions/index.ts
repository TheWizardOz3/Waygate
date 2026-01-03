/**
 * Actions Module
 *
 * Manages action definitions and schemas for integrations.
 * Actions represent typed operations (e.g., slack.sendMessage) with
 * JSON Schema validation for inputs and outputs.
 */

// Schemas - export all types and helpers
export * from './action.schemas';

// JSON Schema Validator - explicit exports to avoid conflict with action.schemas ValidationResult
export {
  // Types
  type ValidationResult as JsonSchemaValidationResult,
  type ValidationError as JsonSchemaValidationError,
  type ValidationMode,
  type ValidateOptions,
  // Core functions
  validateJsonSchema,
  validateActionInput,
  validateActionOutput,
  // Cache management
  clearValidatorCache,
  getValidatorCacheSize,
  // Schema utilities
  isValidJsonSchemaStructure,
  isCompilableSchema,
  createEmptySchema as createEmptyJsonSchema,
  mergeSchemas,
  // Error formatting
  formatErrorsForLLM,
  formatAsApiError,
} from './json-schema-validator';

// Repository - export with explicit names to avoid conflicts
export {
  // Types
  type CreateActionDbInput,
  type UpdateActionDbInput,
  type ActionFilters,
  type PaginationOptions,
  type PaginatedActions,
  // Functions
  createAction as createActionInDb,
  createActionsInBatch,
  replaceActionsForIntegration,
  findActionById,
  findActionByIdWithIntegration,
  findActionBySlug,
  findActionByIntegrationAndActionSlug,
  findActionsByIntegration,
  findActionsByIntegrationPaginated,
  findActionsByTenant,
  actionSlugExists,
  findExistingSlugs,
  updateAction as updateActionInDb,
  updateActionForTenant,
  deleteAction as deleteActionInDb,
  deleteActionForTenant,
  deleteActionsByIntegration,
  countActionsByIntegration,
  countActionsByHttpMethod,
  getActionStats,
} from './action.repository';

// Service - primary API for action operations
export {
  // Error class
  ActionError,
  // Create operations
  createAction,
  persistGeneratedActions,
  // Read operations
  getAction,
  getActionBySlug,
  getActionSchema,
  listActions,
  getAllActions,
  // Update operations
  updateAction,
  // Delete operations
  deleteAction,
  deleteAllActions,
  // Statistics
  getIntegrationActionStats,
  // Helpers
  verifyIntegrationOwnership,
} from './action.service';

// Scraper Integration - connect AI scraper output to database
export {
  persistActionsFromScrape,
  persistActionsForIntegration,
  type PersistFromScrapeOptions,
  type PersistFromScrapeResult,
} from './persist-from-scraper';
