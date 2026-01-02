/**
 * Custom Header Credential Handler
 *
 * Handles authentication via custom headers.
 * Supports multiple arbitrary headers for APIs with non-standard auth requirements.
 */

import type { CustomHeaderCredentialData } from '../credential.schemas';

/**
 * Gets custom auth headers
 *
 * @param credential - The decrypted custom header credential data
 * @returns Headers object with all custom headers
 *
 * @example
 * ```ts
 * const credential = { headers: { 'X-App-Id': 'app123', 'X-App-Secret': 'secret' } };
 * const headers = getCustomHeaders(credential);
 * // headers = { 'X-App-Id': 'app123', 'X-App-Secret': 'secret' }
 * ```
 */
export function getCustomHeaders(credential: CustomHeaderCredentialData): Record<string, string> {
  return { ...credential.headers };
}

/**
 * Applies custom headers to an existing headers object
 *
 * @param headers - Existing headers object
 * @param credential - The decrypted custom header credential data
 * @returns Headers object with custom headers merged in
 */
export function applyCustomHeaders(
  headers: Record<string, string>,
  credential: CustomHeaderCredentialData
): Record<string, string> {
  return {
    ...headers,
    ...credential.headers,
  };
}

/**
 * Validates that required headers are present in the credential
 *
 * @param credential - The decrypted custom header credential data
 * @param requiredHeaders - List of header names that must be present
 * @returns True if all required headers are present
 */
export function hasRequiredHeaders(
  credential: CustomHeaderCredentialData,
  requiredHeaders: string[]
): boolean {
  return requiredHeaders.every(
    (header) => header in credential.headers && credential.headers[header].length > 0
  );
}

/**
 * Gets the value of a specific header from the credential
 *
 * @param credential - The decrypted custom header credential data
 * @param headerName - The name of the header to get (case-sensitive)
 * @returns The header value or undefined if not present
 */
export function getHeaderValue(
  credential: CustomHeaderCredentialData,
  headerName: string
): string | undefined {
  return credential.headers[headerName];
}
