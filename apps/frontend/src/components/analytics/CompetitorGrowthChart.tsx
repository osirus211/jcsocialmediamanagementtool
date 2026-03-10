import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CompetitorAccount, CompetitorGrowthData, competitorService } from '@/services/competitor.service';

interface CompetitorGrowthChartProps {
  competitors: CompetitorAccount[];
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export function CompetitorGrowthChart({ competitors }: CompetitorGrowthChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);
  const [visibleLines, setVisibleLines] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (competitors.length > 0) {
      loadGrowthData();
    } else {
      setData([]);
      setIsLoading(false);
    }
  }, [competitors, dateRange]);

  useEffect(() => {
    // Initialize all lines as visible
    const allLines = new Set(['Your Account', ...competitors.map(c => c.displayName || c.handle)]);
    setVisibleLines(allLines);
  }, [competitors]);

  const loadGrowthData = async () => {
    try {
      setIsLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // Load growth data for all competitors
      const growthPromises = competitors.map(competitor =>
        competitorService.getGrowth(competitor._id, startDate, endDate)
      );

      const growthResults = await Promise.all(growthPromises);

      // Generate date range
      const dates: string[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Transform data for chart
      const chartData = dates.map(date => {
        const dataPoint: any = { date };

        // Add your account data (placeholder)
        dataPoint['Your Account'] = 5000 + Math.random() * 100; // Placeholder growth

        // Add competitor data
        competitors.forEach((competitor, index) => {
          const competitorName = competitor.displayName || competitor.handle;
          const growthData = growthResults[index];
          const dayData = growthData.find(d => d.date.split('T')[0] === date);
          dataPoint[competitorName] = dayData?.followerCount || 0;
        });

        return dataPoint;
      });

      setData(chartData);
    } catch (error) {
      console.error('Failed to load growth data:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLineVisibility = (lineName: string) => {
    const newVisibleLines = new Set(visibleLines);
    if (newVisibleLines.has(lineName)) {
      newVisibleLines.delete(lineName);
    } else {
      newVisibleLines.add(lineName);
    }
    setVisibleLines(newVisibleLines);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (competitors.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            📈
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Track follower growth</h3>
          <p className="text-gray-600">
            Add competitors to see how their follower count changes over time.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-6">
            <div className="h-6 bg-gray-200 rounded w-48"></div>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-gray-200 rounded w-12"></div>
              ))}
            </div>
          </div>
          <div className="h-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const allLines = ['Your Account', ...competitors.map(c => c.displayName || c.handle)];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Follower Growth</h3>
        
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

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={formatDate}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatNumber}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatNumber(value),
                name === 'Your Account' ? `${name} (You)` : name
              ]}
              labelFormatter={(date: string) => `Date: ${formatDate(date)}`}
              labelStyle={{ color: '#374151' }}
            />
            <Legend 
              onClick={(e) => toggleLineVisibility(e.value)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
            
            {/* Your Account Line */}
            <Line
              type="monotone"
              dataKey="Your Account"
              stroke="#1D4ED8"
              strokeWidth={3}
              dot={{ fill: '#1D4ED8', strokeWidth: 2, r: 4 }}
              hide={!visibleLines.has('Your Account')}
              name="Your Account"
            />

            {/* Competitor Lines */}
            {competitors.map((competitor, index) => {
              const competitorName = competitor.displayName || competitor.handle;
              return (
                <Line
                  key={competitor._id}
                  type="monotone"
                  dataKey={competitorName}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2, r: 3 }}
                  hide={!visibleLines.has(competitorName)}
                  name={competitorName}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {allLines.map((lineName, index) => {
          const color = lineName === 'Your Account' ? '#1D4ED8' : COLORS[(index - 1) % COLORS.length];
          const isVisible = visibleLines.has(lineName);
          
          return (
            <button
              key={lineName}
              onClick={() => toggleLineVisibility(lineName)}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                isVisible 
                  ? 'bg-gray-100 hover:bg-gray-200' 
                  : 'bg-gray-50 opacity-50 hover:opacity-75'
              }`}
            >
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: color }}
              ></div>
              <span className="text-sm text-gray-600">
                {lineName}
                {lineName === 'Your Account' && (
                  <span className="ml-1 text-xs text-blue-600 font-medium">(You)</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}