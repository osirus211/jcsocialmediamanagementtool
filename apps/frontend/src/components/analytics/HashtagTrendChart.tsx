import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart } from 'recharts';
import { analyticsService, HashtagTrendData } from '@/services/analytics.service';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

interface HashtagTrendChartProps {
  hashtag: string;
  onClose?: () => void;
}

export function HashtagTrendChart({ hashtag, onClose }: HashtagTrendChartProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [chartData, setChartData] = useState<HashtagTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace || !hashtag) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get last 12 weeks of data
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

        const trends = await analyticsService.getHashtagTrends(hashtag, startDate, endDate);
        setChartData(trends);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load hashtag trends';
        logger.error('Hashtag trends fetch error:', { error: err });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentWorkspace, hashtag]);

  const formatWeek = (week: string) => {
    // Convert "2024-W12" format to readable date
    const [year, weekNum] = week.split('-W');
    const date = new Date(parseInt(year), 0, 1 + (parseInt(weekNum) - 1) * 7);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{hashtag} Performance Over Time</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">⚠️ Error loading data</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{hashtag} Performance Over Time</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-500">Loading hashtag trends...</div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{hashtag} Performance Over Time</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 mb-2 text-4xl">📈</div>
            <div className="text-gray-600">No trend data available</div>
            <div className="text-sm text-gray-500 mt-1">
              This hashtag needs more posts over time to show trends
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxEngagement = Math.max(...chartData.map(d => d.avgEngagement));
  const maxPosts = Math.max(...chartData.map(d => d.postCount));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{hashtag} Performance Over Time</h3>
          <p className="text-sm text-gray-500 mt-1">
            Engagement rate and post count over the last 12 weeks
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {chartData.reduce((sum, d) => sum + d.postCount, 0)}
          </div>
          <div className="text-sm text-gray-500">Total Posts</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {(chartData.reduce((sum, d) => sum + d.avgEngagement, 0) / chartData.length).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Avg Engagement</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {maxEngagement.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Peak Engagement</div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="week" 
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={formatWeek}
            />
            <YAxis 
              yAxisId="engagement"
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              yAxisId="posts"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelFormatter={(value) => `Week of ${formatWeek(value)}`}
              formatter={(value: number, name: string) => {
                if (name === 'avgEngagement') {
                  return [`${value.toFixed(1)}%`, 'Avg Engagement'];
                }
                return [value, 'Posts'];
              }}
            />
            <Bar
              yAxisId="posts"
              dataKey="postCount"
              fill="#e5e7eb"
              opacity={0.6}
              name="postCount"
            />
            <Line
              yAxisId="engagement"
              type="monotone"
              dataKey="avgEngagement"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
              name="avgEngagement"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Blue line shows engagement rate (left axis) • Gray bars show post count (right axis)
      </div>
    </div>
  );
}