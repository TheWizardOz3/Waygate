/**
 * Context Resolver
 *
 * Resolves human-friendly names (like "#general" or "@sarah") to external IDs
 * using injected reference data context. This enables AI agents to use natural
 * names in tool invocations while Waygate handles the ID resolution.
 *
 * Resolution Strategy:
 * 1. Check if value looks like a reference (starts with # or @, or matches common patterns)
 * 2. Look up the reference in the appropriate context type (channels, users, etc.)
 * 3. Return the resolved ID or the original value if no match found
 *
 * Context Types:
 * - channels: Slack channels, Discord channels, etc. (prefixed with #)
 * - users: User references (prefixed with @)
 * - Generic lookups: Any name-to-ID resolution based on context type
 */

import { z } from 'zod';

// =============================================================================
// Types & Schemas
// =============================================================================

/**
 * A single reference data item from context
 */
export interface ContextItem {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context provided for name resolution
 * Keyed by data type (e.g., "users", "channels")
 */
export interface ResolutionContext {
  [dataType: string]: ContextItem[];
}

/**
 * Schema for validating context input
 */
export const ResolutionContextSchema = z.record(
  z.string(),
  z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  )
);

/**
 * Result of resolving a single value
 */
export interface ResolvedValue {
  /** The original value provided */
  original: unknown;
  /** The resolved value (ID or original if not resolved) */
  resolved: unknown;
  /** Whether resolution occurred */
  wasResolved: boolean;
  /** The context type used for resolution (if resolved) */
  contextType?: string;
  /** The matched item name (if resolved) */
  matchedName?: string;
}

/**
 * Result of resolving all input parameters
 */
export interface ContextResolutionResult {
  /** The input with resolved values */
  resolvedInput: Record<string, unknown>;
  /** Details of what was resolved */
  resolutions: Record<string, ResolvedValue>;
  /** Whether any resolution occurred */
  hasResolutions: boolean;
  /** Count of resolved fields */
  resolvedCount: number;
}

// =============================================================================
// Reference Pattern Detection
// =============================================================================

/**
 * Patterns that indicate a value might need resolution
 */
const REFERENCE_PATTERNS = {
  /** Channel reference: #channel-name */
  channel: /^#([a-zA-Z0-9_-]+)$/,
  /** User reference: @username */
  user: /^@([a-zA-Z0-9_.-]+)$/,
  /** Generic name (not an ID format) - simple heuristic */
  genericName: /^[a-zA-Z][a-zA-Z0-9 _-]*$/,
} as const;

/**
 * Common ID patterns to detect values that are already IDs
 */
const ID_PATTERNS = {
  /** Slack-style IDs: C12345ABC, U12345ABC */
  slackId: /^[A-Z][A-Z0-9]{8,}$/,
  /** UUID format */
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /** Numeric ID */
  numericId: /^\d+$/,
  /** Generic alphanumeric ID (all caps or contains numbers) */
  alphanumericId: /^[A-Z0-9]+$/,
} as const;

/**
 * Context type mapping based on reference patterns
 */
const PATTERN_TO_CONTEXT_TYPE: Record<keyof typeof REFERENCE_PATTERNS, string[]> = {
  channel: ['channels', 'conversations', 'rooms'],
  user: ['users', 'members', 'people'],
  genericName: [], // Will try all available context types
};

// =============================================================================
// Core Resolution Functions
// =============================================================================

/**
 * Check if a value looks like it's already an ID (shouldn't be resolved)
 */
function looksLikeId(value: string): boolean {
  return Object.values(ID_PATTERNS).some((pattern) => pattern.test(value));
}

/**
 * Detect what type of reference a value might be
 */
function detectReferenceType(value: string): keyof typeof REFERENCE_PATTERNS | null {
  // If it looks like an ID, don't try to resolve
  if (looksLikeId(value)) {
    return null;
  }

  for (const [type, pattern] of Object.entries(REFERENCE_PATTERNS)) {
    if (pattern.test(value)) {
      return type as keyof typeof REFERENCE_PATTERNS;
    }
  }

  return null;
}

/**
 * Extract the name to look up from a reference value
 * e.g., "#general" -> "general", "@sarah" -> "sarah"
 */
function extractLookupName(value: string): string {
  // Remove leading # or @
  if (value.startsWith('#') || value.startsWith('@')) {
    return value.slice(1);
  }
  return value;
}

/**
 * Find a matching item in the context by name
 * Performs case-insensitive matching
 */
function findInContext(name: string, items: ContextItem[]): ContextItem | null {
  const normalizedName = name.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exactMatch = items.find((item) => item.name.toLowerCase() === normalizedName);
  if (exactMatch) {
    return exactMatch;
  }

  // Partial match at start (for nicknames, etc.)
  const partialMatch = items.find((item) => item.name.toLowerCase().startsWith(normalizedName));
  if (partialMatch) {
    return partialMatch;
  }

  // Check metadata for alternative names (e.g., display_name, handle)
  const metadataMatch = items.find((item) => {
    if (!item.metadata) return false;
    const metaValues = Object.values(item.metadata).filter((v) => typeof v === 'string');
    return metaValues.some((v) => (v as string).toLowerCase() === normalizedName);
  });

  return metadataMatch || null;
}

/**
 * Resolve a single string value using the provided context
 */
