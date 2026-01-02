/**
 * Bearer Token Credential Handler
 *
 * Handles Bearer Token Authentication (RFC 6750).
 * Places the token in the Authorization header.
 */

import type { BearerCredentialData } from '../credential.schemas';
import type { OAuth2CredentialData } from '../credential.schemas';

/**
 * Generates the Bearer auth header value
 *
 * @param credential - The decrypted Bearer credential data
 * @returns The Authorization header value (e.g., "Bearer abc123")
 *
 * @example
 * ```ts
 * const credential = { token: 'abc123' };
 * const header = getBearerAuthHeader(credential);
 * // header = 'Bearer abc123'
 * ```
 */
export function getBearerAuthHeader(credential: BearerCredentialData): string {
  return `Bearer ${credential.token}`;
}

/**
 * Generates Bearer auth header from an OAuth2 credential
 *
 * @param credential - The decrypted OAuth2 credential data
 * @returns The Authorization header value
 */
export function getBearerAuthHeaderFromOAuth2(credential: OAuth2CredentialData): string {
  const tokenType = credential.tokenType || 'Bearer';
  return `${tokenType} ${credential.accessToken}`;
}

/**
 * Gets headers for Bearer auth
 *
 * @param credential - The decrypted Bearer credential data
 * @returns Headers object with Authorization header
 */
export function getBearerAuthHeaders(credential: BearerCredentialData): Record<string, string> {
  return {
    Authorization: getBearerAuthHeader(credential),
  };
}

/**
 * Gets headers for OAuth2 Bearer auth
 *
 * @param credential - The decrypted OAuth2 credential data
 * @returns Headers object with Authorization header
 */
export function getOAuth2AuthHeaders(credential: OAuth2CredentialData): Record<string, string> {
  return {
    Authorization: getBearerAuthHeaderFromOAuth2(credential),
  };
}

/**
 * Applies Bearer auth to a headers object
 *
 * @param headers - Existing headers object
 * @param credential - The decrypted Bearer credential data
 * @returns Headers object with Bearer auth added
 */
export function applyBearerAuth(
  headers: Record<string, string>,
  credential: BearerCredentialData
): Record<string, string> {
  return {
    ...headers,
    Authorization: getBearerAuthHeader(credential),
  };
}

/**
 * Applies OAuth2 Bearer auth to a headers object
 *
 * @param headers - Existing headers object
 * @param credential - The decrypted OAuth2 credential data
 * @returns Headers object with Bearer auth added
 */
export function applyOAuth2Auth(
  headers: Record<string, string>,
  credential: OAuth2CredentialData
): Record<string, string> {
  return {
    ...headers,
    Authorization: getBearerAuthHeaderFromOAuth2(credential),
  };
}
