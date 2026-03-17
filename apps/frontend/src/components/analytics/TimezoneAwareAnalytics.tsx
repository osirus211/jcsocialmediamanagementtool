/**
 * Timezone-Aware Analytics Component
 * 
 * Features that beat competitors:
 * - All analytics data shown in workspace timezone
 * - Date range picker respects workspace timezone
 * - Time-based charts use workspace timezone
 * - Engagement time analysis by timezone
 * - Optimal posting time suggestions based on workspace timezone
 */

import React, { useState, useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { 
  getWorkspaceDayBounds, 
  getWorkspaceWeekBounds, 
  getWorkspaceMonthBounds,
  formatInWorkspaceTimezone 
} from '@/utils/timezones';
import { TimezoneSelector } from '@/components/ui/TimezoneSelector';
import { Calendar, Clock, TrendingUp, BarChart3, Globe } from 'lucide-react';
import { calcEngagementRate } from '../../utils/engagementRate';

interface AnalyticsData {
  date: string;
  impressions: number;
  engagements: number;
  clicks: number;
  shares: number;
}

interface TimezoneAwareAnalyticsProps {
  data: AnalyticsData[];
  dateRange: {
    start: Date;
    end: Date;
  };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

export const TimezoneAwareAnalytics: React.FC<TimezoneAwareAnalyticsProps> = ({
  data,
  dateRange,
  onDateRangeChange,
}) => {
  const { currentWorkspace, updateWorkspace } = useWorkspaceStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);
  
  const workspaceTimezone = currentWorkspace?.settings?.timezone || 'UTC';

  // Convert analytics data to workspace timezone
  const timezoneAwareData = useMemo(() => {
    return data.map(item => ({
      ...item,
      localDate: formatInWorkspaceTimezone(new Date(item.date), workspaceTimezone, 'MMM dd, yyyy'),
      localTime: formatInWorkspaceTimezone(new Date(item.date), workspaceTimezone, 'HH:mm'),
    }));
  }, [data, workspaceTimezone]);

  // Get optimal posting times based on engagement data
  const optimalTimes = useMemo(() => {
    const hourlyEngagement: Record<number, number> = {};
    
    data.forEach(item => {
      const date = new Date(item.date);
      const workspaceDate = new Date(date.toLocaleString('en-US', { timeZone: workspaceTimezone }));
      const hour = workspaceDate.getHours();
      
      hourlyEngagement[hour] = (hourlyEngagement[hour] || 0) + item.engagements;
    });

    return Object.entries(hourlyEngagement)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([hour, engagements]) => ({
        hour: parseInt(hour),
        engagements,
        timeLabel: `${parseInt(hour) === 0 ? 12 : parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)}${parseInt(hour) >= 12 ? 'PM' : 'AM'}`
      }));
  }, [data, workspaceTimezone]);

  const handlePeriodChange = (period: 'day' | 'week' | 'month') => {
    setSelectedPeriod(period);
    
    const now = new Date();
    let newRange;
    
    switch (period) {
      case 'day':
        newRange = getWorkspaceDayBounds(now, workspaceTimezone);
        break;
      case 'week':
        newRange = getWorkspaceWeekBounds(now, workspaceTimezone);
        break;
      case 'month':
        newRange = getWorkspaceMonthBounds(now, workspaceTimezone);
        break;
    }
    
    onDateRangeChange(newRange);
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    if (currentWorkspace) {
      try {
        await updateWorkspace(currentWorkspace._id, {
          settings: {
            ...currentWorkspace.settings,
            timezone: newTimezone
          }
        });
        setShowTimezoneSelector(false);
      } catch (error) {
        console.error('Failed to update timezone:', error);
      }
    }
  };

  const totalEngagements = timezoneAwareData.reduce((sum, item) => sum + item.engagements, 0);
  const totalImpressions = timezoneAwareData.reduce((sum, item) => sum + item.impressions, 0);
  const engagementRate = calcEngagementRate(0, 0, totalEngagements, totalImpressions).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header with Timezone Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            All data shown in workspace timezone
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Current Timezone Display */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Globe className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {workspaceTimezone.split('/').pop()?.replace('_', ' ')}
            </span>
            <button
              onClick={() => setShowTimezoneSelector(!showTimezoneSelector)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Change
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['day', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  selectedPeriod === period
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timezone Selector Dropdown */}
      {showTimezoneSelector && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Change Analytics Timezone
          </h3>
          <TimezoneSelector
            value={workspaceTimezone}
            onChange={handleTimezoneChange}
            className="max-w-md"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            This will update your workspace timezone and refresh all analytics data.
          </p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Impressions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalImpressions.toLocaleString()}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Engagements</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalEngagements.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{engagementRate}%</p>
            </div>
            <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Optimal Posting Times */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Optimal Posting Times (Workspace Timezone)
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {optimalTimes.map((time, index) => (
            <div
              key={time.hour}
              className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {time.timeLabel}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {time.engagements} engagements
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                #{index + 1} best time
              </div>
            </div>
          ))}
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          💡 These times are calculated based on your historical engagement data in the {workspaceTimezone.split('/').pop()?.replace('_', ' ')} timezone.
        </p>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Performance by Date
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date (Workspace Time)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Impressions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Engagements
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {timezoneAwareData.map((item, index) => {
                const rate = item.impressions > 0 ? (item.engagements / item.impressions * 100).toFixed(2) : '0';
                return (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.localDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.impressions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.engagements.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {rate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};