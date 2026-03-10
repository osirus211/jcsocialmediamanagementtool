/**
 * YouTube Publisher
 * Handles publishing videos and Shorts to YouTube
 */

import { IPublisher } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';

export interface YouTubePublishResult {
  postId: string;
  url: string;
}

export class YouTubePublisher implements IPublisher {
  async publish(account: ISocialAccount, post: IPost): Promise<YouTubePublishResult> {
    // Route based on content type
    if (post.contentType === 'reel') {
      return this.publishShort(account, post);
    }
    return this.publishVideo(account, post);
  }

  /**
   * Publish regular YouTube video
   */
  async publishVideo(account: ISocialAccount, post: IPost): Promise<YouTubePublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('YouTube requires a video file');
      }

      const videoUrl = post.mediaUrls[0];
      const title = this.extractTitle(post.content);
      const description = this.extractDescription(post.content);

      // Prepare video metadata
      const videoMetadata = {
        snippet: {
          title: title.substring(0, 100), // YouTube title limit
          description: description.substring(0, 5000), // YouTube description limit
          tags: this.extractTags(post.content),
          categoryId: '22', // People & Blogs category
        },
        status: {
          privacyStatus: 'public',
        },
      };

      // Upload video using YouTube Data API v3
      const uploadResponse = await this.uploadVideoToYouTube(
        account.accessToken,
        videoUrl,
        videoMetadata
      );

      const videoId = uploadResponse.id;
      const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;

      logger.info('YouTube video published successfully', {
        accountId: account._id,
        videoId,
        title: title.substring(0, 50),
      });

      return {
        postId: videoId,
        url: youtubeUrl,
      };
    } catch (error: any) {
      logger.error('Failed to publish YouTube video', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Publish YouTube Short
   */
  async publishShort(account: ISocialAccount, post: IPost): Promise<YouTubePublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('YouTube Shorts requires a video file');
      }

      const videoUrl = post.mediaUrls[0];
      
      // Validate video requirements for Shorts
      await this.validateShortRequirements(videoUrl);

      const title = this.extractTitle(post.content);
      const description = this.extractDescription(post.content) + ' #Shorts';

      // Prepare Shorts metadata
      const videoMetadata = {
        snippet: {
          title: title.substring(0, 100),
          description: description.substring(0, 5000),
          tags: [...this.extractTags(post.content), 'Shorts'],
          categoryId: '24', // Entertainment category for Shorts
        },
        status: {
          privacyStatus: 'public',
        },
      };

      // Upload video using YouTube Data API v3
      const uploadResponse = await this.uploadVideoToYouTube(
        account.accessToken,
        videoUrl,
        videoMetadata
      );

      const videoId = uploadResponse.id;
      const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;

      logger.info('YouTube Short published successfully', {
        accountId: account._id,
        videoId,
        title: title.substring(0, 50),
      });

      return {
        postId: videoId,
        url: youtubeUrl,
      };
    } catch (error: any) {
      logger.error('Failed to publish YouTube Short', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload video to YouTube using resumable upload
   */
  private async uploadVideoToYouTube(
    accessToken: string,
    videoUrl: string,
    metadata: any
  ): Promise<any> {
    // Step 1: Initiate resumable upload
    const initiateResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initiateResponse.ok) {
      const error = await initiateResponse.json();
      throw new Error(`YouTube upload initiation failed: ${error.error?.message || 'Unknown error'}`);
    }

    const uploadUrl = initiateResponse.headers.get('location');
    if (!uploadUrl) {
      throw new Error('No upload URL received from YouTube');
    }

    // Step 2: Download video file
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video file');
    }

    const videoBuffer = await videoResponse.arrayBuffer();

    // Step 3: Upload video content
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`YouTube video upload failed: ${error}`);
    }

    return await uploadResponse.json();
  }

  /**
   * Validate video requirements for YouTube Shorts
   */
  private async validateShortRequirements(videoUrl: string): Promise<void> {
    // Note: In a real implementation, you would use ffmpeg to check video properties
    // For now, we'll assume the video meets requirements
    // Requirements: vertical (9:16 ratio), max 60 seconds
    logger.info('Validating YouTube Short requirements', { videoUrl });
  }

  /**
   * Extract title from content (first line)
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    return lines[0] || 'Untitled Video';
  }

  /**
   * Extract description from content (remaining lines)
   */
  private extractDescription(content: string): string {
    const lines = content.split('\n');
    return lines.slice(1).join('\n').trim() || '';
  }

  /**
   * Extract hashtags as tags
   */
  private extractTags(content: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const tags: string[] = [];
    let match;

    while ((match = hashtagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }

    return tags.slice(0, 10); // YouTube allows max 10 tags
  }
}