/**
 * Backend Timezone Utilities
 * 
 * Features that beat competitors:
 * - Server-side timezone validation
 * - Automatic DST handling
 * - Timezone conversion for scheduled posts
 * - Analytics timezone support
 * - Multi-timezone post scheduling
 */

import { DateTime } from 'luxon';

/**
 * Validate IANA timezone identifier
 */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    DateTime.now().setZone(timezone);
    return true;
  } catch {
    return false;
  }
};

/**
 * Convert date to workspace timezone
 */
export const convertToWorkspaceTimezone = (date: Date, workspaceTimezone: string): DateTime => {
  try {
    return DateTime.fromJSDate(date).setZone(workspaceTimezone);
  } catch {
    return DateTime.fromJSDate(date).setZone('UTC');
  }
};

/**
 * Convert scheduled time from workspace timezone to UTC for storage
 */
export const convertScheduledTimeToUTC = (
  scheduledTime: Date,
  workspaceTimezone: string
): Date => {
  try {
    // Parse the scheduled time as if it's in the workspace timezone
    const workspaceDateTime = DateTime.fromJSDate(scheduledTime, { zone: workspaceTimezone });
    return workspaceDateTime.toUTC().toJSDate();
  } catch {
    return scheduledTime;
  }
};

/**
 * Convert UTC time to workspace timezone for display
 */
export const convertUTCToWorkspaceTime = (
  utcTime: Date,
  workspaceTimezone: string
): Date => {
  try {
    const utcDateTime = DateTime.fromJSDate(utcTime, { zone: 'UTC' });
    return utcDateTime.setZone(workspaceTimezone).toJSDate();
  } catch {
    return utcTime;
  }
};

/**
 * Get timezone offset for a specific timezone
 */
export const getTimezoneOffset = (timezone: string): string => {
  try {
    const now = DateTime.now().setZone(timezone);
    const offset = now.offset;
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch {
    return 'UTC+00:00';
  }
};

/**
 * Format date in workspace timezone
 */
export const formatInWorkspaceTimezone = (
  date: Date,
  workspaceTimezone: string,
  format: string = 'yyyy-MM-dd HH:mm:ss'
): string => {
  try {
    return DateTime.fromJSDate(date).setZone(workspaceTimezone).toFormat(format);
  } catch {
    return DateTime.fromJSDate(date).toFormat(format);
  }
};

/**
 * Get start and end of day in workspace timezone
 */
export const getWorkspaceDayBounds = (
  date: Date,
  workspaceTimezone: string
): { startOfDay: Date; endOfDay: Date } => {
  try {
    const workspaceDate = DateTime.fromJSDate(date).setZone(workspaceTimezone);
    const startOfDay = workspaceDate.startOf('day').toUTC().toJSDate();
    const endOfDay = workspaceDate.endOf('day').toUTC().toJSDate();
    return { startOfDay, endOfDay };
  } catch {
    const utcDate = DateTime.fromJSDate(date).toUTC();
    return {
      startOfDay: utcDate.startOf('day').toJSDate(),
      endOfDay: utcDate.endOf('day').toJSDate()
    };
  }
};

/**
 * Get week bounds in workspace timezone
 */
export const getWorkspaceWeekBounds = (
  date: Date,
  workspaceTimezone: string
): { startOfWeek: Date; endOfWeek: Date } => {
  try {
    const workspaceDate = DateTime.fromJSDate(date).setZone(workspaceTimezone);
    const startOfWeek = workspaceDate.startOf('week').toUTC().toJSDate();
    const endOfWeek = workspaceDate.endOf('week').toUTC().toJSDate();
    return { startOfWeek, endOfWeek };
  } catch {
    const utcDate = DateTime.fromJSDate(date).toUTC();
    return {
      startOfWeek: utcDate.startOf('week').toJSDate(),
      endOfWeek: utcDate.endOf('week').toJSDate()
    };
  }
};

/**
 * Get month bounds in workspace timezone
 */
export const getWorkspaceMonthBounds = (
  date: Date,
  workspaceTimezone: string
): { startOfMonth: Date; endOfMonth: Date } => {
  try {
    const workspaceDate = DateTime.fromJSDate(date).setZone(workspaceTimezone);
    const startOfMonth = workspaceDate.startOf('month').toUTC().toJSDate();
    const endOfMonth = workspaceDate.endOf('month').toUTC().toJSDate();
    return { startOfMonth, endOfMonth };
  } catch {
    const utcDate = DateTime.fromJSDate(date).toUTC();
    return {
      startOfMonth: utcDate.startOf('month').toJSDate(),
      endOfMonth: utcDate.endOf('month').toJSDate()
    };
  }
};

/**
 * Check if a time is within business hours for a timezone
 */
export const isWithinBusinessHours = (
  date: Date,
  workspaceTimezone: string,
  startHour: number = 9,
  endHour: number = 17
): boolean => {
  try {
    const workspaceTime = DateTime.fromJSDate(date).setZone(workspaceTimezone);
    const hour = workspaceTime.hour;
    return hour >= startHour && hour < endHour;
  } catch {
    return false;
  }
};

/**
 * Get optimal posting times for a timezone (based on social media best practices)
 */
export const getOptimalPostingTimes = (workspaceTimezone: string): Date[] => {
  try {
    const now = DateTime.now().setZone(workspaceTimezone);
    const today = now.startOf('day');
    
    // Best times: 9 AM, 12 PM, 3 PM, 6 PM in workspace timezone
    const optimalHours = [9, 12, 15, 18];
    
    return optimalHours.map(hour => 
      today.plus({ hours: hour }).toUTC().toJSDate()
    );
  } catch {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return [9, 12, 15, 18].map(hour => 
      new Date(today.getTime() + hour * 60 * 60 * 1000)
    );
  }
};

/**
 * Calculate time until next optimal posting time
 */
export const getTimeUntilNextOptimalPost = (workspaceTimezone: string): number => {
  try {
    const now = DateTime.now().setZone(workspaceTimezone);
    const optimalTimes = getOptimalPostingTimes(workspaceTimezone);
    
    const nextOptimalTime = optimalTimes.find(time => 
      DateTime.fromJSDate(time).setZone(workspaceTimezone) > now
    );
    
    if (nextOptimalTime) {
      return DateTime.fromJSDate(nextOptimalTime).setZone(workspaceTimezone).diff(now).milliseconds;
    }
    
    // If no optimal time today, get first optimal time tomorrow
    const tomorrow = now.plus({ days: 1 }).startOf('day');
    const firstOptimalTomorrow = tomorrow.plus({ hours: 9 });
    return firstOptimalTomorrow.diff(now).milliseconds;
  } catch {
    return 0;
  }
};

/**
 * Validate timezone and provide fallback
 */
export const validateTimezoneWithFallback = (timezone: string, fallback: string = 'UTC'): string => {
  if (isValidTimezone(timezone)) {
    return timezone;
  }
  return fallback;
};