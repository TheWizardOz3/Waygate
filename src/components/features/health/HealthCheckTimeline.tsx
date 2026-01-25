'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Shield,
  Wifi,
  Search,
  Play,
  Timer,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type HealthCheckStatus = 'healthy' | 'degraded' | 'unhealthy';
type HealthCheckTier = 'credential' | 'connectivity' | 'full_scan';
type HealthCheckTrigger = 'scheduled' | 'manual' | 'on_demand' | 'startup';

interface HealthCheckEntry {
  id: string;
  status: HealthCheckStatus;
  checkTier: HealthCheckTier;
  checkTrigger: HealthCheckTrigger;
  errorMessage?: string | null;
  durationMs: number;
  createdAt: string;
}

interface HealthCheckTimelineProps {
  checks: HealthCheckEntry[];
  maxItems?: number;
  showTierFilter?: boolean;
  className?: string;
}

const statusConfig = {
  healthy: {
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
    bgClassName: 'bg-emerald-500/15',
    label: 'Passed',
  },
  degraded: {
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
    bgClassName: 'bg-amber-500/15',
    label: 'Degraded',
  },
  unhealthy: {
    icon: XCircle,
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-red-500/15',
    label: 'Failed',
  },
};

const tierConfig = {
  credential: {
    icon: Shield,
    label: 'Credential',
    description: 'Token validity check',
    className: 'bg-violet-500/15 text-violet-600 border-violet-500/20',
  },
  connectivity: {
    icon: Wifi,
    label: 'Connectivity',
    description: 'API connectivity check',
    className: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
  },
  full_scan: {
    icon: Search,
    label: 'Full Scan',
    description: 'Complete action verification',
    className: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20',
  },
};

const triggerConfig = {
  scheduled: { icon: Clock, label: 'Scheduled' },
  manual: { icon: Play, label: 'Manual' },
  on_demand: { icon: Play, label: 'On Demand' },
  startup: { icon: Timer, label: 'Startup' },
};

/**
 * Timeline component showing health check history
 */
export function HealthCheckTimeline({
  checks,
  maxItems = 10,
  className,
}: HealthCheckTimelineProps) {
  const displayChecks = checks.slice(0, maxItems);

  if (displayChecks.length === 0) {
    return (
      <div className={cn('py-8 text-center', className)}>
        <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No health checks yet</p>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 h-full w-px bg-border" />

      {/* Timeline items */}
      <div className="space-y-4">
        {displayChecks.map((check, index) => {
          const status = statusConfig[check.status];
          const tier = tierConfig[check.checkTier];
          const trigger = triggerConfig[check.checkTrigger];
          const StatusIcon = status.icon;
          const TierIcon = tier.icon;

          return (
            <div key={check.id} className={cn('relative pl-10', index === 0 && 'pt-0')}>
              {/* Status indicator dot */}
              <div
                className={cn(
                  'absolute left-2 flex h-5 w-5 items-center justify-center rounded-full',
                  status.bgClassName
                )}
              >
                <StatusIcon className={cn('h-3 w-3', status.className)} />
              </div>

              {/* Content */}
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Tier badge and status */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('gap-1 text-xs', tier.className)}>
                      <TierIcon className="h-3 w-3" />
                      {tier.label}
                    </Badge>
                    <span className={cn('text-sm font-medium', status.className)}>
                      {status.label}
                    </span>
                  </div>

                  {/* Right: Time and duration */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1">
                          {trigger.icon && <trigger.icon className="h-3 w-3" />}
                          {trigger.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Triggered by: {trigger.label}</p>
                      </TooltipContent>
                    </Tooltip>
                    <span>•</span>
                    <span>{check.durationMs}ms</span>
                  </div>
                </div>

                {/* Error message if any */}
                {check.errorMessage && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {check.errorMessage}
                  </p>
                )}

                {/* Timestamp */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(check.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more indicator */}
      {checks.length > maxItems && (
        <div className="mt-4 pl-10 text-sm text-muted-foreground">
          + {checks.length - maxItems} more health checks
        </div>
      )}
    </div>
  );
}

/**
 * Compact timeline row for inline displays
 */
export function HealthCheckTimelineRow({
  check,
  className,
}: {
  check: HealthCheckEntry;
  className?: string;
}) {
  const status = statusConfig[check.status];
  const tier = tierConfig[check.checkTier];
  const StatusIcon = status.icon;
  const TierIcon = tier.icon;

  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <StatusIcon className={cn('h-4 w-4 flex-shrink-0', status.className)} />
      <div className="flex flex-1 items-center gap-2">
        <Badge variant="outline" className={cn('gap-1 text-xs', tier.className)}>
          <TierIcon className="h-3 w-3" />
          {tier.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(check.createdAt), { addSuffix: true })}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{check.durationMs}ms</span>
    </div>
  );
}
