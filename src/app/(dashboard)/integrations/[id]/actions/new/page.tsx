'use client';

import { useParams } from 'next/navigation';
import { ActionEditor } from '@/components/features/actions/ActionEditor';

export default function NewActionPage() {
  const params = useParams();
  const integrationId = params.id as string;

  return <ActionEditor integrationId={integrationId} />;
}
