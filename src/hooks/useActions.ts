/**
 * Action Hooks
 *
 * React Query hooks for fetching and managing actions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/lib/api/client';
import type {
  ListActionsQuery,
  CreateActionInput,
  UpdateActionInput,
} from '@/lib/modules/actions/action.schemas';

// =============================================================================
// Query Keys
// =============================================================================

export const actionKeys = {
  all: ['actions'] as const,
  lists: () => [...actionKeys.all, 'list'] as const,
  list: (integrationId: string, filters?: Partial<ListActionsQuery>) =>
    [...actionKeys.lists(), integrationId, filters] as const,
  details: () => [...actionKeys.all, 'detail'] as const,
  detail: (id: string) => [...actionKeys.details(), id] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch list of actions for an integration
 */
export function useActions(integrationId: string | undefined, params?: Partial<ListActionsQuery>) {
  return useQuery({
    queryKey: actionKeys.list(integrationId!, params),
    queryFn: () => client.actions.list(integrationId!, params),
    enabled: !!integrationId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch a single action by ID
 */
export function useAction(actionId: string | undefined) {
  return useQuery({
    queryKey: actionKeys.detail(actionId!),
    queryFn: () => client.actions.get(actionId!),
    enabled: !!actionId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create a new action
 */
export function useCreateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateActionInput) => client.actions.create(input),
    onSuccess: (data) => {
      // Invalidate actions list for this integration
      queryClient.invalidateQueries({
        queryKey: actionKeys.list(data.integrationId),
      });
      toast.success('Action created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create action', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to update an action
 */
export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateActionInput & { id: string }) =>
      client.actions.update(id, input),
    onSuccess: (data) => {
      // Update the specific action in cache
      queryClient.setQueryData(actionKeys.detail(data.id), data);
      // Invalidate list to refetch
      queryClient.invalidateQueries({
        queryKey: actionKeys.list(data.integrationId),
      });
      toast.success('Action updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update action', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to delete an action
 */
export function useDeleteAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, integrationId }: { id: string; integrationId: string }) =>
      client.actions.delete(id).then(() => integrationId),
    onSuccess: (integrationId, { id }) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: actionKeys.detail(id) });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: actionKeys.list(integrationId),
      });
      toast.success('Action deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete action', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to delete multiple actions
 */
export function useBulkDeleteActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, integrationId }: { ids: string[]; integrationId: string }) => {
      // Delete all actions in parallel
      await Promise.all(ids.map((id) => client.actions.delete(id)));
      return integrationId;
    },
    onSuccess: (integrationId, { ids }) => {
      // Remove all from cache
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: actionKeys.detail(id) });
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: actionKeys.list(integrationId),
      });
      toast.success(`${ids.length} actions deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error('Failed to delete actions', {
        description: error.message,
      });
    },
  });
}
