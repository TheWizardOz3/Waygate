/**
 * Action Editor Types
 *
 * Shared types for the action editor components.
 */

import type { HttpMethod, JsonSchema } from '@/lib/modules/actions/action.schemas';

export interface SchemaField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface ActionEditorFormData {
  name: string;
  slug: string;
  description: string;
  httpMethod: HttpMethod;
  endpointTemplate: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  cacheable: boolean;
  cacheTtlSeconds: number | null;
  retryConfig: {
    maxRetries: number;
    retryableStatuses: number[];
  } | null;
}

export function createEmptySchema(): JsonSchema {
  return {
    type: 'object',
    properties: {},
    required: [],
  };
}

export function schemaToFields(schema: JsonSchema): SchemaField[] {
  if (!schema.properties) return [];

  const required = schema.required || [];

  return Object.entries(schema.properties).map(([name, prop]) => ({
    id: crypto.randomUUID(),
    name,
    type:
      ((Array.isArray(prop.type) ? prop.type[0] : prop.type) as SchemaField['type']) || 'string',
    required: required.includes(name),
    description: prop.description,
    default: prop.default,
    enum: prop.enum as string[] | undefined,
  }));
}

export function fieldsToSchema(fields: SchemaField[]): JsonSchema {
  const properties: Record<string, object> = {};
  const required: string[] = [];

  fields.forEach((field) => {
    properties[field.name] = {
      type: field.type,
      ...(field.description && { description: field.description }),
      ...(field.default !== undefined && { default: field.default }),
      ...(field.enum && field.enum.length > 0 && { enum: field.enum }),
    };

    if (field.required) {
      required.push(field.name);
    }
  });

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
}
