import { useState } from 'react';
import { AlertTriangle, TrendingDown, Lightbulb } from 'lucide-react';

interface WorstPost {
  postId: string;
  platform: string;
  thumbnail?: string;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  performanceScore: number;
  content?: string;
  suggestion: string;
}

interface WorstPostsGridProps {
  data: WorstPost[];
  isLoading?: boolean;
  onPostClick?: (postId: string) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  facebook: '📘',
  instagram: '📷',
  linkedin: '💼',
  tiktok: '🎵',
  threads: '@',
  bluesky: '🦋',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-black text-white',
  facebook: 'bg-blue-600 text-white',
  instagram: 'bg-gradient-to-br from-purple-600 to-pink-500 text-white',
  linkedin: 'bg-blue-700 text-white',
  tiktok: 'bg-black text-white',
  threads: 'bg-black text-white',
  bluesky: 'bg-blue-500 text-white',
};

export function WorstPostsGrid({ data, isLoading = false, onPostClick }: WorstPostsGridProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const handlePostClick = (postId: string) => {
    if (onPostClick) {
      onPostClick(postId);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-gray-200 rounded"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-full h-32 bg-gray-200 rounded mb-3"></div>
            <div className="space-y-2">
              <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
              <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🎉</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">All your posts are performing well</h3>
        <p className="text-gray-600">
          No posts are scoring below 40. Keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="worst-posts-section">
        {data.map((post, index) => (
          <div
            key={post.postId}
            className="bg-white border border-red-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handlePostClick(post.postId)}
          >
            {/* Header with platform and warning */}
            <div className="flex items-center justify-between p-4 pb-2 bg-red-50">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${PLATFORM_COLORS[post.platform] || 'bg-gray-500 text-white'}`}>
                  {PLATFORM_ICONS[post.platform] || '📱'}
                </div>
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {post.platform}
                </span>
              </div>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>

            {/* Performance Score */}
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Performance Score</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={post.performanceScore}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Performance score: ${post.performanceScore} out of 100`}
                  >
                    <div 
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${post.performanceScore}%` }}
                    />
                  </div>
                  <span 
                    className="text-sm font-semibold text-red-600"
                  >
                    {post.performanceScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="px-4 pb-3">
              {post.thumbnail ? (
                <img
                  src={post.thumbnail}
                  alt="Post thumbnail"
                  className="w-full h-32 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No preview</span>
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {formatDate(post.publishedAt)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Engagement Rate</div>
                  <div className="font-semibold text-red-600">
                    {post.engagementRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Audience Reached</div>
                  <div className="font-semibold">
                    {post.reach > 0 ? formatNumber(post.reach) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Likes</div>
                  <div className="font-semibold">
                    {formatNumber(post.likes)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Comments</div>
                  <div className="font-semibold">
                    {formatNumber(post.comments)}
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestion */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-amber-700 mb-1">Suggestion</div>
                  <div className="text-xs text-gray-600">{post.suggestion}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Screen reader accessible data table */}
      <div className="sr-only">
        <table>
          <caption>Worst performing posts data</caption>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Published Date</th>
              <th>Performance Score</th>
              <th>Engagement Rate</th>
              <th>Audience Reached</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Suggestion</th>
            </tr>
          </thead>
          <tbody>
            {data.map((post) => (
              <tr key={post.postId}>
                <td>{post.platform}</td>
                <td>{post.publishedAt}</td>
                <td>{post.performanceScore}</td>
                <td>{post.engagementRate}%</td>
                <td>{post.reach}</td>
                <td>{post.likes}</td>
                <td>{post.comments}</td>
                <td>{post.suggestion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}