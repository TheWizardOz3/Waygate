'use client';

import { cn } from '@/lib/utils';
import { useActivePlatformConnectors } from '@/hooks/usePlatformConnectors';
import { Loader2, CheckCircle2, Shield, Zap } from 'lucide-react';
import type { PlatformConnectorResponse } from '@/lib/modules/platform-connectors';

interface PlatformConnectorSelectProps {
  value: string | null;
  onChange: (slug: string) => void;
  className?: string;
}

/**
 * PlatformConnectorSelect - Select available platform connectors
 *
 * Displays platform connectors as selectable cards with status badges
 * showing certification status (CASA, app review, etc.)
 */
export function PlatformConnectorSelect({
  value,
  onChange,
  className,
}: PlatformConnectorSelectProps) {
  const { data, isLoading, error } = useActivePlatformConnectors();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading connectors...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">Failed to load platform connectors</p>
        <p className="mt-1 text-xs text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  const connectors = data?.connectors ?? [];

  if (connectors.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <Zap className="mx-auto h-8 w-8 text-amber-500/50" />
        <p className="mt-2 font-medium text-amber-600 dark:text-amber-400">
          No platform connectors available
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Waygate&apos;s pre-configured OAuth apps are not yet set up for this provider.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Go back and select &quot;Use Your Own Credentials&quot; to connect with your own OAuth app
          or API key.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3', className)}>
      {connectors.map((connector) => (
        <PlatformConnectorCard
          key={connector.id}
          connector={connector}
          isSelected={value === connector.providerSlug}
          onSelect={() => onChange(connector.providerSlug)}
        />
      ))}
    </div>
  );
}

interface PlatformConnectorCardProps {
  connector: PlatformConnectorResponse;
  isSelected: boolean;
  onSelect: () => void;
}

function PlatformConnectorCard({ connector, isSelected, onSelect }: PlatformConnectorCardProps) {
  const certifications = connector.certifications as {
    casa?: { status: string };
    appReview?: { status: string };
  };

  const hasCertification =
    certifications?.casa?.status === 'active' || certifications?.appReview?.status === 'approved';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex items-start gap-4 rounded-lg border p-4 text-left transition-all',
        'hover:border-primary/50 hover:bg-accent/30',
        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card'
      )}
    >
      {/* Logo/Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {connector.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={connector.logoUrl}
            alt={connector.displayName}
            className="h-6 w-6 object-contain"
          />
        ) : (
          <Zap className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{connector.displayName}</span>
          {hasCertification && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
              <Shield className="h-3 w-3" />
              Verified
            </span>
          )}
        </div>
        {connector.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{connector.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="capitalize">{connector.authType.replace('_', ' ')}</span>
          {connector.defaultScopes.length > 0 && (
            <span>{connector.defaultScopes.length} scopes</span>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-3 top-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}
    </button>
  );
}

/**
 * CertificationBadge - Shows certification status
 */
export function CertificationBadge({
  type,
  status,
}: {
  type: 'casa' | 'appReview';
  status: string;
}) {
  const isActive = type === 'casa' ? status === 'active' : status === 'approved';

  if (!isActive) return null;

  const label = type === 'casa' ? 'CASA Certified' : 'App Verified';

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
      <Shield className="h-3 w-3" />
      {label}
    </span>
  );
}
