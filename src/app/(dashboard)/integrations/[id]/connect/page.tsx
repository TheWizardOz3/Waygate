'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OAuthConnectButton } from '@/components/features/auth/OAuthConnectButton';
import { ApiKeyConnectForm } from '@/components/features/auth/ApiKeyConnectForm';
import {
  ConnectionStatus,
  type ConnectionState,
} from '@/components/features/auth/ConnectionStatus';
import { useIntegration } from '@/hooks';

type CallbackState = 'idle' | 'processing' | 'success' | 'error';

export default function ConnectIntegrationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const integrationId = params.id as string;

  const { data: integration, isLoading, refetch } = useIntegration(integrationId);

  // Handle OAuth callback
  const [callbackState, setCallbackState] = useState<CallbackState>('idle');
  const [callbackError, setCallbackError] = useState<string>('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setCallbackState('error');
      setCallbackError(errorDescription || error);
      // Notify parent window if in popup
      if (window.opener) {
        window.opener.postMessage(
          { type: 'oauth_error', error: errorDescription || error },
          window.location.origin
        );
        window.close();
      }
    } else if (code) {
      setCallbackState('processing');
      // Handle OAuth callback
      handleOAuthCallbackAsync(code);
    }

    async function handleOAuthCallbackAsync(authCode: string) {
      try {
        const response = await fetch(`/api/v1/integrations/${integrationId}/oauth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: authCode }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to complete OAuth');
        }

        setCallbackState('success');

        // Notify parent window if in popup
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth_success' }, window.location.origin);
          window.close();
        } else {
          // Redirect back to integration detail
          setTimeout(() => {
            router.push(`/integrations/${integrationId}`);
          }, 2000);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'OAuth callback failed';
        setCallbackState('error');
        setCallbackError(errorMsg);

        if (window.opener) {
          window.opener.postMessage(
            { type: 'oauth_error', error: errorMsg },
            window.location.origin
          );
          window.close();
        }
      }
    }
  }, [searchParams, integrationId, router]);

  const handleConnectionSuccess = () => {
    refetch();
  };

  if (isLoading) {
    return <ConnectPageSkeleton />;
  }

  if (!integration) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Integration not found</p>
      </div>
    );
  }

  // If handling OAuth callback
  if (callbackState !== 'idle') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              {callbackState === 'processing' && (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium">Completing connection...</p>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we finish setting up your integration.
                  </p>
                </>
              )}

              {callbackState === 'success' && (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <p className="text-lg font-medium">Connected!</p>
                  <p className="text-sm text-muted-foreground">
                    Successfully connected to {integration.name}.
                  </p>
                </>
              )}

              {callbackState === 'error' && (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <p className="text-lg font-medium">Connection Failed</p>
                  <p className="text-sm text-muted-foreground">{callbackError}</p>
                  <Button onClick={() => setCallbackState('idle')}>Try Again</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine connection status
  // Note: credentialStatus may come from an extended integration response
  const integrationWithCredentials = integration as typeof integration & {
    credentialStatus?: 'connected' | 'expired' | 'error' | 'disconnected';
    credentialLastRefreshed?: string;
    credentialExpiresAt?: string;
  };

  const connectionStatus: ConnectionState =
    integrationWithCredentials.credentialStatus === 'connected'
      ? 'connected'
      : integrationWithCredentials.credentialStatus === 'expired'
        ? 'expired'
        : integrationWithCredentials.credentialStatus === 'error'
          ? 'error'
          : 'disconnected';

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/integrations" className="transition-colors hover:text-foreground">
          Integrations
        </Link>
        <span>/</span>
        <Link
          href={`/integrations/${integrationId}`}
          className="transition-colors hover:text-foreground"
        >
          {integration.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Connect</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/integrations/${integrationId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {isConnected ? 'Manage Connection' : 'Connect'} {integration.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? 'View and manage your connection settings'
              : 'Set up authentication to start using this integration'}
          </p>
        </div>
      </div>

      {/* Connection Status (if connected) */}
      {connectionStatus !== 'disconnected' && (
        <ConnectionStatus
          integrationId={integrationId}
          integrationName={integration.name}
          authType={integration.authType}
          status={connectionStatus}
          lastRefreshed={integrationWithCredentials.credentialLastRefreshed}
          expiresAt={integrationWithCredentials.credentialExpiresAt}
          onRefresh={handleConnectionSuccess}
          onDisconnect={handleConnectionSuccess}
        />
      )}

      {/* Connect Forms (if not connected) */}
      {connectionStatus === 'disconnected' && (
        <>
          {integration.authType === 'oauth2' && (
            <Card>
              <CardHeader>
                <CardTitle>OAuth 2.0 Connection</CardTitle>
                <CardDescription>Securely connect using OAuth authorization</CardDescription>
              </CardHeader>
              <CardContent>
                <OAuthConnectButton
                  integrationId={integrationId}
                  integrationName={integration.name}
                  authorizationUrl={integration.authConfig?.authorizationUrl as string | undefined}
                  isConnected={isConnected}
                  onSuccess={handleConnectionSuccess}
                />
              </CardContent>
            </Card>
          )}

          {(integration.authType === 'api_key' || integration.authType === 'bearer') && (
            <ApiKeyConnectForm
              integrationId={integrationId}
              integrationName={integration.name}
              headerName={integration.authConfig?.headerName as string | undefined}
              prefix={integration.authConfig?.prefix as string | undefined}
              onSuccess={handleConnectionSuccess}
            />
          )}

          {integration.authType === 'basic' && (
            <Card>
              <CardHeader>
                <CardTitle>Basic Authentication</CardTitle>
                <CardDescription>Enter your username and password</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Basic authentication setup coming soon.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ConnectPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-4 w-48" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
