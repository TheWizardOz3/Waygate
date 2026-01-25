'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

interface HealthSummary {
  healthy: number;
  degraded: number;
  unhealthy: number;
  total: number;
  healthScore: number;
}

interface HealthSummaryCardProps {
  summary: HealthSummary;
  isLoading?: boolean;
  onRefresh?: () => void;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * Card showing overall health status summary for a tenant
 */
export function HealthSummaryCard({
  summary,
  isLoading = false,
  onRefresh,
  onViewDetails,
  className,
}: HealthSummaryCardProps) {
  const { healthy, degraded, unhealthy, total, healthScore } = summary;

  // Determine overall status color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Subtle gradient background based on health */}
      <div
        className={cn(
          'absolute inset-0 opacity-5',
          healthScore >= 90 && 'bg-gradient-to-br from-emerald-500 to-transparent',
          healthScore >= 70 &&
            healthScore < 90 &&
            'bg-gradient-to-br from-amber-500 to-transparent',
          healthScore < 70 && 'bg-gradient-to-br from-red-500 to-transparent'
        )}
      />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Integration Health
            </CardTitle>
            <CardDescription>Overall connection health status</CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Health Score */}
        <div className="flex items-end gap-2">
          <span className={cn('text-4xl font-bold', getScoreColor(healthScore))}>
            {healthScore}%
          </span>
          <span className="mb-1 text-sm text-muted-foreground">health score</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn('h-full transition-all', getProgressColor(healthScore))}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {healthy} of {total} connections healthy
          </p>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <StatusCountCard
            icon={CheckCircle2}
            label="Healthy"
            count={healthy}
            className="text-emerald-600 dark:text-emerald-400"
          />
          <StatusCountCard
            icon={AlertTriangle}
            label="Degraded"
            count={degraded}
            className="text-amber-600 dark:text-amber-400"
          />
          <StatusCountCard
            icon={XCircle}
            label="Unhealthy"
            count={unhealthy}
            className="text-red-600 dark:text-red-400"
          />
        </div>

        {/* View details button */}
        {onViewDetails && (
          <Button variant="ghost" className="w-full justify-between" onClick={onViewDetails}>
            View health details
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatusCountCard({
  icon: Icon,
  label,
  count,
  className,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-2 text-center">
      <Icon className={cn('mx-auto h-4 w-4', className)} />
      <p className="mt-1 text-lg font-semibold">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Compact health indicator for inline displays
 */
export function HealthScoreIndicator({
  score,
  size = 'default',
  showLabel = true,
  className,
}: {
  score: number;
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  const getColor = (s: number) => {
    if (s >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (s >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const sizeStyles = {
    sm: 'text-lg',
    default: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={cn('flex items-baseline gap-1', className)}>
      <span className={cn('font-bold', sizeStyles[size], getColor(score))}>{score}%</span>
      {showLabel && <span className="text-xs text-muted-foreground">health</span>}
    </div>
  );
}

/**
 * Skeleton loader for HealthSummaryCard
 */
export function HealthSummaryCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-10 w-24 rounded bg-muted" />
        <div className="h-2 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded bg-muted" />
          <div className="h-16 rounded bg-muted" />
          <div className="h-16 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
