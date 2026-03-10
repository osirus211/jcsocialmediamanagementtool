import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

interface EngagementData {
  date: string;
  engagementRate: number;
  platform?: string;
}

interface EngagementChartProps {
  selectedPlatform?: string;
}

export function EngagementChart({ selectedPlatform }: EngagementChartProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [chartData, setChartData] = useState<EngagementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchEngagementData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Calculate date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        // Mock data for now - in real implementation, this would call the analytics API
        const mockData: EngagementData[] = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          
          mockData.push({
            date: date.toISOString().split('T')[0],
            engagementRate: Math.random() * 8 + 2, // Random engagement rate between 2-10%
            platform: selectedPlatform || 'all'
          });
        }
        
        setChartData(mockData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load engagement data';
        logger.error('Failed to fetch engagement data', { error: errorMessage });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEngagementData();
  }, [selectedPlatform, currentWorkspace]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTooltipValue = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Failed to load chart</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📈</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No engagement data</h3>
          <p className="text-gray-500">
            Publish posts to see your engagement trends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Engagement rate over the last 30 days
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => `${value}%`}
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={formatTooltipValue}
              labelFormatter={(label) => `Date: ${formatDate(label)}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Line
              type="monotone"
              dataKey="engagementRate"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {(chartData.reduce((sum, d) => sum + d.engagementRate, 0) / chartData.length).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Avg Engagement</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {Math.max(...chartData.map(d => d.engagementRate)).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Peak Engagement</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {chartData.length}
          </div>
          <div className="text-sm text-gray-500">Days Tracked</div>
        </div>
      </div>
    </div>
  );
}