/**
 * Timezone-Aware DateTime Picker
 * 
 * Features that beat competitors:
 * - Shows time in workspace timezone
 * - Displays user's local time alongside
 * - Prevents past date selection
 * - Smart timezone conversion
 * - Visual timezone indicators
 * - Optimal time suggestions
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatTimeWithTimezone, convertTimezone, getUserTimezone, getTimezoneOffset } from '@/utils/timezones';
import { Clock, Globe, MapPin } from 'lucide-react';

interface TimezoneAwareDateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  showOptimalTimes?: boolean;
  minDate?: Date;
}

export const TimezoneAwareDateTimePicker: React.FC<TimezoneAwareDateTimePickerProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label = 'Schedule Date & Time',
  showOptimalTimes = true,
  minDate,
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  const [localValue, setLocalValue] = useState('');
  
  const workspaceTimezone = currentWorkspace?.settings?.timezone || 'UTC';
  const userTimezone = useMemo(() => getUserTimezone(), []);
  const workspaceOffset = useMemo(() => getTimezoneOffset(workspaceTimezone), [workspaceTimezone]);
  const userOffset = useMemo(() => getTimezoneOffset(userTimezone), [userTimezone]);

  // Convert value to local input format
  useEffect(() => {
    if (value) {
      // Convert the UTC date to workspace timezone for display
      const workspaceDate = convertTimezone(value, 'UTC', workspaceTimezone);
      const localString = new Date(workspaceDate.getTime() - workspaceDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setLocalValue(localString);
    } else {
      setLocalValue('');
    }
  }, [value, workspaceTimezone]);

  const handleDateChange = (dateString: string) => {
    if (!dateString) {
      setLocalValue('');
      onChange(undefined);
      return;
    }

    setLocalValue(dateString);

    // Parse the input as if it's in workspace timezone
    const inputDate = new Date(dateString);
    
    // Convert from workspace timezone to UTC for storage
    const utcDate = convertTimezone(inputDate, workspaceTimezone, 'UTC');
    
    // Validate future date (compare in UTC)
    const now = new Date();
    const minDateTime = minDate || now;
    
    if (utcDate <= minDateTime) {
      // Don't update the value, but keep the local input for user feedback
      return;
    }

    onChange(utcDate);
  };

  const getOptimalTimes = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    // Optimal posting times in workspace timezone
    const optimalHours = [9, 12, 15, 18]; // 9 AM, 12 PM, 3 PM, 6 PM
    
    const suggestions = [];
    
    // Today's remaining optimal times
    optimalHours.forEach(hour => {
      const suggestionTime = new Date(today.getTime() + hour * 60 * 60 * 1000);
      const workspaceTime = convertTimezone(suggestionTime, userTimezone, workspaceTimezone);
      
      if (workspaceTime > now) {
        suggestions.push({
          label: `Today ${hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}`,
          date: suggestionTime,
          isToday: true
        });
      }
    });
    
    // Tomorrow's optimal times
    optimalHours.forEach(hour => {
      const suggestionTime = new Date(tomorrow.getTime() + hour * 60 * 60 * 1000);
      suggestions.push({
        label: `Tomorrow ${hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}`,
        date: suggestionTime,
        isToday: false
      });
    });
    
    return suggestions.slice(0, 6); // Show max 6 suggestions
  };

  const optimalTimes = useMemo(() => getOptimalTimes(), [workspaceTimezone]);

  const isValidDate = useMemo(() => {
    if (!localValue) return true;
    
    const inputDate = new Date(localValue);
    const utcDate = convertTimezone(inputDate, workspaceTimezone, 'UTC');
    const minDateTime = minDate || new Date();
    
    return utcDate > minDateTime;
  }, [localValue, workspaceTimezone, minDate]);

  const getPreviewTimes = () => {
    if (!localValue) return null;
    
    const inputDate = new Date(localValue);
    const workspaceTime = formatTimeWithTimezone(inputDate, workspaceTimezone, false);
    const userTime = formatTimeWithTimezone(inputDate, userTimezone, false);
    
    return { workspaceTime, userTime };
  };

  const previewTimes = getPreviewTimes();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Label and Timezone Info */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Globe className="w-3 h-3" />
          <span>Workspace: {workspaceOffset}</span>
          {workspaceTimezone !== userTimezone && (
            <>
              <span>•</span>
              <MapPin className="w-3 h-3" />
              <span>Local: {userOffset}</span>
            </>
          )}
        </div>
      </div>

      {/* DateTime Input */}
      <div className="relative">
        <input
          type="datetime-local"
          value={localValue}
          onChange={(e) => handleDateChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            ${!isValidDate ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Validation Error */}
      {!isValidDate && localValue && (
        <div className="text-sm text-red-600 dark:text-red-400">
          Scheduled time must be in the future
        </div>
      )}

      {/* Time Preview */}
      {previewTimes && isValidDate && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm">
            <div className="font-medium text-blue-900 dark:text-blue-100">
              📅 Workspace Time: {previewTimes.workspaceTime}
            </div>
            {workspaceTimezone !== userTimezone && (
              <div className="text-blue-700 dark:text-blue-300 mt-1">
                🌍 Your Local Time: {previewTimes.userTime}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Optimal Time Suggestions */}
      {showOptimalTimes && !disabled && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Optimal Times
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {optimalTimes.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const utcDate = convertTimezone(suggestion.date, userTimezone, 'UTC');
                  onChange(utcDate);
                }}
                className={`
                  px-3 py-2 text-xs rounded-md border transition-colors text-left
                  ${suggestion.isToday 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="font-medium">{suggestion.label}</div>
                <div className="text-xs opacity-75">
                  {formatTimeWithTimezone(suggestion.date, workspaceTimezone, false).split(' ').slice(-2).join(' ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timezone Help Text */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        💡 All times are shown in your workspace timezone ({workspaceTimezone.split('/').pop()?.replace('_', ' ')}).
        {workspaceTimezone !== userTimezone && ' Your local time is shown for reference.'}
      </div>
    </div>
  );
};