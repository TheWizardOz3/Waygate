/**
 * OAuth Callback Handler
 *
 * GET /api/v1/auth/callback/:provider
 *
 * Handles the OAuth callback after user authorization.
 * Exchanges the authorization code for tokens and stores them.
 * Redirects the user back to the dashboard or specified URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback, AuthServiceError } from '@/lib/modules/auth/auth.service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Base URL for redirects
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors from the provider
  if (error) {
    const errorMessage = errorDescription || error;
    console.error('OAuth provider error:', error, errorDescription);

    // Redirect to dashboard with error
    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', errorMessage);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Validate required parameters
  if (!code) {
    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', 'Authorization code not received');
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!state) {
    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', 'OAuth state parameter missing');
    return NextResponse.redirect(redirectUrl.toString());
  }

  try {
    // Process the callback
    const result = await handleOAuthCallback(code, state);

    // Determine redirect URL
    let redirectUrl: URL;
    if (result.redirectUrl) {
      redirectUrl = new URL(result.redirectUrl);
    } else {
      // Default: redirect to integration detail page
      redirectUrl = new URL(`/integrations/${result.integrationId}`, appUrl);
    }

    // Add success indicator
    redirectUrl.searchParams.set('oauth_success', 'true');

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);

    let errorMessage = 'Failed to complete OAuth connection';

    if (error instanceof AuthServiceError) {
      errorMessage = error.message;
    }

    // Redirect to dashboard with error
    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', errorMessage);
    return NextResponse.redirect(redirectUrl.toString());
  }
}

/**
 * POST handler for providers that use POST for callbacks
 * Some OAuth providers send the callback as a POST request
 */
export async function POST(request: NextRequest) {
  // Extract parameters from form data or JSON body
  let code: string | null = null;
  let state: string | null = null;
  let error: string | null = null;
  let errorDescription: string | null = null;

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    code = formData.get('code') as string | null;
    state = formData.get('state') as string | null;
    error = formData.get('error') as string | null;
    errorDescription = formData.get('error_description') as string | null;
  } else if (contentType.includes('application/json')) {
    const body = await request.json();
    code = body.code;
    state = body.state;
    error = body.error;
    errorDescription = body.error_description;
  }

  // Base URL for redirects
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors from the provider
  if (error) {
    const errorMessage = errorDescription || error;
    console.error('OAuth provider error:', error, errorDescription);

    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', errorMessage);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Validate required parameters
  if (!code || !state) {
    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', 'Invalid OAuth callback parameters');
    return NextResponse.redirect(redirectUrl.toString());
  }

  try {
    const result = await handleOAuthCallback(code, state);

    let redirectUrl: URL;
    if (result.redirectUrl) {
      redirectUrl = new URL(result.redirectUrl);
    } else {
      redirectUrl = new URL(`/integrations/${result.integrationId}`, appUrl);
    }

    redirectUrl.searchParams.set('oauth_success', 'true');
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);

    let errorMessage = 'Failed to complete OAuth connection';
    if (error instanceof AuthServiceError) {
      errorMessage = error.message;
    }

    const redirectUrl = new URL('/integrations', appUrl);
    redirectUrl.searchParams.set('oauth_error', errorMessage);
    return NextResponse.redirect(redirectUrl.toString());
  }
}
