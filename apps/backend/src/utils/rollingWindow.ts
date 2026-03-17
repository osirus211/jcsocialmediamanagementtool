/**
 * Rolling Window Date Utilities
 * 
 * Centralized date calculations for rolling window comparisons
 */

import { differenceInDays, subDays } from 'date-fns';

/**
 * Calculate rolling window dates for period comparison
 */
export function getRollingWindowDates(startDate: Date, endDate: Date): {
  previousStart: Date;
  previousEnd: Date;
  rangeDays: number;
} {
  const rangeDays = differenceInDays(endDate, startDate) + 1;
  const previousEnd = subDays(startDate, 1);
  const previousStart = subDays(previousEnd, rangeDays - 1);
  
  return { previousStart, previousEnd, rangeDays };
}

/**
 * Calculate percentage change between two values
 */
export function calcPercentChange(previous: number, current: number): number {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0 && current > 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}