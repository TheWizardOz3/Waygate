'use client';

import * as React from 'react';
import Link from 'next/link';
import { Puzzle, Plus, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IntegrationEmptyStateProps {
  className?: string;
}

/**
 * Empty state shown when user has no integrations.
 * Provides a friendly message and CTA to create their first integration.
 */
export function IntegrationEmptyState({ className }: IntegrationEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center',
        className
      )}
    >
      {/* Icon */}
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Puzzle className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent-magic">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-2 font-heading text-xl font-semibold">No integrations yet</h3>

      {/* Description */}
      <p className="mb-6 max-w-sm text-muted-foreground">
        Create your first integration by providing API documentation. Our AI will analyze it and
        generate ready-to-use actions for you.
      </p>

      {/* CTA */}
      <Button asChild size="lg" className="gap-2">
        <Link href="/integrations/new">
          <Plus className="h-4 w-4" />
          Create Integration
        </Link>
      </Button>

      {/* Secondary Link */}
      <p className="mt-4 text-sm text-muted-foreground">
        Need help?{' '}
        <a
          href="https://docs.waygate.dev/getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-secondary hover:underline"
        >
          Read the docs
        </a>
      </p>
    </div>
  );
}

/**
 * Smaller inline empty state for filtered results
 */
export function IntegrationNoResults({ className }: { className?: string }) {
  return (
    <div className={cn('py-12 text-center', className)}>
      <Puzzle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
      <h3 className="mb-1 font-medium">No integrations found</h3>
      <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
    </div>
  );
}
