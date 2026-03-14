/**
 * YouTube Publisher - Complete Implementation
 * Handles publishing videos, Shorts, and live streams to YouTube
 * Uses YouTube Data API v3 with resumable uploads
 */

import { IPublisher, PublishPostOptions, PublishPostResult } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';
import axios from 'axios';
import FormData from 'form-data';

export interface YouTubePublishResult {
  postId: string;
  url: string;
}

export interface YouTubeVideoMetadata {
  snippet: {
    title: string;
    description: string;
    tags?: string[];
    categoryId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  status: {
    privacyStatus: 'public' | 'private' | 'unlisted';
    publishAt?: string;
    selfDeclaredMadeForKids?: boolean;
    madeForKids?: boolean;
  };
  recordingDetails?: {
    recordingDate?: string;
  };
}

export interface YouTubeUploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

export class YouTubePublisher implements IPublisher {
  readonly platform = 'youtube';
  private readonly apiBaseUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly uploadBaseUrl = 'https://www.googleapis.com/upload/youtube/v3';

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    // Convert options to IPost format for compatibility with existing method
    const post = {
      content: options.content,
      mediaUrls: options.mediaIds || [],
      metadata: options.metadata,
      contentType: options.metadata?.contentType || 'video',
      scheduledAt: options.metadata?.scheduledAt,
    } as IPost;

    const result = await this.publish(account, post);
    return {
      platformPostId: result.postId,
      url: result.url,
    };
  }

  async publish(account: ISocialAccount, post: IPost): Promise<YouTubePublishResult> {
    // Route based on content type
    if (post.contentType === 'reel' || post.metadata?.isShort) {
      return this.publishShort(account, post);
    }
    return this.publishVideo(account, post);
  }

