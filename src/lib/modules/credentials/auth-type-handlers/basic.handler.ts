/**
 * Basic Auth Credential Handler
 *
 * Handles HTTP Basic Authentication (RFC 7617).
 * Encodes username:password as Base64 in the Authorization header.
 */

import type { BasicCredentialData } from '../credential.schemas';

/**
 * Generates the Basic Auth header value
 *
 * @param credential - The decrypted Basic auth credential data
 * @returns The Authorization header value (e.g., "Basic dXNlcjpwYXNz")
 *
 * @example
 * ```ts
 * const credential = { username: 'user', password: 'pass' };
 * const header = getBasicAuthHeader(credential);
 * // header = 'Basic dXNlcjpwYXNz'
 * ```
 */
export function getBasicAuthHeader(credential: BasicCredentialData): string {
  const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Gets headers for Basic auth
 *
 * @param credential - The decrypted Basic auth credential data
 * @returns Headers object with Authorization header
 */
export function getBasicAuthHeaders(credential: BasicCredentialData): Record<string, string> {
  return {
    Authorization: getBasicAuthHeader(credential),
  };
}

/**
 * Applies Basic auth to a headers object
 *
 * @param headers - Existing headers object
 * @param credential - The decrypted Basic auth credential data
 * @returns Headers object with Basic auth added
 */
export function applyBasicAuth(
  headers: Record<string, string>,
  credential: BasicCredentialData
): Record<string, string> {
  return {
    ...headers,
    Authorization: getBasicAuthHeader(credential),
  };
}
