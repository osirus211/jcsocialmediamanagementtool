/**
 * Timezone Indicator for Calendar
 * 
 * Features that beat competitors:
 * - Shows current workspace timezone
 * - Displays current time in workspace timezone
 * - Shows user's local time for comparison
 * - Real-time clock updates
 * - Visual timezone offset indicator
 */

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatTimeWithTimezone, getUserTimezone, getTimezoneOffset } from '@/utils/timezones';
import { Globe, Clock, MapPin } from 'lucide-react';

export const TimezoneIndicator: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const workspaceTimezone = currentWorkspace?.settings?.timezone || 'UTC';
  const userTimezone = getUserTimezone();
  const workspaceOffset = getTimezoneOffset(workspaceTimezone);
  const userOffset = getTimezoneOffset(userTimezone);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const workspaceTime = formatTimeWithTimezone(currentTime, workspaceTimezone, false);
  const userTime = formatTimeWithTimezone(currentTime, userTimezone, false);
  const isDifferentTimezone = workspaceTimezone !== userTimezone;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Workspace Time */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Globe className="w-4 h-4" />
          <span>Workspace Time:</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-mono text-sm text-gray-900 dark:text-white">
            {workspaceTime}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
            {workspaceOffset}
          </span>
        </div>
      </div>

      {/* User Local Time (if different) */}
      {isDifferentTimezone && (
        <>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              <MapPin className="w-4 h-4" />
              <span>Your Local:</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="font-mono text-sm text-gray-900 dark:text-white">
                {userTime}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                {userOffset}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Timezone Name */}
      <div className="ml-auto">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {workspaceTimezone.split('/').pop()?.replace('_', ' ')}
          {isDifferentTimezone && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              (Local: {userTimezone.split('/').pop()?.replace('_', ' ')})
            </span>
          )}
        </span>
      </div>
    </div>
  );
};