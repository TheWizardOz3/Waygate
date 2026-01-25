'use client';

import { Badge } from '@/components/ui/badge';
import { Zap, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectorType } from '@/lib/modules/connections/connection.schemas';

interface ConnectorTypeBadgeProps {
  type: ConnectorType;
  size?: 'sm' | 'default';
  showIcon?: boolean;
  className?: string;
}

/**
 * ConnectorTypeBadge - Shows whether a connection uses Waygate's OAuth app or custom credentials
 *
 * - platform: "Waygate App" - uses Waygate's registered OAuth application
 * - custom: "Custom App" - uses user's own OAuth credentials
 */
export function ConnectorTypeBadge({
  type,
  size = 'default',
  showIcon = true,
  className,
}: ConnectorTypeBadgeProps) {
  const isPlatform = type === 'platform';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1',
        size === 'sm' ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-xs',
        isPlatform
          ? 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400'
          : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
        className
      )}
    >
      {showIcon &&
        (isPlatform ? (
          <Zap className={cn('fill-current', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        ) : (
          <Settings className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        ))}
      {isPlatform ? 'Waygate App' : 'Custom App'}
    </Badge>
  );
}

interface CredentialSourceBadgeProps {
  source: 'platform' | 'user_owned';
  size?: 'sm' | 'default';
  showIcon?: boolean;
  className?: string;
}

/**
 * CredentialSourceBadge - Shows where the OAuth credentials originated from
 *
 * - platform: Credentials obtained through Waygate's OAuth app
 * - user_owned: Credentials obtained through user's own OAuth app
 */
export function CredentialSourceBadge({
  source,
  size = 'default',
  showIcon = true,
  className,
}: CredentialSourceBadgeProps) {
  const isPlatform = source === 'platform';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1',
        size === 'sm' ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-xs',
        isPlatform
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
        className
      )}
    >
      {showIcon &&
        (isPlatform ? (
          <Shield className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        ) : (
          <Settings className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        ))}
      {isPlatform ? 'Platform Credentials' : 'Custom Credentials'}
    </Badge>
  );
}
