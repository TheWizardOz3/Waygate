'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Unplug,
  Loader2,
  Clock,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';

export type ConnectionState = 'connected' | 'expired' | 'error' | 'disconnected';

interface ConnectionStatusProps {
  integrationId: string;
  integrationName: string;
  authType: 'oauth2' | 'api_key' | 'basic' | 'bearer' | 'custom_header';
  status: ConnectionState;
  lastRefreshed?: Date | string;
  expiresAt?: Date | string;
  scopes?: string[];
  onRefresh?: () => void;
  onDisconnect?: () => void;
}

export function ConnectionStatus({
  integrationId,
  integrationName,
  authType,
  status,
  lastRefreshed,
  expiresAt,
  scopes,
  onRefresh,
  onDisconnect,
}: ConnectionStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await apiClient.post(`/integrations/${integrationId}/credentials/refresh`);
      toast.success('Credentials refreshed successfully');
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to refresh credentials';
      toast.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);

    try {
      await apiClient.delete(`/integrations/${integrationId}/credentials`);
      toast.success(`Disconnected from ${integrationName}`);
      onDisconnect?.();
      setShowDisconnectDialog(false);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to disconnect';
      toast.error(error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const statusConfig = getStatusConfig(status);
  const authTypeLabel = getAuthTypeLabel(authType);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Connection Status
              </CardTitle>
              <CardDescription>{authTypeLabel} authentication</CardDescription>
            </div>
            <Badge variant="outline" className={statusConfig.badgeClass}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Details */}
          <div className="grid gap-4 md:grid-cols-2">
            {lastRefreshed && (
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last refreshed:</span>
                <span>{formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}</span>
              </div>
            )}

            {expiresAt && status !== 'disconnected' && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Expires:</span>
                <span className={status === 'expired' ? 'text-destructive' : ''}>
                  {formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>

          {/* Scopes */}
          {scopes && scopes.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Permissions:</p>
              <div className="flex flex-wrap gap-2">
                {scopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Status Message */}
          {status === 'expired' && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Your credentials have expired. Please refresh to restore the connection.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                There was an error with your connection. Please try refreshing or reconnecting.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {status !== 'disconnected' && (
              <>
                <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from {integrationName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your stored credentials. You&apos;ll need to reconnect to use this
              integration again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getStatusConfig(status: ConnectionState) {
  switch (status) {
    case 'connected':
      return {
        label: 'Connected',
        icon: <CheckCircle2 className="mr-1 h-3.5 w-3.5" />,
        badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      };
    case 'expired':
      return {
        label: 'Expired',
        icon: <AlertCircle className="mr-1 h-3.5 w-3.5" />,
        badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      };
    case 'error':
      return {
        label: 'Error',
        icon: <XCircle className="mr-1 h-3.5 w-3.5" />,
        badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
      };
    case 'disconnected':
    default:
      return {
        label: 'Not Connected',
        icon: <Unplug className="mr-1 h-3.5 w-3.5" />,
        badgeClass: 'bg-muted text-muted-foreground',
      };
  }
}

function getAuthTypeLabel(authType: string): string {
  switch (authType) {
    case 'oauth2':
      return 'OAuth 2.0';
    case 'api_key':
      return 'API Key';
    case 'basic':
      return 'Basic Auth';
    case 'bearer':
      return 'Bearer Token';
    case 'custom_header':
      return 'Custom Header';
    default:
      return authType;
  }
}
