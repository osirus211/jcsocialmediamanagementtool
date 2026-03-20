/**
 * Bluesky Publisher
 * 
 * Publishes posts to Bluesky using AT Protocol
 * Supports text, images, videos, links, threads, and rich text features
 */

import { BskyAgent, RichText } from '@atproto/api';
import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import { TokenEncryptionService } from '../../services/TokenEncryptionService';
import axios from 'axios';

const MAX_CONTENT_LENGTH = 300;
const MAX_MEDIA_COUNT = 4;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_DURATION = 180; // 3 minutes

interface BlobRef {
  $type: string;
  ref: {
    $link: string;
  };
  mimeType: string;
  size: number;
}

interface Facet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<{
    $type: string;
    [key: string]: any;
  }>;
}

export class BlueskyPublisher extends BasePublisher {
  readonly platform = 'bluesky';
  protected readonly requiredScopes = ['atproto', 'com.atproto.repo.createRecord'];
  private readonly service = 'https://bsky.social';
  private readonly videoService = 'https://video.bsky.app';
  private tokenEncryption: TokenEncryptionService;

  constructor() {
    super();
    this.tokenEncryption = new TokenEncryptionService();
  }

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    this.validatePlatformScopes(account);
    const { content, mediaIds = [], threadPosts = [] } = options;

