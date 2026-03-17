/**
 * Best Times Heatmap Component
 * 
 * Displays optimal posting times as a heatmap
 */

import React from 'react';
import { Card } from '../../ui/card';
import type { BestTimeHeatmap } from '../../../types/analytics.types';

interface BestTimesHeatmapProps {
  data: BestTimeHeatmap[];
  className?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const BestTimesHeatmap: React.FC<BestTimesHeatmapProps> = ({ data, className }) => {
  // Create a map for quick lookup
  const dataMap = new Map<string, BestTimeHeatmap>();
  data.forEach(item => {
    dataMap.set(`${item.day}-${item.hour}`, item);
  });

  // Find max engagement score for color scaling
  const maxScore = Math.max(...data.map(d => d.engagementRate), 1);

  const getIntensity = (score: number): number => {
    return Math.min(score / maxScore, 1);
  };

  const getColorClass = (intensity: number): string => {
    if (intensity === 0) return 'bg-gray-100';
    if (intensity < 0.2) return 'bg-blue-100';
    if (intensity < 0.4) return 'bg-blue-200';
    if (intensity < 0.6) return 'bg-blue-300';
    if (intensity < 0.8) return 'bg-blue-400';
    return 'bg-blue-500';
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const formatScore = (score: number): string => {
    return `${score.toFixed(1)}%`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Legend */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Lower engagement</span>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-100 rounded"></div>
          <div className="w-3 h-3 bg-blue-100 rounded"></div>
          <div className="w-3 h-3 bg-blue-200 rounded"></div>
          <div className="w-3 h-3 bg-blue-300 rounded"></div>
          <div className="w-3 h-3 bg-blue-400 rounded"></div>
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
        </div>
        <span>Higher engagement</span>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Hour labels */}
          <div className="grid grid-cols-25 gap-1 mb-2">
            <div className="text-xs text-gray-500"></div> {/* Empty corner */}
            {HOURS.map(hour => (
              <div key={hour} className="text-xs text-gray-500 text-center">
                {hour % 4 === 0 ? formatHour(hour) : ''}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="grid grid-cols-25 gap-1 mb-1">
              {/* Day label */}
              <div className="text-xs text-gray-500 flex items-center justify-end pr-2">
                {day}
              </div>
              
              {/* Hour cells */}
              {HOURS.map(hour => {
                const cellData = dataMap.get(`${dayIndex}-${hour}`);
                const score = cellData?.engagementRate || 0;
                const postCount = cellData?.postCount || 0;
                const intensity = getIntensity(score);
                const colorClass = getColorClass(intensity);

                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`
                      w-6 h-6 rounded-sm cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-md
                      ${colorClass}
                      ${postCount > 0 ? 'border border-gray-300' : ''}
                    `}
                    title={`${day} ${formatHour(hour)}\nEngagement: ${formatScore(score)}\nPosts: ${postCount}`}
                  >
                    {/* Optional: Show score in high-engagement cells */}
                    {intensity > 0.6 && (
                      <div className="text-xs text-white font-medium text-center leading-6">
                        {Math.round(score)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Best times summary */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Top Performing Times</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data
            .filter(d => d.postCount > 0)
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .slice(0, 6)
            .map((item, index) => (
              <Card key={`${item.day}-${item.hour}`} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {DAYS[item.day]} {formatHour(item.hour)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.postCount} posts
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">
                      {formatScore(item.engagementRate)}
                    </p>
                    <p className="text-xs text-gray-500">
                      #{index + 1}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Mobile-friendly summary for small screens */}
      <div className="block sm:hidden mt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Peak Hours by Day</h4>
        <div className="space-y-2">
          {DAYS.map((day, dayIndex) => {
            const dayData = data.filter(d => d.day === dayIndex.toString() && d.postCount > 0);
            const bestHour = dayData.reduce((best, current) => 
              current.engagementRate > best.engagementRate ? current : best,
              { engagementRate: 0, hour: 0, postCount: 0, day: dayIndex.toString() } as BestTimeHeatmap
            );

            return (
              <div key={day} className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium">{day}</span>
                {bestHour.postCount > 0 ? (
                  <span className="text-sm text-blue-600">
                    {formatHour(bestHour.hour)} ({formatScore(bestHour.engagementRate)})
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">No data</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};