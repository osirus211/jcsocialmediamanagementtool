import { useState, useEffect } from 'react';
import { analyticsService, TopPerformingPost } from '@/services/analytics.service';
import { PostPerformanceCard } from './PostPerformanceCard';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

type SortBy = 'engagement' | 'ctr' | 'roi';
type DateRange = '7d' | '30d' | '90d';

export function TopPostsTable() {
  const { currentWorkspace } = useWorkspaceStore();
  const [posts, setPosts] = useState<TopPerformingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('engagement');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        const data = await analyticsService.getTopPerformingPosts(sortBy, 20, startDate, endDate);
        setPosts(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load top posts';
        logger.error('Top posts fetch error:', { error: err });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentWorkspace, sortBy, dateRange]);

  const handleRowClick = (postId: string) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  const handlePostUpdate = () => {
    // Refresh the data when a post is updated
    if (currentWorkspace) {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      analyticsService.getTopPerformingPosts(sortBy, 20, startDate, endDate)
        .then(setPosts)
        .catch(err => logger.error('Failed to refresh posts:', { error: err }));
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: '🐦',
      facebook: '📘',
      instagram: '📷',
      linkedin: '💼',
      tiktok: '🎵',
      threads: '@',
      bluesky: '🦋',
    };
    return icons[platform] || '📱';
  };

  const getROIColor = (roi?: number) => {
    if (roi === undefined) return 'text-gray-500';
    if (roi > 0) return 'text-green-600';
    return 'text-red-600';
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Posts</h3>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">⚠️ Error loading data</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Top Performing Posts</h3>
        
        <div className="flex items-center gap-4">
          {/* Date Range Filter */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sort Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setSortBy('engagement')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            sortBy === 'engagement'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          By Engagement
        </button>
        <button
          onClick={() => setSortBy('ctr')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            sortBy === 'ctr'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          By CTR
        </button>
        <button
          onClick={() => setSortBy('roi')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            sortBy === 'roi'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          By ROI
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex space-x-4 p-4 border rounded-lg">
              <div className="h-4 bg-gray-200 rounded w-8"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4 text-4xl">📊</div>
          <div className="text-gray-600 text-lg mb-2">No posts found</div>
          <div className="text-sm text-gray-500">
            Publish some posts and wait for analytics data to see performance metrics
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.postId}>
              <div
                onClick={() => handleRowClick(post.postId)}
                className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-xl">{getPlatformIcon(post.platform)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {post.content.length > 80 ? `${post.content.substring(0, 80)}...` : post.content}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(post.publishedAt).toLocaleDateString()} • {post.platform}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {post.impressions.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Impressions</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">
                      {post.clickThroughRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">CTR</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">
                      {post.engagementRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Engagement</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold ${getROIColor(post.roi)}`}>
                      {post.roi !== undefined ? `${post.roi.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">ROI</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      {post.linkClicks.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Link Clicks</div>
                  </div>
                </div>

                <div className="ml-4 text-gray-400">
                  {expandedPostId === post.postId ? '−' : '+'}
                </div>
              </div>

              {/* Expanded Post Performance Card */}
              {expandedPostId === post.postId && (
                <div className="mt-2 ml-4 mr-4">
                  <PostPerformanceCard
                    postId={post.postId}
                    onUpdate={handlePostUpdate}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}