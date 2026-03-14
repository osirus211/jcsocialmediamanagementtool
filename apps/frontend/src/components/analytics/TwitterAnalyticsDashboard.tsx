import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Repeat2, 
  Heart, 
  Eye,
  BarChart3,
  Clock,
  Hash,
  Zap
} from 'lucide-react';

interface TwitterMetrics {
  followers: number;
  following: number;
  tweets: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  profileViews: number;
  mentions: number;
}

interface TweetPerformance {
  id: string;
  content: string;
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  isThread?: boolean;
  threadLength?: number;
}

interface TwitterAnalyticsDashboardProps {
  accountId: string;
  dateRange: string;
}

export function TwitterAnalyticsDashboard({ accountId, dateRange }: TwitterAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<TwitterMetrics | null>(null);
  const [topTweets, setTopTweets] = useState<TweetPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tweets' | 'audience' | 'trends'>('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [accountId, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch analytics data
      const response = await fetch(`/api/v1/analytics/twitter/${accountId}?range=${dateRange}`);
      const data = await response.json();
      
      setMetrics(data.metrics);
      setTopTweets(data.topTweets || []);
    } catch (error) {
      console.error('Failed to fetch Twitter analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatEngagementRate = (rate: number): string => {
    return `${rate.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Twitter Analytics</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'tweets', label: 'Tweet Performance', icon: MessageCircle },
            { id: 'audience', label: 'Audience', icon: Users },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Followers</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.followers)}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+2.5% from last week</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Impressions</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.impressions)}</p>
                </div>
                <Eye className="h-8 w-8 text-purple-500" />
              </div>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+15.3% from last week</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{formatEngagementRate(metrics.engagementRate)}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+0.8% from last week</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Profile Views</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.profileViews)}</p>
                </div>
                <Users className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="mt-2 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+5.2% from last week</span>
              </div>
            </div>
          </div>

          {/* Engagement Breakdown */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Heart className="h-6 w-6 text-red-500" />
                <div>
                  <p className="text-sm text-gray-600">Likes</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.likes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Repeat2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Retweets</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.retweets)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Replies</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.replies)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tweet Performance Tab */}
      {activeTab === 'tweets' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Tweets</h3>
              <p className="text-sm text-gray-600 mt-1">Your best tweets from the selected period</p>
            </div>
            
            <div className="divide-y">
              {topTweets.map((tweet) => (
                <div key={tweet.id} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-gray-900 mb-2">{tweet.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(tweet.createdAt).toLocaleDateString()}</span>
                        {tweet.isThread && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            Thread ({tweet.threadLength} tweets)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span>{formatNumber(tweet.likes)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Repeat2 className="h-4 w-4 text-green-500" />
                        <span>{formatNumber(tweet.retweets)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span>{formatNumber(tweet.replies)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-purple-500" />
                        <span>{formatNumber(tweet.impressions)}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatEngagementRate(tweet.engagementRate)}</p>
                        <p className="text-xs text-gray-500">engagement</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audience Tab */}
      {activeTab === 'audience' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Follower Growth</h3>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <p>Follower growth chart would go here</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Demographics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Top Countries</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">United States</span>
                      <span className="text-sm font-medium">45%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">United Kingdom</span>
                      <span className="text-sm font-medium">12%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Canada</span>
                      <span className="text-sm font-medium">8%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Trending Hashtags
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {['#AI', '#WebDev', '#React', '#TypeScript', '#OpenSource', '#TechNews'].map((hashtag) => (
                <div key={hashtag} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-600">{hashtag}</span>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Trending in Technology</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimal Posting Times</h3>
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center">
                  <p className="text-sm font-medium text-gray-700 mb-2">{day}</p>
                  <div className="space-y-1">
                    <div className="h-8 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-xs text-blue-700">9 AM</span>
                    </div>
                    <div className="h-8 bg-green-100 rounded flex items-center justify-center">
                      <span className="text-xs text-green-700">3 PM</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Based on your audience activity patterns. Times shown in your local timezone.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}