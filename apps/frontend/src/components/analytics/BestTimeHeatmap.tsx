import { useState, useEffect } from 'react';
import { analyticsService, HeatmapData } from '@/services/analytics.service';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

interface BestTimeHeatmapProps {
  platform?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BestTimeHeatmap({ platform }: BestTimeHeatmapProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchHeatmapData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await analyticsService.getBestTimes(platform, currentWorkspace._id);
        setHeatmapData(response.heatmap);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load heatmap data';
        logger.error('Failed to fetch heatmap data', { error: errorMessage });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeatmapData();
  }, [platform, currentWorkspace]);

  const getEngagementForSlot = (dayOfWeek: number, hour: number): HeatmapData | null => {
    return heatmapData.find(d => d.dayOfWeek === dayOfWeek && d.hour === hour) || null;
  };

  const getMaxEngagement = (): number => {
    return Math.max(...heatmapData.map(d => d.avgEngagement), 1);
  };

  const getCellColor = (engagement: number, maxEngagement: number): string => {
    if (engagement === 0) return 'bg-gray-100';
    
    const intensity = engagement / maxEngagement;
    if (intensity >= 0.8) return 'bg-green-600';
    if (intensity >= 0.6) return 'bg-green-500';
    if (intensity >= 0.4) return 'bg-green-400';
    if (intensity >= 0.2) return 'bg-green-300';
    return 'bg-green-200';
  };

  const formatTime = (hour: number): string => {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="space-y-1">
          {/* Hour headers skeleton */}
          <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
            <div></div>
            {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
              <div key={hour} className="h-4 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
          
          {/* Grid skeleton */}
          {DAYS.map((_, dayIndex) => (
            <div key={dayIndex} className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              {HOURS.map(hour => (
                <div key={hour} className="h-6 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-2">Failed to load heatmap</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (heatmapData.length < 10) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-2">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Not enough data</h3>
        <p className="text-gray-500">
          Publish at least 10 posts to see your optimal posting times
        </p>
      </div>
    );
  }

  const maxEngagement = getMaxEngagement();

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Hover over cells to see engagement details
      </div>
      
      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour headers */}
          <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
            <div></div> {/* Empty corner */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className={`text-xs text-center text-gray-600 ${
                  hour % 3 === 0 ? 'font-medium' : 'opacity-50'
                }`}
              >
                {hour % 3 === 0 ? formatTime(hour) : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
              {/* Day label */}
              <div className="text-sm font-medium text-gray-700 text-right pr-2 py-1">
                {day}
              </div>
              
              {/* Hour cells */}
              {HOURS.map(hour => {
                const data = getEngagementForSlot(dayIndex, hour);
                const engagement = data?.avgEngagement || 0;
                const postCount = data?.postCount || 0;
                
                return (
                  <div
                    key={hour}
                    className={`h-6 rounded cursor-pointer transition-all hover:ring-2 hover:ring-blue-300 ${
                      getCellColor(engagement, maxEngagement)
                    }`}
                    title={
                      data
                        ? `${day} ${formatTime(hour)} — avg ${engagement.toFixed(1)}% engagement, ${postCount} posts`
                        : `${day} ${formatTime(hour)} — no data`
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Low engagement</span>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-100 rounded"></div>
          <div className="w-3 h-3 bg-green-200 rounded"></div>
          <div className="w-3 h-3 bg-green-300 rounded"></div>
          <div className="w-3 h-3 bg-green-400 rounded"></div>
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <div className="w-3 h-3 bg-green-600 rounded"></div>
        </div>
        <span>High engagement</span>
      </div>
    </div>
  );
}