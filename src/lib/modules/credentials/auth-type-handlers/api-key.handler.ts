/**
 * API Key Credential Handler
 *
 * Handles API key authentication for external APIs.
 * Supports placing the API key in header, query parameter, or request body.
 */

import type { ApiKeyCredentialData } from '../credential.schemas';

/**
 * Request configuration with auth applied
 */
export interface AuthenticatedRequestConfig {
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  bodyParams: Record<string, string>;
}

/**
 * Applies API key authentication to a request configuration
 *
 * @param credential - The decrypted API key credential data
 * @returns Request configuration with auth applied
 *
 * @example
 * ```ts
 * const credential = { apiKey: 'sk-xxx', placement: 'header', paramName: 'X-API-Key' };
 * const config = applyApiKeyAuth(credential);
 * // config.headers = { 'X-API-Key': 'sk-xxx' }
 * ```
 */
export function applyApiKeyAuth(credential: ApiKeyCredentialData): AuthenticatedRequestConfig {
  const config: AuthenticatedRequestConfig = {
    headers: {},
    queryParams: {},
    bodyParams: {},
  };

  switch (credential.placement) {
    case 'header':
      config.headers[credential.paramName] = credential.apiKey;
      break;
    case 'query':
      config.queryParams[credential.paramName] = credential.apiKey;
      break;
    case 'body':
      config.bodyParams[credential.paramName] = credential.apiKey;
      break;
  }

  return config;
}

/**
 * Builds a URL with API key query parameter if applicable
 *
 * @param baseUrl - The base URL
 * @param credential - The decrypted API key credential data
 * @returns URL with query parameter if placement is 'query', otherwise unchanged
 */
export function buildUrlWithApiKey(baseUrl: string, credential: ApiKeyCredentialData): string {
  if (credential.placement !== 'query') {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.searchParams.set(credential.paramName, credential.apiKey);
  return url.toString();
}

/**
 * Gets headers for API key auth if applicable
 *
 * @param credential - The decrypted API key credential data
 * @returns Headers object with API key if placement is 'header'
 */
export function getApiKeyHeaders(credential: ApiKeyCredentialData): Record<string, string> {
  if (credential.placement !== 'header') {
    return {};
  }

  return { [credential.paramName]: credential.apiKey };
}

/**
 * Gets body parameters for API key auth if applicable
 *
 * @param credential - The decrypted API key credential data
 * @returns Body params object with API key if placement is 'body'
 */
export function getApiKeyBodyParams(credential: ApiKeyCredentialData): Record<string, string> {
  if (credential.placement !== 'body') {
    return {};
  }

  return { [credential.paramName]: credential.apiKey };
}

/**
 * Common API key header names by convention
 */
export const CommonApiKeyHeaders = {
  X_API_KEY: 'X-API-Key',
  AUTHORIZATION: 'Authorization',
  API_KEY: 'api-key',
  APIKEY: 'apikey',
} as const;

/**
 * Common API key query parameter names
 */
export const CommonApiKeyParams = {
  API_KEY: 'api_key',
  APIKEY: 'apikey',
  KEY: 'key',
  ACCESS_KEY: 'access_key',
} as const;
