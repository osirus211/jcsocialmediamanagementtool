/**
 * Security Hardening Tests
 */

import { scrubPii } from '../../utils/piiScrubber';
import * as fs from 'fs';
import * as path from 'path';

describe('Security Hardening', () => {
  describe('PII Scrubber', () => {
    it('should remove email addresses from text', () => {
      const result = scrubPii('My email is john@example.com');
      expect(result).toContain('[EMAIL]');
      expect(result).not.toContain('john@example.com');
    });

    it('should remove phone numbers from text', () => {
      const result = scrubPii('Call me at 555-123-4567');
      expect(result).toContain('[PHONE]');
      expect(result).not.toContain('555-123-4567');
    });

    it('should remove credit card numbers from text', () => {
      const result = scrubPii('My card is 4111 1111 1111 1111');
      expect(result).toContain('[CARD]');
      expect(result).not.toContain('4111 1111 1111 1111');
    });

    it('should NOT modify URLs containing email-like patterns', () => {
      const url = 'https://user@example.com/path';
      const result = scrubPii(url);
      expect(result).toBe(url);
    });

    it('should return original value for non-string input', () => {
      expect(scrubPii(null as any)).toBe(null);
      expect(scrubPii(undefined as any)).toBe(undefined);
      expect(scrubPii(123 as any)).toBe(123);
    });
  });

  describe('Rate Limiter Replacement', () => {
    it('should not export sentimentRateLimitMap from mentions.routes.ts', () => {
      const mentionsRoutesPath = path.join(__dirname, '../../routes/v1/mentions.routes.ts');
      const content = fs.readFileSync(mentionsRoutesPath, 'utf-8');
      
      expect(content).not.toContain('sentimentRateLimitMap');
      expect(content).toContain('SlidingWindowRateLimiter');
      expect(content).toContain('replySuggestionLimit');
    });
  });

  describe('CSP Headers', () => {
    it('should include frame-ancestors none in CSP', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).toContain('frame-ancestors');
      expect(content).toContain("'none'");
    });

    it('should include object-src none in CSP', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).toContain('object-src');
      expect(content).toContain("'none'");
    });

    it('should include upgrade-insecure-requests in CSP', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).toContain('upgrade-insecure-requests');
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should use timingSafeEqual for Facebook webhook signatures', () => {
      const facebookWebhookPath = path.join(__dirname, '../../providers/webhooks/FacebookWebhookProvider.ts');
      const content = fs.readFileSync(facebookWebhookPath, 'utf-8');
      
      expect(content).toContain('timingSafeEqual');
      expect(content).not.toMatch(/signature\s*===\s*[`'"]/);
    });

    it('should use timingSafeEqual for Twitter webhook signatures', () => {
      const twitterWebhookPath = path.join(__dirname, '../../providers/webhooks/TwitterWebhookProvider.ts');
      const content = fs.readFileSync(twitterWebhookPath, 'utf-8');
      
      expect(content).toContain('timingSafeEqual');
      expect(content).not.toMatch(/signature\s*===\s*[`'"]/);
    });
  });

  describe('Additional Security Headers', () => {
    it('should include Permissions-Policy header', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).toContain('Permissions-Policy');
    });

    it('should include Cross-Origin headers', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).toContain('Cross-Origin-Embedder-Policy');
      expect(content).toContain('Cross-Origin-Opener-Policy');
      expect(content).toContain('Cross-Origin-Resource-Policy');
    });
  });

  describe('Redis-backed Rate Limiting', () => {
    it('should use Redis for ipUserRateLimit', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).toContain('getRedisClient');
      expect(content).toContain('ipUserRate:');
      expect(content).toContain('zremrangebyscore');
      expect(content).toContain('zcard');
      expect(content).toContain('zadd');
    });

    it('should not use in-memory Map for ipUserRateLimit', () => {
      const securityPath = path.join(__dirname, '../../middleware/security.ts');
      const content = fs.readFileSync(securityPath, 'utf-8');
      
      expect(content).not.toContain('ipUserRequests = new Map');
    });
  });
});
