/**
 * Description Building Module
 *
 * Generates LLM-optimized tool descriptions in the mini-prompt format.
 * Provides templates for common action types and utilities for building
 * structured descriptions that help AI models understand tools.
 */

// =============================================================================
// Description Builder - Main API
// =============================================================================

export {
  // Main builder function
  buildToolDescription,
  buildSimpleDescription,
  // Types
  type DescriptionBuilderOptions,
  type ActionCategory,
  type ParameterInfo,
  // Re-exported utilities
  detectActionCategory,
  extractResourceType,
} from './description-builder';

// =============================================================================
// Templates - For customization and extension
// =============================================================================

export {
  // Template types
  type TemplateContext,
  type DescriptionTemplate,
  // Template access
  getTemplateForCategory,
  applyOpeningTemplate,
  applyOutputTemplate,
  getTemplateHints,
  // Template constants
  DESCRIPTION_TEMPLATES,
} from './templates';
