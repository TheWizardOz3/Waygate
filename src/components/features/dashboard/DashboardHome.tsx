'use client';

import { Sparkles, CheckCircle2, AlertCircle, Activity, Clock, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RecentActivity } from './RecentActivity';
import { useIntegrations, useLogStats } from '@/hooks';
import { cn } from '@/lib/utils';

export function DashboardHome() {
  const { data: integrationsData, isLoading: integrationsLoading } = useIntegrations();
  const { data: logStats, isLoading: statsLoading } = useLogStats();

  const integrations = integrationsData?.integrations ?? [];
  const totalIntegrations = integrations.length;
  // Active = not draft and not disabled
  const activeIntegrations = integrations.filter(
    (i) => i.status === 'active' || i.status === 'error'
  ).length;
  const unhealthyIntegrations = integrations.filter(
    (i) => i.status === 'error' || i.status === 'disabled'
  ).length;

  const totalRequests = logStats?.totalRequests ?? 0;
  const successRate = logStats?.successRate ?? 0;
  const avgLatency = logStats?.averageLatency ?? 0;
  const errorCount = logStats?.errorCount ?? 0;

  const isLoading = integrationsLoading || statsLoading;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold">Welcome back</h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s an overview of your integrations and API activity.
        </p>
      </div>

      {/* Compact Stats Row */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-y md:grid-cols-3 md:divide-y-0 lg:grid-cols-6">
            <CompactStat
              label="Integrations"
              value={totalIntegrations}
              icon={Sparkles}
              loading={isLoading}
            />
            <CompactStat
              label="Active"
              value={activeIntegrations}
              subtext={
                totalIntegrations > 0
                  ? `${Math.round((activeIntegrations / totalIntegrations) * 100)}%`
                  : '—'
              }
              icon={CheckCircle2}
              variant="success"
              loading={isLoading}
            />
            <CompactStat
              label="Needs Attention"
              value={unhealthyIntegrations}
              icon={AlertCircle}
              variant={unhealthyIntegrations > 0 ? 'warning' : 'muted'}
              loading={isLoading}
            />
            <CompactStat
              label="Requests (7d)"
              value={formatNumber(totalRequests)}
              icon={Activity}
              loading={isLoading}
            />
            <CompactStat
              label="Success Rate"
              value={totalRequests > 0 ? `${successRate.toFixed(1)}%` : '—'}
              icon={CheckCircle2}
              variant={
                totalRequests === 0
                  ? 'muted'
                  : successRate >= 99
                    ? 'success'
                    : successRate >= 95
                      ? 'warning'
                      : 'danger'
              }
              loading={isLoading}
            />
            <CompactStat
              label="Avg Latency"
              value={totalRequests > 0 ? `${avgLatency.toFixed(0)}ms` : '—'}
              icon={Clock}
              variant={
                totalRequests === 0
                  ? 'muted'
                  : avgLatency < 200
                    ? 'success'
                    : avgLatency < 500
                      ? 'warning'
                      : 'danger'
              }
              loading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Bar - Errors highlight */}
      {errorCount > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
              <Zap className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                {errorCount} error{errorCount !== 1 ? 's' : ''} in the last 7 days
              </p>
              <p className="text-xs text-red-700/70 dark:text-red-300/70">
                Review your logs to identify and resolve issues
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - Now higher up */}
      <RecentActivity limit={10} />
    </div>
  );
}

interface CompactStatProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  loading?: boolean;
}

function CompactStat({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  loading,
}: CompactStatProps) {
  const variantStyles = {
    default: 'text-primary',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
    muted: 'text-muted-foreground',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div
        className={cn(
          'rounded-md bg-muted/50 p-2',
          variant !== 'default' && variant !== 'muted' && 'bg-opacity-10'
        )}
      >
        <Icon className={cn('h-4 w-4', variantStyles[variant])} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-5 w-12" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <p className={cn('text-lg font-semibold tabular-nums', variantStyles[variant])}>
              {value}
            </p>
            {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
