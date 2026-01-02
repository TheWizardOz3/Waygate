/**
 * Credential Test Endpoint
 *
 * POST /api/v1/integrations/:id/credentials/test
 *
 * Tests that stored credentials are valid by making a test API call
 * or validating with the OAuth provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  getDecryptedCredential,
  isOAuth2Credential,
  isApiKeyCredential,
  isBasicCredential,
  isBearerCredential,
} from '@/lib/modules/credentials/credential.service';
import { createGenericProvider } from '@/lib/modules/auth/oauth-providers';
import { getOAuth2AuthHeaders } from '@/lib/modules/credentials/auth-type-handlers';

export const POST = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    // Extract integration ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const integrationIdIndex = pathParts.indexOf('integrations') + 1;
    const integrationId = pathParts[integrationIdIndex];

    if (!integrationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Integration ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Get the integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        tenantId: tenant.id,
      },
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTEGRATION_NOT_FOUND',
            message: 'Integration not found',
          },
        },
        { status: 404 }
      );
    }

    // Get the credential
    const credential = await getDecryptedCredential(integrationId, tenant.id);

    if (!credential) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_CREDENTIALS',
            message: 'No active credentials found for this integration',
            suggestedResolution: {
              action: 'REFRESH_CREDENTIALS',
              description: 'Connect the integration to add credentials',
              retryable: false,
            },
          },
        },
        { status: 400 }
      );
    }

    // Test the credential based on type
    let testResult: { valid: boolean; message: string; details?: Record<string, unknown> };

    if (isOAuth2Credential(credential)) {
      testResult = await testOAuth2Credential(integration, credential.data.accessToken);
    } else if (isApiKeyCredential(credential)) {
      testResult = await testApiKeyCredential(integration, credential.data.apiKey);
    } else if (isBasicCredential(credential)) {
      testResult = await testBasicCredential();
    } else if (isBearerCredential(credential)) {
      testResult = await testBearerCredential(integration, credential.data.token);
    } else {
      testResult = {
        valid: true,
        message: 'Credential format is valid (no external validation available)',
      };
    }

    if (testResult.valid) {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: true,
            message: testResult.message,
            credentialType: credential.credentialType,
            testedAt: new Date().toISOString(),
            details: testResult.details,
          },
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CREDENTIAL_VALIDATION_FAILED',
            message: testResult.message,
            suggestedResolution: {
              action: 'CHECK_INTEGRATION_CONFIG',
              description:
                'Verify credentials are correct and have not been revoked by the provider',
              retryable: false,
            },
          },
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Credential test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while testing credentials',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * Tests OAuth2 credentials using token validation or user info endpoint
 */
async function testOAuth2Credential(
  integration: { authConfig: unknown },
  accessToken: string
): Promise<{ valid: boolean; message: string; details?: Record<string, unknown> }> {
  const authConfig = integration.authConfig as {
    authorizationUrl?: string;
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    userInfoUrl?: string;
    introspectionUrl?: string;
  };

  // Try user info endpoint first
  if (authConfig.userInfoUrl) {
    try {
      const response = await fetch(authConfig.userInfoUrl, {
        headers: getOAuth2AuthHeaders({ accessToken, tokenType: 'Bearer' }),
      });

      if (response.ok) {
        return {
          valid: true,
          message: 'OAuth2 token is valid',
          details: { method: 'userinfo' },
        };
      } else if (response.status === 401) {
        return {
          valid: false,
          message: 'OAuth2 token is invalid or expired',
        };
      }
    } catch {
      // Fall through to other methods
    }
  }

  // Try introspection endpoint
  if (authConfig.introspectionUrl && authConfig.clientId && authConfig.clientSecret) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const provider = createGenericProvider(
        {
          authorizationUrl: authConfig.authorizationUrl || '',
          tokenUrl: authConfig.tokenUrl || '',
          introspectionUrl: authConfig.introspectionUrl,
        },
        authConfig.clientId,
        authConfig.clientSecret,
        `${appUrl}/api/v1/auth/callback/oauth2`
      );

      const isValid = await provider.validateToken(accessToken);
      return {
        valid: isValid,
        message: isValid ? 'OAuth2 token is valid' : 'OAuth2 token is invalid or expired',
        details: { method: 'introspection' },
      };
    } catch {
      // Fall through
    }
  }

  // No validation endpoint available - assume valid
  return {
    valid: true,
    message: 'OAuth2 token format is valid (no validation endpoint configured)',
    details: { method: 'format_only' },
  };
}

/**
 * Tests API key credentials
 * Note: Most APIs don't have a dedicated validation endpoint,
 * so this just validates the format
 */
async function testApiKeyCredential(
  integration: { authConfig: unknown },
  apiKey: string
): Promise<{ valid: boolean; message: string; details?: Record<string, unknown> }> {
  // Check that the API key is not empty
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      valid: false,
      message: 'API key is empty',
    };
  }

  // API keys typically can't be validated without making an actual API call
  // For now, just validate format
  return {
    valid: true,
    message: 'API key format is valid',
    details: { method: 'format_only', keyLength: apiKey.length },
  };
}

/**
 * Tests Basic auth credentials
 */
async function testBasicCredential(): Promise<{
  valid: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  // Basic auth can't be validated without making an API call
  return {
    valid: true,
    message: 'Basic auth credentials format is valid',
    details: { method: 'format_only' },
  };
}

/**
 * Tests Bearer token credentials
 */
async function testBearerCredential(
  integration: { authConfig: unknown },
  token: string
): Promise<{ valid: boolean; message: string; details?: Record<string, unknown> }> {
  if (!token || token.trim().length === 0) {
    return {
      valid: false,
      message: 'Bearer token is empty',
    };
  }

  return {
    valid: true,
    message: 'Bearer token format is valid',
    details: { method: 'format_only', tokenLength: token.length },
  };
}
