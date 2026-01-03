'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteIntegration } from '@/hooks';
import { toast } from 'sonner';
import type { IntegrationResponse } from '@/lib/modules/integrations/integration.schemas';

interface DeleteIntegrationDialogProps {
  integration: IntegrationResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteIntegrationDialog({
  integration,
  open,
  onOpenChange,
}: DeleteIntegrationDialogProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const deleteIntegration = useDeleteIntegration();

  const isConfirmed = confirmText === integration.slug;

  const handleDelete = async () => {
    try {
      await deleteIntegration.mutateAsync(integration.id);
      toast.success('Integration deleted successfully');
      onOpenChange(false);
      router.push('/integrations');
    } catch (error) {
      toast.error('Failed to delete integration', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Integration</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p>
              Are you sure you want to delete <strong>{integration.name}</strong>? This action
              cannot be undone.
            </p>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">This will permanently delete:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                <li>All actions associated with this integration</li>
                <li>All stored credentials and tokens</li>
                <li>Request logs for this integration</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Confirmation input */}
        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
            Type <span className="font-mono font-medium text-foreground">{integration.slug}</span>{' '}
            to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={integration.slug}
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || deleteIntegration.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteIntegration.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Integration'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
