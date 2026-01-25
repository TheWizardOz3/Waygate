'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GitBranch, Pencil } from 'lucide-react';
import type { MappingSource } from '@/lib/modules/execution/mapping';

interface MappingInheritanceBadgeProps {
  source: MappingSource;
  overridden?: boolean;
  className?: string;
}

/**
 * Badge showing whether a mapping is inherited from action defaults or overridden at connection level
 */
export function MappingInheritanceBadge({
  source,
  overridden,
  className,
}: MappingInheritanceBadgeProps) {
  if (source === 'connection') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 ${className}`}
          >
            <Pencil className="h-2.5 w-2.5" />
            Override
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {overridden
              ? 'This mapping overrides the action default'
              : 'Custom mapping for this connection only'}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1 border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400 ${className}`}
        >
          <GitBranch className="h-2.5 w-2.5" />
          Inherited
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Using the action-level default mapping</p>
      </TooltipContent>
    </Tooltip>
  );
}
