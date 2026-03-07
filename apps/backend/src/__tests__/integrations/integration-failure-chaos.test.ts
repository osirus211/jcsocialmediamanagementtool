/**
 * Integration Failure Chaos Tests
 * 
 * Phase 1 - Task 1.5: Test Integration Failure Scenarios
 * 
 * Comprehensive chaos testing simulating integration failures:
 * - OAuth provider down
 * - Media upload service down
 * - AI caption service down
 * - Email service down
 * - Multiple simultaneous failures
 * - Recovery scenarios
 * 
 * CRITICAL SAFETY INVARIANTS:
 * - Post publishing MUST succeed even if all integrations fail
 * - No duplicate posts allowed
 * - No missed posts allowed
 * - No unhandled exceptions
 * - Graceful degradation required
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockOAuthProvider } from '../../../../../.kiro/execution/chaos/MockOAuthProvider';
import { MockMediaUploadService } from '../../../../../.kiro/execution/chaos/MockMediaUploadService';
import { MockAICaptionService } from '../../../../../.kiro/execution/chaos/MockAICaptionService';
import { MockEmailService } from '../../../../../.kiro/execution/email/MockEmailService';
import { PostPublishWorkflow } from '../../../../../.kiro/execution/chaos/PostPublishWorkflow';

describe('Integration Failure Chaos Tests', () => {
  let oauthProvider: MockOAuthProvider;
  let mediaUploadService: MockMediaUploadService;
  let aiCaptionService: MockAICaptionService;
  let emailService: MockEmailService;
  let workflow: PostPublishWorkflow;

  beforeEach(() => {
    oauthProvider = new MockOAuthProvider();
    mediaUploadService = new MockMediaUploadService();
    aiCaptionService = new MockAICaptionService();
    emailService = new MockEmailService();
    workflow = new PostPublishWorkflow(
      oauthProvider,
      mediaUploadService,
      aiCaptionService,
      emailService
    );

    // Set up cached token for fallback scenarios
    oauthProvider.setCachedToken({
      accessToken: 'cached_token_123',
      refreshToken: 'cached_refresh_123',
      expiresAt: new Date(Date.now() + 3600000),
      provider: 'facebook',
      accountId: 'account_123',
    });
  });

  describe('A. OAuth Provider Failure', () => {
    it('should use cached tokens when OAuth provider returns 503', async () => {
      oauthProvider.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_1',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
      expect(result.warnings).toContain('OAuth provider unavailable, using cached token');
      expect(result.errors).toHaveLength(0);
    });

    it('should use cached tokens when OAuth provider times out', async () => {
      oauthProvider.setBehavior('timeout');

      const result = await workflow.publishPost({
        id: 'post_2',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
      expect(result.warnings).toContain('OAuth provider unavailable, using cached token');
    });

    it('should use cached tokens when OAuth token refresh fails', async () => {
      oauthProvider.setBehavior('invalid_token');

      const result = await workflow.publishPost({
        id: 'post_3',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
    });

    it('should handle OAuth provider down during post publish gracefully', async () => {
      oauthProvider.setBehavior('network_error');

      const result = await workflow.publishPost({
        id: 'post_4',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
    });

    it('should not block post publishing when OAuth fails', async () => {
      oauthProvider.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_5',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(workflow.getStats().successfulPublishes).toBe(1);
      expect(workflow.getStats().failedPublishes).toBe(0);
    });
  });

  describe('B. Media Upload Service Failure', () => {
    it('should publish as text-only when media upload service returns 503', async () => {
      mediaUploadService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_6',
        content: 'Test post with media',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.mediaUploaded).toBe(false);
      expect(result.warnings).toContain('Media upload failed, publishing as text-only');
    });

    it('should publish as text-only when media upload service times out', async () => {
      mediaUploadService.setBehavior('timeout');

      const result = await workflow.publishPost({
        id: 'post_7',
        content: 'Test post with media',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.mediaUploaded).toBe(false);
      expect(result.warnings).toContain('Media upload failed, publishing as text-only');
    });

    it('should publish as text-only when media upload has network error', async () => {
      mediaUploadService.setBehavior('network_error');

      const result = await workflow.publishPost({
        id: 'post_8',
        content: 'Test post with media',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.mediaUploaded).toBe(false);
    });

    it('should log media upload failure correctly', async () => {
      mediaUploadService.setBehavior('error_503');

      await workflow.publishPost({
        id: 'post_9',
        content: 'Test post with media',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });

      const stats = workflow.getStats();
      expect(stats.mediaUploadFailures).toBe(1);
    });

    it('should not block post publishing when media upload fails', async () => {
      mediaUploadService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_10',
        content: 'Test post with media',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });

      expect(result.success).toBe(true);
      expect(workflow.getStats().successfulPublishes).toBe(1);
    });
  });

  describe('C. AI Caption Service Failure', () => {
    it('should use fallback caption when AI service returns 503', async () => {
      aiCaptionService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_11',
        content: 'Test post',
        platform: 'facebook',
        userProvidedCaption: 'My custom caption',
      });

      expect(result.success).toBe(true);
      expect(result.aiCaptionUsed).toBe(false);
      expect(result.warnings).toContain('AI caption failed, using user-provided caption');
    });

    it('should use fallback caption when AI service times out', async () => {
      aiCaptionService.setBehavior('timeout');

      const result = await workflow.publishPost({
        id: 'post_12',
        content: 'Test post',
        platform: 'facebook',
        userProvidedCaption: 'My custom caption',
      });

      expect(result.success).toBe(true);
      expect(result.aiCaptionUsed).toBe(false);
    });

    it('should use fallback caption when AI service has network error', async () => {
      aiCaptionService.setBehavior('network_error');

      const result = await workflow.publishPost({
        id: 'post_13',
        content: 'Test post',
        platform: 'facebook',
        userProvidedCaption: 'My custom caption',
      });

      expect(result.success).toBe(true);
      expect(result.aiCaptionUsed).toBe(false);
    });

    it('should log AI failure correctly', async () => {
      aiCaptionService.setBehavior('error_503');

      await workflow.publishPost({
        id: 'post_14',
        content: 'Test post',
        platform: 'facebook',
      });

      const stats = workflow.getStats();
      expect(stats.aiCaptionFailures).toBe(1);
    });

    it('should not block post publishing when AI service fails', async () => {
      aiCaptionService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_15',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(workflow.getStats().successfulPublishes).toBe(1);
    });
  });

  describe('D. Email Service Failure', () => {
    it('should skip email when email service returns 503', async () => {
      emailService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_16',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);
      expect(result.warnings).toContain('Email notification failed');
    });

    it('should skip email when email service times out', async () => {
      emailService.setBehavior('timeout');

      const result = await workflow.publishPost({
        id: 'post_17',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);
      expect(result.warnings).toContain('Email notification failed');
    });

    it('should skip email when email service has network error', async () => {
      emailService.setBehavior('network_error');

      const result = await workflow.publishPost({
        id: 'post_18',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);
    });

    it('should log email failure correctly', async () => {
      emailService.setBehavior('error_503');

      await workflow.publishPost({
        id: 'post_19',
        content: 'Test post',
        platform: 'facebook',
      });

      const stats = workflow.getStats();
      expect(stats.emailFailures).toBe(1);
    });

    it('should not block any workflow when email fails', async () => {
      emailService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_20',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(workflow.getStats().successfulPublishes).toBe(1);
    });
  });

  describe('E. Multiple Simultaneous Failures', () => {
    it('should succeed when OAuth + Media both down', async () => {
      oauthProvider.setBehavior('error_503');
      mediaUploadService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_21',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
      expect(result.mediaUploaded).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should succeed when OAuth + AI both down', async () => {
      oauthProvider.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_22',
        content: 'Test post',
        platform: 'facebook',
        userProvidedCaption: 'Fallback caption',
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
      expect(result.aiCaptionUsed).toBe(false);
    });

    it('should succeed when Media + AI both down', async () => {
      mediaUploadService.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_23',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
        userProvidedCaption: 'Fallback caption',
      });

      expect(result.success).toBe(true);
      expect(result.mediaUploaded).toBe(false);
      expect(result.aiCaptionUsed).toBe(false);
    });

    it('should succeed when ALL services down (OAuth + Media + AI + Email)', async () => {
      oauthProvider.setBehavior('error_503');
      mediaUploadService.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');
      emailService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_24',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
        userProvidedCaption: 'Fallback caption',
      });

      expect(result.success).toBe(true);
      expect(result.usedCachedToken).toBe(true);
      expect(result.mediaUploaded).toBe(false);
      expect(result.aiCaptionUsed).toBe(false);
      expect(result.emailSent).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should not cause cascading failures when multiple services down', async () => {
      oauthProvider.setBehavior('error_503');
      mediaUploadService.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_25',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('F. Recovery Validation', () => {
    it('should acquire new tokens when OAuth provider recovers', async () => {
      // First attempt - provider down
      oauthProvider.setBehavior('error_503');
      const result1 = await workflow.publishPost({
        id: 'post_26',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result1.usedCachedToken).toBe(true);

      // Provider recovers
      oauthProvider.reset();
      oauthProvider.setBehavior('success');
      
      const result2 = await workflow.publishPost({
        id: 'post_27',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result2.usedCachedToken).toBe(false);
    });

    it('should resume media uploads when media service recovers', async () => {
      // First attempt - service down
      mediaUploadService.setBehavior('error_503');
      const result1 = await workflow.publishPost({
        id: 'post_28',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });
      expect(result1.mediaUploaded).toBe(false);

      // Service recovers
      mediaUploadService.reset();
      mediaUploadService.setBehavior('success');
      
      const result2 = await workflow.publishPost({
        id: 'post_29',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });
      expect(result2.mediaUploaded).toBe(true);
    });

    it('should resume AI captions when AI service recovers', async () => {
      // First attempt - service down
      aiCaptionService.setBehavior('error_503');
      const result1 = await workflow.publishPost({
        id: 'post_30',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result1.aiCaptionUsed).toBe(false);

      // Service recovers
      aiCaptionService.reset();
      aiCaptionService.setBehavior('success');
      
      const result2 = await workflow.publishPost({
        id: 'post_31',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result2.aiCaptionUsed).toBe(true);
    });

    it('should resume emails when email service recovers', async () => {
      // First attempt - service down
      emailService.setBehavior('error_503');
      const result1 = await workflow.publishPost({
        id: 'post_32',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result1.emailSent).toBe(false);

      // Service recovers
      emailService.reset();
      emailService.setBehavior('success');
      
      const result2 = await workflow.publishPost({
        id: 'post_33',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result2.emailSent).toBe(true);
    });

    it('should restore full functionality when all services recover', async () => {
      // All services down
      oauthProvider.setBehavior('error_503');
      mediaUploadService.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');
      emailService.setBehavior('error_503');

      const result1 = await workflow.publishPost({
        id: 'post_34',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });
      expect(result1.success).toBe(true);
      expect(result1.usedCachedToken).toBe(true);
      expect(result1.mediaUploaded).toBe(false);
      expect(result1.aiCaptionUsed).toBe(false);
      expect(result1.emailSent).toBe(false);

      // All services recover
      oauthProvider.reset();
      mediaUploadService.reset();
      aiCaptionService.reset();
      emailService.reset();

      const result2 = await workflow.publishPost({
        id: 'post_35',
        content: 'Test post',
        platform: 'facebook',
        media: {
          filename: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      });
      expect(result2.success).toBe(true);
      expect(result2.usedCachedToken).toBe(false);
      expect(result2.mediaUploaded).toBe(true);
      expect(result2.aiCaptionUsed).toBe(true);
      expect(result2.emailSent).toBe(true);
    });
  });

  describe('G. Safety Invariants', () => {
    it('should never create duplicate posts', async () => {
      const result1 = await workflow.publishPost({
        id: 'post_duplicate',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result1.success).toBe(true);

      const result2 = await workflow.publishPost({
        id: 'post_duplicate',
        content: 'Test post',
        platform: 'facebook',
      });
      expect(result2.success).toBe(false);
      expect(result2.errors).toContain('Duplicate post detected');
      expect(workflow.getStats().duplicates).toBe(1);
    });

    it('should never throw unhandled exceptions', async () => {
      oauthProvider.setBehavior('error_503');
      mediaUploadService.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');
      emailService.setBehavior('error_503');

      await expect(workflow.publishPost({
        id: 'post_36',
        content: 'Test post',
        platform: 'facebook',
      })).resolves.toBeDefined();
    });

    it('should maintain core workflow even with all failures', async () => {
      oauthProvider.setBehavior('error_503');
      mediaUploadService.setBehavior('error_503');
      aiCaptionService.setBehavior('error_503');
      emailService.setBehavior('error_503');

      const result = await workflow.publishPost({
        id: 'post_37',
        content: 'Test post',
        platform: 'facebook',
      });

      expect(result.success).toBe(true);
      expect(workflow.getStats().successfulPublishes).toBe(1);
      expect(workflow.getStats().failedPublishes).toBe(0);
    });
  });
});
