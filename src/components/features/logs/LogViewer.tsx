'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Calendar, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { LogEntryRow } from './LogEntryRow';
import { LogDetailDialog } from './LogDetailDialog';
import { useLogs, useIntegrations, type LogEntry, type LogsQueryParams } from '@/hooks';

interface LogViewerProps {
  initialIntegrationId?: string;
}

export function LogViewer({ initialIntegrationId }: LogViewerProps) {
  // Filters
  const [integrationId, setIntegrationId] = useState<string | undefined>(initialIntegrationId);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Build query params
  const queryParams: LogsQueryParams = useMemo(
    () => ({
      integrationId: integrationId || undefined,
      status: status !== 'all' ? (status as 'success' | 'error' | 'timeout') : undefined,
      search: search || undefined,
      startDate: dateRange.from ? startOfDay(dateRange.from).toISOString() : undefined,
      endDate: dateRange.to ? endOfDay(dateRange.to).toISOString() : undefined,
      limit: 50,
    }),
    [integrationId, status, search, dateRange]
  );

  const { data, isLoading, isError, refetch, isFetching } = useLogs(queryParams);
  const { data: integrationsData } = useIntegrations();

  const logs = data?.logs ?? [];
  const integrations = integrationsData?.integrations ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Integration Filter */}
        <Select
          value={integrationId ?? 'all'}
          onValueChange={(v) => setIntegrationId(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Integration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Integrations</SelectItem>
            {integrations.map((integration) => (
              <SelectItem key={integration.id} value={integration.id}>
                {integration.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                  </>
                ) : (
                  format(dateRange.from, 'MMM d, yyyy')
                )
              ) : (
                'Pick dates'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Refresh */}
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <LogViewerSkeleton />
      ) : isError ? (
        <div className="py-12 text-center text-destructive">
          Failed to load logs. Please try again.
        </div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No logs found matching your filters.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Time</TableHead>
                <TableHead>Integration</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Latency</TableHead>
                <TableHead className="w-[80px]"></TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <LogEntryRow key={log.id} log={log} onClick={() => setSelectedLog(log)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination info */}
      {data?.pagination && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {logs.length} of {data.pagination.totalCount} logs
          </span>
          {data.pagination.hasMore && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Load More
            </Button>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <LogDetailDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
    </div>
  );
}

function LogViewerSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="space-y-4 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 max-w-[200px] flex-1" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
