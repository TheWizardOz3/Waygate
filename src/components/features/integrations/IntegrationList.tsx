'use client';

import * as React from 'react';
import { Search, Filter, Plus, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IntegrationCard, IntegrationCardSkeleton } from './IntegrationCard';
import { IntegrationEmptyState, IntegrationNoResults } from './IntegrationEmptyState';
import { useIntegrations, useDeleteIntegration } from '@/hooks/useIntegrations';
import { cn } from '@/lib/utils';
import type { IntegrationStatus, AuthType } from '@/lib/modules/integrations/integration.schemas';

// =============================================================================
// Types
// =============================================================================

interface IntegrationListProps {
  className?: string;
}

type ViewMode = 'grid' | 'list';

// =============================================================================
// Component
// =============================================================================

/**
 * Main integration list component with search, filters, and grid/list view.
 */
export function IntegrationList({ className }: IntegrationListProps) {
  // State
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<IntegrationStatus | 'all'>('all');
  const [authTypeFilter, setAuthTypeFilter] = React.useState<AuthType | 'all'>('all');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Query
  const { data, isLoading, error } = useIntegrations({
    search: debouncedSearch || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    authType: authTypeFilter === 'all' ? undefined : authTypeFilter,
  });

  // Mutations
  const deleteIntegration = useDeleteIntegration();

  const handleDelete = React.useCallback(
    (id: string) => {
      if (confirm('Are you sure you want to delete this integration? This cannot be undone.')) {
        deleteIntegration.mutate(id);
      }
    },
    [deleteIntegration]
  );

  // Computed
  const integrations = data?.integrations ?? [];
  const hasIntegrations = integrations.length > 0;
  const hasFilters = debouncedSearch || statusFilter !== 'all' || authTypeFilter !== 'all';
  const isEmpty = !isLoading && integrations.length === 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Manage your API integrations</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/integrations/new">
            <Plus className="h-4 w-4" />
            New Integration
          </Link>
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as IntegrationStatus | 'all')}
        >
          <SelectTrigger className="w-[140px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        {/* Auth Type Filter */}
        <Select
          value={authTypeFilter}
          onValueChange={(v) => setAuthTypeFilter(v as AuthType | 'all')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Auth Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="oauth2">OAuth 2.0</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="custom_header">Custom Header</SelectItem>
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
        </div>
      </div>

      {/* Results Count */}
      {!isLoading && hasIntegrations && (
        <p className="text-sm text-muted-foreground">
          {data?.pagination.totalCount ?? integrations.length} integration
          {integrations.length !== 1 ? 's' : ''}
          {hasFilters && ' found'}
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        // Loading State
        <div
          className={cn(
            'gap-4',
            viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <IntegrationCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        // Error State
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">Failed to load integrations</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
        </div>
      ) : isEmpty && !hasFilters ? (
        // Empty State (no integrations at all)
        <IntegrationEmptyState />
      ) : isEmpty && hasFilters ? (
        // No Results State (filters applied but no matches)
        <IntegrationNoResults />
      ) : (
        // Integration Grid/List
        <div
          className={cn(
            'gap-4',
            viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
          )}
        >
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
