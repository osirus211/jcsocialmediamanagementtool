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
  clicks: number;
  engagements: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  performanceScore: number;
  content?: string;
}

interface TopPostsGridProps {
  data: TopPost[];
  isLoading?: boolean;
  showRanking?: boolean;
  onPostClick?: (postId: string) => void;
  onPostSelect?: (postId: string, selected: boolean) => void;
  selectedPosts?: string[];
  maxSelectable?: number;
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

type SortField = 'engagementRate' | 'reach' | 'impressions' | 'clicks' | 'engagements' | 'likes' | 'comments' | 'shares' | 'saves' | 'performanceScore';
type SortDirection = 'asc' | 'desc';

export function TopPostsGrid({ 
  data, 
  isLoading = false, 
  showRanking = true,
  onPostClick,
  onPostSelect,
  selectedPosts = [],
  maxSelectable = 4
}: TopPostsGridProps) {
  const [sortField, setSortField] = useState<SortField>('engagementRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const multiplier = sortDirection === 'desc' ? -1 : 1;
    return (aValue - bValue) * multiplier;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num == null || num === undefined) {
      return '—';
    }
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

  const getPerformanceColor = (score: number): string => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (score: number): string => {
    if (score >= 70) return 'Excellent';
    if (score >= 40) return 'Good';
    return 'Needs Improvement';
  };

  const handlePostSelect = (postId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (onPostSelect) {
      onPostSelect(postId, event.target.checked);
    }
  };

  const handlePostClick = (postId: string) => {
    if (onPostClick) {
      onPostClick(postId);
    }
  };

  const isPostSelected = (postId: string) => selectedPosts.includes(postId);
  const canSelectMore = selectedPosts.length < maxSelectable;

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
          { field: 'performanceScore' as SortField, label: 'Performance Score' },
          { field: 'reach' as SortField, label: 'Audience Reached' },
          { field: 'impressions' as SortField, label: 'Impressions' },
          { field: 'clicks' as SortField, label: 'Clicks' },
          { field: 'engagements' as SortField, label: 'Engagements' },
          { field: 'likes' as SortField, label: 'Likes' },
          { field: 'comments' as SortField, label: 'Comments' },
          { field: 'shares' as SortField, label: 'Shares' },
          { field: 'saves' as SortField, label: 'Saves' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="top-posts-section">
        {paginatedData.map((post, index) => (
          <div
            key={post.postId}
            className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handlePostClick(post.postId)}
          >
            {/* Header with platform, rank, and selection */}
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                {onPostSelect && (
                  <input
                    type="checkbox"
                    checked={isPostSelected(post.postId)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handlePostSelect(post.postId, e);
                    }}
                    disabled={!isPostSelected(post.postId) && !canSelectMore}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    title={!canSelectMore && !isPostSelected(post.postId) ? `Maximum ${maxSelectable} posts can be compared at once` : ''}
                  />
                )}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${PLATFORM_COLORS[post.platform] || 'bg-gray-500 text-white'}`}>
                  {PLATFORM_ICONS[post.platform] || '📱'}
                </div>
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {post.platform}
                </span>
              </div>
              {showRanking && (
                <div className="text-xs text-gray-500">
                  #{index + 1}
                </div>
              )}
            </div>

            {/* Performance Score */}
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Performance Score</span>
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-12 h-2 bg-gray-200 rounded-full overflow-hidden`}
                    role="progressbar"
                    aria-valuenow={post.performanceScore}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Performance score: ${post.performanceScore} out of 100`}
                  >
                    <div 
                      className={`h-full transition-all duration-300 ${
                        post.performanceScore >= 70 ? 'bg-green-500' :
                        post.performanceScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${post.performanceScore}%` }}
                    />
                  </div>
                  <span 
                    className={`text-sm font-semibold ${getPerformanceColor(post.performanceScore)}`}
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
                  <div className="text-gray-500">Audience Reached</div>
                  <div className="font-semibold">
                    {post.reach > 0 ? formatNumber(post.reach) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Impressions</div>
                  <div className="font-semibold">
                    {formatNumber(post.impressions)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Clicks</div>
                  <div className="font-semibold text-indigo-500">
                    {formatNumber(post.clicks)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Engagements</div>
                  <div className="font-semibold text-purple-600">
                    {formatNumber(post.engagements)}
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
              <th>Impressions</th>
              <th>Clicks</th>
              <th>Engagements</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Saves</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((post) => (
              <tr key={post.postId}>
                <td>{post.platform}</td>
                <td>{post.publishedAt}</td>
                <td>{post.engagementRate}%</td>
                <td>{post.reach}</td>
                <td>{post.impressions}</td>
                <td>{post.clicks}</td>
                <td>{post.engagements}</td>
                <td>{post.likes}</td>
                <td>{post.comments}</td>
                <td>{post.shares}</td>
                <td>{post.saves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-2 text-sm border rounded-lg ${
                currentPage === page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}