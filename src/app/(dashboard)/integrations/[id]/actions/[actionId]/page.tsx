'use client';

import { useParams } from 'next/navigation';
import { ActionEditor } from '@/components/features/actions/ActionEditor';

export default function EditActionPage() {
  const params = useParams();
  const integrationId = params.id as string;
  const actionId = params.actionId as string;

  return <ActionEditor integrationId={integrationId} actionId={actionId} />;
}
