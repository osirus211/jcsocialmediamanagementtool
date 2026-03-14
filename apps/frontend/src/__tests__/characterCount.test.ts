import { describe, it, expect } from 'vitest';
import {
  countGraphemes,
  countTwitterCharacters,
  countBlueskyCharacters,
  countStandardCharacters,
  getPlatformCharacterCount,
  getPlatformLimit,
  getCharacterThresholds,
  getCharacterStatus,
  getWorstCaseCount,
  extractUrls,
  getPlatformWarnings
} from '@/utils/characterCount';

describe('Character Count Utilities', () => {
  describe('countGraphemes', () => {
    it('should count basic ASCII characters correctly', () => {
      expect(countGraphemes('Hello World')).toBe(11);
    });

    it('should count emojis as single characters', () => {
      expect(countGraphemes('Hello 👋 World 🌍')).toBe(15);
      expect(countGraphemes('🔥🚀💯')).toBe(3);
    });

    it('should handle complex emojis with modifiers', () => {
      expect(countGraphemes('👨‍💻')).toBe(1); // Man technologist
      expect(countGraphemes('👩🏽‍💼')).toBe(1); // Woman office worker with skin tone
    });

    it('should handle empty string', () => {
      expect(countGraphemes('')).toBe(0);
    });
  });

  describe('countTwitterCharacters', () => {
    it('should count regular text normally', () => {
      expect(countTwitterCharacters('Hello World')).toBe(11);
    });

    it('should count URLs as 23 characters', () => {
      expect(countTwitterCharacters('Check this out: https://example.com')).toBe(39); // 16 + 23
    });

    it('should count multiple URLs correctly', () => {
      const text = 'Links: https://example.com and https://another-very-long-url.com/path/to/resource';
      expect(countTwitterCharacters(text)).toBe(11 + 23 + 23); // "Links:  and " + 2 URLs
    });

    it('should handle URLs with emojis', () => {
      expect(countTwitterCharacters('🔥 https://example.com 🚀')).toBe(4 + 23); // 2 emojis + 2 spaces + URL
    });
  });

  describe('getPlatformCharacterCount', () => {
    it('should use Twitter counting for Twitter', () => {
      const text = 'Check https://example.com';
      expect(getPlatformCharacterCount(text, 'twitter')).toBe(countTwitterCharacters(text));
    });

    it('should use Bluesky counting for Bluesky', () => {
      const text = 'Hello 👋 World';
      expect(getPlatformCharacterCount(text, 'bluesky')).toBe(countBlueskyCharacters(text));
    });

    it('should use standard counting for other platforms', () => {
      const text = 'Hello 👋 World';
      expect(getPlatformCharacterCount(text, 'instagram')).toBe(countStandardCharacters(text));
      expect(getPlatformCharacterCount(text, 'linkedin')).toBe(countStandardCharacters(text));
    });
  });

  describe('getPlatformLimit', () => {
    it('should return correct limits for each platform', () => {
      expect(getPlatformLimit('twitter')).toBe(280); // Free tier
      expect(getPlatformLimit('instagram')).toBe(2200);
      expect(getPlatformLimit('linkedin')).toBe(3000);
      expect(getPlatformLimit('facebook')).toBe(63206);
      expect(getPlatformLimit('threads')).toBe(500);
      expect(getPlatformLimit('bluesky')).toBe(300);
      expect(getPlatformLimit('youtube')).toBe(5000);
      expect(getPlatformLimit('google-business')).toBe(1500);
      expect(getPlatformLimit('pinterest')).toBe(500);
      expect(getPlatformLimit('tiktok')).toBe(2200);
    });

    it('should return default limit for unknown platforms', () => {
      expect(getPlatformLimit('unknown-platform')).toBe(280);
    });
  });

  describe('getCharacterThresholds', () => {
    it('should calculate correct thresholds', () => {
      const thresholds = getCharacterThresholds(280);
      expect(thresholds.warning).toBe(224); // 80% of 280
      expect(thresholds.danger).toBe(252);  // 90% of 280
      expect(thresholds.limit).toBe(280);
    });
  });

  describe('getCharacterStatus', () => {
    it('should return correct status for different counts', () => {
      expect(getCharacterStatus(100, 280)).toEqual({
        status: 'good',
        color: 'green',
        severity: 'success'
      });

      expect(getCharacterStatus(250, 280)).toEqual({
        status: 'warning',
        color: 'yellow',
        severity: 'caution'
      });

      expect(getCharacterStatus(270, 280)).toEqual({
        status: 'danger',
        color: 'red',
        severity: 'warning'
      });

      expect(getCharacterStatus(300, 280)).toEqual({
        status: 'over',
        color: 'red',
        severity: 'error'
      });
    });
  });

  describe('getWorstCaseCount', () => {
    it('should find platform with highest character ratio', () => {
      const text = 'Hello World'; // 11 characters
      const platforms = ['twitter', 'bluesky']; // 280 vs 300 limits
      
      const worstCase = getWorstCaseCount(text, platforms);
      expect(worstCase.platform).toBe('twitter'); // Higher ratio: 11/280 > 11/300
      expect(worstCase.count).toBe(11);
      expect(worstCase.limit).toBe(280);
    });

    it('should handle URLs correctly in worst case', () => {
      const text = 'Check https://example.com'; // 6 + 23 = 29 for Twitter, 25 for others
      const platforms = ['twitter', 'instagram'];
      
      const worstCase = getWorstCaseCount(text, platforms);
      expect(worstCase.platform).toBe('twitter');
      expect(worstCase.count).toBe(29); // Twitter URL counting
    });
  });

  describe('extractUrls', () => {
    it('should extract HTTP and HTTPS URLs', () => {
      const text = 'Visit https://example.com and http://test.org';
      const urls = extractUrls(text);
      expect(urls).toEqual(['https://example.com', 'http://test.org']);
    });

    it('should return empty array when no URLs', () => {
      expect(extractUrls('No URLs here')).toEqual([]);
    });
  });

  describe('getPlatformWarnings', () => {
    it('should warn about Instagram truncation', () => {
      const warnings = getPlatformWarnings('instagram', 200, 2200);
      expect(warnings).toContain('Caption will be truncated at 125 characters in feed');
    });

    it('should warn about LinkedIn see more', () => {
      const warnings = getPlatformWarnings('linkedin', 1500, 3000);
      expect(warnings).toContain('Posts over 1300 characters show "see more" link');
    });

    it('should return empty array for short content', () => {
      const warnings = getPlatformWarnings('instagram', 50, 2200);
      expect(warnings).toEqual([]);
    });
  });
});

