/**
 * Scrape Job Hooks
 *
 * React Query hooks for starting and polling scrape jobs.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/api/client';
import type { CreateScrapeJobInput, ScrapeJobResponse } from '@/lib/modules/ai/scrape-job.schemas';

/**
 * Hook to start a new scrape job
 */
export function useScrapeJob() {
  const mutation = useMutation({
    mutationFn: (input: CreateScrapeJobInput) => client.scrape.create(input),
    onError: (error: Error) => {
      toast.error('Failed to start scraping', {
        description: error.message,
      });
    },
  });

  return {
    startScraping: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

/**
 * Hook to poll scrape job status
 */
export function useScrapeJobStatus(
  jobId: string | null,
  options?: {
    enabled?: boolean;
    onSuccess?: (data: ScrapeJobResponse) => void;
    onError?: (error: Error) => void;
  }
) {
  return useQuery({
    queryKey: ['scrape-job', jobId],
    queryFn: () => {
      if (!jobId) throw new Error('Job ID is required');
      return client.scrape.getStatus(jobId);
    },
    enabled: !!jobId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      // Stop polling if job is complete or failed
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return false;
      }
      // Poll every 2 seconds while in progress
      return 2000;
    },
    refetchIntervalInBackground: true,
  });
}

/**
 * Utility type for scrape job mutation
 */
export type ScrapeJobMutation = ReturnType<typeof useScrapeJob>;
