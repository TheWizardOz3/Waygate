/**
 * Disconnect Endpoint
 *
 * POST /api/v1/integrations/:id/disconnect
 *
 * Revokes credentials for an integration and marks it as disconnected.
 * Optionally attempts to revoke tokens with the OAuth provider.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { AuthType } from '@prisma/client';
import { withApiAuth } from '@/lib/api/middleware/auth';
import {
  findActiveCredentialForIntegration,
  revokeCredential,
} from '@/lib/modules/credentials/credential.repository';
import { getDecryptedCredential } from '@/lib/modules/credentials/credential.service';
import { createGenericProvider } from '@/lib/modules/auth/oauth-providers';

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

    // Find active credential
    const credential = await findActiveCredentialForIntegration(integrationId, tenant.id);

    if (!credential) {
      return NextResponse.json(
        {
          success: true,
          data: {
            message: 'Integration was not connected',
            integrationId,
          },
        },
        { status: 200 }
      );
    }

    // For OAuth2, attempt to revoke tokens with the provider
    if (integration.authType === AuthType.oauth2) {
      try {
        const decrypted = await getDecryptedCredential(integrationId, tenant.id);

        if (decrypted && decrypted.refreshToken) {
          const authConfig = integration.authConfig as {
            authorizationUrl: string;
            tokenUrl: string;
            clientId: string;
            clientSecret: string;
            revocationUrl?: string;
          };

          // Only attempt revocation if we have the required config
          if (authConfig.clientId && authConfig.clientSecret && authConfig.revocationUrl) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const redirectUri = `${appUrl}/api/v1/auth/callback/oauth2`;

            const provider = createGenericProvider(
              authConfig,
              authConfig.clientId,
              authConfig.clientSecret,
              redirectUri
            );

            // Try to revoke the refresh token (and by extension, the access token)
            try {
              await provider.revokeToken(decrypted.refreshToken, 'refresh');
            } catch (revokeError) {
              // Log but don't fail - we still want to mark as revoked locally
              console.warn('Failed to revoke token with provider:', revokeError);
            }
          }
        }
      } catch (decryptError) {
        // Log but continue - we still want to revoke locally
        console.warn('Failed to decrypt credential for revocation:', decryptError);
      }
    }

    // Mark the credential as revoked
    await revokeCredential(credential.id);

    // Update integration status
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'draft' },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Integration disconnected successfully',
          integrationId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while disconnecting the integration',
        },
      },
      { status: 500 }
    );
  }
});
