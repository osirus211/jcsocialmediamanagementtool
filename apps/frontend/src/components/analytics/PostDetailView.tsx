import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, TrendingUp, Users, Eye, Heart, MessageCircle, Share, Bookmark } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PostDetail {
  postId: string;
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  performanceScore: number;
  collectedAt: string;
  post: {
    content: string;
    mediaUrls?: string[];
    publishedAt: string;
    accountName: string;
  };
  history: Array<{
    collectedAt: string;
    engagementRate: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
  }>;
}

interface PostDetailViewProps {
  postId: string;
  onBack: () => void;
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

export function PostDetailView({ postId, onBack }: PostDetailViewProps) {
  const [postDetail, setPostDetail] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPostDetail();
  }, [postId]);

  const loadPostDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // This would be replaced with actual API call
      const response = await fetch(`/api/v1/analytics/posts/${postId}`);
      if (!response.ok) {
        throw new Error('Failed to load post details');
      }
      
      const data = await response.json();
      setPostDetail(data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load post details');
    } finally {
      setIsLoading(false);
    }
  };
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
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPerformanceColor = (score: number): string => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceBgColor = (score: number): string => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !postDetail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Analytics
        </button>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">❌</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load post details</h3>
          <p className="text-gray-600 mb-4">{error || 'Post not found'}</p>
          <button
            onClick={loadPostDetail}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="post-detail-view">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Analytics
      </button>

      {/* Post Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${PLATFORM_COLORS[postDetail.platform] || 'bg-gray-500 text-white'}`}>
              {PLATFORM_ICONS[postDetail.platform] || '📱'}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 capitalize">
                {postDetail.platform} Post
              </h1>
              <p className="text-sm text-gray-600">
                {postDetail.post.accountName} • {formatDate(postDetail.post.publishedAt)}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.open(`#/post/${postDetail.postId}`, '_blank')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="View original post"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>

        {/* Performance Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Performance Score</span>
            <span 
              className={`text-lg font-bold ${getPerformanceColor(postDetail.performanceScore)}`}
              aria-label={`Performance score: ${postDetail.performanceScore} out of 100`}
            >
              {postDetail.performanceScore}/100
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getPerformanceBgColor(postDetail.performanceScore)}`}
              style={{ width: `${postDetail.performanceScore}%` }}
            />
          </div>
        </div>

        {/* Post Content Preview */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Content Preview</h3>
          <p className="text-gray-900 text-sm leading-relaxed">
            {postDetail.post.content.length > 200 
              ? `${postDetail.post.content.substring(0, 200)}...` 
              : postDetail.post.content
            }
          </p>
          {postDetail.post.mediaUrls && postDetail.post.mediaUrls.length > 0 && (
            <div className="mt-3 flex gap-2">
              {postDetail.post.mediaUrls.slice(0, 3).map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Media ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              ))}
              {postDetail.post.mediaUrls.length > 3 && (
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500">
                  +{postDetail.post.mediaUrls.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Audience Reached</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {postDetail.reach > 0 ? formatNumber(postDetail.reach) : '—'}
          </div>
          {postDetail.reach === 0 && (
            <div className="text-xs text-gray-500 mt-1" title="Reach data not available for this platform">
              Reach data not available for this platform
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">Impressions</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(postDetail.impressions)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-gray-700">Engagement Rate</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {postDetail.engagementRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-gray-700">Total Engagement</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(postDetail.likes + postDetail.comments + postDetail.shares + postDetail.saves)}
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <Heart className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{formatNumber(postDetail.likes)}</div>
            <div className="text-sm text-gray-600">Likes</div>
          </div>
          <div className="text-center">
            <MessageCircle className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{formatNumber(postDetail.comments)}</div>
            <div className="text-sm text-gray-600">Comments</div>
          </div>
          <div className="text-center">
            <Share className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{formatNumber(postDetail.shares)}</div>
            <div className="text-sm text-gray-600">
              {postDetail.platform === 'twitter' ? 'Retweets' : 'Shares'}
            </div>
          </div>
          <div className="text-center">
            <Bookmark className="h-6 w-6 text-amber-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{formatNumber(postDetail.saves)}</div>
            <div className="text-sm text-gray-600">Saves</div>
          </div>
        </div>
      </div>

      {/* Metrics History Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Over Time</h3>
        {postDetail.history && postDetail.history.length > 1 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={postDetail.history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="collectedAt" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number, name: string) => [
                    name === 'engagementRate' ? `${value.toFixed(1)}%` : formatNumber(value),
                    name === 'engagementRate' ? 'Engagement Rate' : 
                    name === 'reach' ? 'Audience Reached' : 
                    name.charAt(0).toUpperCase() + name.slice(1)
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="engagementRate" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="engagementRate"
                />
                <Line 
                  type="monotone" 
                  dataKey="reach" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="reach"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No history yet</p>
            <p className="text-sm">Historical data will appear here as we collect more metrics over time.</p>
          </div>
        )}
      </div>
    </div>
  );
}