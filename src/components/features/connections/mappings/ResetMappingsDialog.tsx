'use client';

import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useResetConnectionMappings } from '@/hooks';

interface ResetMappingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  actionId: string;
  overrideCount: number;
  onReset?: () => void;
}

/**
 * Confirmation dialog for resetting all connection mappings to defaults
 */
export function ResetMappingsDialog({
  open,
  onOpenChange,
  connectionId,
  actionId,
  overrideCount,
  onReset,
}: ResetMappingsDialogProps) {
  const { mutateAsync: resetMappings, isPending } = useResetConnectionMappings(connectionId);

  const handleReset = async () => {
    try {
      await resetMappings({ actionId });
      onOpenChange(false);
      onReset?.();
    } catch {
      // Error toast handled by hook
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reset to Default Mappings?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will delete{' '}
            <strong className="text-foreground">
              {overrideCount} custom mapping{overrideCount !== 1 ? 's' : ''}
            </strong>{' '}
            for this connection. The connection will revert to using the action-level default
            mappings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset to Defaults
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
