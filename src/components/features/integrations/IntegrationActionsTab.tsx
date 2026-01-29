'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Sparkles } from 'lucide-react';
import { ActionTable } from '@/components/features/actions/ActionTable';
import type { IntegrationResponse } from '@/lib/modules/integrations/integration.schemas';

interface IntegrationActionsTabProps {
  integrationId: string;
  integration?: IntegrationResponse;
}

export function IntegrationActionsTab({ integrationId, integration }: IntegrationActionsTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage the API actions available for this integration</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/integrations/${integrationId}/actions/new`}>
              <Sparkles className="mr-2 h-4 w-4" />
              Discover More
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/integrations/${integrationId}/actions/new/manual`}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Action
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ActionTable integrationId={integrationId} integration={integration} />
      </CardContent>
    </Card>
  );
}
