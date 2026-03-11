/**
 * Social Account React Query Hooks
 * 
 * Provides cached queries for social account data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { SocialAccount, ConnectAccountInput } from '@/types/social.types';

interface SocialAccountsResponse {
  accounts: SocialAccount[];
}

interface SocialAccountResponse {
  account: SocialAccount;
}

/**
 * Fetch all social accounts for workspace
 * Cached for 15 minutes (social accounts rarely change)
 */
export function useSocialAccounts(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.socialAccounts.all(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<SocialAccountsResponse>('/social/accounts');
      return response.accounts;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!workspaceId,
  });
}

/**
 * Connect social account mutation
 * Invalidates social accounts list on success
 */
export function useConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConnectAccountInput) => {
      const response = await apiClient.post<SocialAccountResponse>(
        '/social/accounts',
        input
      );
      return response.account;
    },
    onSuccess: (newAccount) => {
      // Invalidate social accounts for the workspace
      if (newAccount.workspaceId) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.socialAccounts.all(newAccount.workspaceId) 
        });
      }
    },
  });
}

/**
 * Disconnect social account mutation
 * Invalidates social accounts list on success
 */
export function useDisconnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, workspaceId }: { accountId: string; workspaceId: string }) => {
      await apiClient.delete(`/social/accounts/${accountId}`);
      return { accountId, workspaceId };
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate social accounts for the workspace
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.socialAccounts.all(workspaceId) 
      });
    },
  });
}

/**
 * Sync social account mutation
 * Invalidates social accounts list on success
 */
export function useSyncAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, workspaceId }: { accountId: string; workspaceId: string }) => {
      const response = await apiClient.post<SocialAccountResponse>(
        `/social/accounts/${accountId}/sync`,
        {}
      );
      return response.account;
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate social accounts for the workspace
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.socialAccounts.all(workspaceId) 
      });
    },
  });
}