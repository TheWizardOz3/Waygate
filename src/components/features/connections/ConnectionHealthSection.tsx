'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Activity,
  Shield,
  Wifi,
  Search,
  RefreshCw,
  ChevronDown,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLatestHealthCheck, useTriggerHealthCheck, useHealthChecks } from '@/hooks';
import { HealthStatusBadge, HealthCheckTimeline } from '@/components/features/health';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ConnectionHealthSectionProps {
  connectionId: string;
}

type HealthCheckTier = 'credential' | 'connectivity' | 'full_scan';

const tierConfig = {
  credential: {
    icon: Shield,
    label: 'Credential Check',
    description: 'Verify token validity and expiration',
    className: 'bg-violet-500/15 text-violet-600 border-violet-500/20',
  },
  connectivity: {
    icon: Wifi,
    label: 'Connectivity Check',
    description: 'Test API connectivity with lightweight request',
    className: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  },
  full_scan: {
    icon: Search,
    label: 'Full Scan',
    description: 'Verify all actions for breaking changes',
    className: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20',
  },
};

/**
 * Health section for ConnectionDetail showing health status, history, and manual check triggers.
 */
export function ConnectionHealthSection({ connectionId }: ConnectionHealthSectionProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runningTier, setRunningTier] = useState<HealthCheckTier | null>(null);

  const {
    data: latestData,
    isLoading: latestLoading,
    refetch: refetchLatest,
  } = useLatestHealthCheck(connectionId);

  const { data: historyData, isLoading: historyLoading } = useHealthChecks(connectionId, {
    limit: 10,
  });

  const triggerMutation = useTriggerHealthCheck(connectionId);

  const handleRunCheck = async (tier: HealthCheckTier) => {
    setRunningTier(tier);
    try {
      const result = await triggerMutation.mutateAsync(tier);

      if (result.statusChanged) {
        toast.success(`Health check complete`, {
          description: `Status changed from ${result.previousStatus ?? 'unknown'} to ${result.newStatus}`,
        });
      } else {
        toast.success(`Health check complete`, {
          description: `Status: ${result.newStatus}`,
        });
      }

      refetchLatest();
    } catch (error) {
      toast.error('Health check failed', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setRunningTier(null);
    }
  };

  if (latestLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Health Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const connection = latestData?.connection;
  const byTier = latestData?.byTier;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Health Status</CardTitle>
          </div>
          {connection?.healthStatus && (
            <HealthStatusBadge status={connection.healthStatus} size="sm" />
          )}
        </div>
        <CardDescription>Monitor connection health and run diagnostics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier Status Grid */}
        <div className="space-y-3">
          {(Object.entries(tierConfig) as [HealthCheckTier, typeof tierConfig.credential][]).map(
            ([tier, config]) => {
              const TierIcon = config.icon;
              const lastCheck = byTier?.[tier];
              const lastCheckTime =
                tier === 'credential'
                  ? connection?.lastCredentialCheckAt
                  : tier === 'connectivity'
                    ? connection?.lastConnectivityCheckAt
                    : connection?.lastFullScanAt;

              return (
                <div key={tier} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        config.className
                      )}
                    >
                      <TierIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {lastCheckTime ? (
                          <>
                            Last:{' '}
                            {formatDistanceToNow(new Date(lastCheckTime), { addSuffix: true })}
                          </>
                        ) : (
                          'Never run'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {lastCheck && (
                      <HealthStatusBadge status={lastCheck.status} size="sm" showIcon={false} />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunCheck(tier)}
                      disabled={runningTier !== null}
                    >
                      {runningTier === tier ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Run'
                      )}
                    </Button>
                  </div>
                </div>
              );
            }
          )}
        </div>

        {/* Warning for unhealthy status */}
        {connection?.healthStatus === 'unhealthy' && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-600">Connection needs attention</p>
              <p className="text-xs text-red-600/80">
                One or more health checks have failed. Run diagnostics to identify the issue.
              </p>
            </div>
          </div>
        )}

        {/* Health Check History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Health Check History
              </span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', historyOpen && 'rotate-180')}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {historyLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : historyData?.items && historyData.items.length > 0 ? (
              <HealthCheckTimeline
                checks={historyData.items.map((item) => ({
                  id: item.id,
                  status: item.status,
                  checkTier: item.checkTier,
                  checkTrigger: item.checkTrigger,
                  errorMessage: item.errorMessage,
                  durationMs: item.durationMs,
                  createdAt: item.createdAt,
                }))}
                maxItems={5}
              />
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No health check history yet
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for ConnectionHealthSection
 */
export function ConnectionHealthSectionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Health Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
