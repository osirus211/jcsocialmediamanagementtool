/**
 * Workspace React Query Hooks
 * 
 * Provides cached queries for workspace data with proper invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Workspace,
  WorkspaceMember,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
} from '@/types/workspace.types';

interface WorkspacesResponse {
  workspaces: Workspace[];
}

interface WorkspaceResponse {
  workspace: Workspace;
}

interface MembersResponse {
  members: WorkspaceMember[];
}

/**
 * Fetch all workspaces for current user
 * Cached for 10 minutes (workspaces don't change often)
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.all,
    queryFn: async () => {
      const response = await apiClient.get<WorkspacesResponse>('/workspaces');
      return response.workspaces;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch workspace members
 * Cached for 5 minutes (members change occasionally)
 */
export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<MembersResponse>(
        `/workspaces/${workspaceId}/members`
      );
      return response.members;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!workspaceId,
  });
}

/**
 * Create workspace mutation
 * Invalidates workspace list on success
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) => {
      const response = await apiClient.post<{ workspace: Workspace }>(
        '/workspaces',
        input
      );
      return response.workspace;
    },
    onSuccess: () => {
      // Invalidate workspace list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}

/**
 * Update workspace mutation
 * Invalidates workspace list and detail on success
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, input }: { workspaceId: string; input: UpdateWorkspaceInput }) => {
      const response = await apiClient.patch<{ workspace: Workspace }>(
        `/workspaces/${workspaceId}`,
        input
      );
      return response.workspace;
    },
    onSuccess: (workspace) => {
      // Invalidate workspace list and specific workspace
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspace._id) });
    },
  });
}

/**
 * Delete workspace mutation
 * Invalidates workspace list on success
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      await apiClient.delete(`/workspaces/${workspaceId}`);
    },
    onSuccess: () => {
      // Invalidate workspace list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}

/**
 * Invite member mutation
 * Invalidates members list on success
 */
export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, input }: { workspaceId: string; input: InviteMemberInput }) => {
      const response = await apiClient.post<{ membership: WorkspaceMember }>(
        `/workspaces/${workspaceId}/members`,
        input
      );
      return response.membership;
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate members list for this workspace
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
    },
  });
}

/**
 * Remove member mutation
 * Invalidates members list on success
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, userId }: { workspaceId: string; userId: string }) => {
      await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`);
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate members list for this workspace
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
    },
  });
}