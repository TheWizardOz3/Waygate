/**
 * API Authentication Middleware
 *
 * Validates Waygate API keys and extracts tenant context for downstream handlers.
 * This is used for the Gateway API - consuming apps authenticate with their API keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { extractApiKey, validateApiKey, maskApiKey } from '@/lib/modules/auth/api-key';

import type { Tenant } from '@prisma/client';

/**
 * Tenant context passed to authenticated route handlers
 */
export interface AuthContext {
  tenant: Tenant;
  apiKeyMasked: string;
}

/**
 * Type for authenticated route handlers
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Error response for authentication failures
 */
function authErrorResponse(
  code: string,
  message: string,
  status: number,
  suggestedAction?: string,
  suggestedDescription?: string
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        suggestedResolution: suggestedAction
          ? {
              action: suggestedAction,
              description: suggestedDescription || '',
              retryable: false,
            }
          : undefined,
      },
    },
    { status }
  );
}

/**
 * Higher-order function that wraps a route handler with API key authentication
 *
 * Validates the Waygate API key from the Authorization header and injects
 * the tenant context into the handler.
 *
 * @param handler - The route handler to wrap
 * @returns Wrapped handler that validates API key before calling the original
 *
 * @example
 * ```ts
 * // In your route.ts
 * export const GET = withApiAuth(async (request, { tenant }) => {
 *   // tenant is the authenticated tenant
 *   const integrations = await getIntegrations(tenant.id);
 *   return NextResponse.json({ data: integrations });
 * });
 * ```
 */
export function withApiAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authHeader = request.headers.get('Authorization');
    const apiKey = extractApiKey(authHeader);

    // Missing or invalid format
    if (!apiKey) {
      return authErrorResponse(
        'MISSING_API_KEY',
        'Authorization header is required with a valid Waygate API key',
        401,
        'REFRESH_CREDENTIALS',
        'Include your Waygate API key in the Authorization header: "Bearer wg_live_..."'
      );
    }

    try {
      // Find tenant with matching API key
      const tenant = await findTenantByApiKey(apiKey);

      if (!tenant) {
        return authErrorResponse(
          'INVALID_API_KEY',
          'The provided Waygate API key is invalid or has been revoked',
          401,
          'REFRESH_CREDENTIALS',
          'Generate a new API key from the Waygate dashboard'
        );
      }

      // Create auth context
      const authContext: AuthContext = {
        tenant,
        apiKeyMasked: maskApiKey(apiKey),
      };

      // Call the wrapped handler with tenant context
      return handler(request, authContext);
    } catch (error) {
      // Log internal errors but don't expose details
      console.error('Auth middleware error:', error);

      return authErrorResponse(
        'AUTH_ERROR',
        'An error occurred during authentication',
        500,
        'ESCALATE_TO_ADMIN',
        'Contact support if this error persists'
      );
    }
  };
}

/**
 * Finds a tenant by validating their API key against stored hashes
 *
 * This performs a database query for all tenants and validates against each hash.
 * For better performance at scale, consider caching or indexing strategies.
 *
 * @param apiKey - The plaintext API key to validate
 * @returns The matching tenant or null if no match
 */
async function findTenantByApiKey(apiKey: string): Promise<Tenant | null> {
  // Get all tenants with their hashed API keys
  // Note: For MVP this is acceptable. For scale, consider:
  // - Caching validated keys in Redis with short TTL
  // - Using a key prefix index for faster lookups
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      waygateApiKeyHash: true,
      settings: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Validate against each tenant's hash
  for (const tenant of tenants) {
    const isValid = await validateApiKey(apiKey, tenant.waygateApiKeyHash);
    if (isValid) {
      return tenant as Tenant;
    }
  }

  return null;
}

/**
 * Validates an API key without returning tenant details
 * Useful for quick validation checks
 *
 * @param apiKey - The API key to validate
 * @returns True if the key is valid
 */
export async function isApiKeyValid(apiKey: string): Promise<boolean> {
  const tenant = await findTenantByApiKey(apiKey);
  return tenant !== null;
}

/**
 * Gets tenant by ID (for internal use after authentication)
 *
 * @param tenantId - The tenant's UUID
 * @returns The tenant or null if not found
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
  });
}
