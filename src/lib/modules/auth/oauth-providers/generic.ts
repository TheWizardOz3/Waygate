/**
 * Generic OAuth2 Provider
 *
 * A flexible OAuth2 provider that works with most OAuth2-compliant services.
 * For services with non-standard implementations, create a custom provider
 * that extends OAuthProvider.
 */

import { OAuthProvider, OAuthError, type OAuthConfig } from './base';

/**
 * Extended config for generic provider with optional introspection/revocation endpoints
 */
export interface GenericOAuthConfig extends OAuthConfig {
  // Token introspection endpoint (RFC 7662)
  introspectionUrl?: string;
  // Token revocation endpoint (RFC 7009)
  revocationUrl?: string;
  // User info endpoint for token validation
  userInfoUrl?: string;
}

/**
 * Generic OAuth2 provider implementation
 *
 * Works with standard OAuth2 providers. For validation, tries:
 * 1. Token introspection endpoint (if configured)
 * 2. User info endpoint (if configured)
 * 3. Returns true (assumes valid if no validation endpoint)
 */
export class GenericOAuthProvider extends OAuthProvider {
  protected genericConfig: GenericOAuthConfig;

  constructor(config: GenericOAuthConfig) {
    super(config);
    this.genericConfig = config;
  }

  /**
   * Validates an access token
   *
   * Tries multiple methods in order:
   * 1. Token introspection (RFC 7662)
   * 2. User info endpoint
   * 3. Assumes valid if no endpoint configured
   */
  async validateToken(accessToken: string): Promise<boolean> {
    // Method 1: Token introspection
    if (this.genericConfig.introspectionUrl) {
      try {
        const response = await fetch(this.genericConfig.introspectionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${this.config.clientId}:${this.config.clientSecret}`
            ).toString('base64')}`,
          },
          body: new URLSearchParams({
            token: accessToken,
            token_type_hint: 'access_token',
          }).toString(),
        });

        if (response.ok) {
          const data = await response.json();
          return data.active === true;
        }
      } catch {
        // Fall through to next method
      }
    }

    // Method 2: User info endpoint
    if (this.genericConfig.userInfoUrl) {
      try {
        const response = await fetch(this.genericConfig.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    // Method 3: No validation endpoint, assume valid
    // The token will fail when actually used if invalid
    return true;
  }

  /**
   * Revokes a token using the revocation endpoint (RFC 7009)
   */
  async revokeToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<void> {
    if (!this.genericConfig.revocationUrl) {
      // No revocation endpoint configured, skip silently
      return;
    }

    const response = await fetch(this.genericConfig.revocationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        token,
        token_type_hint: tokenType === 'refresh' ? 'refresh_token' : 'access_token',
      }).toString(),
    });

    // Per RFC 7009, revocation should return 200 even if token is invalid
    // Only throw on actual errors
    if (!response.ok && response.status !== 200) {
      throw new OAuthError('TOKEN_REVOCATION_FAILED', `Failed to revoke token: ${response.status}`);
    }
  }
}

/**
 * Creates a generic OAuth provider from integration auth config
 *
 * @param authConfig - The auth_config JSON from the integration
 * @param clientId - OAuth client ID from credentials
 * @param clientSecret - OAuth client secret from credentials
 * @param redirectUri - OAuth redirect URI
 */
export function createGenericProvider(
  authConfig: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes?: string[];
    usePkce?: boolean;
    introspectionUrl?: string;
    revocationUrl?: string;
    userInfoUrl?: string;
    additionalAuthParams?: Record<string, string>;
    additionalTokenParams?: Record<string, string>;
  },
  clientId: string,
  clientSecret: string,
  redirectUri: string
): GenericOAuthProvider {
  return new GenericOAuthProvider({
    clientId,
    clientSecret,
    redirectUri,
    authorizationUrl: authConfig.authorizationUrl,
    tokenUrl: authConfig.tokenUrl,
    scopes: authConfig.scopes ?? [],
    usePkce: authConfig.usePkce ?? false,
    introspectionUrl: authConfig.introspectionUrl,
    revocationUrl: authConfig.revocationUrl,
    userInfoUrl: authConfig.userInfoUrl,
    additionalAuthParams: authConfig.additionalAuthParams,
    additionalTokenParams: authConfig.additionalTokenParams,
  });
}
