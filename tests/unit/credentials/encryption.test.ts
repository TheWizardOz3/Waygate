import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  generateEncryptionKey,
  EncryptionError,
} from '@/lib/modules/credentials/encryption';

// Valid 32-byte (64 hex chars) test encryption key
const TEST_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

describe('Credential Encryption Module', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'my secret access token';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'my secret';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Ciphertexts should differ due to different IVs
      expect(encrypted1.equals(encrypted2)).toBe(false);

      // But both should decrypt to the same plaintext
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '🔐 Secret with émojis and spëcial châräctérs 日本語';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle large payloads', () => {
      const plaintext = 'x'.repeat(100000); // 100KB
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw EncryptionError if ENCRYPTION_KEY is missing', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow(EncryptionError);
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw EncryptionError if ENCRYPTION_KEY is invalid length', () => {
      process.env.ENCRYPTION_KEY = 'tooshort';

      expect(() => encrypt('test')).toThrow(EncryptionError);
      expect(() => encrypt('test')).toThrow('must be a 64-character hex string');
    });

    it('should throw EncryptionError if ENCRYPTION_KEY contains non-hex chars', () => {
      process.env.ENCRYPTION_KEY = 'g'.repeat(64); // 'g' is not a valid hex char

      expect(() => encrypt('test')).toThrow(EncryptionError);
      expect(() => encrypt('test')).toThrow('must be a 64-character hex string');
    });

    it('should throw EncryptionError when decrypting corrupted data', () => {
      const encrypted = encrypt('test');
      // Corrupt the ciphertext portion
      encrypted[encrypted.length - 1] ^= 0xff;

      expect(() => decrypt(encrypted)).toThrow(EncryptionError);
      expect(() => decrypt(encrypted)).toThrow('invalid or corrupted data');
    });

    it('should throw EncryptionError when decrypting data that is too short', () => {
      const tooShort = Buffer.from('short');

      expect(() => decrypt(tooShort)).toThrow(EncryptionError);
      expect(() => decrypt(tooShort)).toThrow('buffer too short');
    });

    it('should throw EncryptionError when decrypting with wrong key', () => {
      const encrypted = encrypt('test');

      // Change the key
      process.env.ENCRYPTION_KEY =
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      expect(() => decrypt(encrypted)).toThrow(EncryptionError);
    });
  });

  describe('encryptJson/decryptJson', () => {
    it('should encrypt and decrypt objects correctly', () => {
      const credentials = {
        accessToken: 'secret-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: '2025-01-01T00:00:00Z',
      };

      const encrypted = encryptJson(credentials);
      const decrypted = decryptJson<typeof credentials>(encrypted);

      expect(decrypted).toEqual(credentials);
    });

    it('should handle nested objects', () => {
      const data = {
        oauth: {
          accessToken: 'token',
          scopes: ['read', 'write'],
        },
        metadata: {
          createdAt: new Date().toISOString(),
        },
      };

      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle arrays', () => {
      const data = ['token1', 'token2', 'token3'];

      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should throw EncryptionError when decrypting invalid JSON', () => {
      // Encrypt a plain string, then try to decrypt as JSON
      const encrypted = encrypt('not valid json {{{');

      expect(() => decryptJson(encrypted)).toThrow(EncryptionError);
      expect(() => decryptJson(encrypted)).toThrow('parse decrypted data as JSON');
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    it('should generate unique keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate a valid key that can be used for encryption', () => {
      const newKey = generateEncryptionKey();
      process.env.ENCRYPTION_KEY = newKey;

      const plaintext = 'test with generated key';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('EncryptionError', () => {
    it('should have the correct name', () => {
      const error = new EncryptionError('test error');
      expect(error.name).toBe('EncryptionError');
    });

    it('should preserve the cause if provided', () => {
      const cause = new Error('original error');
      const error = new EncryptionError('wrapped error', cause);

      expect(error.message).toBe('wrapped error');
      expect(error.cause).toBe(cause);
    });
  });
});
