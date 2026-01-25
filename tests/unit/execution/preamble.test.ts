/**
 * Preamble Module Tests
 *
 * Tests for the LLM Response Preamble functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  interpolatePreamble,
  validatePreambleTemplate,
  isPreambleTemplateValid,
  applyPreamble,
  calculateResultCount,
  VALID_TEMPLATE_VARIABLES,
  type PreambleContext,
} from '@/lib/modules/execution/preamble';

// =============================================================================
// Test Data
// =============================================================================

const sampleContext: PreambleContext = {
  integrationName: 'Salesforce',
  integrationSlug: 'salesforce',
  actionName: 'Search Contacts',
  actionSlug: 'search-contacts',
  connectionName: 'Production',
  resultCount: 42,
};

const minimalContext: Omit<PreambleContext, 'resultCount'> = {
  integrationName: 'Salesforce',
  integrationSlug: 'salesforce',
  actionName: 'Search Contacts',
  actionSlug: 'search-contacts',
  connectionName: 'Production',
};

// =============================================================================
// interpolatePreamble Tests
// =============================================================================

describe('Preamble Module', () => {
  describe('interpolatePreamble', () => {
    it('should interpolate all template variables correctly', () => {
      const template =
        '{integration_name} {integration_slug} {action_name} {action_slug} {connection_name} {result_count}';

      const result = interpolatePreamble(template, sampleContext);

      expect(result).toBe('Salesforce salesforce Search Contacts search-contacts Production 42');
    });

    it('should handle {integration_name} variable', () => {
      const template = 'The {integration_name} results:';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('The Salesforce results:');
    });

    it('should handle {integration_slug} variable', () => {
      const template = 'API: {integration_slug}';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('API: salesforce');
    });

    it('should handle {action_name} variable', () => {
      const template = 'Running {action_name}:';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('Running Search Contacts:');
    });

    it('should handle {action_slug} variable', () => {
      const template = 'Action: {action_slug}';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('Action: search-contacts');
    });

    it('should handle {connection_name} variable', () => {
      const template = 'Using {connection_name} connection:';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('Using Production connection:');
    });

    it('should handle {result_count} variable', () => {
      const template = 'Found {result_count} results:';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('Found 42 results:');
    });

    it('should show N/A when result_count is undefined', () => {
      const template = 'Found {result_count} results:';
      const contextWithoutCount: PreambleContext = {
        ...sampleContext,
        resultCount: undefined,
      };
      const result = interpolatePreamble(template, contextWithoutCount);
      expect(result).toBe('Found N/A results:');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{integration_name} - {integration_name}';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('Salesforce - Salesforce');
    });

    it('should preserve unknown variables as literal text', () => {
      const template = 'The {unknown_var} from {integration_name}:';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('The {unknown_var} from Salesforce:');
    });

    it('should handle empty template', () => {
      const result = interpolatePreamble('', sampleContext);
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'This is plain text.';
      const result = interpolatePreamble(template, sampleContext);
      expect(result).toBe('This is plain text.');
    });
  });

  // =============================================================================
  // validatePreambleTemplate Tests
  // =============================================================================

  describe('validatePreambleTemplate', () => {
    it('should return empty array for valid template', () => {
      const template = 'The {action_name} results from {integration_name}:';
      const invalidVars = validatePreambleTemplate(template);
      expect(invalidVars).toEqual([]);
    });

    it('should return empty array for template with all valid variables', () => {
      const template = VALID_TEMPLATE_VARIABLES.map((v) => `{${v}}`).join(' ');
      const invalidVars = validatePreambleTemplate(template);
      expect(invalidVars).toEqual([]);
    });

    it('should return invalid variable names', () => {
      const template = 'Hello {invalid_var} from {integration_name}:';
      const invalidVars = validatePreambleTemplate(template);
      expect(invalidVars).toEqual(['invalid_var']);
    });

    it('should return multiple invalid variables', () => {
      const template = '{foo} and {bar} with {integration_name}';
      const invalidVars = validatePreambleTemplate(template);
      expect(invalidVars).toContain('foo');
      expect(invalidVars).toContain('bar');
      expect(invalidVars).not.toContain('integration_name');
    });

    it('should return empty array for template with no variables', () => {
      const template = 'Just plain text';
      const invalidVars = validatePreambleTemplate(template);
      expect(invalidVars).toEqual([]);
    });

    it('should return empty array for empty template', () => {
      const invalidVars = validatePreambleTemplate('');
      expect(invalidVars).toEqual([]);
    });
  });

  // =============================================================================
  // isPreambleTemplateValid Tests
  // =============================================================================

  describe('isPreambleTemplateValid', () => {
    it('should return true for valid template', () => {
      const template = 'The {action_name} results:';
      expect(isPreambleTemplateValid(template)).toBe(true);
    });

    it('should return false for invalid template', () => {
      const template = 'Hello {invalid_var}';
      expect(isPreambleTemplateValid(template)).toBe(false);
    });

    it('should return true for null template', () => {
      expect(isPreambleTemplateValid(null)).toBe(true);
    });

    it('should return true for undefined template', () => {
      expect(isPreambleTemplateValid(undefined)).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isPreambleTemplateValid('')).toBe(true);
    });
  });

  // =============================================================================
  // calculateResultCount Tests
  // =============================================================================

  describe('calculateResultCount', () => {
    it('should return array length for array data', () => {
      const data = [1, 2, 3, 4, 5];
      expect(calculateResultCount(data)).toBe(5);
    });

    it('should return 0 for empty array', () => {
      expect(calculateResultCount([])).toBe(0);
    });

    it('should return items array length for object with items', () => {
      const data = { items: [1, 2, 3] };
      expect(calculateResultCount(data)).toBe(3);
    });

    it('should return results array length for object with results', () => {
      const data = { results: ['a', 'b'] };
      expect(calculateResultCount(data)).toBe(2);
    });

    it('should return data array length for object with data', () => {
      const data = { data: [{ id: 1 }, { id: 2 }] };
      expect(calculateResultCount(data)).toBe(2);
    });

    it('should return records array length for object with records', () => {
      const data = { records: [{ Name: 'A' }, { Name: 'B' }, { Name: 'C' }] };
      expect(calculateResultCount(data)).toBe(3);
    });

    it('should return undefined for non-array, non-object data', () => {
      expect(calculateResultCount('string')).toBeUndefined();
      expect(calculateResultCount(123)).toBeUndefined();
      expect(calculateResultCount(null)).toBeUndefined();
    });

    it('should return undefined for object without common array property', () => {
      const data = { name: 'Test', count: 5 };
      expect(calculateResultCount(data)).toBeUndefined();
    });
  });

  // =============================================================================
  // applyPreamble Tests
  // =============================================================================

  describe('applyPreamble', () => {
    it('should apply preamble with valid template', () => {
      const template = 'The {action_name} results from {integration_name}:';
      const data = [{ id: 1 }, { id: 2 }];

      const result = applyPreamble(template, minimalContext, data);

      expect(result.applied).toBe(true);
      expect(result.context).toBe('The Search Contacts results from Salesforce:');
    });

    it('should not apply preamble when template is null', () => {
      const data = [{ id: 1 }];
      const result = applyPreamble(null, minimalContext, data);

      expect(result.applied).toBe(false);
      expect(result.context).toBeUndefined();
    });

    it('should not apply preamble when template is empty string', () => {
      const data = [{ id: 1 }];
      const result = applyPreamble('', minimalContext, data);

      expect(result.applied).toBe(false);
      expect(result.context).toBeUndefined();
    });

    it('should not apply preamble when template is only whitespace', () => {
      const data = [{ id: 1 }];
      const result = applyPreamble('   ', minimalContext, data);

      expect(result.applied).toBe(false);
      expect(result.context).toBeUndefined();
    });

    it('should calculate result_count from array data', () => {
      const template = 'Found {result_count} contacts:';
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const result = applyPreamble(template, minimalContext, data);

      expect(result.applied).toBe(true);
      expect(result.context).toBe('Found 3 contacts:');
    });

    it('should show N/A for result_count when data is not array', () => {
      const template = 'Found {result_count} items:';
      const data = { message: 'success' };

      const result = applyPreamble(template, minimalContext, data);

      expect(result.applied).toBe(true);
      expect(result.context).toBe('Found N/A items:');
    });

    it('should handle nested results array for result_count', () => {
      const template = 'Retrieved {result_count} records:';
      const data = { records: [{ id: 1 }, { id: 2 }], total: 100 };

      const result = applyPreamble(template, minimalContext, data);

      expect(result.applied).toBe(true);
      expect(result.context).toBe('Retrieved 2 records:');
    });
  });

  // =============================================================================
  // VALID_TEMPLATE_VARIABLES Tests
  // =============================================================================

  describe('VALID_TEMPLATE_VARIABLES', () => {
    it('should contain all expected variables', () => {
      expect(VALID_TEMPLATE_VARIABLES).toContain('integration_name');
      expect(VALID_TEMPLATE_VARIABLES).toContain('integration_slug');
      expect(VALID_TEMPLATE_VARIABLES).toContain('action_name');
      expect(VALID_TEMPLATE_VARIABLES).toContain('action_slug');
      expect(VALID_TEMPLATE_VARIABLES).toContain('connection_name');
      expect(VALID_TEMPLATE_VARIABLES).toContain('result_count');
    });

    it('should have exactly 6 variables', () => {
      expect(VALID_TEMPLATE_VARIABLES).toHaveLength(6);
    });
  });
});
