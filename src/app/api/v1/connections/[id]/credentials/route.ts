/**
 * Connection Credentials Endpoint
 *
 * GET /api/v1/connections/:id/credentials
 *
 * Returns the credential status for a specific connection.
 * Does NOT return the actual credential data (encrypted tokens).
 *
 * @route GET /api/v1/connections/:id/credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/middleware/auth';
import { getConnectionById, ConnectionError } from '@/lib/modules/connections';
import { prisma } from '@/lib/db/client';
import { CredentialStatus } from '@prisma/client';

/**
 * Extract connection ID from URL path
 * URL pattern: /api/v1/connections/{id}/credentials
 */
function extractConnectionId(url: string): string | null {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');

  // Find 'connections' in path and get the next segment
  const connectionsIndex = pathParts.indexOf('connections');
  if (connectionsIndex === -1) {
    return null;
  }

  return pathParts[connectionsIndex + 1] || null;
}

/**
 * GET /api/v1/connections/:id/credentials
 *
 * Returns credential status for a connection without exposing sensitive data.
 *
 * Response:
 * - connection: { id, name }
 * - credentials: { hasCredentials, status, credentialType, credentialSource, expiresAt, scopes }
 */
export const GET = withApiAuth(async (request: NextRequest, { tenant }) => {
  try {
    const connectionId = extractConnectionId(request.url);

    if (!connectionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Connection ID is required',
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: 'Include a valid connection ID in the URL path',
              retryable: false,
            },
          },
        },
        { status: 400 }
      );
    }

    // Verify connection exists and belongs to tenant
    const connection = await getConnectionById(tenant.id, connectionId);

    // Find the active credential for this connection
    const credential = await prisma.integrationCredential.findFirst({
      where: {
        connectionId: connectionId,
        tenantId: tenant.id,
        status: CredentialStatus.active,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        credentialType: true,
        credentialSource: true,
        expiresAt: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If no connection-specific credential, check for integration-level credential
    let foundCredential = credential;
    if (!foundCredential) {
      foundCredential = await prisma.integrationCredential.findFirst({
        where: {
          integrationId: connection.integrationId,
          tenantId: tenant.id,
          connectionId: null, // Integration-level credential
          status: CredentialStatus.active,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          status: true,
          credentialType: true,
          credentialSource: true,
          expiresAt: true,
          scopes: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          connection: {
            id: connection.id,
            name: connection.name,
          },
          credentials: foundCredential
            ? {
                hasCredentials: true,
                status: foundCredential.status,
                credentialType: foundCredential.credentialType,
                credentialSource: foundCredential.credentialSource,
                expiresAt: foundCredential.expiresAt?.toISOString() ?? null,
                scopes: foundCredential.scopes,
              }
            : {
                hasCredentials: false,
              },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ConnectionError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            suggestedResolution: {
              action: 'RETRY_WITH_MODIFIED_INPUT',
              description: getErrorDescription(error.code),
              retryable: false,
            },
          },
        },
        { status: error.statusCode }
      );
    }

    console.error('[CONNECTION_CREDENTIALS_GET] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An error occurred fetching connection credentials',
          suggestedResolution: {
            action: 'ESCALATE_TO_ADMIN',
            description: 'An internal error occurred. Please try again or contact support.',
            retryable: false,
          },
        },
      },
      { status: 500 }
    );
  }
});

/**
 * Get human-readable error description
 */
function getErrorDescription(code: string): string {
  switch (code) {
    case 'CONNECTION_NOT_FOUND':
      return 'The specified connection was not found';
    default:
      return 'An error occurred while processing the connection credentials request';
  }
}
