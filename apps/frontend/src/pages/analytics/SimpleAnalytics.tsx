import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useSimpleAnalytics } from '@/hooks/useSimpleAnalytics';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { ActivityChart } from '@/components/analytics/ActivityChart';
import { PlatformBreakdown } from '@/components/analytics/PlatformBreakdown';
import { RecentPostsTable } from '@/components/analytics/RecentPostsTable';
import { RefreshCw, BarChart3 } from 'lucide-react';

/**
 * SimpleAnalyticsPage Component
 * 
 * Lightweight analytics dashboard
 * 
 * Features:
 * - Overview cards (total, success rate, failed, scheduled)
 * - Activity trend chart (posts per day)
 * - Platform distribution
 * - Recent posts table
 * 
 * Performance:
 * - Client-side aggregation
 * - No heavy backend queries
 * - Fast rendering
 * - Handles empty data safely
 */
export function SimpleAnalyticsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [days, setDays] = useState(30);
  const { analytics, stats, isLoading, refresh } = useSimpleAnalytics(days);

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your posting activity and performance
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time range selector */}
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            
            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && !analytics && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading analytics...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !analytics && (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Analytics Data Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start publishing posts to see your analytics
            </p>
          </div>
        )}

        {/* Analytics content */}
        {analytics && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <OverviewCards
              totalPublished={analytics.overview.totalPublished}
              successRate={analytics.overview.successRate}
              failedCount={analytics.overview.failedCount}
              scheduledCount={analytics.overview.scheduledCount}
            />

            {/* Activity Trend */}
            {analytics.activityTrend.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Activity Trend
                </h2>
                <ActivityChart data={analytics.activityTrend} />
              </div>
            )}

            {/* Platform Distribution */}
            {analytics.platformDistribution.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Platform Distribution
                </h2>
                <PlatformBreakdown data={analytics.platformDistribution} />
              </div>
            )}

            {/* Recent Posts */}
            {analytics.recentPosts.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Posts
                </h2>
                <RecentPostsTable posts={analytics.recentPosts} />
              </div>
            )}

            {/* All Status Stats */}
            {stats && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  All Time Stats
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(stats).map(([status, count]) => (
                    <div key={status} className="text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {count}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