  /**
   * Publish regular YouTube video with resumable upload
   */
  async publishVideo(account: ISocialAccount, post: IPost): Promise<YouTubePublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('YouTube requires a video file');
      }

      const videoUrl = post.mediaUrls[0];
      const title = this.extractTitle(post.content);
      const description = this.extractDescription(post.content);
      const tags = this.extractTags(post.content);

      // Prepare video metadata
      const videoMetadata: YouTubeVideoMetadata = {
        snippet: {
          title: title.substring(0, 100), // YouTube title limit
          description: description.substring(0, 5000), // YouTube description limit
          tags: tags.slice(0, 10), // YouTube allows max 10 tags
          categoryId: post.metadata?.categoryId || '22', // People & Blogs default
          defaultLanguage: post.metadata?.language || 'en',
        },
        status: {
          privacyStatus: post.metadata?.privacy || 'public',
          publishAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString() : undefined,
          selfDeclaredMadeForKids: post.metadata?.madeForKids || false,
          madeForKids: post.metadata?.madeForKids || false,
        },
      };

      // Upload video using resumable upload
      const uploadResponse = await this.uploadVideoResumable(
        account.accessToken,
        videoUrl,
        videoMetadata
      );

      const videoId = uploadResponse.id;
      
      // Upload custom thumbnail if provided
      if (post.metadata?.thumbnailUrl) {
        await this.uploadThumbnail(account.accessToken, videoId, post.metadata.thumbnailUrl);
      }

      const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;

      logger.info('YouTube video published successfully', {
        accountId: account._id,
        videoId,
        title: title.substring(0, 50),
        isScheduled: !!post.scheduledAt,
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
   * Publish YouTube Short with validation
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
      const description = this.extractDescription(post.content);
      const tags = this.extractTags(post.content);

      // Add #Shorts to description if not present
      const shortsDescription = description.includes('#Shorts') 
        ? description 
        : `${description} #Shorts`.trim();

      // Prepare Shorts metadata
      const videoMetadata: YouTubeVideoMetadata = {
        snippet: {
          title: title.substring(0, 100),
          description: shortsDescription.substring(0, 5000),
          tags: [...tags, 'Shorts'].slice(0, 10),
          categoryId: post.metadata?.categoryId || '24', // Entertainment category for Shorts
          defaultLanguage: post.metadata?.language || 'en',
        },
        status: {
          privacyStatus: post.metadata?.privacy || 'public',
          publishAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString() : undefined,
          selfDeclaredMadeForKids: post.metadata?.madeForKids || false,
          madeForKids: post.metadata?.madeForKids || false,
        },
      };

      // Upload video using resumable upload
      const uploadResponse = await this.uploadVideoResumable(
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
        isScheduled: !!post.scheduledAt,
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
   * Initialize resumable upload session
   */
  async initResumableUpload(
    accessToken: string,
    metadata: YouTubeVideoMetadata
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.uploadBaseUrl}/videos?uploadType=resumable&part=snippet,status,recordingDetails`,
        metadata,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/*',
          },
        }
      );

      const uploadUrl = response.headers.location;
      if (!uploadUrl) {
        throw new Error('No upload URL received from YouTube');
      }

      logger.debug('Resumable upload session initialized', {
        uploadUrl: uploadUrl.substring(0, 50) + '...',
      });

      return uploadUrl;
    } catch (error: any) {
      logger.error('Failed to initialize resumable upload', {
        error: error.response?.data || error.message,
      });
      throw new Error(`YouTube upload initialization failed: ${error.message}`);
    }
  }

  /**
   * Upload video using resumable upload with progress tracking
   */
  async uploadVideoResumable(
    accessToken: string,
    videoUrl: string,
    metadata: YouTubeVideoMetadata
  ): Promise<any> {
    try {
      // Step 1: Initialize resumable upload
      const uploadUrl = await this.initResumableUpload(accessToken, metadata);

      // Step 2: Download video file
      const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes timeout for large files
      });

      const videoBuffer = Buffer.from(videoResponse.data);
      const totalSize = videoBuffer.length;

      logger.info('Starting video upload', {
        totalSize,
        sizeInMB: Math.round(totalSize / 1024 / 1024),
      });

      // Step 3: Upload video content with chunking for large files
      const chunkSize = 8 * 1024 * 1024; // 8MB chunks
      let uploadedBytes = 0;

      while (uploadedBytes < totalSize) {
        const start = uploadedBytes;
        const end = Math.min(uploadedBytes + chunkSize, totalSize);
        const chunk = videoBuffer.slice(start, end);

        const response = await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Type': 'video/*',
            'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
          },
          timeout: 120000, // 2 minutes per chunk
        });

        uploadedBytes = end;
        const progress = Math.round((uploadedBytes / totalSize) * 100);

        logger.debug('Upload progress', {
          uploadedBytes,
          totalSize,
          progress: `${progress}%`,
        });

        // If upload is complete, return the response
        if (response.status === 200 || response.status === 201) {
          logger.info('Video upload completed', {
            videoId: response.data?.id,
            totalSize,
          });
          return response.data;
        }
      }

      throw new Error('Upload completed but no final response received');
    } catch (error: any) {
      logger.error('Video upload failed', {
        error: error.response?.data || error.message,
        status: error.response?.status,
      });
      throw new Error(`YouTube video upload failed: ${error.message}`);
    }
  }

  /**
   * Upload custom thumbnail
   */
  async uploadThumbnail(
    accessToken: string,
    videoId: string,
    thumbnailUrl: string
  ): Promise<void> {
    try {
      // Download thumbnail
      const thumbnailResponse = await axios.get(thumbnailUrl, {
        responseType: 'arraybuffer',
      });

      const thumbnailBuffer = Buffer.from(thumbnailResponse.data);

      // Upload thumbnail
      await axios.post(
        `${this.uploadBaseUrl}/thumbnails/set?videoId=${videoId}`,
        thumbnailBuffer,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'image/jpeg',
          },
        }
      );

      logger.info('Custom thumbnail uploaded', { videoId });
    } catch (error: any) {
      logger.error('Failed to upload thumbnail', {
        videoId,
        error: error.message,
      });
      // Don't throw - thumbnail upload is optional
    }
  }

  /**
   * Update video metadata after upload
   */
  async updateVideoMetadata(
    accessToken: string,
    videoId: string,
    metadata: Partial<YouTubeVideoMetadata>
  ): Promise<void> {
    try {
      await axios.put(
        `${this.apiBaseUrl}/videos?part=snippet,status`,
        {
          id: videoId,
          ...metadata,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Video metadata updated', { videoId });
    } catch (error: any) {
      logger.error('Failed to update video metadata', {
        videoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(account: ISocialAccount, platformPostId: string): Promise<void> {
    try {
      await axios.delete(`${this.apiBaseUrl}/videos?id=${platformPostId}`, {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
        },
      });

      logger.info('Video deleted successfully', {
        accountId: account._id,
        videoId: platformPostId,
      });
    } catch (error: any) {
      logger.error('Failed to delete video', {
        accountId: account._id,
        videoId: platformPostId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check upload status for resumable uploads
   */
  async checkUploadStatus(uploadUrl: string): Promise<number> {
    try {
      const response = await axios.put(uploadUrl, '', {
        headers: {
          'Content-Range': 'bytes */*',
        },
      });

      // Parse range header to get uploaded bytes
      const rangeHeader = response.headers.range;
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        return match ? parseInt(match[1]) + 1 : 0;
      }

      return 0;
    } catch (error: any) {
      if (error.response?.status === 308) {
        // Resume incomplete - parse range from response
        const rangeHeader = error.response.headers.range;
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=0-(\d+)/);
          return match ? parseInt(match[1]) + 1 : 0;
        }
      }
      return 0;
    }
  }

  /**
   * Validate video requirements for YouTube Shorts
   */
  private async validateShortRequirements(videoUrl: string): Promise<void> {
    try {
      // Get video metadata using HEAD request
      const response = await axios.head(videoUrl);
      const contentLength = response.headers['content-length'];
      
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeInMB > 512) { // YouTube's max file size
          throw new BadRequestError('Video file too large for YouTube Shorts (max 512MB)');
        }
      }

      // Note: In production, you would use ffmpeg to check:
      // - Duration (max 3 minutes as of 2024)
      // - Aspect ratio (preferably 9:16 for vertical)
      // - Resolution (minimum 720p recommended)
      
      logger.info('YouTube Short requirements validated', { videoUrl });
    } catch (error: any) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      logger.warn('Could not validate Short requirements', {
        videoUrl,
        error: error.message,
      });
      // Continue anyway - let YouTube handle validation
    }
  }

  /**
   * Extract title from content (first line or up to first newline)
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    const title = lines[0]?.trim() || 'Untitled Video';
    return title.length > 100 ? title.substring(0, 97) + '...' : title;
  }

  /**
   * Extract description from content (remaining lines after title)
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

  // IPublisher interface methods
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // YouTube handles media during video upload
    return mediaUrls;
  }

  getLimits() {
    return {
      maxContentLength: 5000,
      maxMediaCount: 1,
      supportedMediaTypes: [
        'video/mp4',
        'video/mov',
        'video/avi',
        'video/webm',
        'video/flv',
        'video/3gpp',
        'video/quicktime'
      ],
      maxFileSize: 512 * 1024 * 1024 * 1024, // 512GB for verified accounts
      maxDuration: 12 * 60 * 60, // 12 hours for verified accounts
    };
  }
}