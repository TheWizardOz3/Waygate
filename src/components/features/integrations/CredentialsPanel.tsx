'use client';

import { useState } from 'react';
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

interface CredentialsPanelProps {
  integration: IntegrationResponse;
}

type CredentialStatus = 'connected' | 'expired' | 'needs_reauth' | 'disconnected';

export function CredentialsPanel({ integration }: CredentialsPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Mock credential status - in real app, would come from credential service
  // Using a function to avoid TypeScript narrowing
  const getCredentialStatus = (): CredentialStatus => 'connected';
  const credentialStatus = getCredentialStatus();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days from now
  const scopes = ['read', 'write', 'admin'];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRefreshing(false);
    toast.success('Credentials refreshed successfully');
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsDisconnecting(false);
    toast.success('Credentials disconnected');
  };

  const handleConnect = () => {
    // TODO: Initiate OAuth flow or show API key input
    toast.info('Connect flow coming soon');
  };

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
            <CardTitle className="text-lg">Credentials</CardTitle>
          </div>
          {getStatusBadge(credentialStatus)}
        </div>
        <CardDescription>
          {integration.authType === 'oauth2'
            ? 'OAuth 2.0 connection status'
            : 'API key authentication status'}
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
        {integration.authType === 'oauth2' && credentialStatus === 'connected' && (
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
