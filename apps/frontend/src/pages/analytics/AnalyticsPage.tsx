import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { analyticsService } from '@/services/analytics.service';
import { Link } from 'react-router-dom';

// Components
import { KPICard } from '@/components/analytics/KPICard';
import { FollowerGrowthChart } from '@/components/analytics/FollowerGrowthChart';
import { EngagementChart } from '@/components/analytics/EngagementChart';
import { TopPostsGrid } from '@/components/analytics/TopPostsGrid';
import { PlatformComparisonTable } from '@/components/analytics/PlatformComparisonTable';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { PlatformFilter } from '@/components/analytics/PlatformFilter';
import { ExportButtons } from '@/components/analytics/ExportButtons';

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter', icon: '𝕏' },
  { id: 'facebook', name: 'Facebook', icon: '📘' },
  { id: 'instagram', name: 'Instagram', icon: '📷' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'threads', name: 'Threads', icon: '@' },
  { id: 'bluesky', name: 'Bluesky', icon: '🦋' },
];

export function AnalyticsPage() {
  const { currentWorkspaceId, workspacesLoaded, workspaces } = useWorkspaceStore();
  
  // Date range state
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
    preset: string;
  }>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate, preset: 'Last 30 days' };
  });

  // Platform filter state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Data state
  const [summaryData, setSummaryData] = useState<any>(null);
  const [followerGrowthData, setFollowerGrowthData] = useState<any[]>([]);
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [topPostsData, setTopPostsData] = useState<any[]>([]);
  const [platformComparisonData, setPlatformComparisonData] = useState<any[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engagementView, setEngagementView] = useState<'day' | 'platform'>('day');

  // Load data when filters change
  useEffect(() => {
    if (currentWorkspaceId) {
      loadAnalyticsData();
    }
  }, [currentWorkspaceId, dateRange, selectedPlatforms]);

  const loadAnalyticsData = async () => {
    if (!currentWorkspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const platforms = selectedPlatforms.length > 0 ? selectedPlatforms : undefined;

      const [summary, followerGrowth, engagement, topPosts, platformComparison] = await Promise.all([
        analyticsService.getSummaryMetrics(dateRange.startDate, dateRange.endDate, platforms),
        analyticsService.getFollowerGrowthData(dateRange.startDate, dateRange.endDate, platforms),
        analyticsService.getEngagementData(dateRange.startDate, dateRange.endDate, platforms, engagementView),
        analyticsService.getTopPostsData(dateRange.startDate, dateRange.endDate, platforms),
        analyticsService.getPlatformComparisonData(dateRange.startDate, dateRange.endDate)
      ]);

      setSummaryData(summary);
      setFollowerGrowthData(followerGrowth);
      setEngagementData(engagement);
      setTopPostsData(topPosts);
      setPlatformComparisonData(platformComparison);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data');
      console.error('Analytics data loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateRangeChange = (startDate: Date, endDate: Date, preset: string) => {
    setDateRange({ startDate, endDate, preset });
  };

  const handlePlatformFilterChange = (platforms: string[]) => {
    setSelectedPlatforms(platforms);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const getTrendIcon = (change: number): string => {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  };

  const getTrendColor = (change: number): string => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (!currentWorkspaceId) {
    if (workspacesLoaded && workspaces.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <div className="text-4xl mb-4">📂</div>
          <h2 className="text-xl font-semibold mb-2">No Workspace Found</h2>
          <p className="text-gray-600 mb-6">You need a workspace to view analytics.</p>
          <Link
            to="/workspaces/create"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Workspace
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-500 italic">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">
            {dateRange.preset} • {selectedPlatforms.length > 0 ? `${selectedPlatforms.length} platforms` : 'All platforms'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons 
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            platforms={selectedPlatforms}
            data={{
              summary: summaryData,
              followerGrowth: followerGrowthData,
              engagement: engagementData,
              topPosts: topPostsData,
              platformComparison: platformComparisonData
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col lg:flex-row gap-4">
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={handleDateRangeChange}
        />
        <PlatformFilter
          platforms={PLATFORMS}
          selectedPlatforms={selectedPlatforms}
          onChange={handlePlatformFilterChange}
        />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadAnalyticsData}
            className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* KPI Cards */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border rounded-lg p-6 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                    <div className="w-12 h-4 bg-gray-200 rounded"></div>
                  </div>
                  <div className="w-20 h-8 bg-gray-200 rounded mb-1"></div>
                  <div className="w-16 h-4 bg-gray-200 rounded"></div>
                </div>
              ))
            ) : summaryData ? (
              <>
                <KPICard
                  title="Total Reach"
                  value={formatNumber(summaryData.reach.current)}
                  change={summaryData.reach.percentageChange}
                  icon="👁️"
                  trend={getTrendIcon(summaryData.reach.percentageChange)}
                  trendColor={getTrendColor(summaryData.reach.percentageChange)}
                />
                <KPICard
                  title="Total Engagement"
                  value={formatNumber(summaryData.engagement.current)}
                  change={summaryData.engagement.percentageChange}
                  icon="❤️"
                  trend={getTrendIcon(summaryData.engagement.percentageChange)}
                  trendColor={getTrendColor(summaryData.engagement.percentageChange)}
                />
                <KPICard
                  title="Follower Growth"
                  value={formatNumber(summaryData.followerGrowth.current)}
                  change={summaryData.followerGrowth.percentageChange}
                  icon="📈"
                  trend={getTrendIcon(summaryData.followerGrowth.percentageChange)}
                  trendColor={getTrendColor(summaryData.followerGrowth.percentageChange)}
                />
                <KPICard
                  title="Posts Published"
                  value={formatNumber(summaryData.postsPublished.current)}
                  change={summaryData.postsPublished.percentageChange}
                  icon="📝"
                  trend={getTrendIcon(summaryData.postsPublished.percentageChange)}
                  trendColor={getTrendColor(summaryData.postsPublished.percentageChange)}
                />
              </>
            ) : (
              // Error state
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border rounded-lg p-6 text-center text-gray-500">
                  <div className="text-2xl mb-2">—</div>
                  <div className="text-sm">No data</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Follower Growth Chart */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Follower Growth Over Time</h2>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <FollowerGrowthChart 
              data={followerGrowthData}
              isLoading={isLoading}
            />
          </div>
        </section>

        {/* Engagement Chart */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Engagement Analysis</h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setEngagementView('day')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  engagementView === 'day'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                By Day
              </button>
              <button
                onClick={() => setEngagementView('platform')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  engagementView === 'platform'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                By Platform
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <EngagementChart 
              data={engagementData}
              viewType={engagementView}
              isLoading={isLoading}
            />
          </div>
        </section>

        {/* Top Posts Grid */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Posts</h2>
          <TopPostsGrid 
            data={topPostsData}
            isLoading={isLoading}
          />
        </section>

        {/* Platform Comparison Table */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Platform Comparison</h2>
          <PlatformComparisonTable 
            data={platformComparisonData}
            isLoading={isLoading}
          />
        </section>
      </div>
    </div>
  );
}