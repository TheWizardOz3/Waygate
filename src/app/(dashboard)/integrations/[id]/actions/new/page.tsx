'use client';

import { useParams } from 'next/navigation';
import { AddActionWizard } from '@/components/features/actions/AddActionWizard';

export default function NewActionPage() {
  const params = useParams();
  const integrationId = params.id as string;

  return <AddActionWizard integrationId={integrationId} />;
}
