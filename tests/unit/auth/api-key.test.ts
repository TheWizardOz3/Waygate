import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  validateApiKey,
  extractApiKey,
  isValidKeyFormat,
  maskApiKey,
} from '@/lib/modules/auth/api-key';

describe('API Key Utilities', () => {
  describe('generateApiKey', () => {
    it('should generate a key with the correct prefix', async () => {
      const { key } = await generateApiKey();
      expect(key.startsWith('wg_live_')).toBe(true);
    });

    it('should generate a key with the correct length', async () => {
      const { key } = await generateApiKey();
      // wg_live_ (8 chars) + 32 hex chars = 40 total
      expect(key).toHaveLength(40);
    });

    it('should generate unique keys each time', async () => {
      const { key: key1 } = await generateApiKey();
      const { key: key2 } = await generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate unique hashes for different keys', async () => {
      const { hash: hash1 } = await generateApiKey();
      const { hash: hash2 } = await generateApiKey();
      expect(hash1).not.toBe(hash2);
    });

    it('should generate a valid bcrypt hash', async () => {
      const { hash } = await generateApiKey();
      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for matching key and hash', async () => {
      const { key, hash } = await generateApiKey();
      const isValid = await validateApiKey(key, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for non-matching key', async () => {
      const { hash } = await generateApiKey();
      const wrongKey = 'wg_live_wrongkeywrongkeywrongkey12';
      const isValid = await validateApiKey(wrongKey, hash);
      expect(isValid).toBe(false);
    });

    it('should return false for modified key', async () => {
      const { key, hash } = await generateApiKey();
      const modifiedKey = key.slice(0, -1) + 'x';
      const isValid = await validateApiKey(modifiedKey, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('extractApiKey', () => {
    it('should extract key from Bearer token format', () => {
      const key = 'wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const result = extractApiKey(`Bearer ${key}`);
      expect(result).toBe(key);
    });

    it('should handle Bearer with extra whitespace', () => {
      const key = 'wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const result = extractApiKey(`Bearer   ${key}  `);
      expect(result).toBe(key);
    });

    it('should extract raw key format', () => {
      const key = 'wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const result = extractApiKey(key);
      expect(result).toBe(key);
    });

    it('should return null for null input', () => {
      const result = extractApiKey(null);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = extractApiKey('');
      expect(result).toBeNull();
    });

    it('should return null for Basic auth', () => {
      const result = extractApiKey('Basic dXNlcjpwYXNz');
      expect(result).toBeNull();
    });

    it('should return null for invalid key format', () => {
      const result = extractApiKey('Bearer invalid_key');
      expect(result).toBeNull();
    });

    it('should return null for key with wrong prefix', () => {
      const result = extractApiKey('Bearer wg_test_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
      expect(result).toBeNull();
    });
  });

  describe('isValidKeyFormat', () => {
    it('should return true for valid key format', () => {
      const key = 'wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      expect(isValidKeyFormat(key)).toBe(true);
    });

    it('should return true for uppercase hex chars', () => {
      const key = 'wg_live_A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6';
      expect(isValidKeyFormat(key)).toBe(true);
    });

    it('should return false for wrong prefix', () => {
      expect(isValidKeyFormat('wg_test_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(false);
      expect(isValidKeyFormat('xx_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(false);
    });

    it('should return false for wrong length', () => {
      expect(isValidKeyFormat('wg_live_tooshort')).toBe(false);
      expect(isValidKeyFormat('wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6extra')).toBe(false);
    });

    it('should return false for non-hex characters', () => {
      expect(isValidKeyFormat('wg_live_g1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidKeyFormat('')).toBe(false);
    });
  });

  describe('maskApiKey', () => {
    it('should mask the middle of the key', () => {
      const key = 'wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const masked = maskApiKey(key);
      expect(masked).toBe('wg_live_****c5d6');
    });

    it('should preserve the prefix and last 4 chars', () => {
      const key = 'wg_live_0000000000000000000000000000wxyz';
      const masked = maskApiKey(key);
      expect(masked).toBe('wg_live_****wxyz');
    });

    it('should return **** for invalid key format', () => {
      expect(maskApiKey('invalid')).toBe('****');
      expect(maskApiKey('')).toBe('****');
    });
  });
});
