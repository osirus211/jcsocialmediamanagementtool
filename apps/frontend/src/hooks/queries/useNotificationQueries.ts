/**
 * Notification React Query Hooks
 * 
 * Provides cached queries for notification data with frequent updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

interface UnreadCountResponse {
  count: number;
}

/**
 * Fetch notifications for workspace
 * Cached for 30 seconds with auto-refetch (notifications need to be fresh)
 */
export function useNotifications(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.notifications.all(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<NotificationsResponse>(
        `/notifications?workspaceId=${workspaceId}`
      );
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    enabled: !!workspaceId,
  });
}

/**
 * Fetch unread notification count
 * Cached for 30 seconds with frequent auto-refetch
 */
export function useUnreadCount(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.notifications.unread(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get<UnreadCountResponse>(
        `/notifications/unread-count?workspaceId=${workspaceId}`
      );
      return response.count;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    enabled: !!workspaceId,
  });
}

/**
 * Mark notification as read mutation
 * Invalidates notifications and unread count on success
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, workspaceId }: { notificationId: string; workspaceId: string }) => {
      await apiClient.patch(`/notifications/${notificationId}/read`);
      return { notificationId, workspaceId };
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate notifications and unread count
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all(workspaceId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.unread(workspaceId) 
      });
    },
  });
}

/**
 * Mark all notifications as read mutation
 * Invalidates notifications and unread count on success
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      await apiClient.patch(`/notifications/mark-all-read?workspaceId=${workspaceId}`);
      return workspaceId;
    },
    onSuccess: (workspaceId) => {
      // Invalidate notifications and unread count
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all(workspaceId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.unread(workspaceId) 
      });
    },
  });
}