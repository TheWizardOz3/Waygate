'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { HttpMethod } from '@/lib/modules/actions/action.schemas';

interface MethodBadgeProps {
  method: HttpMethod | string;
  className?: string;
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  PATCH: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
};

export function MethodBadge({ method, className }: MethodBadgeProps) {
  const normalizedMethod = method.toUpperCase();
  const styles = METHOD_STYLES[normalizedMethod] || 'bg-muted text-muted-foreground';

  return (
    <Badge
      variant="outline"
      className={cn('font-mono text-xs uppercase tracking-wider', styles, className)}
    >
      {normalizedMethod}
    </Badge>
  );
}
