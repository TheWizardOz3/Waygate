'use client';

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  loading,
}: StatsCardProps) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-red-500/10 text-red-600',
  };

  const trendDirection = trend?.value === 0 ? 'neutral' : (trend?.value ?? 0) > 0 ? 'up' : 'down';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className={cn('rounded-lg p-3', variantStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {trend && !loading && (
          <div className="mt-4 flex items-center gap-2">
            {trendDirection === 'up' && <TrendingUp className="h-4 w-4 text-emerald-600" />}
            {trendDirection === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
            {trendDirection === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground" />}
            <span
              className={cn(
                'text-sm font-medium',
                trendDirection === 'up' && 'text-emerald-600',
                trendDirection === 'down' && 'text-red-600',
                trendDirection === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend.value > 0 && '+'}
              {trend.value}%
            </span>
            <span className="text-sm text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
