import { describe, it, expect } from 'vitest';
import {
  resolveContextReferences,
  formatResolutionDetails,
  hasResolvableContext,
  getContextTypes,
  generateFieldHints,
  DEFAULT_FIELD_HINTS,
  type ResolutionContext,
} from '@/lib/modules/tool-export/handlers/context-resolver';

describe('Context Resolver', () => {
  // Sample context data
  const sampleContext: ResolutionContext = {
    channels: [
      { id: 'C123456789', name: 'general' },
      { id: 'C987654321', name: 'engineering' },
      { id: 'C111111111', name: 'random' },
    ],
    users: [
      { id: 'U123456789', name: 'sarah', metadata: { display_name: 'Sarah Smith' } },
      { id: 'U987654321', name: 'john' },
      { id: 'U111111111', name: 'alice', metadata: { handle: 'alice.dev' } },
    ],
  };

  describe('resolveContextReferences', () => {
    it('should resolve channel reference with # prefix', () => {
      const input = { channel: '#general', text: 'Hello!' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(true);
      expect(result.resolvedCount).toBe(1);
      expect(result.resolvedInput.channel).toBe('C123456789');
      expect(result.resolvedInput.text).toBe('Hello!'); // unchanged
      expect(result.resolutions.channel.wasResolved).toBe(true);
      expect(result.resolutions.channel.original).toBe('#general');
      expect(result.resolutions.channel.resolved).toBe('C123456789');
    });

    it('should resolve user reference with @ prefix', () => {
      const input = { user: '@sarah', message: 'Hi!' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(true);
      expect(result.resolvedInput.user).toBe('U123456789');
      expect(result.resolutions.user.matchedName).toBe('sarah');
    });

    it('should not resolve values that look like IDs', () => {
      const input = { channel: 'C123456789', text: 'Already an ID' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(false);
      expect(result.resolvedInput.channel).toBe('C123456789');
    });

    it('should not resolve UUIDs', () => {
      const input = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(false);
    });

    it('should not resolve numeric IDs', () => {
      const input = { id: '12345678' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(false);
    });

    it('should perform case-insensitive matching', () => {
      const input = { channel: '#GENERAL' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(true);
      expect(result.resolvedInput.channel).toBe('C123456789');
    });

    it('should resolve using metadata values', () => {
      const input = { user: '@alice.dev' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(true);
      expect(result.resolvedInput.user).toBe('U111111111');
    });

    it('should handle partial name matches', () => {
      const input = { channel: '#eng' }; // Partial match for 'engineering'
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(true);
      expect(result.resolvedInput.channel).toBe('C987654321');
    });

    it('should return input unchanged when no context provided', () => {
      const input = { channel: '#general' };
      const result = resolveContextReferences(input, {});

      expect(result.hasResolutions).toBe(false);
      expect(result.resolvedInput.channel).toBe('#general');
    });

    it('should not resolve non-string values', () => {
      const input = { count: 42, enabled: true, channel: '#general' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.resolvedCount).toBe(1); // Only channel resolved
      expect(result.resolvedInput.count).toBe(42);
      expect(result.resolvedInput.enabled).toBe(true);
    });

    it('should resolve multiple fields', () => {
      const input = { channel: '#general', user: '@john' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.resolvedCount).toBe(2);
      expect(result.resolvedInput.channel).toBe('C123456789');
      expect(result.resolvedInput.user).toBe('U987654321');
    });

    it('should use field hints for resolution', () => {
      const input = { room: '#engineering' };
      const result = resolveContextReferences(input, sampleContext, {
        room: 'channels', // Hint that 'room' maps to channels context
      });

      expect(result.hasResolutions).toBe(true);
      expect(result.resolvedInput.room).toBe('C987654321');
    });

    it('should return original value when no match found', () => {
      const input = { channel: '#nonexistent' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.hasResolutions).toBe(false);
      expect(result.resolvedInput.channel).toBe('#nonexistent');
    });

    it('should record resolution context type', () => {
      const input = { channel: '#general' };
      const result = resolveContextReferences(input, sampleContext);

      expect(result.resolutions.channel.contextType).toBe('channels');
    });
  });

  describe('formatResolutionDetails', () => {
    it('should format resolved fields only', () => {
      const input = { channel: '#general', text: 'Hello' };
      const result = resolveContextReferences(input, sampleContext);
      const formatted = formatResolutionDetails(result.resolutions);

      expect(Object.keys(formatted)).toHaveLength(1);
      expect(formatted.channel).toBeDefined();
      expect(formatted.channel.original).toBe('#general');
      expect(formatted.channel.resolved).toBe('C123456789');
    });

    it('should return empty object when nothing resolved', () => {
      const input = { text: 'Hello' };
      const result = resolveContextReferences(input, sampleContext);
      const formatted = formatResolutionDetails(result.resolutions);

      expect(Object.keys(formatted)).toHaveLength(0);
    });
  });

  describe('hasResolvableContext', () => {
    it('should return true when context has items', () => {
      expect(hasResolvableContext(sampleContext)).toBe(true);
    });

    it('should return false for undefined context', () => {
      expect(hasResolvableContext(undefined)).toBe(false);
    });

    it('should return false for empty context', () => {
      expect(hasResolvableContext({})).toBe(false);
    });

    it('should return false when all context arrays are empty', () => {
      expect(hasResolvableContext({ channels: [], users: [] })).toBe(false);
    });
  });

  describe('getContextTypes', () => {
    it('should return all context types with items', () => {
      const types = getContextTypes(sampleContext);

      expect(types).toContain('channels');
      expect(types).toContain('users');
      expect(types).toHaveLength(2);
    });

    it('should exclude empty context types', () => {
      const context = {
        channels: [{ id: 'C1', name: 'test' }],
        users: [], // Empty
      };
      const types = getContextTypes(context);

      expect(types).toContain('channels');
      expect(types).not.toContain('users');
    });
  });

  describe('generateFieldHints', () => {
    it('should apply default hints for known fields', () => {
      const hints = generateFieldHints(['channel', 'user_id', 'text']);

      expect(hints.channel).toBe('channels');
      expect(hints.user_id).toBe('users');
      expect(hints.text).toBeUndefined(); // No default hint
    });

    it('should prefer custom hints over defaults', () => {
      const hints = generateFieldHints(['channel'], { channel: 'rooms' });

      expect(hints.channel).toBe('rooms');
    });

    it('should merge custom and default hints', () => {
      const hints = generateFieldHints(['channel', 'custom_field'], {
        custom_field: 'custom_context',
      });

      expect(hints.channel).toBe('channels');
      expect(hints.custom_field).toBe('custom_context');
    });
  });

  describe('DEFAULT_FIELD_HINTS', () => {
    it('should have hints for common channel fields', () => {
      expect(DEFAULT_FIELD_HINTS.channel).toBe('channels');
      expect(DEFAULT_FIELD_HINTS.channel_id).toBe('channels');
      expect(DEFAULT_FIELD_HINTS.channelId).toBe('channels');
      expect(DEFAULT_FIELD_HINTS.conversation).toBe('channels');
    });

    it('should have hints for common user fields', () => {
      expect(DEFAULT_FIELD_HINTS.user).toBe('users');
      expect(DEFAULT_FIELD_HINTS.user_id).toBe('users');
      expect(DEFAULT_FIELD_HINTS.assignee).toBe('users');
      expect(DEFAULT_FIELD_HINTS.owner).toBe('users');
    });

    it('should have hints for other common resource fields', () => {
      expect(DEFAULT_FIELD_HINTS.repository).toBe('repositories');
      expect(DEFAULT_FIELD_HINTS.team).toBe('teams');
      expect(DEFAULT_FIELD_HINTS.project).toBe('projects');
    });
  });
});
