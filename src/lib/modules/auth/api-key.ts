/**
 * Waygate API Key Utilities
 *
 * Handles generation, hashing, and validation of Waygate API keys.
 * These keys are used by consuming apps to authenticate with the Gateway API.
 *
 * API Key Format: wg_live_<32 random hex chars> (e.g., wg_live_a1b2c3d4...)
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

const API_KEY_PREFIX = 'wg_live_';
const API_KEY_LENGTH = 32; // 32 hex chars = 16 bytes of randomness
const BCRYPT_ROUNDS = 12;

/**
 * Generates a new Waygate API key
 *
 * @returns Object containing the plaintext key and its bcrypt hash
 *
 * @example
 * ```ts
 * const { key, hash } = await generateApiKey();
 * // key: "wg_live_a1b2c3d4e5f6..." (show to user once)
 * // hash: "$2b$12$..." (store in database)
 * ```
 */
export async function generateApiKey(): Promise<{ key: string; hash: string }> {
  const randomPart = randomBytes(API_KEY_LENGTH / 2).toString('hex');
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = await bcrypt.hash(key, BCRYPT_ROUNDS);

  return { key, hash };
}

/**
 * Validates a plaintext API key against a stored bcrypt hash
 *
 * @param key - The plaintext API key from the request
 * @param hash - The stored bcrypt hash
 * @returns True if the key matches the hash
 */
export async function validateApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Extracts the API key from an Authorization header value
 *
 * Supports both "Bearer <key>" and raw key formats
 *
 * @param authHeader - The Authorization header value
 * @returns The extracted key or null if invalid format
 *
 * @example
 * ```ts
 * extractApiKey('Bearer wg_live_abc123') // 'wg_live_abc123'
 * extractApiKey('wg_live_abc123')         // 'wg_live_abc123'
 * extractApiKey('Basic dXNlcjpwYXNz')     // null (not a Waygate key)
 * ```
 */
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Handle "Bearer <key>" format
  if (authHeader.startsWith('Bearer ')) {
    const key = authHeader.slice(7).trim();
    return isValidKeyFormat(key) ? key : null;
  }

  // Handle raw key format (for flexibility)
  if (isValidKeyFormat(authHeader)) {
    return authHeader;
  }

  return null;
}

/**
 * Checks if a string matches the expected Waygate API key format
 *
 * @param key - String to validate
 * @returns True if the key has the correct format
 */
export function isValidKeyFormat(key: string): boolean {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  const randomPart = key.slice(API_KEY_PREFIX.length);

  // Should be exactly 32 hex characters
  return /^[0-9a-f]{32}$/i.test(randomPart);
}

/**
 * Masks an API key for safe logging/display
 *
 * @param key - The API key to mask
 * @returns Masked version showing only prefix and last 4 chars
 *
 * @example
 * ```ts
 * maskApiKey('wg_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')
 * // Returns: 'wg_live_****c5d6'
 * ```
 */
export function maskApiKey(key: string): string {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return '****';
  }

  const lastFour = key.slice(-4);
  return `${API_KEY_PREFIX}****${lastFour}`;
}
