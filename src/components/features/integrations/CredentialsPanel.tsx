'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Unlink,
  Loader2,
} from 'lucide-react';
import type { IntegrationResponse } from '@/lib/modules/integrations/integration.schemas';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { OAuthConnectButton } from '@/components/features/auth/OAuthConnectButton';
import { ApiKeyConnectForm } from '@/components/features/auth/ApiKeyConnectForm';
import { useIntegrationCredentials, integrationKeys } from '@/hooks';

interface CredentialsPanelProps {
  integration: IntegrationResponse;
}

type CredentialStatus = 'connected' | 'expired' | 'needs_reauth' | 'disconnected';

export function CredentialsPanel({ integration }: CredentialsPanelProps) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConnectForm, setShowConnectForm] = useState(false);

  const { data: credentialsResponse, isLoading } = useIntegrationCredentials(integration.id);

  // Derive credential status from the query data
  const credentialData = useMemo(() => {
    if (!credentialsResponse?.credentials) {
      return { status: 'disconnected' as CredentialStatus };
    }

    const creds = credentialsResponse.credentials;
    if (!creds.hasCredentials) {
      return { status: 'disconnected' as CredentialStatus };
    }

    let uiStatus: CredentialStatus = 'connected';
    if (creds.status === 'expired') {
      uiStatus = 'expired';
    } else if (creds.status === 'needs_reauth' || creds.status === 'invalid') {
      uiStatus = 'needs_reauth';
    }

    return {
      status: uiStatus,
      expiresAt: creds.expiresAt || undefined,
      scopes: creds.scopes,
      credentialType: creds.credentialType,
    };
  }, [credentialsResponse]);

  const credentialStatus = credentialData.status;
  const expiresAt = credentialData.expiresAt ? new Date(credentialData.expiresAt) : null;
  const scopes = credentialData.scopes || [];

  const invalidateCredentials = () => {
    queryClient.invalidateQueries({
      queryKey: integrationKeys.credentials(integration.id),
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apiClient.post(`/integrations/${integration.id}/refresh`);
      invalidateCredentials();
      toast.success('Credentials refreshed successfully');
    } catch (err) {
      toast.error('Failed to refresh credentials', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await apiClient.post(`/integrations/${integration.id}/disconnect`);
      invalidateCredentials();
      toast.success('Credentials disconnected');
    } catch (err) {
      toast.error('Failed to disconnect', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnect = () => {
    setShowConnectForm(true);
  };

  const handleConnectSuccess = () => {
    setShowConnectForm(false);
    invalidateCredentials();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Show connect form if requested
  if (showConnectForm) {
    if (integration.authType === 'oauth2') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Connect with OAuth</CardTitle>
            <CardDescription>Authorize access to {integration.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OAuthConnectButton
              integrationId={integration.id}
              integrationName={integration.name}
              onSuccess={handleConnectSuccess}
              onError={(error) => toast.error(error)}
            />
            <Button variant="ghost" onClick={() => setShowConnectForm(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      );
    } else {
      // Detect if this integration requires a base URL (e.g., Supabase, Airtable, etc.)
      const integrationNameLower = integration.name.toLowerCase();
      const integrationSlugLower = integration.slug?.toLowerCase() || '';
      const isSupabase =
        integrationNameLower.includes('supabase') || integrationSlugLower.includes('supabase');
      const isAirtable =
        integrationNameLower.includes('airtable') || integrationSlugLower.includes('airtable');
      const isUserSpecificApi = isSupabase || isAirtable;

      // Determine intelligent defaults based on the integration type
      let baseUrlHint = '';
      let baseUrlPlaceholder = 'https://your-project.example.com';
      let apiKeyHint = 'Your API key will be encrypted before storage';
      let headerName = 'Authorization';
      let prefix = 'Bearer';

      if (isSupabase) {
        baseUrlHint = 'Your Supabase project URL (found in Project Settings → API)';
        baseUrlPlaceholder = 'https://your-project-id.supabase.co';
        apiKeyHint =
          'Use your "service_role" key for full access (found in Project Settings → API → service_role)';
        // Supabase uses 'apikey' header with no prefix
        headerName = 'apikey';
        prefix = '';
      } else if (isAirtable) {
        baseUrlHint = 'Your Airtable base URL';
        baseUrlPlaceholder = 'https://api.airtable.com/v0/your-base-id';
        apiKeyHint = 'Your Airtable Personal Access Token or API key';
      }

      return (
        <ApiKeyConnectForm
          integrationId={integration.id}
          integrationName={integration.name}
          headerName={headerName}
          prefix={prefix}
          requiresBaseUrl={isUserSpecificApi}
          baseUrlHint={baseUrlHint}
          baseUrlPlaceholder={baseUrlPlaceholder}
          apiKeyHint={apiKeyHint}
          onSuccess={handleConnectSuccess}
          onError={(error) => toast.error(error)}
        />
      );
    }
  }

  const getStatusIcon = (status: CredentialStatus) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-accent" />;
      case 'expired':
        return <Clock className="h-4 w-4 text-destructive" />;
      case 'needs_reauth':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'disconnected':
        return <Unlink className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: CredentialStatus) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-accent text-accent-foreground">Connected</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'needs_reauth':
        return <Badge className="bg-warning text-warning-foreground">Needs Re-auth</Badge>;
      case 'disconnected':
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {integration.authType === 'oauth2' ? (
              <Shield className="h-5 w-5 text-secondary" />
            ) : (
              <Key className="h-5 w-5 text-secondary" />
            )}
            <CardTitle className="text-lg">Default Credentials</CardTitle>
          </div>
          {getStatusBadge(credentialStatus)}
        </div>
        <CardDescription>
          Used when apps don&apos;t specify a connection. For per-app credentials, use the
          Connections tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          {getStatusIcon(credentialStatus)}
          <span className="text-sm">
            {credentialStatus === 'connected' && 'Credentials are active and working'}
            {credentialStatus === 'expired' && 'Credentials have expired'}
            {credentialStatus === 'needs_reauth' && 'Re-authentication required'}
            {credentialStatus === 'disconnected' && 'No credentials configured'}
          </span>
        </div>

        {/* Expiration (for OAuth) */}
        {integration.authType === 'oauth2' && credentialStatus === 'connected' && expiresAt && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">
                {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}
              </span>
            </div>
            {scopes.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Scopes</span>
                <div className="flex gap-1">
                  {scopes.map((scope) => (
                    <Badge key={scope} variant="outline" className="text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {credentialStatus === 'connected' ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect}>
              {integration.authType === 'oauth2' ? (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Connect with OAuth
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Add API Key
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
