/**
 * Advanced Character Counting Utilities
 * Handles platform-specific character counting rules including URLs, emojis, and graphemes
 */

// URL regex pattern for detecting URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Twitter URL length (all URLs count as 23 characters regardless of actual length)
const TWITTER_URL_LENGTH = 23;

/**
 * Count graphemes (visual characters) instead of bytes
 * This ensures emojis count as 1 character regardless of their byte length
 */
export function countGraphemes(text: string): number {
  // Use Intl.Segmenter for accurate grapheme counting if available
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text)).length;
    } catch (error) {
      // Fallback if Segmenter fails
    }
  }
  
  // Fallback: Use spread operator which handles most Unicode correctly
  return [...text].length;
}

/**
 * Count characters for Twitter/X with URL handling
 */
export function countTwitterCharacters(text: string): number {
  // Replace all URLs with placeholder of Twitter URL length
  const textWithUrlsReplaced = text.replace(URL_REGEX, 'x'.repeat(TWITTER_URL_LENGTH));
  
  // Count graphemes of the modified text
  return countGraphemes(textWithUrlsReplaced);
}

/**
 * Count characters for Bluesky (uses grapheme counting)
 */
export function countBlueskyCharacters(text: string): number {
  return countGraphemes(text);
}

/**
 * Count characters for most platforms (standard grapheme counting)
 */
export function countStandardCharacters(text: string): number {
  return countGraphemes(text);
}

/**
 * Get platform-specific character count
 */
export function getPlatformCharacterCount(text: string, platform: string): number {
  switch (platform) {
    case 'twitter':
      return countTwitterCharacters(text);
    case 'bluesky':
      return countBlueskyCharacters(text);
    default:
      return countStandardCharacters(text);
  }
}

/**
 * Check if user has Twitter Premium (placeholder - would need API integration)
 */
export function hasTwitterPremium(): boolean {
  // TODO: Integrate with user account data to check Twitter subscription
  return false;
}

/**
 * Get platform-specific character limit
 */
export function getPlatformLimit(platform: string): number {
  const limits: Record<string, number> = {
    twitter: hasTwitterPremium() ? 25000 : 280,
    linkedin: 3000,
    facebook: 63206,
    instagram: 2200,
    threads: 500,
    bluesky: 300,
    youtube: 5000,
    'google-business': 1500,
    pinterest: 500,
    tiktok: 2200,
  };
  
  return limits[platform] || 280;
}

/**
 * Get warning thresholds for character count
 */
export function getCharacterThresholds(limit: number) {
  return {
    warning: Math.floor(limit * 0.8),  // 80% - yellow warning
    danger: Math.floor(limit * 0.9),   // 90% - red warning
    limit: limit                       // 100% - over limit
  };
}

/**
 * Get character count status and color
 */
export function getCharacterStatus(count: number, limit: number) {
  const thresholds = getCharacterThresholds(limit);
  
  if (count > limit) {
    return { status: 'over', color: 'red', severity: 'error' };
  } else if (count > thresholds.danger) {
    return { status: 'danger', color: 'red', severity: 'warning' };
  } else if (count > thresholds.warning) {
    return { status: 'warning', color: 'yellow', severity: 'caution' };
  } else {
    return { status: 'good', color: 'green', severity: 'success' };
  }
}

/**
 * Get worst-case character count when posting to multiple platforms
 */
export function getWorstCaseCount(text: string, platforms: string[]): {
  count: number;
  platform: string;
  limit: number;
} {
  let worstCase = { count: 0, platform: '', limit: Infinity };
  
  for (const platform of platforms) {
    const count = getPlatformCharacterCount(text, platform);
    const limit = getPlatformLimit(platform);
    const ratio = count / limit;
    
    if (ratio > (worstCase.count / worstCase.limit)) {
      worstCase = { count, platform, limit };
    }
  }
  
  return worstCase;
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

/**
 * Get platform-specific warnings and tips
 */
export function getPlatformWarnings(platform: string, count: number, limit: number): string[] {
  const warnings: string[] = [];
  
  switch (platform) {
    case 'instagram':
      if (count > 125) {
        warnings.push('Caption will be truncated at 125 characters in feed');
      }
      break;
    case 'twitter':
      const urls = extractUrls(''); // Would need actual text
      if (urls.length > 0) {
        warnings.push(`URLs count as ${TWITTER_URL_LENGTH} characters each`);
      }
      break;
    case 'linkedin':
      if (count > 1300) {
        warnings.push('Posts over 1300 characters show "see more" link');
      }
      break;
  }
  
  return warnings;
}