    this.validateContentLength(content, MAX_CONTENT_LENGTH);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    try {
      const agent = await this.getAuthenticatedAgent(account);

      // Handle thread posts
      if (threadPosts && threadPosts.length > 0) {
        return await this.publishThread(agent, account, [content, ...threadPosts], mediaIds);
      }

      // Single post
      const result = await this.publishSinglePost(agent, account, content, mediaIds);
      return result;
    } catch (error: any) {
      this.handleApiError(error, 'publishPost');
    }
  }

  /**
   * Publish a single post with media and rich text features
   */
  private async publishSinglePost(
    agent: BskyAgent,
    account: ISocialAccount,
    content: string,
    mediaIds: string[] = []
  ): Promise<PublishPostResult> {
    // Parse rich text for facets (hashtags, mentions, links)
    const richText = new RichText({ text: content });
    await richText.detectFacets(agent);

    // Build post record
    const postRecord: any = {
      $type: 'app.bsky.feed.post',
      text: richText.text,
      createdAt: new Date().toISOString(),
      langs: ['en'], // Default to English, could be configurable
    };

    // Add facets if present
    if (richText.facets && richText.facets.length > 0) {
      postRecord.facets = richText.facets;
    }

    // Handle media attachments
    if (mediaIds.length > 0) {
      const embed = await this.processMediaAttachments(agent, mediaIds);
      if (embed) {
        postRecord.embed = embed;
      }
    }

    // Publish the post
    const result = await agent.post(postRecord);

    logger.info('Bluesky post published successfully', {
      uri: result.uri,
      accountId: account._id.toString(),
      hasMedia: mediaIds.length > 0,
      hasFacets: !!richText.facets?.length
    });

    const postId = result.uri.split('/').pop() || result.uri;

    return {
      platformPostId: postId,
      url: `https://bsky.app/profile/${account.accountName}/post/${postId}`,
      metadata: {
        uri: result.uri,
        cid: result.cid,
        facets: richText.facets,
      },
    };
  }

  /**
   * Publish a thread of connected posts
   */
  private async publishThread(
    agent: BskyAgent,
    account: ISocialAccount,
    posts: string[],
    mediaIds: string[] = []
  ): Promise<PublishPostResult> {
    const results: any[] = [];
    let root: { uri: string; cid: string } | null = null;
    let parent: { uri: string; cid: string } | null = null;

    for (let i = 0; i < posts.length; i++) {
      const content = posts[i];
      const postMediaIds = i === 0 ? mediaIds : []; // Only first post gets media

      const richText = new RichText({ text: content });
      await richText.detectFacets(agent);

      const postRecord: any = {
        $type: 'app.bsky.feed.post',
        text: richText.text,
        createdAt: new Date().toISOString(),
        langs: ['en'],
      };

      // Add facets
      if (richText.facets && richText.facets.length > 0) {
        postRecord.facets = richText.facets;
      }

      // Add reply structure for thread
      if (parent) {
        postRecord.reply = {
          root: root!,
          parent: parent,
        };
      }

      // Add media to first post only
      if (postMediaIds.length > 0) {
        const embed = await this.processMediaAttachments(agent, postMediaIds);
        if (embed) {
          postRecord.embed = embed;
        }
      }

      const result = await agent.post(postRecord);
      results.push(result);

      // Set root and parent for next iteration
      if (i === 0) {
        root = { uri: result.uri, cid: result.cid };
      }
      parent = { uri: result.uri, cid: result.cid };

      logger.info(`Bluesky thread post ${i + 1}/${posts.length} published`, {
        uri: result.uri,
        accountId: account._id.toString()
      });
    }

    const firstResult = results[0];
    const postId = firstResult.uri.split('/').pop() || firstResult.uri;

    return {
      platformPostId: postId,
      url: `https://bsky.app/profile/${account.accountName}/post/${postId}`,
      metadata: {
        uri: firstResult.uri,
        cid: firstResult.cid,
        threadLength: results.length,
        threadUris: results.map(r => r.uri),
      },
    };
  }

  /**
   * Process media attachments (images and videos)
   */
  private async processMediaAttachments(agent: BskyAgent, mediaIds: string[]): Promise<any> {
    const images: any[] = [];
    let video: any = null;

    for (const mediaUrl of mediaIds) {
      try {
        const response = await axios.get(mediaUrl, {
          responseType: 'arraybuffer',
        });

        const buffer = Buffer.from(response.data);
        const mimeType = response.headers['content-type'] || 'application/octet-stream';

        if (mimeType.startsWith('image/')) {
          // Handle image
          const blob = await this.uploadBlob(agent, buffer, mimeType);
          images.push({
            alt: '', // Could be enhanced to support alt text
            image: blob,
            aspectRatio: { width: 1, height: 1 }, // Could be calculated from image
          });
        } else if (mimeType.startsWith('video/')) {
          // Handle video
          if (buffer.length > MAX_VIDEO_SIZE) {
            logger.warn('Video too large for Bluesky', { size: buffer.length, maxSize: MAX_VIDEO_SIZE });
            continue;
          }
          
          video = await this.uploadVideo(agent, buffer, mimeType);
        }
      } catch (error: any) {
        logger.error('Failed to process media for Bluesky', {
          mediaUrl,
          error: error.message,
        });
      }
    }

    // Return appropriate embed type
    if (video) {
      return {
        $type: 'app.bsky.embed.video',
        video: video,
        alt: '',
        aspectRatio: { width: 16, height: 9 }, // Default aspect ratio
      };
    } else if (images.length > 0) {
      return {
        $type: 'app.bsky.embed.images',
        images: images.slice(0, MAX_MEDIA_COUNT),
      };
    }

    return null;
  }

  /**
   * Upload image blob to Bluesky
   */
  private async uploadBlob(agent: BskyAgent, buffer: Buffer, mimeType: string): Promise<any> {
    const response = await agent.uploadBlob(buffer, { encoding: mimeType });
    return response.data.blob;
  }

  /**
   * Upload video to Bluesky video service
   */
  private async uploadVideo(agent: BskyAgent, buffer: Buffer, mimeType: string): Promise<any> {
    try {
      // Upload video to Bluesky video service
      const uploadResponse = await axios.post(
        `${this.videoService}/xrpc/app.bsky.video.uploadVideo`,
        buffer,
        {
          headers: {
            'Authorization': `Bearer ${agent.session?.accessJwt}`,
            'Content-Type': mimeType,
          },
        }
      );

      const jobId = uploadResponse.data.jobId;

      // Poll for upload completion
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max
      
      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `${this.videoService}/xrpc/app.bsky.video.getJobStatus?jobId=${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${agent.session?.accessJwt}`,
            },
          }
        );

        const status = statusResponse.data.jobStatus;
        
        if (status.state === 'JOB_STATE_COMPLETED') {
          return status.blob;
        } else if (status.state === 'JOB_STATE_FAILED') {
          throw new Error(`Video upload failed: ${status.error}`);
        }

        // Wait 10 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
      }

      throw new Error('Video upload timeout');
    } catch (error: any) {
      logger.error('Video upload to Bluesky failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a post from Bluesky
   */
  async deletePost(account: ISocialAccount, platformPostId: string): Promise<void> {
    try {
      const agent = await this.getAuthenticatedAgent(account);
      
      await agent.deletePost(platformPostId);
      
      logger.info('Bluesky post deleted successfully', {
        accountId: account._id.toString(),
        postId: platformPostId
      });
    } catch (error: any) {
      logger.error('Failed to delete Bluesky post', {
        accountId: account._id.toString(),
        postId: platformPostId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get authenticated Bluesky agent
   */
  private async getAuthenticatedAgent(account: ISocialAccount): Promise<BskyAgent> {
    const agent = new BskyAgent({ service: this.service });
    
    const accessToken = this.getAccessToken(account);
    const refreshToken = account.refreshToken ? this.tokenEncryption.decryptToken(account.refreshToken) : '';

    await agent.resumeSession({
      accessJwt: accessToken,
      refreshJwt: refreshToken,
      did: account.providerUserId,
      handle: account.accountName,
    } as any);

    return agent;
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Bluesky handles media upload during post creation
    return mediaUrls;
  }

  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxMediaCount: MAX_MEDIA_COUNT,
      maxVideoSize: MAX_VIDEO_SIZE,
      maxVideoDuration: MAX_VIDEO_DURATION,
      supportedMediaTypes: [
        'image/jpeg', 
        'image/png', 
        'image/webp', 
        'image/heic', 
        'image/heif',
        'image/gif',
        'video/mp4',
        'video/mov'
      ],
      supportsThreads: true,
      supportsRichText: true,
      supportsHashtags: true,
      supportsMentions: true,
      supportsLinks: true,
    };
  }
}
