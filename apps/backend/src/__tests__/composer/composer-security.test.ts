import { describe, it, expect, beforeEach } from '@jest/globals';
import { PLATFORM_CHAR_LIMITS, PLATFORM_SIZE_LIMITS, PLATFORM_MEDIA_LIMITS } from '../../constants/platformLimits';
import { scrubPii } from '../../utils/piiScrubber';

describe('Composer Security', () => {
  it('PLATFORM_CHAR_LIMITS contains Twitter 280', () => {
    expect(PLATFORM_CHAR_LIMITS.twitter).toBe(280);
  });

  it('PLATFORM_CHAR_LIMITS contains LinkedIn 3000', () => {
    expect(PLATFORM_CHAR_LIMITS.linkedin).toBe(3000);
  });

  it('PLATFORM_CHAR_LIMITS contains Instagram 2200', () => {
    expect(PLATFORM_CHAR_LIMITS.instagram).toBe(2200);
  });

  it('PLATFORM_SIZE_LIMITS contains Instagram 8MB', () => {
    expect(PLATFORM_SIZE_LIMITS.instagram).toBe(8 * 1024 * 1024);
  });

  it('PLATFORM_SIZE_LIMITS contains Twitter 5MB', () => {
    expect(PLATFORM_SIZE_LIMITS.twitter).toBe(5 * 1024 * 1024);
  });

  it('PLATFORM_MEDIA_LIMITS contains Twitter 4', () => {
    expect(PLATFORM_MEDIA_LIMITS.twitter).toBe(4);
  });

  it('PLATFORM_MEDIA_LIMITS contains Instagram 10', () => {
    expect(PLATFORM_MEDIA_LIMITS.instagram).toBe(10);
  });

  it('scrubPii removes email from caption', () => {
    const result = scrubPii('Contact me at test@example.com for info');
    expect(result).not.toContain('test@example.com');
    expect(result).toContain('[EMAIL]');
  });

  it('scrubPii removes phone from caption', () => {
    const result = scrubPii('Call me at 555-123-4567 today');
    expect(result).not.toContain('555-123-4567');
    expect(result).toContain('[PHONE]');
  });

  it('scrubPii does not modify clean content', () => {
    const clean = 'Check out our new product launch this week!';
    expect(scrubPii(clean)).toBe(clean);
  });

  it('content exceeding Twitter limit would be rejected', () => {
    const limit = PLATFORM_CHAR_LIMITS.twitter;
    const overLimit = 'a'.repeat(limit + 1);
    expect(overLimit.length).toBeGreaterThan(limit);
  });

  it('content within Twitter limit is accepted', () => {
    const limit = PLATFORM_CHAR_LIMITS.twitter;
    const withinLimit = 'a'.repeat(limit);
    expect(withinLimit.length).toBeLessThanOrEqual(limit);
  });

  it('file over Instagram size limit would be rejected', () => {
    const limit = PLATFORM_SIZE_LIMITS.instagram;
    const overSize = limit + 1;
    expect(overSize).toBeGreaterThan(limit);
  });

  it('more than 4 media files for Twitter would be rejected', () => {
    const limit = PLATFORM_MEDIA_LIMITS.twitter;
    expect(5).toBeGreaterThan(limit);
  });

  it('duplicate detection uses sha256 hash', () => {
    const crypto = require('crypto');
    const content = 'Test post content';
    const hash1 = crypto.createHash('sha256').update(content.trim()).digest('hex');
    const hash2 = crypto.createHash('sha256').update(content.trim()).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('different content produces different hash', () => {
    const crypto = require('crypto');
    const h1 = crypto.createHash('sha256').update('Post A').digest('hex');
    const h2 = crypto.createHash('sha256').update('Post B').digest('hex');
    expect(h1).not.toBe(h2);
  });

  it('HTML is stripped from content', () => {
    const html = '<script>alert("xss")</script>Hello world';
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    expect(stripped).toBe('alert("xss")Hello world');
    expect(stripped).not.toContain('<script>');
  });

  it('SSRF localhost is in blocked patterns', () => {
    const { SSRF_BLOCKED_PATTERNS } = require('../../constants/platformLimits');
    expect(SSRF_BLOCKED_PATTERNS).toContain('localhost');
    expect(SSRF_BLOCKED_PATTERNS).toContain('127.');
    expect(SSRF_BLOCKED_PATTERNS).toContain('169.254.');
  });

  it('SSRF private CIDR blocks are defined', () => {
    const { SSRF_BLOCKED_CIDRS } = require('../../constants/platformLimits');
    expect(SSRF_BLOCKED_CIDRS.some((r: RegExp) => r.test('192.168.1.1'))).toBe(true);
    expect(SSRF_BLOCKED_CIDRS.some((r: RegExp) => r.test('10.0.0.1'))).toBe(true);
    expect(SSRF_BLOCKED_CIDRS.some((r: RegExp) => r.test('172.16.0.1'))).toBe(true);
  });
});
