import { useEffect, useState } from 'react';
import { useAnalyticsStore } from '@/store/analytics.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { KPICard } from '@/components/analytics/KPICard';
import { PerformanceChart } from '@/components/analytics/PerformanceChart';
import { PlatformComparison } from '@/components/analytics/PlatformComparison';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';

export const AnalyticsDashboardPage = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const {
    overview,
    platformMetrics,
    growthMetrics,
    isLoading,
    dateRange,
    setDateRange,
    fetchOverview,
    fetchPlatformMetrics,
    fetchGrowthMetrics,
  } = useAnalyticsStore();

  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    if (currentWorkspace) {
      loadAnalytics();
    }
  }, [currentWorkspace, dateRange]);

  const loadAnalytics = async () => {
    try {
      await Promise.all([
        fetchOverview(dateRange.startDate || undefined, dateRange.endDate || undefined),
        fetchPlatformMetrics(dateRange.startDate || undefined, dateRange.endDate || undefined),
      ]);

      // Load growth metrics if date range is set
      if (dateRange.startDate && dateRange.endDate) {
        await fetchGrowthMetrics(dateRange.startDate, dateRange.endDate, interval);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleDateRangeChange = (startDate: string | null, endDate: string | null) => {
    setDateRange(startDate, endDate);
  };

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-gray-600 mt-1">
              Track performance and engagement for {currentWorkspace.name}
            </p>
          </div>
          <DateRangeFilter
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={handleDateRangeChange}
          />
        </div>

        {isLoading && !overview ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading analytics...</div>
          </div>
        ) : overview ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Impressions"
                value={overview.totalImpressions.toLocaleString()}
                change={overview.growth.impressions}
                icon="👁️"
              />
              <KPICard
                title="Total Engagement"
                value={overview.totalEngagement.toLocaleString()}
                change={overview.growth.engagement}
                icon="❤️"
              />
              <KPICard
                title="Engagement Rate"
                value={`${overview.engagementRate.toFixed(2)}%`}
                icon="📊"
              />
              <KPICard
                title="Total Posts"
                value={overview.totalPosts.toString()}
                icon="📝"
              />
            </div>

            {/* Performance Chart */}
            {growthMetrics.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Performance Over Time</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInterval('day')}
                      className={`px-3 py-1 text-sm rounded ${
                        interval === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setInterval('week')}
                      className={`px-3 py-1 text-sm rounded ${
                        interval === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => setInterval('month')}
                      className={`px-3 py-1 text-sm rounded ${
                        interval === 'month'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Month
                    </button>
                  </div>
                </div>
                <PerformanceChart data={growthMetrics} />
              </div>
            )}

            {/* Platform Comparison */}
            {platformMetrics.length > 0 && (
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Platform Comparison</h2>
                <PlatformComparison data={platformMetrics} />
              </div>
            )}

            {/* Best Performing Post */}
            {overview.bestPerformingPost && (
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Best Performing Post</h2>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-gray-800 mb-2">
                      {overview.bestPerformingPost.content || 'No content'}
                    </p>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>👁️ {overview.bestPerformingPost.impressions?.toLocaleString() || 0}</span>
                      <span>❤️ {overview.bestPerformingPost.likes?.toLocaleString() || 0}</span>
                      <span>💬 {overview.bestPerformingPost.comments?.toLocaleString() || 0}</span>
                      <span>🔄 {overview.bestPerformingPost.shares?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {overview.bestPerformingPost.engagementRate?.toFixed(2) || 0}%
                    </div>
                    <div className="text-xs text-gray-500">Engagement Rate</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <div className="text-gray-500 mb-4">No analytics data yet</div>
            <p className="text-sm text-gray-400">
              Publish some posts to see analytics
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
