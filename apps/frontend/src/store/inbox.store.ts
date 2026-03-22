import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';

export interface InboxItem {
  _id: string;
  type: 'mention' | 'comment' | 'notification';
  workspaceId: string;
  platform?: string;
  content: string;
  author?: { username: string; displayName?: string; profileUrl?: string };
  sentiment?: 'positive' | 'negative' | 'neutral';
  keyword?: string;
  sourceUrl?: string;
  readAt?: string;
  createdAt: string;
}

export interface ListeningRule {
  _id: string;
  workspaceId: string;
  platform: string;
  type: 'keyword' | 'hashtag' | 'competitor';
  value: string;
  active: boolean;
  lastCollectedAt?: string;
  createdAt: string;
}

export interface CreateRuleInput {
  platform: string;
  type: 'keyword' | 'hashtag' | 'competitor';
  value: string;
}

interface InboxState {
  items: InboxItem[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  activeFilter: 'all' | 'mention' | 'comment' | 'notification';
  activePlatform: string | null;
  activeSentiment: 'positive' | 'negative' | 'neutral' | null;
  unreadOnly: boolean;

  // Listening rules
  listeningRules: ListeningRule[];
  isLoadingRules: boolean;

  // Stream
  isStreamConnected: boolean;
  streamError: string | null;
}

interface InboxActions {
  fetchInbox: (workspaceId: string, reset?: boolean) => Promise<void>;
  markAllRead: (workspaceId: string) => Promise<void>;
  markItemRead: (workspaceId: string, itemId: string, type: string) => Promise<void>;
  setFilter: (filter: 'all' | 'mention' | 'comment' | 'notification') => void;
  setPlatform: (platform: string | null) => void;
  setSentiment: (sentiment: 'positive' | 'negative' | 'neutral' | null) => void;
  setUnreadOnly: (unreadOnly: boolean) => void;
  fetchListeningRules: (workspaceId: string) => Promise<void>;
  createListeningRule: (workspaceId: string, data: CreateRuleInput) => Promise<void>;
  deleteListeningRule: (workspaceId: string, ruleId: string) => Promise<void>;
  connectStream: (workspaceId: string) => Promise<void>;
  disconnectStream: () => void;
  appendStreamItem: (item: InboxItem) => void;
  startPolling: (workspaceId: string) => void;
  clearInboxData: () => void;
}

interface InboxStore extends InboxState, InboxActions {}

// Module-level EventSource reference
let eventSource: EventSource | null = null;
let pollingInterval: NodeJS.Timeout | null = null;

export const useInboxStore = create<InboxStore>()((set, get) => ({
  // Initial state
  items: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,
  error: null,
  activeFilter: 'all',
  activePlatform: null,
  activeSentiment: null,
  unreadOnly: false,

  listeningRules: [],
  isLoadingRules: false,

  isStreamConnected: false,
  streamError: null,

  // Actions
  fetchInbox: async (workspaceId: string, reset = false) => {
    try {
      set({ isLoading: true, error: null });

      const state = get();
      const params = new URLSearchParams();
      
      if (state.activeFilter !== 'all') {
        params.append('type', state.activeFilter);
      }
      
      if (state.activePlatform) {
        params.append('platform', state.activePlatform);
      }
      
      if (state.activeSentiment) {
        params.append('sentiment', state.activeSentiment);
      }
      
      if (state.unreadOnly) {
        params.append('unreadOnly', 'true');
      }
      
      params.append('limit', '50');
      params.append('offset', reset ? '0' : state.items.length.toString());

      const response = await apiClient.get<{
        success: boolean;
        data: { items: InboxItem[]; unreadCount: number; total: number };
      }>(`/inbox?${params.toString()}`);

      set({
        items: reset ? response.data.items : [...state.items, ...response.data.items],
        unreadCount: response.data.unreadCount,
        total: response.data.total,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch inbox',
        isLoading: false,
      });
      throw error;
    }
  },

  markAllRead: async (workspaceId: string) => {
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: { markedCount: number };
      }>('/inbox/mark-all-read');

      // Update local state
      set((state) => ({
        items: state.items.map((item) => ({
          ...item,
          readAt: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark all as read' });
      throw error;
    }
  },

  markItemRead: async (workspaceId: string, itemId: string, type: string) => {
    try {
      if (type === 'mention') {
        await apiClient.post(`/mentions/${itemId}/mark-read`);
      } else if (type === 'notification') {
        await apiClient.post(`/notifications/${itemId}/mark-read`);
      }

      // Update local state
      set((state) => ({
        items: state.items.map((item) =>
          item._id === itemId ? { ...item, readAt: new Date().toISOString() } : item
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to mark item as read' });
      throw error;
    }
  },

  setFilter: (filter: 'all' | 'mention' | 'comment' | 'notification') => {
    set({ activeFilter: filter });
  },

  setPlatform: (platform: string | null) => {
    set({ activePlatform: platform });
  },

  setSentiment: (sentiment: 'positive' | 'negative' | 'neutral' | null) => {
    set({ activeSentiment: sentiment });
  },

  setUnreadOnly: (unreadOnly: boolean) => {
    set({ unreadOnly });
  },

  fetchListeningRules: async (workspaceId: string) => {
    try {
      set({ isLoadingRules: true });

      const response = await apiClient.get<{
        success: boolean;
        data: ListeningRule[];
      }>('/listening-rules');

      set({
        listeningRules: response.data,
        isLoadingRules: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch listening rules',
        isLoadingRules: false,
      });
      throw error;
    }
  },

  createListeningRule: async (workspaceId: string, data: CreateRuleInput) => {
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: ListeningRule;
      }>('/listening-rules', data);

      set((state) => ({
        listeningRules: [...state.listeningRules, response.data],
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to create listening rule' });
      throw error;
    }
  },

  deleteListeningRule: async (workspaceId: string, ruleId: string) => {
    try {
      await apiClient.delete(`/listening-rules/${ruleId}`);

      set((state) => ({
        listeningRules: state.listeningRules.filter((rule) => rule._id !== ruleId),
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete listening rule' });
      throw error;
    }
  },

  connectStream: async (workspaceId: string) => {
    try {
      // Get stream token
      const response = await apiClient.get<{
        success: boolean;
        data: { token: string; expiresAt: string };
      }>('/inbox/stream-token');

      const { token } = response.data;

      // Try EventSource (SSE) first
      if (typeof EventSource !== 'undefined') {
        eventSource = new EventSource(`/api/v1/inbox/stream?token=${token}`);

        eventSource.onopen = () => {
          set({ isStreamConnected: true, streamError: null });
        };

        eventSource.onmessage = (event) => {
          try {
            const item = JSON.parse(event.data) as InboxItem;
            get().appendStreamItem(item);
          } catch (error) {
            console.error('Failed to parse stream message:', error);
          }
        };

        eventSource.onerror = () => {
          set({ isStreamConnected: false, streamError: 'Stream connection error' });
          eventSource?.close();
          eventSource = null;
          
          // Fallback to polling
          get().startPolling(workspaceId);
        };
      } else {
        // Fallback to polling
        get().startPolling(workspaceId);
      }
    } catch (error: any) {
      set({ streamError: error.message || 'Failed to connect stream' });
      // Fallback to polling
      get().startPolling(workspaceId);
    }
  },

  startPolling: (workspaceId: string) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    pollingInterval = setInterval(() => {
      get().fetchInbox(workspaceId, true);
    }, 30000); // Poll every 30 seconds

    set({ isStreamConnected: true, streamError: null });
  },

  disconnectStream: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    set({ isStreamConnected: false });
  },

  appendStreamItem: (item: InboxItem) => {
    set((state) => ({
      items: [item, ...state.items],
      unreadCount: !item.readAt ? state.unreadCount + 1 : state.unreadCount,
      total: state.total + 1,
    }));
  },

  clearInboxData: () => {
    get().disconnectStream();
    set({
      items: [],
      unreadCount: 0,
      total: 0,
      error: null,
      listeningRules: [],
    });
  },
}));
