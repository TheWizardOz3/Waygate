/**
 * Credential Encryption Module
 *
 * Provides AES-256-GCM encryption/decryption for storing sensitive credentials.
 * All credentials are encrypted before storage and decrypted only in-memory when needed.
 *
 * Format: [IV (16 bytes)] + [AuthTag (16 bytes)] + [Ciphertext]
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Error thrown when encryption/decryption operations fail
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Validates that the ENCRYPTION_KEY environment variable is properly configured
 * @throws EncryptionError if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new EncryptionError(
      'ENCRYPTION_KEY environment variable is not set. Please configure a 32-byte hex string.'
    );
  }

  // Validate hex format and length
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new EncryptionError(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt
 * @returns Buffer containing IV + AuthTag + Ciphertext
 * @throws EncryptionError if encryption fails
 *
 * @example
 * ```ts
 * const encrypted = encrypt(JSON.stringify({ accessToken: 'secret' }));
 * // Store encrypted buffer in database
 * ```
 */
export function encrypt(plaintext: string): Buffer {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: IV (16) + AuthTag (16) + Ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError('Failed to encrypt data', error instanceof Error ? error : undefined);
  }
}

/**
 * Decrypts a buffer that was encrypted with the encrypt function
 *
 * @param data - Buffer containing IV + AuthTag + Ciphertext
 * @returns The decrypted string
 * @throws EncryptionError if decryption fails (invalid data, wrong key, tampering)
 *
 * @example
 * ```ts
 * const decrypted = decrypt(encryptedBuffer);
 * const credentials = JSON.parse(decrypted);
 * ```
 */
export function decrypt(data: Buffer): string {
  try {
    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new EncryptionError('Invalid encrypted data: buffer too short');
    }

    const key = getEncryptionKey();
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    // Don't expose details about why decryption failed (could indicate tampering)
    throw new EncryptionError('Failed to decrypt data: invalid or corrupted data');
  }
}

/**
 * Encrypts a JavaScript object as JSON
 *
 * @param data - Object to encrypt
 * @returns Buffer containing encrypted JSON
 *
 * @example
 * ```ts
 * const encrypted = encryptJson({ accessToken: 'secret', refreshToken: 'refresh' });
 * ```
 */
export function encryptJson<T>(data: T): Buffer {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypts a buffer and parses it as JSON
 *
 * @param data - Buffer containing encrypted JSON
 * @returns The parsed object
 * @throws EncryptionError if decryption or JSON parsing fails
 *
 * @example
 * ```ts
 * const credentials = decryptJson<OAuth2Credential>(encryptedBuffer);
 * ```
 */
export function decryptJson<T>(data: Buffer): T {
  const decrypted = decrypt(data);
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    throw new EncryptionError('Failed to parse decrypted data as JSON');
  }
}

/**
 * Generates a new random encryption key
 * Useful for initial setup or key rotation
 *
 * @returns A 64-character hex string suitable for ENCRYPTION_KEY
 *
 * @example
 * ```ts
 * console.log('New encryption key:', generateEncryptionKey());
 * // Add to .env: ENCRYPTION_KEY=<generated key>
 * ```
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}
