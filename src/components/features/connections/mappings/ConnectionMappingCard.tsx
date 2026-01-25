'use client';

import { ArrowRight, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MappingInheritanceBadge } from './MappingInheritanceBadge';
import { useDeleteConnectionOverride } from '@/hooks';
import type { ResolvedMapping } from '@/lib/modules/execution/mapping';

interface ConnectionMappingCardProps {
  resolvedMapping: ResolvedMapping;
  connectionId: string;
  actionId: string;
  onDeleted?: () => void;
}

/**
 * Card displaying a single mapping with its inheritance status
 */
export function ConnectionMappingCard({
  resolvedMapping,
  connectionId,
  actionId,
  onDeleted,
}: ConnectionMappingCardProps) {
  const { mapping, source, overridden, defaultMapping } = resolvedMapping;
  const { mutateAsync: deleteOverride, isPending } = useDeleteConnectionOverride(connectionId);

  const coercionType = mapping.transformConfig?.coercion?.type;
  const isOverride = source === 'connection';

  const handleRevertToDefault = async () => {
    if (!mapping.id) return;
    try {
      await deleteOverride({ mappingId: mapping.id, actionId });
      onDeleted?.();
    } catch {
      // Error toast handled by hook
    }
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30">
      {/* Direction Badge */}
      <Badge variant="outline" className="shrink-0 text-xs">
        {mapping.direction}
      </Badge>

      {/* Source → Target */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {mapping.sourcePath}
        </code>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {mapping.targetPath}
        </code>
      </div>

      {/* Coercion Type */}
      {coercionType && (
        <Badge variant="secondary" className="shrink-0 text-xs">
          {coercionType}
        </Badge>
      )}

      {/* Inheritance Badge */}
      <MappingInheritanceBadge source={source} overridden={overridden} />

      {/* Actions */}
      {isOverride && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Revert to default */}
          {overridden && defaultMapping && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleRevertToDefault}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Revert to default</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Delete override */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={handleRevertToDefault}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Remove override</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
