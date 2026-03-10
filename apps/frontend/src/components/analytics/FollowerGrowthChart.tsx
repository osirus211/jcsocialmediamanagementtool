import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsService, FollowerTrendData } from '@/services/analytics.service';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useSocialAccountsStore } from '@/store/social-accounts.store';
import { logger } from '@/lib/logger';

interface FollowerGrowthChartProps {
  selectedAccountId?: string;
}

export function FollowerGrowthChart({ selectedAccountId }: FollowerGrowthChartProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const { accounts } = useSocialAccountsStore();
  const [chartData, setChartData] = useState<FollowerTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [accountId, setAccountId] = useState<string>(selectedAccountId || '');

  // Set default account if not provided
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0]._id);
    }
  }, [accounts, selectedAccountId, accountId]);

  useEffect(() => {
    if (!currentWorkspace || !accountId) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        const trends = await analyticsService.getFollowerTrends(accountId, startDate, endDate, 'day');
        setChartData(trends);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load follower trends';
        logger.error('Follower trends fetch error:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentWorkspace, accountId, dateRange]);

  const selectedAccount = accounts.find(acc => acc._id === accountId);
  const currentFollowers = chartData.length > 0 ? chartData[chartData.length - 1].followerCount : 0;
  const previousFollowers = chartData.length > 1 ? chartData[0].followerCount : currentFollowers;
  const growth = currentFollowers - previousFollowers;
  const growthPercentage = previousFollowers > 0 ? (growth / previousFollowers) * 100 : 0;

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Follower Growth</h3>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">⚠️ Error loading data</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Follower Growth</h3>
        
        <div className="flex items-center gap-4">
          {/* Account Selector */}
          {!selectedAccountId && accounts.length > 1 && (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>
                  {account.username} ({account.provider})
                </option>
              ))}
            </select>
          )}

          {/* Date Range Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Growth Delta Badge */}
      {!isLoading && chartData.length > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {currentFollowers.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Current Followers</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growth >= 0 ? '+' : ''}{growth.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">
              {growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(1)}% change
            </div>
          </div>

          {selectedAccount && (
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-700">
                {selectedAccount.username}
              </div>
              <div className="text-sm text-gray-500 capitalize">
                {selectedAccount.provider}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-500">Loading follower trends...</div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 mb-2">📊</div>
            <div className="text-gray-600">No follower data available</div>
            <div className="text-sm text-gray-500 mt-1">
              Follower tracking will begin once data is collected
            </div>
          </div>
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Followers']}
              />
              <Line
                type="monotone"
                dataKey="followerCount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}