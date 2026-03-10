import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CompetitorAccount, CompetitorComparison, competitorService } from '@/services/competitor.service';

interface CompetitorBenchmarkChartProps {
  competitors: CompetitorAccount[];
}

type MetricType = 'engagement' | 'likes' | 'comments' | 'followers';

const METRIC_CONFIGS = {
  engagement: {
    label: 'Engagement Rate',
    dataKey: 'engagementRate',
    formatter: (value: number) => `${(value * 100).toFixed(1)}%`,
  },
  likes: {
    label: 'Avg Likes',
    dataKey: 'avgLikes',
    formatter: (value: number) => value.toLocaleString(),
  },
  comments: {
    label: 'Avg Comments',
    dataKey: 'avgComments',
    formatter: (value: number) => value.toLocaleString(),
  },
  followers: {
    label: 'Followers',
    dataKey: 'followerCount',
    formatter: (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toString();
    },
  },
};

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export function CompetitorBenchmarkChart({ competitors }: CompetitorBenchmarkChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('engagement');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (competitors.length > 0) {
      loadComparisonData();
    } else {
      setData([]);
      setIsLoading(false);
    }
  }, [competitors, dateRange]);

  const loadComparisonData = async () => {
    try {
      setIsLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const competitorIds = competitors.map(c => c._id);
      const comparisons = await competitorService.compareCompetitors(competitorIds, startDate, endDate);

      // Transform data for chart
      const chartData = comparisons.map((comparison, index) => ({
        name: comparison.competitor.displayName || comparison.competitor.handle,
        engagementRate: comparison.metrics?.engagementRate || 0,
        avgLikes: comparison.metrics?.avgLikes || 0,
        avgComments: comparison.metrics?.avgComments || 0,
        followerCount: comparison.metrics?.followerCount || 0,
        color: COLORS[index % COLORS.length],
      }));

      // Add "Your Account" placeholder data (would come from your analytics)
      chartData.unshift({
        name: 'Your Account',
        engagementRate: 0.045, // Placeholder
        avgLikes: 150, // Placeholder
        avgComments: 25, // Placeholder
        followerCount: 5000, // Placeholder
        color: '#1D4ED8', // Brand color
      });

      setData(chartData);
    } catch (error) {
      console.error('Failed to load comparison data:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const metricConfig = METRIC_CONFIGS[selectedMetric];

  if (competitors.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            📊
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Add competitors to compare</h3>
          <p className="text-gray-600">
            Track your competitors to see how you stack up against them.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded w-24"></div>
            ))}
          </div>
          <div className="h-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Benchmark Comparison</h3>
        
        {/* Date Range Filter */}
        <div className="flex gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setDateRange(days as 7 | 30 | 90)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                dateRange === days
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(METRIC_CONFIGS) as MetricType[]).map((metric) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedMetric === metric
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {METRIC_CONFIGS[metric].label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              formatter={(value: number) => [metricConfig.formatter(value), metricConfig.label]}
              labelStyle={{ color: '#374151' }}
            />
            <Legend />
            <Bar 
              dataKey={metricConfig.dataKey} 
              name={metricConfig.label}
              fill="#3B82F6"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="text-sm text-gray-600">
              {item.name}
              {item.name === 'Your Account' && (
                <span className="ml-1 text-xs text-blue-600 font-medium">(You)</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}