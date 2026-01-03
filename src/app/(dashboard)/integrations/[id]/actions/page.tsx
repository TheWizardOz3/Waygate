'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionTable } from '@/components/features/actions/ActionTable';
import { useIntegration } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';

export default function IntegrationActionsPage() {
  const params = useParams();
  const integrationId = params.id as string;
  const { data: integration, isLoading } = useIntegration(integrationId);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/integrations" className="transition-colors hover:text-foreground">
          Integrations
        </Link>
        <span>/</span>
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <Link
            href={`/integrations/${integrationId}`}
            className="transition-colors hover:text-foreground"
          >
            {integration?.name ?? 'Integration'}
          </Link>
        )}
        <span>/</span>
        <span className="text-foreground">Actions</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/integrations/${integrationId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">Actions</h1>
            <p className="text-sm text-muted-foreground">
              Manage API actions for {integration?.name ?? 'this integration'}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/integrations/${integrationId}/actions/new`}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Action
          </Link>
        </Button>
      </div>

      {/* Table */}
      <ActionTable integrationId={integrationId} />
    </div>
  );
}
