'use client';

import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, RefreshCw, AlertTriangle, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

interface ApiKeyDisplayProps {
  apiKey: string;
  label?: string;
  description?: string;
  onRegenerate?: () => Promise<string>;
  readOnly?: boolean;
}

export function ApiKeyDisplay({
  apiKey,
  label = 'API Key',
  description = 'Use this key to authenticate API requests',
  onRegenerate,
  readOnly = false,
}: ApiKeyDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentKey, setCurrentKey] = useState(apiKey);

  const maskedKey = maskApiKey(currentKey);
  const displayKey = isVisible ? currentKey : maskedKey;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentKey);
      setIsCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy API key');
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;

    setIsRegenerating(true);
    try {
      const newKey = await onRegenerate();
      setCurrentKey(newKey);
      setShowRegenerateDialog(false);
      toast.success('API key regenerated successfully');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to regenerate API key';
      toast.error(error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {label}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input value={displayKey} readOnly className="pr-10 font-mono" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setIsVisible(!isVisible)}
              >
                {isVisible ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {isCopied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {!readOnly && onRegenerate && (
            <div className="flex items-center justify-between border-t pt-2">
              <div className="text-sm text-muted-foreground">
                <p>Regenerating will invalidate the current key.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowRegenerateDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              This will permanently invalidate your current API key. All applications using this key
              will need to be updated with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                'Regenerate Key'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '•'.repeat(key.length);
  }
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  const masked = '•'.repeat(Math.min(key.length - 8, 24));
  return `${prefix}${masked}${suffix}`;
}
