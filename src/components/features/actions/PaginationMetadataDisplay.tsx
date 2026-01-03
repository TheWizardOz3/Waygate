'use client';

import {
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Layers,
  Hash,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PaginationMetadata } from '@/lib/modules/gateway/gateway.schemas';

interface PaginationMetadataDisplayProps {
  metadata: PaginationMetadata;
  className?: string;
}

/**
 * Displays pagination metadata from a Gateway API response.
 * Shows fetched items, pages, token estimates, and truncation info.
 */
export function PaginationMetadataDisplay({ metadata, className }: PaginationMetadataDisplayProps) {
  const truncationReasonLabels: Record<string, string> = {
    maxPages: 'Max pages reached',
    maxItems: 'Max items reached',
    maxCharacters: 'Max characters reached',
    maxDuration: 'Timeout reached',
    error: 'Error during pagination',
    circular: 'Circular pagination detected',
  };

  // Calculate progress percentages (if we have total)
  const itemsProgress = metadata.totalItems
    ? (metadata.fetchedItems / metadata.totalItems) * 100
    : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Pagination Results
          </span>
          {metadata.truncated ? (
            <Badge
              variant="outline"
              className="border-orange-500/50 text-orange-600 dark:text-orange-400"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              Truncated
            </Badge>
          ) : metadata.hasMore ? (
            <Badge
              variant="outline"
              className="border-blue-500/50 text-blue-600 dark:text-blue-400"
            >
              More Available
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-green-500/50 text-green-600 dark:text-green-400"
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Complete
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Items Fetched</p>
                  <p className="text-lg font-semibold">
                    {metadata.fetchedItems.toLocaleString()}
                    {metadata.totalItems && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {' / '}
                        {metadata.totalItems.toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of items retrieved across all pages</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pages Fetched</p>
                  <p className="text-lg font-semibold">{metadata.pagesFetched}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of API requests made</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Est. Tokens
                  </p>
                  <p className="text-lg font-semibold">
                    ~{metadata.estimatedTokens.toLocaleString()}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Estimated tokens (~4 characters per token)</p>
                <p className="text-xs text-muted-foreground">
                  {metadata.fetchedCharacters.toLocaleString()} characters
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Duration
                  </p>
                  <p className="text-lg font-semibold">
                    {metadata.durationMs < 1000
                      ? `${metadata.durationMs}ms`
                      : `${(metadata.durationMs / 1000).toFixed(1)}s`}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total time spent fetching all pages</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Progress bar for items */}
        {itemsProgress !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Data Coverage</span>
              <span>{itemsProgress.toFixed(1)}%</span>
            </div>
            <Progress value={itemsProgress} className="h-2" />
          </div>
        )}

        {/* Truncation Info */}
        {metadata.truncated && metadata.truncationReason && (
          <div className="rounded-md bg-orange-500/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-500" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-300">
                  {truncationReasonLabels[metadata.truncationReason] || metadata.truncationReason}
                </p>
                <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                  {metadata.hasMore
                    ? 'More data is available. Use the continuation token to fetch additional results.'
                    : 'Pagination was stopped but no more data exists.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Continuation Token */}
        {metadata.continuationToken && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                Continuation Token
              </p>
              <CopyButton value={metadata.continuationToken} />
            </div>
            <code className="block max-h-16 overflow-auto break-all rounded bg-muted p-2 font-mono text-xs">
              {metadata.continuationToken}
            </code>
            <p className="text-xs text-muted-foreground">
              Use this token in the next request to resume pagination from where it stopped.
            </p>
          </div>
        )}

        {/* Has More Info */}
        {!metadata.truncated && metadata.hasMore && (
          <div className="rounded-md bg-blue-500/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Hash className="mt-0.5 h-4 w-4 text-blue-500" />
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-300">More data available</p>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  The API indicates more data exists. Enable pagination to fetch additional results.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
