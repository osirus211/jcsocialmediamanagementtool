/**
 * Engagement Rate Calculation Utility
 * 
 * Single source of truth for engagement rate formula across the application.
 * RULE 27: All engagement rate calculations must use this shared utility.
 */

/**
 * Calculate engagement rate as a percentage
 * @param likes Number of likes
 * @param comments Number of comments  
 * @param shares Number of shares
 * @param reach Number of people reached (or impressions if reach unavailable)
 * @returns Engagement rate as percentage (0-100)
 */
export function calcEngagementRate(
  likes: number,
  comments: number,
  shares: number,
  reach: number
): number {
  if (reach === 0) return 0;
  return ((likes + comments + shares) / reach) * 100;
}

/**
 * Calculate engagement rate including saves (for platforms that support it)
 * @param likes Number of likes
 * @param comments Number of comments
 * @param shares Number of shares
 * @param saves Number of saves (Instagram, etc.)
 * @param reach Number of people reached
 * @returns Engagement rate as percentage (0-100)
 */
export function calcEngagementRateWithSaves(
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  reach: number
): number {
  if (reach === 0) return 0;
  return ((likes + comments + shares + saves) / reach) * 100;
}