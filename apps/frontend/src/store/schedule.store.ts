import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import {
  QueuedPost,
  QueueStats,
  QueuePauseStatus,
  ShuffleQueueRequest,
  PauseQueueRequest,
  ResumeQueueRequest,
} from '@/services/queue.service';

interface Post {
  _id: string;
  workspaceId: string;
  content: string;
  platform: string;
  socialAccountId: string;
  scheduledAt: string;
  status: string;
  mediaIds: string[];
  createdAt: string;
}

interface ScheduleState {
  // Queue
  queuedPosts: QueuedPost[];
  queueStats: QueueStats | null;
  isQueueLoading: boolean;
  queueError: string | null;
  isPaused: boolean;
  pauseStatus: QueuePauseStatus | null;

  // Calendar
  calendarPosts: Post[];
  calendarView: 'month' | 'week' | 'list';
  calendarMonth: Date;
  isCalendarLoading: boolean;
  calendarError: string | null;
  activeFilters: {
    platforms: string[];
    accountIds: string[];
  };
}

interface ScheduleActions {
  // Queue actions
  fetchQueue: (workspaceId: string, platform?: string) => Promise<void>;
  reorderQueue: (workspaceId: string, postId: string, newPosition: number) => Promise<void>;
  shuffleQueue: (workspaceId: string, options?: ShuffleQueueRequest) => Promise<void>;
  pauseQueue: (workspaceId: string, options?: PauseQueueRequest) => Promise<void>;
  resumeQueue: (workspaceId: string, accountId?: string) => Promise<void>;
  removeFromQueue: (workspaceId: string, postId: string) => Promise<void>;
  
  // Calendar actions
  fetchCalendarPosts: (workspaceId: string, start: Date, end: Date) => Promise<void>;
  reschedulePost: (workspaceId: string, postId: string, newDate: Date) => Promise<void>;
  setCalendarView: (view: 'month' | 'week' | 'list') => void;
  setCalendarMonth: (month: Date) => void;
  setActiveFilters: (filters: { platforms: string[]; accountIds: string[] }) => void;
  
  // Utility actions
  clearScheduleData: () => void;
}

interface ScheduleStore extends ScheduleState, ScheduleActions {}

export const useScheduleStore = create<ScheduleStore>()((set, get) => ({
  // Initial state
  queuedPosts: [],
  queueStats: null,
  isQueueLoading: false,
  queueError: null,
  isPaused: false,
  pauseStatus: null,
  
  calendarPosts: [],
  calendarView: 'month',
  calendarMonth: new Date(),
  isCalendarLoading: false,
  calendarError: null,
  activeFilters: {
    platforms: [],
    accountIds: [],
  },

  // Queue actions
  fetchQueue: async (workspaceId: string, platform?: string) => {
    try {
      set({ isQueueLoading: true, queueError: null });

      const params = new URLSearchParams();
      if (platform) params.append('platform', platform);
      params.append('limit', '100');
      params.append('offset', '0');

      const response = await apiClient.get<{ success: boolean; data: { posts: QueuedPost[]; stats: QueueStats } }>(
        `/queue?${params.toString()}`
      );

      set({
        queuedPosts: response.data.posts,
        queueStats: response.data.stats,
        isQueueLoading: false,
      });
    } catch (error: any) {
      set({
        queueError: error.message || 'Failed to fetch queue',
        isQueueLoading: false,
      });
      throw error;
    }
  },

  reorderQueue: async (workspaceId: string, postId: string, newPosition: number) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
        '/queue/reorder',
        { postId, newPosition }
      );

      set({ queuedPosts: response.data });
    } catch (error: any) {
      set({ queueError: error.message || 'Failed to reorder queue' });
      throw error;
    }
  },

  shuffleQueue: async (workspaceId: string, options?: ShuffleQueueRequest) => {
    try {
      set({ isQueueLoading: true });

      const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
        '/queue/shuffle',
        options || {}
      );

      set({
        queuedPosts: response.data,
        isQueueLoading: false,
      });
    } catch (error: any) {
      set({
        queueError: error.message || 'Failed to shuffle queue',
        isQueueLoading: false,
      });
      throw error;
    }
  },

  pauseQueue: async (workspaceId: string, options?: PauseQueueRequest) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: QueuePauseStatus }>(
        '/queue/pause',
        options || {}
      );

      set({
        isPaused: response.data.isPaused,
        pauseStatus: response.data,
      });
    } catch (error: any) {
      set({ queueError: error.message || 'Failed to pause queue' });
      throw error;
    }
  },

  resumeQueue: async (workspaceId: string, accountId?: string) => {
    try {
      const response = await apiClient.post<{ success: boolean; data: QueuePauseStatus }>(
        '/queue/resume',
        { accountId }
      );

      set({
        isPaused: response.data.isPaused,
        pauseStatus: response.data,
      });
    } catch (error: any) {
      set({ queueError: error.message || 'Failed to resume queue' });
      throw error;
    }
  },

  removeFromQueue: async (workspaceId: string, postId: string) => {
    try {
      await apiClient.post('/queue/remove', { postId });

      set((state) => ({
        queuedPosts: state.queuedPosts.filter((p) => p.id !== postId),
      }));
    } catch (error: any) {
      set({ queueError: error.message || 'Failed to remove from queue' });
      throw error;
    }
  },

  // Calendar actions
  fetchCalendarPosts: async (workspaceId: string, start: Date, end: Date) => {
    try {
      set({ isCalendarLoading: true, calendarError: null });

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      params.append('status', 'scheduled');

      const response = await apiClient.get<{ posts: Post[] }>(
        `/posts?${params.toString()}`
      );

      set({
        calendarPosts: response.posts,
        isCalendarLoading: false,
      });
    } catch (error: any) {
      set({
        calendarError: error.message || 'Failed to fetch calendar posts',
        isCalendarLoading: false,
      });
      throw error;
    }
  },

  reschedulePost: async (workspaceId: string, postId: string, newDate: Date) => {
    try {
      await apiClient.patch(`/posts/${postId}`, {
        scheduledAt: newDate.toISOString(),
      });

      // Update post in calendar
      set((state) => ({
        calendarPosts: state.calendarPosts.map((p) =>
          p._id === postId ? { ...p, scheduledAt: newDate.toISOString() } : p
        ),
      }));
    } catch (error: any) {
      set({ calendarError: error.message || 'Failed to reschedule post' });
      throw error;
    }
  },

  setCalendarView: (view: 'month' | 'week' | 'list') => {
    set({ calendarView: view });
  },

  setCalendarMonth: (month: Date) => {
    set({ calendarMonth: month });
  },

  setActiveFilters: (filters: { platforms: string[]; accountIds: string[] }) => {
    set({ activeFilters: filters });
  },

  clearScheduleData: () => {
    set({
      queuedPosts: [],
      queueStats: null,
      queueError: null,
      calendarPosts: [],
      calendarError: null,
    });
  },
}));
