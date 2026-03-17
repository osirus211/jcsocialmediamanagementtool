import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import {
  OverviewMetrics,
  PlatformMetrics,
  GrowthMetrics,
  PostAnalytics,
  AnalyticsResponse,
} from '@/types/analytics.types';

interface AnalyticsState {
  overview: OverviewMetrics | null;
  platformMetrics: PlatformMetrics[];
  growthMetrics: GrowthMetrics[];
  postAnalytics: Record<string, PostAnalytics[]>;
  isLoading: boolean;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
    preset: string | null;
  };
}

interface AnalyticsActions {
  setLoading: (loading: boolean) => void;
  setDateRange: (startDate: string | null, endDate: string | null, preset?: string | null) => void;
  
  fetchOverview: (startDate?: string, endDate?: string) => Promise<void>;
  fetchPlatformMetrics: (startDate?: string, endDate?: string) => Promise<void>;
  fetchGrowthMetrics: (startDate: string, endDate: string, interval?: string) => Promise<void>;
  fetchPostAnalytics: (postId: string) => Promise<void>;
  generateMockAnalytics: (postId: string, platform: string) => Promise<void>;
  
  clearAnalytics: () => void;
}

interface AnalyticsStore extends AnalyticsState, AnalyticsActions {}

/**
 * Analytics store
 * Manages analytics and engagement tracking data
 */
export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  // Initial state
  overview: null,
  platformMetrics: [],
  growthMetrics: [],
  postAnalytics: {},
  isLoading: false,
  dateRange: {
    startDate: null,
    endDate: null,
    preset: null,
  },

  // Setters
  setLoading: (loading) => set({ isLoading: loading }),
  
  setDateRange: (startDate, endDate, preset = null) => set({ dateRange: { startDate, endDate, preset } }),

  /**
   * Fetch overview metrics
   */
  fetchOverview: async (startDate?: string, endDate?: string) => {
    try {
      set({ isLoading: true });

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiClient.get<AnalyticsResponse<OverviewMetrics>>(
        `/analytics/overview?${params.toString()}`
      );

      set({ overview: response.data, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Fetch overview error:', error);
      throw error;
    }
  },

  /**
   * Fetch platform metrics
   */
  fetchPlatformMetrics: async (startDate?: string, endDate?: string) => {
    try {
      set({ isLoading: true });

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiClient.get<AnalyticsResponse<PlatformMetrics[]>>(
        `/analytics/platform?${params.toString()}`
      );

      set({ platformMetrics: response.data, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Fetch platform metrics error:', error);
      throw error;
    }
  },

  /**
   * Fetch growth metrics
   */
  fetchGrowthMetrics: async (startDate: string, endDate: string, interval: string = 'day') => {
    try {
      set({ isLoading: true });

      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      params.append('interval', interval);

      const response = await apiClient.get<AnalyticsResponse<GrowthMetrics[]>>(
        `/analytics/growth?${params.toString()}`
      );

      set({ growthMetrics: response.data, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Fetch growth metrics error:', error);
      throw error;
    }
  },

  /**
   * Fetch analytics for specific post
   */
  fetchPostAnalytics: async (postId: string) => {
    try {
      set({ isLoading: true });

      const response = await apiClient.get<AnalyticsResponse<PostAnalytics[]>>(
        `/analytics/post/${postId}`
      );

      set((state) => ({
        postAnalytics: {
          ...state.postAnalytics,
          [postId]: response.data,
        },
        isLoading: false,
      }));
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Fetch post analytics error:', error);
      throw error;
    }
  },

  /**
   * Generate mock analytics for a post
   */
  generateMockAnalytics: async (postId: string, platform: string) => {
    try {
      set({ isLoading: true });

      await apiClient.post(`/analytics/mock/${postId}`, { platform });

      // Refresh post analytics
      await get().fetchPostAnalytics(postId);

      set({ isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Generate mock analytics error:', error);
      throw error;
    }
  },

  /**
   * Clear all analytics (on workspace switch)
   */
  clearAnalytics: () => {
    set({
      overview: null,
      platformMetrics: [],
      growthMetrics: [],
      postAnalytics: {},
      isLoading: false,
      dateRange: {
        startDate: null,
        endDate: null,
        preset: null,
      },
    });
  },
}));
