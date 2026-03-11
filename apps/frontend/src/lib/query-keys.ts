/**
 * Centralized Query Keys Factory
 * 
 * Provides type-safe query keys for React Query caching
 * All query keys should be defined here to ensure consistency
 */

export const queryKeys = {
  workspaces: {
    all: ['workspaces'] as const,
    detail: (id: string) => ['workspaces', id] as const,
    members: (id: string) => ['workspaces', id, 'members'] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: (filters: Record<string, unknown>) => ['posts', 'list', filters] as const,
    detail: (id: string) => ['posts', id] as const,
    stats: (workspaceId: string) => ['posts', 'stats', workspaceId] as const,
    calendar: (workspaceId: string, start: string, end: string) => ['posts', 'calendar', workspaceId, start, end] as const,
  },
  analytics: {
    engagement: (workspaceId: string, period: string) => ['analytics', 'engagement', workspaceId, period] as const,
    followerGrowth: (workspaceId: string, platform: string) => ['analytics', 'follower-growth', workspaceId, platform] as const,
    hashtags: (workspaceId: string) => ['analytics', 'hashtags', workspaceId] as const,
    bestTimes: (workspaceId: string) => ['analytics', 'best-times', workspaceId] as const,
  },
  socialAccounts: {
    all: (workspaceId: string) => ['social-accounts', workspaceId] as const,
  },
  notifications: {
    all: (workspaceId: string) => ['notifications', workspaceId] as const,
    unread: (workspaceId: string) => ['notifications', workspaceId, 'unread'] as const,
  },
  campaigns: {
    all: (workspaceId: string) => ['campaigns', workspaceId] as const,
    detail: (id: string) => ['campaigns', id] as const,
  },
  categories: {
    all: (workspaceId: string) => ['categories', workspaceId] as const,
  },
  rssFeeds: {
    all: (workspaceId: string) => ['rss-feeds', workspaceId] as const,
    items: (feedId: string) => ['rss-feeds', feedId, 'items'] as const,
  },
  templates: {
    all: (workspaceId: string) => ['templates', workspaceId] as const,
  },
  media: {
    all: (workspaceId: string) => ['media', workspaceId] as const,
    folders: (workspaceId: string) => ['media', workspaceId, 'folders'] as const,
  },
  approvals: {
    queue: (workspaceId: string) => ['approvals', workspaceId] as const,
    count: (workspaceId: string) => ['approvals', workspaceId, 'count'] as const,
  },
  activity: {
    feed: (workspaceId: string) => ['activity', workspaceId] as const,
  },
};