describe('Real-world scenarios', () => {
  it('should handle typical social media post with emojis and hashtags', () => {
    const text = 'Just launched our new product! 🚀 So excited to share this with everyone. Check it out at https://oursite.com #startup #tech #innovation';
    
    // Twitter should count URL as 23 chars
    const twitterCount = getPlatformCharacterCount(text, 'twitter');
    const expectedTwitter = countGraphemes('Just launched our new product! 🚀 So excited to share this with everyone. Check it out at ') + 23 + countGraphemes(' #startup #tech #innovation');
    expect(twitterCount).toBe(expectedTwitter);
    
    // Instagram should count normally
    const instagramCount = getPlatformCharacterCount(text, 'instagram');
    expect(instagramCount).toBe(countGraphemes(text));
  });

  it('should correctly identify when content is over limit', () => {
    const longText = 'A'.repeat(300); // 300 characters
    
    expect(getCharacterStatus(300, 280).severity).toBe('error');
    expect(getCharacterStatus(250, 280).severity).toBe('warning');
    expect(getCharacterStatus(200, 280).severity).toBe('success');
  });

  it('should handle multi-platform posting correctly', () => {
    const text = 'Short post with https://example.com';
    const platforms = ['twitter', 'instagram', 'linkedin'];
    
    const worstCase = getWorstCaseCount(text, platforms);
    
    // Twitter should be worst case due to URL counting
    expect(worstCase.platform).toBe('twitter');
    expect(worstCase.count).toBeGreaterThan(getPlatformCharacterCount(text, 'instagram'));
  });
});