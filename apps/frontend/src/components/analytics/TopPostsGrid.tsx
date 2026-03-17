import { useState } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

interface TopPost {
  postId: string;
  platform: string;
  thumbnail?: string;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  engagementRate: number;
}

interface TopPostsGridProps {
  data: TopPost[];
  isLoading?: boolean;
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

type SortField = 'engagementRate' | 'reach' | 'likes' | 'comments' | 'shares';
type SortDirection = 'asc' | 'desc';

export function TopPostsGrid({ data, isLoading = false }: TopPostsGridProps) {
  const [sortField, setSortField] = useState<SortField>('engagementRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const multiplier = sortDirection === 'desc' ? -1 : 1;
    return (aValue - bValue) * multiplier;
  });

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'desc' 
      ? <TrendingDown className="h-4 w-4 text-blue-600" />
      : <TrendingUp className="h-4 w-4 text-blue-600" />;
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
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No top posts yet</h3>
        <p className="text-gray-600">
          Your best performing posts will appear here once you start publishing content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 mr-2">Sort by:</span>
        {[
          { field: 'engagementRate' as SortField, label: 'Engagement Rate' },
          { field: 'reach' as SortField, label: 'Reach' },
          { field: 'likes' as SortField, label: 'Likes' },
          { field: 'comments' as SortField, label: 'Comments' },
          { field: 'shares' as SortField, label: 'Shares' },
        ].map(({ field, label }) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              sortField === field
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {label}
            {getSortIcon(field)}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedData.map((post, index) => (
          <div
            key={post.postId}
            className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Platform Badge */}
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${PLATFORM_COLORS[post.platform] || 'bg-gray-500 text-white'}`}>
                  {PLATFORM_ICONS[post.platform] || '📱'}
                </div>
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {post.platform}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                #{index + 1}
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
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {formatDate(post.publishedAt)}
                </span>
                <button
                  onClick={() => window.open(`#/post/${post.postId}`, '_blank')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="View original post"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Engagement Rate</div>
                  <div className="font-semibold text-green-600">
                    {post.engagementRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Reach</div>
                  <div className="font-semibold">
                    {formatNumber(post.reach)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Likes</div>
                  <div className="font-semibold text-red-500">
                    {formatNumber(post.likes)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Comments</div>
                  <div className="font-semibold text-blue-500">
                    {formatNumber(post.comments)}
                  </div>
                </div>
              </div>

              {(post.shares > 0 || post.saves > 0) && (
                <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                  <div>
                    <div className="text-gray-500">Shares</div>
                    <div className="font-semibold text-purple-500">
                      {formatNumber(post.shares)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Saves</div>
                    <div className="font-semibold text-orange-500">
                      {formatNumber(post.saves)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Screen reader accessible data table */}
      <div className="sr-only">
        <table>
          <caption>Top performing posts data</caption>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Published Date</th>
              <th>Engagement Rate</th>
              <th>Reach</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Saves</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((post) => (
              <tr key={post.postId}>
                <td>{post.platform}</td>
                <td>{post.publishedAt}</td>
                <td>{post.engagementRate}%</td>
                <td>{post.reach}</td>
                <td>{post.likes}</td>
                <td>{post.comments}</td>
                <td>{post.shares}</td>
                <td>{post.saves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}