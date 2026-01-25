'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Activity } from 'lucide-react';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | null | undefined;

interface HealthStatusBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'default' | 'lg';
  showTooltip?: boolean;
  showIcon?: boolean;
  className?: string;
}

const healthConfig = {
  healthy: {
    label: 'Healthy',
    description: 'All health checks passing. Connection is working normally.',
    icon: CheckCircle2,
    className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  degraded: {
    label: 'Degraded',
    description: 'Some health checks failing. Connection may have intermittent issues.',
    icon: AlertTriangle,
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/20 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  unhealthy: {
    label: 'Unhealthy',
    description: 'Health checks failing. Connection needs attention.',
    icon: XCircle,
    className: 'bg-red-500/15 text-red-600 border-red-500/20 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
  unknown: {
    label: 'Unknown',
    description: 'No health checks have been run yet.',
    icon: HelpCircle,
    className: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20',
    dotColor: 'bg-zinc-400',
  },
};

/**
 * Badge showing health check status (healthy/degraded/unhealthy)
 */
export function HealthStatusBadge({
  status,
  size = 'default',
  showTooltip = true,
  showIcon = true,
  className,
}: HealthStatusBadgeProps) {
  const config = healthConfig[status ?? 'unknown'] ?? healthConfig.unknown;
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'px-1.5 py-0 text-xs gap-1',
    default: 'px-2 py-0.5 text-xs gap-1.5',
    lg: 'px-2.5 py-1 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, sizeStyles[size], className)}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Small dot indicator for health status (for compact displays)
 */
export function HealthStatusDot({
  status,
  size = 'default',
  showTooltip = true,
  pulse = false,
  className,
}: {
  status: HealthStatus;
  size?: 'sm' | 'default' | 'lg';
  showTooltip?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const config = healthConfig[status ?? 'unknown'] ?? healthConfig.unknown;

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    default: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  const dot = (
    <span className={cn('relative inline-flex', className)}>
      <span className={cn('rounded-full', config.dotColor, dotSizes[size])} />
      {pulse && status === 'healthy' && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            config.dotColor
          )}
        />
      )}
    </span>
  );

  if (!showTooltip) {
    return dot;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{dot}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          <span className="font-medium">{config.label}</span>
        </div>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
