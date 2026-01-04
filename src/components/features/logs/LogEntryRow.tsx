'use client';

import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Zap, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MethodBadge } from '@/components/features/actions/MethodBadge';
import { cn } from '@/lib/utils';
import type { LogEntry } from '@/hooks/useLogs';

interface LogEntryRowProps {
  log: LogEntry;
  onClick: () => void;
}

export function LogEntryRow({ log, onClick }: LogEntryRowProps) {
  const statusConfig = getStatusConfig(log.status, log.statusCode);

  // Safely parse timestamp
  const timestamp = log.timestamp ? new Date(log.timestamp) : null;
  const isValidDate = timestamp && !isNaN(timestamp.getTime());

  return (
    <TableRow className="cursor-pointer transition-colors hover:bg-muted/50" onClick={onClick}>
      {/* Timestamp */}
      <TableCell className="w-[140px]">
        {isValidDate ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent>{timestamp.toLocaleString()}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Integration */}
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{log.integrationName}</span>
          <span className="font-mono text-xs text-muted-foreground">{log.integrationSlug}</span>
        </div>
      </TableCell>

      {/* Action */}
      <TableCell>
        <div className="flex items-center gap-2">
          <MethodBadge method={log.httpMethod} />
          <span className="font-mono text-sm">{log.actionName}</span>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge variant="outline" className={cn('gap-1', statusConfig.className)}>
          {statusConfig.icon}
          {log.statusCode}
        </Badge>
      </TableCell>

      {/* Latency */}
      <TableCell className="w-[100px]">
        <div className="flex items-center gap-1.5">
          <Zap className={cn('h-3.5 w-3.5', getLatencyColor(log.duration))} />
          <span className={cn('font-mono text-sm', getLatencyColor(log.duration))}>
            {formatDuration(log.duration)}
          </span>
        </div>
      </TableCell>

      {/* Indicators */}
      <TableCell className="w-[80px]">
        <div className="flex items-center gap-1">
          {log.cached && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="px-1.5">
                  <Zap className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Cached response</TooltipContent>
            </Tooltip>
          )}
          {log.retryCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="px-1.5">
                  <RefreshCw className="h-3 w-3" />
                  <span className="ml-0.5 text-xs">{log.retryCount}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Retried {log.retryCount} time(s)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="w-[60px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

function getStatusConfig(status: LogEntry['status'], statusCode: number) {
  if (status === 'success' || (statusCode >= 200 && statusCode < 300)) {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    };
  }
  if (status === 'timeout') {
    return {
      icon: <Clock className="h-3.5 w-3.5" />,
      className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    };
  }
  return {
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
}

function getLatencyColor(ms: number): string {
  if (ms < 200) return 'text-emerald-600';
  if (ms < 500) return 'text-amber-600';
  return 'text-red-600';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
