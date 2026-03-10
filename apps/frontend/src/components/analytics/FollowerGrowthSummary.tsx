import { useState, useEffect } from 'react';
import { analyticsService, FollowerGrowthData } from '@/services/analytics.service';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

interface FollowerGrowthSummaryProps {
  dateRange?: '7d' | '30d' | '90d';
}

export function FollowerGrowthSummary({ dateRange = '30d' }: FollowerGrowthSummaryProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [growthData, setGrowthData] = useState<FollowerGrowthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        const data = await analyticsService.getWorkspaceFollowerGrowth(startDate, endDate);
        setGrowthData(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load follower growth';
        logger.error('Follower growth fetch error:', { error: err });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentWorkspace, dateRange]);

  const getTrendIcon = (growthPercentage: number) => {
    if (growthPercentage > 0) return '📈';
    if (growthPercentage < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (growthPercentage: number) => {
    if (growthPercentage > 0) return 'text-green-600';
    if (growthPercentage < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Follower Growth Summary</h3>
        <div className="text-center py-4">
          <div className="text-red-600 mb-2">⚠️ Error loading data</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Follower Growth Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg p-4">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-8 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (growthData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Follower Growth Summary</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">👥</div>
          <div className="text-gray-600">No follower data available</div>
          <div className="text-sm text-gray-500 mt-1">
            Connect social accounts to start tracking follower growth
          </div>
        </div>
      </div>
    );
  }

  // Group by platform for better organization
  const platformGroups = growthData.reduce((acc, item) => {
    if (!acc[item.platform]) {
      acc[item.platform] = [];
    }
    acc[item.platform].push(item);
    return acc;
  }, {} as Record<string, FollowerGrowthData[]>);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Follower Growth Summary</h3>
        <div className="text-sm text-gray-500">
          Last {dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(platformGroups).map(([platform, accounts]) => {
          // Calculate totals for the platform
          const totalCurrentFollowers = accounts.reduce((sum, acc) => sum + acc.currentFollowers, 0);
          const totalGrowth = accounts.reduce((sum, acc) => sum + acc.growth, 0);
          const avgGrowthPercentage = accounts.reduce((sum, acc) => sum + acc.growthPercentage, 0) / accounts.length;

          return (
            <div key={platform} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-lg capitalize font-medium text-gray-900">
                    {platform}
                  </div>
                  <div className="text-sm text-gray-500">
                    ({accounts.length} account{accounts.length !== 1 ? 's' : ''})
                  </div>
                </div>
                <div className="text-xl">
                  {getTrendIcon(avgGrowthPercentage)}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {totalCurrentFollowers.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Total Followers</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-lg font-semibold ${getTrendColor(totalGrowth)}`}>
                      {totalGrowth >= 0 ? '+' : ''}{totalGrowth.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Growth</div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${getTrendColor(avgGrowthPercentage)}`}>
                      {avgGrowthPercentage >= 0 ? '+' : ''}{avgGrowthPercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Avg Change</div>
                  </div>
                </div>

                {/* Individual account details if multiple accounts */}
                {accounts.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">By Account:</div>
                    <div className="space-y-1">
                      {accounts.map((account, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <div className="text-gray-600 truncate max-w-20">
                            Account {index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">
                              {account.currentFollowers.toLocaleString()}
                            </span>
                            <span className={getTrendColor(account.growthPercentage)}>
                              ({account.growthPercentage >= 0 ? '+' : ''}{account.growthPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}