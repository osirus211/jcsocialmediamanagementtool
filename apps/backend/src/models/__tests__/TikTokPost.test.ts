import mongoose from 'mongoose';
import { TikTokPost, ITikTokPost, TikTokPublishStatus, TikTokPrivacyLevel } from '../TikTokPost';

describe('TikTokPost Model', () => {
  describe('Schema Validation', () => {
    it('should create a valid TikTokPost with required fields', () => {
      const postData = {
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test TikTok post',
        privacyLevel: TikTokPrivacyLevel.PUBLIC_TO_EVERYONE,
        disableComment: false,
        disableDuet: false,
        disableStitch: false,
        publishStatus: TikTokPublishStatus.DRAFT,
        retryCount: 0,
      };

      const post = new TikTokPost(postData);
      const validationError = post.validateSync();

      expect(validationError).toBeUndefined();
      expect(post.workspaceId).toEqual(postData.workspaceId);
      expect(post.socialAccountId).toEqual(postData.socialAccountId);
      expect(post.caption).toBe(postData.caption);
      expect(post.privacyLevel).toBe(TikTokPrivacyLevel.PUBLIC_TO_EVERYONE);
      expect(post.publishStatus).toBe(TikTokPublishStatus.DRAFT);
    });

    it('should fail validation without required fields', () => {
      const post = new TikTokPost({});
      const validationError = post.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors.workspaceId).toBeDefined();
      expect(validationError?.errors.socialAccountId).toBeDefined();
      expect(validationError?.errors.caption).toBeDefined();
    });

    it('should enforce caption maxlength of 2200 characters', () => {
      const longCaption = 'a'.repeat(2201);
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: longCaption,
      });

      const validationError = post.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError?.errors.caption).toBeDefined();
    });

    it('should accept valid privacy levels', () => {
      const validPrivacyLevels = [
        TikTokPrivacyLevel.PUBLIC_TO_EVERYONE,
        TikTokPrivacyLevel.MUTUAL_FOLLOW_FRIENDS,
        TikTokPrivacyLevel.SELF_ONLY,
      ];

      validPrivacyLevels.forEach((privacyLevel) => {
        const post = new TikTokPost({
          workspaceId: new mongoose.Types.ObjectId(),
          socialAccountId: new mongoose.Types.ObjectId(),
          caption: 'Test',
          privacyLevel,
        });

        const validationError = post.validateSync();
        expect(validationError).toBeUndefined();
        expect(post.privacyLevel).toBe(privacyLevel);
      });
    });

    it('should accept valid publish statuses', () => {
      const validStatuses = [
        TikTokPublishStatus.DRAFT,
        TikTokPublishStatus.UPLOADING,
        TikTokPublishStatus.SCHEDULED,
        TikTokPublishStatus.PUBLISHING,
        TikTokPublishStatus.PUBLISHED,
        TikTokPublishStatus.FAILED,
      ];

      validStatuses.forEach((status) => {
        const post = new TikTokPost({
          workspaceId: new mongoose.Types.ObjectId(),
          socialAccountId: new mongoose.Types.ObjectId(),
          caption: 'Test',
          publishStatus: status,
        });

        const validationError = post.validateSync();
        expect(validationError).toBeUndefined();
        expect(post.publishStatus).toBe(status);
      });
    });
  });

  describe('Model Methods', () => {
    it('canBeEdited should return true for draft posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.DRAFT,
      });

      expect(post.canBeEdited()).toBe(true);
    });

    it('canBeEdited should return true for scheduled posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.SCHEDULED,
      });

      expect(post.canBeEdited()).toBe(true);
    });

    it('canBeEdited should return false for published posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.PUBLISHED,
      });

      expect(post.canBeEdited()).toBe(false);
    });

    it('canBeDeleted should return true for draft posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.DRAFT,
      });

      expect(post.canBeDeleted()).toBe(true);
    });

    it('canBeDeleted should return false for publishing posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.PUBLISHING,
      });

      expect(post.canBeDeleted()).toBe(false);
    });

    it('canBeDeleted should return false for published posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.PUBLISHED,
      });

      expect(post.canBeDeleted()).toBe(false);
    });

    it('canBeScheduled should return true for draft posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.DRAFT,
      });

      expect(post.canBeScheduled()).toBe(true);
    });

    it('canBeScheduled should return false for non-draft posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.SCHEDULED,
      });

      expect(post.canBeScheduled()).toBe(false);
    });

    it('canBePublished should return true for draft posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.DRAFT,
      });

      expect(post.canBePublished()).toBe(true);
    });

    it('canBePublished should return true for failed posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.FAILED,
      });

      expect(post.canBePublished()).toBe(true);
    });

    it('canBePublished should return false for published posts', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.PUBLISHED,
      });

      expect(post.canBePublished()).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should set default values correctly', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
      });

      expect(post.privacyLevel).toBe(TikTokPrivacyLevel.PUBLIC_TO_EVERYONE);
      expect(post.disableComment).toBe(false);
      expect(post.disableDuet).toBe(false);
      expect(post.disableStitch).toBe(false);
      expect(post.publishStatus).toBe(TikTokPublishStatus.DRAFT);
      expect(post.retryCount).toBe(0);
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional video fields', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        videoId: 'video123',
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });

      const validationError = post.validateSync();
      expect(validationError).toBeUndefined();
      expect(post.videoId).toBe('video123');
      expect(post.videoUrl).toBe('https://example.com/video.mp4');
      expect(post.thumbnailUrl).toBe('https://example.com/thumb.jpg');
    });

    it('should allow optional scheduling fields', () => {
      const scheduledDate = new Date(Date.now() + 3600000); // 1 hour from now
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        publishStatus: TikTokPublishStatus.SCHEDULED,
        scheduledFor: scheduledDate,
      });

      const validationError = post.validateSync();
      expect(validationError).toBeUndefined();
      expect(post.scheduledFor).toEqual(scheduledDate);
    });

    it('should allow optional TikTok post fields', () => {
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        tiktokPostId: 'tiktok123',
        tiktokPostUrl: 'https://tiktok.com/@user/video/123',
      });

      const validationError = post.validateSync();
      expect(validationError).toBeUndefined();
      expect(post.tiktokPostId).toBe('tiktok123');
      expect(post.tiktokPostUrl).toBe('https://tiktok.com/@user/video/123');
    });

    it('should allow optional analytics fields', () => {
      const now = new Date();
      const post = new TikTokPost({
        workspaceId: new mongoose.Types.ObjectId(),
        socialAccountId: new mongoose.Types.ObjectId(),
        caption: 'Test',
        analytics: {
          viewCount: 1000,
          likeCount: 50,
          commentCount: 10,
          shareCount: 5,
          lastUpdatedAt: now,
        },
      });

      const validationError = post.validateSync();
      expect(validationError).toBeUndefined();
      expect(post.analytics?.viewCount).toBe(1000);
      expect(post.analytics?.likeCount).toBe(50);
      expect(post.analytics?.commentCount).toBe(10);
      expect(post.analytics?.shareCount).toBe(5);
      expect(post.analytics?.lastUpdatedAt).toEqual(now);
    });
  });
});
