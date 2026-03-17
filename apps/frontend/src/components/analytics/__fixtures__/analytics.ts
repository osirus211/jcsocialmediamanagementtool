/**
 * Mock analytics data fixtures matching actual API response shapes
 */

export const mockSummaryMetrics = {
  reach: {
    current: 15420,
    previous: 12350,
    percentageChange: 24.9
  },
  engagement: {
    current: 1240,
    previous: 980,
    percentageChange: 26.5
  },
  followerGrowth: {
    current: 150,
    previous: 120,
    percentageChange: 25.0
  },
  postsPublished: {
    current: 12,
    previous: 8,
    percentageChange: 50.0
  }
};

export const mockFollowerGrowthData = [
  { date: '2024-01-01', platform: 'twitter', followerCount: 1200 },
  { date: '2024-01-01', platform: 'instagram', followerCount: 2500 },
  { date: '2024-01-02', platform: 'twitter', followerCount: 1205 },
  { date: '2024-01-02', platform: 'instagram', followerCount: 2510 },
];

export const mockEngagementDataByDay = [
  {
    date: '2024-01-01',
    platforms: [
      { platform: 'twitter', likes: 45, comments: 12, shares: 8, saves: 3, total: 68 },
      { platform: 'instagram', likes: 120, comments: 25, shares: 15, saves: 10, total: 170 }
    ],
    likes: 165,
    comments: 37,
    shares: 23,
    saves: 13,
    total: 238
  },
  {
    date: '2024-01-02',
    platforms: [
      { platform: 'twitter', likes: 52, comments: 15, shares: 10, saves: 4, total: 81 },
      { platform: 'instagram', likes: 135, comments: 30, shares: 18, saves: 12, total: 195 }
    ],
    likes: 187,
    comments: 45,
    shares: 28,
    saves: 16,
    total: 276
  }
];

export const mockEngagementDataByPlatform = [
  { platform: 'instagram', likes: 255, comments: 55, shares: 33, saves: 22, total: 365 },
  { platform: 'twitter', likes: 97, comments: 27, shares: 18, saves: 7, total: 149 }
];

export const mockTopPostsData = [
  {
    postId: '507f1f77bcf86cd799439011',
    platform: 'instagram',
    thumbnail: 'https://example.com/thumb1.jpg',
    publishedAt: '2024-01-01T10:00:00Z',
    likes: 120,
    comments: 25,
    shares: 15,
    saves: 10,
    reach: 2500,
    engagementRate: 6.8
  },
  {
    postId: '507f1f77bcf86cd799439012',
    platform: 'twitter',
    thumbnail: null,
    publishedAt: '2024-01-02T14:30:00Z',
    likes: 45,
    comments: 12,
    shares: 8,
    saves: 3,
    reach: 1200,
    engagementRate: 5.7
  }
];

export const mockPlatformComparisonData = [
  {
    platform: 'instagram',
    followers: 2500,
    followerGrowth: 50,
    posts: 8,
    reach: 15420,
    engagement: 850,
    engagementRate: 5.5,
    bestPostingHour: 14,
    lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
  },
  {
    platform: 'twitter',
    followers: 1200,
    followerGrowth: 25,
    posts: 4,
    reach: 6800,
    engagement: 390,
    engagementRate: 5.7,
    bestPostingHour: 16,
    lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  },
  {
    platform: 'facebook',
    followers: 800,
    followerGrowth: -10,
    posts: 2,
    reach: 3200,
    engagement: 180,
    engagementRate: 5.6,
    bestPostingHour: 12,
    lastSyncedAt: null // Never synced
  }
];

export const mockAnalyticsData = {
  summary: mockSummaryMetrics,
  followerGrowth: mockFollowerGrowthData,
  engagementByDay: mockEngagementDataByDay,
  engagementByPlatform: mockEngagementDataByPlatform,
  topPosts: mockTopPostsData,
  platformComparison: mockPlatformComparisonData
};