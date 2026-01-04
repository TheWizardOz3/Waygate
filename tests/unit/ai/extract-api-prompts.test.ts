/**
 * Extract API Prompts Unit Tests
 *
 * Tests for the simplified endpoint extraction prompts.
 * Verifies prompt structure matches schema requirements.
 */

import { describe, it, expect } from 'vitest';
import {
  ENDPOINT_EXTRACTION_SYSTEM_PROMPT,
  ENDPOINT_SCHEMA,
  ENDPOINTS_ARRAY_SCHEMA,
  ENDPOINT_EXTRACTION_EXAMPLE,
  PAGINATED_ENDPOINT_EXTRACTION_EXAMPLE,
  buildEndpointExtractionPrompt,
} from '@/lib/modules/ai/prompts/extract-api';

// =============================================================================
// Endpoint Extraction System Prompt Tests
// =============================================================================

describe('ENDPOINT_EXTRACTION_SYSTEM_PROMPT', () => {
  it('should only mention the 5 flat fields', () => {
    const prompt = ENDPOINT_EXTRACTION_SYSTEM_PROMPT;

    // Should mention the 5 required flat fields
    expect(prompt).toContain('name');
    expect(prompt).toContain('slug');
    expect(prompt).toContain('method');
    expect(prompt).toContain('path');
    expect(prompt).toContain('description');
  });

  it('should NOT mention complex nested fields that would conflict with schema', () => {
    const prompt = ENDPOINT_EXTRACTION_SYSTEM_PROMPT;

    // These complex fields should NOT be in the prompt (they're not in the schema)
    expect(prompt).not.toContain('requestBody');
    expect(prompt).not.toContain('responses');
    expect(prompt).not.toContain('pagination');
    expect(prompt).not.toContain('schemaConfidence');
    expect(prompt).not.toContain('pathParameters');
    expect(prompt).not.toContain('queryParameters');
  });

  it('should emphasize JSON array output', () => {
    const prompt = ENDPOINT_EXTRACTION_SYSTEM_PROMPT;

    expect(prompt).toContain('JSON array');
    expect(prompt.toLowerCase()).toContain('no markdown');
  });
});

// =============================================================================
// Endpoint Schema Tests
// =============================================================================

describe('ENDPOINT_SCHEMA', () => {
  it('should be a flat object schema with only 5 properties', () => {
    expect(ENDPOINT_SCHEMA.type).toBe('object');
    expect(ENDPOINT_SCHEMA.properties).toBeDefined();

    const propertyNames = Object.keys(ENDPOINT_SCHEMA.properties || {});
    expect(propertyNames).toHaveLength(5);
    expect(propertyNames).toContain('name');
    expect(propertyNames).toContain('slug');
    expect(propertyNames).toContain('method');
    expect(propertyNames).toContain('path');
    expect(propertyNames).toContain('description');
  });

  it('should have required fields', () => {
    expect(ENDPOINT_SCHEMA.required).toContain('name');
    expect(ENDPOINT_SCHEMA.required).toContain('slug');
    expect(ENDPOINT_SCHEMA.required).toContain('method');
    expect(ENDPOINT_SCHEMA.required).toContain('path');
  });

  it('should NOT have nested object properties', () => {
    const properties = ENDPOINT_SCHEMA.properties || {};

    for (const value of Object.values(properties)) {
      // All properties should be strings, not objects or arrays
      expect(value.type).toBe('string');
      expect(value.properties).toBeUndefined();
      expect(value.items).toBeUndefined();
    }
  });

  it('should have method as enum', () => {
    const methodProp = ENDPOINT_SCHEMA.properties?.method;
    expect(methodProp?.enum).toBeDefined();
    expect(methodProp?.enum).toContain('GET');
    expect(methodProp?.enum).toContain('POST');
    expect(methodProp?.enum).toContain('PUT');
    expect(methodProp?.enum).toContain('PATCH');
    expect(methodProp?.enum).toContain('DELETE');
  });
});

describe('ENDPOINTS_ARRAY_SCHEMA', () => {
  it('should be an array of endpoint objects', () => {
    expect(ENDPOINTS_ARRAY_SCHEMA.type).toBe('array');
    expect(ENDPOINTS_ARRAY_SCHEMA.items).toBeDefined();
    expect(ENDPOINTS_ARRAY_SCHEMA.items).toBe(ENDPOINT_SCHEMA);
  });
});

// =============================================================================
// Example Output Tests
// =============================================================================

describe('ENDPOINT_EXTRACTION_EXAMPLE', () => {
  it('should have flat output matching schema', () => {
    const output = ENDPOINT_EXTRACTION_EXAMPLE.output;

    // Should have only the 5 flat fields
    expect(output.name).toBeDefined();
    expect(output.slug).toBeDefined();
    expect(output.method).toBeDefined();
    expect(output.path).toBeDefined();
    expect(output.description).toBeDefined();

    // Should NOT have complex nested fields
    expect(output).not.toHaveProperty('requestBody');
    expect(output).not.toHaveProperty('responses');
    expect(output).not.toHaveProperty('pathParameters');
    expect(output).not.toHaveProperty('queryParameters');
    expect(output).not.toHaveProperty('pagination');
    expect(output).not.toHaveProperty('tags');
  });
});

describe('PAGINATED_ENDPOINT_EXTRACTION_EXAMPLE', () => {
  it('should have flat output matching schema (no pagination field)', () => {
    const output = PAGINATED_ENDPOINT_EXTRACTION_EXAMPLE.output;

    // Should have only the 5 flat fields
    expect(output.name).toBeDefined();
    expect(output.slug).toBeDefined();
    expect(output.method).toBeDefined();
    expect(output.path).toBeDefined();
    expect(output.description).toBeDefined();

    // Should NOT have pagination config (schema doesn't support it)
    expect(output).not.toHaveProperty('pagination');
    expect(output).not.toHaveProperty('requestBody');
    expect(output).not.toHaveProperty('responses');
  });
});

// =============================================================================
// Build Prompt Function Tests
// =============================================================================

describe('buildEndpointExtractionPrompt', () => {
  it('should include system prompt', () => {
    const prompt = buildEndpointExtractionPrompt('Sample docs');
    expect(prompt).toContain(ENDPOINT_EXTRACTION_SYSTEM_PROMPT);
  });

  it('should include documentation content', () => {
    const docs = 'This is sample API documentation';
    const prompt = buildEndpointExtractionPrompt(docs);
    expect(prompt).toContain(docs);
  });

  it('should ask for JSON array output only', () => {
    const prompt = buildEndpointExtractionPrompt('Sample docs');
    expect(prompt).toContain('JSON array');
  });

  it('should NOT mention complex nested structures in task section', () => {
    const prompt = buildEndpointExtractionPrompt('Sample docs');
    const taskSection = prompt.split('## Task')[1] || '';

    // Task should only mention flat fields
    expect(taskSection).toContain('name');
    expect(taskSection).toContain('method');
    expect(taskSection).toContain('path');
    expect(taskSection).not.toContain('requestBody');
    expect(taskSection).not.toContain('responses');
    expect(taskSection).not.toContain('pagination');
  });
});
