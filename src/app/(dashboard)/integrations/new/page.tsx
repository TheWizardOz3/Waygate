import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const CreateIntegrationWizard = dynamic(
  () =>
    import('@/components/features/integrations/wizard/CreateIntegrationWizard').then(
      (mod) => mod.CreateIntegrationWizard
    ),
  {
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="mt-8 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    ),
  }
);

export default function NewIntegrationPage() {
  return (
    <div className="py-4">
      <CreateIntegrationWizard />
    </div>
  );
}
