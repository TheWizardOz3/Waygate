'use client';

import { useParams } from 'next/navigation';
import { ActionTester } from '@/components/features/actions/ActionTester';

export default function ActionTestPage() {
  const params = useParams();
  const integrationId = params.id as string;
  const actionId = params.actionId as string;

  return <ActionTester integrationId={integrationId} actionId={actionId} />;
}