function resolveSingleValue(
  value: string,
  context: ResolutionContext,
  hintContextType?: string
): ResolvedValue {
  const result: ResolvedValue = {
    original: value,
    resolved: value,
    wasResolved: false,
  };

  // Detect reference type
  const refType = detectReferenceType(value);
  if (!refType) {
    // Value looks like an ID or doesn't match any pattern
    return result;
  }

  // Get candidate context types to search
  let contextTypesToSearch: string[] = [];

  if (hintContextType && context[hintContextType]) {
    // If a hint is provided, try that first
    contextTypesToSearch = [hintContextType];
  } else {
    // Use pattern-based context types
    const patternTypes = PATTERN_TO_CONTEXT_TYPE[refType];
    if (patternTypes.length > 0) {
      contextTypesToSearch = patternTypes.filter((t) => context[t]);
    } else {
      // For generic names, try all available context types
      contextTypesToSearch = Object.keys(context);
    }
  }

  // Extract the name to look up
  const lookupName = extractLookupName(value);

  // Search through candidate context types
  for (const contextType of contextTypesToSearch) {
    const items = context[contextType];
    if (!items || items.length === 0) continue;

    const match = findInContext(lookupName, items);
    if (match) {
      result.resolved = match.id;
      result.wasResolved = true;
      result.contextType = contextType;
      result.matchedName = match.name;
      return result;
    }
  }

  return result;
}

// =============================================================================
// Main Resolution Function
// =============================================================================

/**
 * Resolve all string values in an input object that look like references.
 * Uses the provided context for name-to-ID resolution.
 *
 * @param input - The action input parameters
 * @param context - Reference data context for resolution
 * @param fieldHints - Optional hints mapping field names to context types
 * @returns Resolution result with resolved input and details
 *
 * @example
 * ```typescript
 * const result = resolveContextReferences(
 *   { channel: '#general', text: 'Hello!' },
 *   { channels: [{ id: 'C123', name: 'general' }] }
 * );
 * // result.resolvedInput = { channel: 'C123', text: 'Hello!' }
 * // result.resolutions.channel = { original: '#general', resolved: 'C123', wasResolved: true }
 * ```
 */
export function resolveContextReferences(
  input: Record<string, unknown>,
  context: ResolutionContext,
  fieldHints: Record<string, string> = {}
): ContextResolutionResult {
  const result: ContextResolutionResult = {
    resolvedInput: { ...input },
    resolutions: {},
    hasResolutions: false,
    resolvedCount: 0,
  };

  // If no context provided, return input unchanged
  if (!context || Object.keys(context).length === 0) {
    return result;
  }

  // Process each field in the input
  for (const [fieldName, value] of Object.entries(input)) {
    // Only resolve string values
    if (typeof value !== 'string') {
      continue;
    }

    // Get hint for this field if available
    const hintContextType = fieldHints[fieldName];

    // Attempt resolution
    const resolved = resolveSingleValue(value, context, hintContextType);

    // Store resolution details
    result.resolutions[fieldName] = resolved;

    // Update input if resolved
    if (resolved.wasResolved) {
      result.resolvedInput[fieldName] = resolved.resolved;
      result.hasResolutions = true;
      result.resolvedCount++;
    }
  }

  return result;
}

// =============================================================================
// Field Hint Generators
// =============================================================================

/**
 * Common field name to context type mappings
 * Used as default hints when no explicit hints provided
 */
export const DEFAULT_FIELD_HINTS: Record<string, string> = {
  // Channel fields
  channel: 'channels',
  channel_id: 'channels',
  channelId: 'channels',
  conversation: 'channels',
  conversation_id: 'channels',
  conversationId: 'channels',
  room: 'channels',
  room_id: 'channels',
  roomId: 'channels',

  // User fields
  user: 'users',
  user_id: 'users',
  userId: 'users',
  member: 'users',
  member_id: 'users',
  memberId: 'users',
  assignee: 'users',
  assignee_id: 'users',
  assigneeId: 'users',
  owner: 'users',
  owner_id: 'users',
  ownerId: 'users',
  author: 'users',
  author_id: 'users',
  authorId: 'users',
  recipient: 'users',
  recipient_id: 'users',
  recipientId: 'users',

  // Repository fields
  repo: 'repositories',
  repository: 'repositories',
  repository_id: 'repositories',
  repositoryId: 'repositories',

  // Team/Group fields
  team: 'teams',
  team_id: 'teams',
  teamId: 'teams',
  group: 'groups',
  group_id: 'groups',
  groupId: 'groups',

  // Project fields
  project: 'projects',
  project_id: 'projects',
  projectId: 'projects',
};

/**
 * Generate field hints from input parameter names
 * Combines default hints with any custom hints
 */
export function generateFieldHints(
  inputFields: string[],
  customHints: Record<string, string> = {}
): Record<string, string> {
  const hints: Record<string, string> = { ...customHints };

  for (const field of inputFields) {
    // Skip if already has a custom hint
    if (hints[field]) continue;

    // Check default hints
    if (DEFAULT_FIELD_HINTS[field]) {
      hints[field] = DEFAULT_FIELD_HINTS[field];
    }
  }

  return hints;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format resolution details for inclusion in response metadata
 */
export function formatResolutionDetails(
  resolutions: Record<string, ResolvedValue>
): Record<string, { original: string; resolved: string }> {
  const formatted: Record<string, { original: string; resolved: string }> = {};

  for (const [field, resolution] of Object.entries(resolutions)) {
    if (resolution.wasResolved) {
      formatted[field] = {
        original: String(resolution.original),
        resolved: String(resolution.resolved),
      };
    }
  }

  return formatted;
}

/**
 * Check if context has any items for resolution
 */
export function hasResolvableContext(context: ResolutionContext | undefined): boolean {
  if (!context) return false;
  return Object.values(context).some((items) => items.length > 0);
}

/**
 * Get all available context types from a context object
 */
export function getContextTypes(context: ResolutionContext): string[] {
  return Object.keys(context).filter((type) => context[type].length > 0);
}
