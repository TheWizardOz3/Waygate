'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MethodBadge } from './MethodBadge';

interface RequestResponseViewerProps {
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: unknown;
    duration?: number;
  };
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function RequestResponseViewer({ request, response, error }: RequestResponseViewerProps) {
  return (
    <div className="space-y-4">
      {request && <RequestPanel request={request} />}
      {response && <ResponsePanel response={response} />}
      {error && <ErrorPanel error={error} />}
    </div>
  );
}

function RequestPanel({
  request,
}: {
  request: NonNullable<RequestResponseViewerProps['request']>;
}) {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

  return (
    <div className="rounded-lg border border-muted bg-muted/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-muted-foreground">Request</span>
          <MethodBadge method={request.method} size="sm" />
          <code className="max-w-[200px] truncate text-xs text-muted-foreground">
            {request.url}
          </code>
        </div>
        <CopyButton value={request.url} label="URL copied" size="sm" className="h-6 w-6" />
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-muted p-3">
          {/* Headers - compact */}
          {request.headers && Object.keys(request.headers).length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">Headers</h4>
              <JsonViewer data={request.headers} compact />
            </div>
          )}

          {/* Body */}
          {request.body !== undefined && (
            <div>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">Body</h4>
              <JsonViewer data={request.body} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResponsePanel({
  response,
}: {
  response: NonNullable<RequestResponseViewerProps['response']>;
}) {
  const isSuccess = response.status >= 200 && response.status < 300;
  const isRedirect = response.status >= 300 && response.status < 400;
  const isClientError = response.status >= 400 && response.status < 500;

  return (
    <div className="rounded-lg border">
      {/* Status header - always visible */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              isSuccess && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
              isRedirect && 'border-blue-500/20 bg-blue-500/10 text-blue-600',
              isClientError && 'border-amber-500/20 bg-amber-500/10 text-amber-600',
              !isSuccess &&
                !isRedirect &&
                !isClientError &&
                'border-red-500/20 bg-red-500/10 text-red-600'
            )}
          >
            {response.status} {response.statusText}
          </Badge>
          {response.duration !== undefined && (
            <span className="text-xs text-muted-foreground">{response.duration}ms</span>
          )}
        </div>
        {response.body !== undefined && (
          <CopyButton
            value={
              typeof response.body === 'string'
                ? response.body
                : JSON.stringify(response.body, null, 2)
            }
            label="Response copied"
            size="sm"
            className="h-6 w-6"
          />
        )}
      </div>

      {/* Body - scrollable area */}
      {response.body !== undefined && (
        <div className="max-h-[400px] overflow-auto">
          <JsonViewer data={response.body} />
        </div>
      )}
    </div>
  );
}

function ErrorPanel({ error }: { error: NonNullable<RequestResponseViewerProps['error']> }) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="destructive">Error</Badge>
        {error.code && <code className="text-xs text-destructive">{error.code}</code>}
      </div>
      <p className="mb-3 text-sm font-medium text-destructive">{error.message}</p>
      {error.details !== undefined && error.details !== null && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Details</h4>
          <JsonViewer data={error.details} />
        </div>
      )}
    </div>
  );
}

function JsonViewer({ data, compact }: { data: unknown; compact?: boolean }) {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2) || '';

  return (
    <div className="group relative">
      <pre
        className={cn(
          'overflow-x-auto rounded-md bg-muted/50 text-xs',
          compact ? 'max-h-[120px] overflow-y-auto p-2' : 'p-3'
        )}
      >
        <code className="text-foreground">{jsonString}</code>
      </pre>
      {!compact && (
        <CopyButton
          value={jsonString}
          label="JSON copied"
          size="sm"
          className="absolute right-2 top-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </div>
  );
}
