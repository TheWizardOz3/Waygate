'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateConnectionOverride } from '@/hooks';
import type { MappingDirection, CoercionType } from '@/lib/modules/execution/mapping';

interface OverrideMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  actionId: string;
  onCreated?: () => void;
}

/**
 * Dialog for creating a new connection-specific mapping override
 */
export function OverrideMappingDialog({
  open,
  onOpenChange,
  connectionId,
  actionId,
  onCreated,
}: OverrideMappingDialogProps) {
  const [direction, setDirection] = useState<MappingDirection>('output');
  const [sourcePath, setSourcePath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [coercionType, setCoercionType] = useState<CoercionType | 'none'>('none');

  const { mutateAsync: createOverride, isPending } = useCreateConnectionOverride(connectionId);

  const canCreate = sourcePath.trim() && targetPath.trim();

  const handleCreate = async () => {
    if (!canCreate) return;

    try {
      const transformConfig = {
        omitIfNull: false,
        omitIfEmpty: false,
        arrayMode: 'all' as const,
        ...(coercionType !== 'none' && { coercion: { type: coercionType } }),
      };

      await createOverride({
        actionId,
        sourcePath: sourcePath.trim(),
        targetPath: targetPath.trim(),
        direction,
        transformConfig,
      });

      // Reset form
      setSourcePath('');
      setTargetPath('');
      setCoercionType('none');
      setDirection('output');

      onOpenChange(false);
      onCreated?.();
    } catch {
      // Error toast handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Mapping Override</DialogTitle>
          <DialogDescription>
            Create a connection-specific mapping that overrides the action default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as MappingDirection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="output">Output (API → App)</SelectItem>
                <SelectItem value="input">Input (App → API)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source → Target */}
          <div className="space-y-2">
            <Label>Field Mapping</Label>
            <div className="flex items-center gap-2">
              <Input
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="$.data.user_email"
                className="flex-1 font-mono text-sm"
              />
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="$.email"
                className="flex-1 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use JSONPath syntax (e.g., <code className="rounded bg-muted px-1">$.data.field</code>
              )
            </p>
          </div>

          {/* Coercion */}
          <div className="space-y-2">
            <Label>Type Coercion (Optional)</Label>
            <Select
              value={coercionType}
              onValueChange={(v) => setCoercionType(v as CoercionType | 'none')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No conversion</SelectItem>
                <SelectItem value="string">Convert to string</SelectItem>
                <SelectItem value="number">Convert to number</SelectItem>
                <SelectItem value="boolean">Convert to boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
