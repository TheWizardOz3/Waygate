'use client';

import { useParams } from 'next/navigation';
import { IntegrationDetail } from '@/components/features/integrations/IntegrationDetail';

export default function IntegrationDetailPage() {
  const params = useParams();
  const integrationId = params.id as string;

  return <IntegrationDetail integrationId={integrationId} />;
}
