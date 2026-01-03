'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Zap, ArrowRight } from 'lucide-react';

interface IntegrationActionsTabProps {
  integrationId: string;
}

export function IntegrationActionsTab({ integrationId }: IntegrationActionsTabProps) {
  // This is a placeholder - the full ActionTable will be built in Phase 5
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage the API actions available for this integration</CardDescription>
        </div>
        <Button asChild>
          <Link href={`/integrations/${integrationId}/actions/new`}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Action
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
            <Zap className="h-6 w-6 text-secondary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Action Management Coming Soon</h3>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              The full action table with sorting, filtering, and inline editing will be available in
              the next phase.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/integrations/${integrationId}/actions`}>
              View All Actions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
