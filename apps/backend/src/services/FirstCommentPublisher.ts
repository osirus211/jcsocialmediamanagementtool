import { logger } from '../utils/logger';
import { httpClient } from '../services/HttpClientService';
import { SocialAccount } from '../models/SocialAccount';
import { Post } from '../models/Post';

const INSTAGRAM_API_BASE = 'https://graph.instagram.com/v21.0';
const FACEBOOK_API_BASE = 'https://graph.facebook.com/v21.0';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

export class FirstCommentPublisher {
  constructor() {
    // No need to initialize httpClient as it's a singleton
  }

  /**
   * Post first comment to Instagram
   */
  async postInstagramFirstComment(
    accountId: string,
    postId: string,
    content: string
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Social account not found');
      }

      const response = await httpClient.post(
        `${INSTAGRAM_API_BASE}/${postId}/comments`,
        {
          message: content,
          access_token: account.accessToken,
        }
      );

      logger.info('Instagram first comment posted successfully', {
        postId,
        commentId: response.data.id,
        accountId,
      });

      return {
        success: true,
        commentId: response.data.id,
      };
    } catch (error: any) {
      logger.error('Failed to post Instagram first comment', {
        postId,
        accountId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Post first comment to Facebook
   */
  async postFacebookFirstComment(
    accountId: string,
    postId: string,
    content: string
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Social account not found');
      }

      const response = await httpClient.post(
        `${FACEBOOK_API_BASE}/${postId}/comments`,
        {
          message: content,
          access_token: account.accessToken,
        }
      );

      logger.info('Facebook first comment posted successfully', {
        postId,
        commentId: response.data.id,
        accountId,
      });

      return {
        success: true,
        commentId: response.data.id,
      };
    } catch (error: any) {
      logger.error('Failed to post Facebook first comment', {
        postId,
        accountId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Post first comment to LinkedIn
   */
  async postLinkedInFirstComment(
    accountId: string,
    postId: string,
    content: string
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        throw new Error('Social account not found');
      }

      // LinkedIn uses URN format for post IDs
      const postUrn = `urn:li:share:${postId}`;

      const response = await httpClient.post(
        `${LINKEDIN_API_BASE}/socialActions/${encodeURIComponent(postUrn)}/comments`,
        {
          actor: `urn:li:person:${account.platformAccountId}`,
          message: {
            text: content,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('LinkedIn first comment posted successfully', {
        postId,
        commentId: response.data.id,
        accountId,
      });

      return {
        success: true,
        commentId: response.data.id,
      };
    } catch (error: any) {
      logger.error('Failed to post LinkedIn first comment', {
        postId,
        accountId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle first comment failure
   */
  async handleFirstCommentFailure(postId: string, error: string): Promise<void> {
    try {
      await Post.findByIdAndUpdate(postId, {
        firstCommentStatus: 'failed',
        errorMessage: error,
      });

      logger.error('First comment marked as failed', {
        postId,
        error,
      });
    } catch (updateError: any) {
      logger.error('Failed to update first comment failure status', {
        postId,
        error: updateError.message,
      });
    }
  }

  /**
   * Retry first comment
   */
  async retryFirstComment(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const post = await Post.findById(postId).populate('socialAccountId');
      if (!post) {
        throw new Error('Post not found');
      }

      if (!post.firstComment?.enabled || !post.firstComment?.content) {
        throw new Error('First comment not configured');
      }

      if (!post.metadata?.platformPostId) {
        throw new Error('Original post not published yet');
      }

      // Update status to pending
      await Post.findByIdAndUpdate(postId, {
        firstCommentStatus: 'pending',
        errorMessage: undefined,
      });

      // Determine platform and post comment
      const account = post.socialAccountId as any;
      let result;

      switch (account.platform) {
        case 'instagram':
          result = await this.postInstagramFirstComment(
            account._id.toString(),
            post.metadata.platformPostId,
            post.firstComment.content
          );
          break;
        case 'facebook':
          result = await this.postFacebookFirstComment(
            account._id.toString(),
            post.metadata.platformPostId,
            post.firstComment.content
          );
          break;
        case 'linkedin':
          result = await this.postLinkedInFirstComment(
            account._id.toString(),
            post.metadata.platformPostId,
            post.firstComment.content
          );
          break;
        default:
          throw new Error(`Platform ${account.platform} not supported for first comments`);
      }

      if (result.success) {
        await Post.findByIdAndUpdate(postId, {
          firstCommentId: result.commentId,
          firstCommentPostedAt: new Date(),
          firstCommentStatus: 'posted',
        });
      } else {
        await this.handleFirstCommentFailure(postId, result.error || 'Unknown error');
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to retry first comment', {
        postId,
        error: error.message,
      });

      await this.handleFirstCommentFailure(postId, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }
}