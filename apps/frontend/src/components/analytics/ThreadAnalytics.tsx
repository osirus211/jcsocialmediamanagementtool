import React from 'react';
import { 
  BarChart3, MessageCircle, Heart, Repeat2, 
  Eye, Users, TrendingUp, Clock, Share
} from 'lucide-react';

interface ThreadMetrics {
  totalViews: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalShares: number;
  engagementRate: number;
  impressions: number;
  clickThroughRate: number;
  completionRate: number; // % who read entire thread
  averageReadTime: number; // seconds
  topPerformingTweet: number; // index
  dropOffPoints: number[]; // tweet indices where people stopped reading
}

interface ThreadAnalyticsProps {
  threadId: string;
  metrics: ThreadMetrics;
  tweetMetrics: Array<{
    tweetIndex: number;
    views: number;
    likes: number;
    retweets: number;
    replies: number;
    engagementRate: number;
  }>;
  publishedAt: Date;
}

export function ThreadAnalytics({ 
  threadId, 
  metrics, 
  tweetMetrics, 
  publishedAt 
}: ThreadAnalyticsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 5) return 'text-green-600 bg-green-100';
    if (rate >= 2) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🧵 Thread Analytics
        </h3>
        <div className="text-sm text-gray-500">
          Published {publishedAt.toLocaleDateString()}
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Total Views</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(metrics.totalViews)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-gray-700">Engagement</span>
          </div>
          <div className={`text-2xl font-bold ${getEngagementColor(metrics.engagementRate).split(' ')[0]}`}>
            {metrics.engagementRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">Completion</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {metrics.completionRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">Avg. Read Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatDuration(metrics.averageReadTime)}
          </div>
        </div>
      </div>

      {/* Engagement Breakdown */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">Engagement Breakdown</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-red-500" />
            <div>
              <div className="font-medium text-gray-900">{formatNumber(metrics.totalLikes)}</div>
              <div className="text-sm text-gray-500">Likes</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Repeat2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium text-gray-900">{formatNumber(metrics.totalRetweets)}</div>
              <div className="text-sm text-gray-500">Retweets</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-medium text-gray-900">{formatNumber(metrics.totalReplies)}</div>
              <div className="text-sm text-gray-500">Replies</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Share className="h-5 w-5 text-purple-500" />
            <div>
              <div className="font-medium text-gray-900">{formatNumber(metrics.totalShares)}</div>
              <div className="text-sm text-gray-500">Shares</div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Tweet Performance */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">Per-Tweet Performance</h4>
        <div className="space-y-3">
          {tweetMetrics.map((tweet, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg border ${
                index === metrics.topPerformingTweet 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Tweet {tweet.tweetIndex + 1}
                  </span>
                  {index === metrics.topPerformingTweet && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      Top Performer
                    </span>
                  )}
                  {metrics.dropOffPoints.includes(index) && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      Drop-off Point
                    </span>
                  )}
                </div>
                <div className={`text-sm font-medium px-2 py-1 rounded ${getEngagementColor(tweet.engagementRate)}`}>
                  {tweet.engagementRate.toFixed(1)}%
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{formatNumber(tweet.views)}</div>
                  <div className="text-gray-500">Views</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{formatNumber(tweet.likes)}</div>
                  <div className="text-gray-500">Likes</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{formatNumber(tweet.retweets)}</div>
                  <div className="text-gray-500">RTs</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{formatNumber(tweet.replies)}</div>
                  <div className="text-gray-500">Replies</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">📊 Insights</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• {metrics.completionRate > 70 ? 'Great thread retention!' : 'Consider shorter tweets for better retention'}</li>
          <li>• Tweet {metrics.topPerformingTweet + 1} performed best - analyze what made it engaging</li>
          {metrics.dropOffPoints.length > 0 && (
            <li>• Readers dropped off at tweet {metrics.dropOffPoints[0] + 1} - consider revising</li>
          )}
          <li>• {metrics.engagementRate > 3 ? 'Above average engagement' : 'Try adding more questions or calls-to-action'}</li>
        </ul>
      </div>
    </div>
  );
}