'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface OAuthConnectButtonProps {
  integrationId: string;
  integrationName: string;
  authorizationUrl?: string;
  isConnected?: boolean;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type ConnectionState = 'idle' | 'connecting' | 'success' | 'error';

export function OAuthConnectButton({
  integrationId,
  integrationName,
  authorizationUrl,
  isConnected,
  onSuccess,
  onError,
}: OAuthConnectButtonProps) {
  const [state, setState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDialog, setShowDialog] = useState(false);

  const handleConnect = async () => {
    setState('connecting');
    setShowDialog(true);

    try {
      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const oauthUrl = authorizationUrl || `/api/v1/integrations/${integrationId}/oauth/authorize`;

      const popup = window.open(
        oauthUrl,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth_success') {
          setState('success');
          toast.success(`Connected to ${integrationName}!`);
          onSuccess?.();
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'oauth_error') {
          const error = event.data.error || 'OAuth authorization failed';
          setState('error');
          setErrorMessage(error);
          onError?.(error);
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          if (state === 'connecting') {
            setState('idle');
            setShowDialog(false);
          }
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to initiate OAuth flow';
      setState('error');
      setErrorMessage(error);
      onError?.(error);
    }
  };

  const handleRetry = () => {
    setState('idle');
    setErrorMessage('');
    handleConnect();
  };

  const handleClose = () => {
    setShowDialog(false);
    if (state === 'success') {
      setState('idle');
    }
  };

  if (isConnected) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        Connected
      </Button>
    );
  }

  return (
    <>
      <Button onClick={handleConnect} disabled={state === 'connecting'}>
        {state === 'connecting' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <ExternalLink className="mr-2 h-4 w-4" />
            Connect with OAuth
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {state === 'connecting' && 'Connecting...'}
              {state === 'success' && 'Connected!'}
              {state === 'error' && 'Connection Failed'}
            </DialogTitle>
            <DialogDescription>
              {state === 'connecting' && (
                <span>Please complete the authorization in the popup window.</span>
              )}
              {state === 'success' && <span>Successfully connected to {integrationName}.</span>}
              {state === 'error' && <span>{errorMessage}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-6">
            {state === 'connecting' && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Waiting for authorization...</p>
              </div>
            )}

            {state === 'success' && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <Button onClick={handleClose}>Done</Button>
              </div>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleRetry}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
