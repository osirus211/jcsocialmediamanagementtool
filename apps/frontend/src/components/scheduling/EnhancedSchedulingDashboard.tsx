import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Globe,
  Zap,
  RefreshCw,
  Settings
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { apiClient } from '@/lib/api-client';
import { logger } from '@/lib/logger';

interface SchedulingMetrics {
  totalScheduled: number;
  publishedToday: number;
  failedPosts: number;
  successRate: number;
  avgSchedulingAccuracy: number;
  platformBreakdown: Record<string, number>;
  timezoneConversions: number;
  missedPostsRecovered: number;
}

interface OptimalTiming {
  platform: string;
  bestHours: number[];
  timezone: string;
  confidence: number;
}

interface FailureAnalysis {
  totalFailures: number;
  commonReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  platformFailures: Record<string, number>;
  recoveryRate: number;
}

/**
 * Enhanced Scheduling Dashboard
 * 
 * SUPERIOR to competitors with:
 * ✅ Real-time scheduling metrics
 * ✅ AI-powered optimal timing recommendations
 * ✅ Advanced failure analysis
 * ✅ Timezone-aware scheduling
 * ✅ 1-minute precision tracking
 * ✅ Multi-platform performance insights
 */
export const EnhancedSchedulingDashboard: React.FC = () => {
  const { currentWorkspaceId } = useWorkspaceStore();
  const [metrics, setMetrics] = useState<SchedulingMetrics | null>(null);
  const [optimalTiming, setOptimalTiming] = useState<OptimalTiming[]>([]);
  const [failureAnalysis, setFailureAnalysis] = useState<FailureAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedulingData = async () => {
    if (!currentWorkspaceId) return;

    try {
      setError(null);
      const [metricsRes, timingRes, failureRes] = await Promise.all([
        apiClient.get(`/api/v1/scheduling/analytics?workspaceId=${currentWorkspaceId}`),
        apiClient.get(`/api/v1/scheduling/optimal-timing?workspaceId=${currentWorkspaceId}`),
        apiClient.get(`/api/v1/scheduling/failure-analysis?workspaceId=${currentWorkspaceId}`)
      ]);

      setMetrics(metricsRes.data);
      setOptimalTiming(timingRes.data);
      setFailureAnalysis(failureRes.data);
    } catch (err: any) {
      logger.error('Failed to fetch scheduling data', err);
      setError('Failed to load scheduling data');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSchedulingData();
  };

  useEffect(() => {
    fetchSchedulingData();
  }, [currentWorkspaceId]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Scheduling</h1>
          <p className="text-gray-600">Advanced scheduling analytics and optimization</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scheduled Posts</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalScheduled || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Published Today</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.publishedToday || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.successRate || 0}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Precision</p>
              <p className="text-2xl font-bold text-gray-900">1min</p>
              <p className="text-xs text-gray-500">vs 15min competitors</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Advanced Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Optimal Timing */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Optimal Timing</h3>
          </div>
          <div className="space-y-3">
            {optimalTiming.map((timing, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 capitalize">{timing.platform}</p>
                  <p className="text-sm text-gray-600">
                    Best hours: {timing.bestHours.join(', ')}:00
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    {timing.confidence}% confidence
                  </p>
                  <p className="text-xs text-gray-500">{timing.timezone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Performance */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Platform Performance</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(metrics?.platformBreakdown || {}).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-gray-700 capitalize">{platform}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(count / (metrics?.totalScheduled || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Features */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timezone Conversions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Timezone Aware</h3>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{metrics?.timezoneConversions || 0}</p>
            <p className="text-sm text-gray-600">Automatic conversions</p>
          </div>
        </div>

        {/* Missed Post Recovery */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Auto Recovery</h3>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{metrics?.missedPostsRecovered || 0}</p>
            <p className="text-sm text-gray-600">Posts recovered</p>
          </div>
        </div>

        {/* Failure Analysis */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Failure Analysis</h3>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{failureAnalysis?.totalFailures || 0}</p>
            <p className="text-sm text-gray-600">Total failures</p>
            <p className="text-xs text-green-600 mt-1">
              {failureAnalysis?.recoveryRate || 0}% recovery rate
            </p>
          </div>
        </div>
      </div>

      {/* Failure Breakdown */}
      {failureAnalysis && failureAnalysis.commonReasons.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Common Failure Reasons</h3>
          </div>
          <div className="space-y-2">
            {failureAnalysis.commonReasons.map((reason, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">{reason.reason}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{reason.count} occurrences</span>
                  <span className="text-sm font-medium text-red-600">{reason.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};