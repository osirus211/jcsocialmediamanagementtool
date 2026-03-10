/**
 * Pinterest Publisher
 * Handles publishing pins to Pinterest
 */

import { IPublisher } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';

export interface PinterestBoard {
  id: string;
  name: string;
  description: string;
  privacy: string;
  pin_count: number;
}

export interface PinterestPin {
  id: string;
  link: string;
  title: string;
  description: string;
  board_id: string;
  media: {
    media_type: string;
    images?: {
      [key: string]: {
        url: string;
        width: number;
        height: number;
      };
    };
  };
}

export interface PinterestPublishResult {
  postId: string;
  url: string;
}

export class PinterestPublisher implements IPublisher {
  private readonly apiBaseUrl = 'https://api.pinterest.com/v5';

  async publish(account: ISocialAccount, post: IPost): Promise<PinterestPublishResult> {
    return this.createPin(account, post);
  }

  /**
   * Create a Pinterest pin
   */
  async createPin(account: ISocialAccount, post: IPost): Promise<PinterestPublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('Pinterest requires an image or video');
      }

      const mediaUrl = post.mediaUrls[0];
      const title = this.extractTitle(post.content);
      const description = this.extractDescription(post.content);

      // Get user's boards to select the first one (or default board)
      const boards = await this.getPinterestBoards(account.accessToken);
      if (boards.length === 0) {
        throw new BadRequestError('No Pinterest boards found for this account');
      }

      const boardId = boards[0].id; // Use first board as default

      // Determine media type
      const isVideo = this.isVideoUrl(mediaUrl);
      
      let pinData: any;
      
      if (isVideo) {
        // For videos, we need to upload the video first
        const videoId = await this.uploadVideo(account.accessToken, mediaUrl);
        pinData = {
          board_id: boardId,
          title: title.substring(0, 100), // Pinterest title limit
          description: description.substring(0, 500), // Pinterest description limit
          media_source: {
            source_type: 'video_id',
            video_id: videoId,
          },
        };
      } else {
        // For images, use direct URL
        pinData = {
          board_id: boardId,
          title: title.substring(0, 100),
          description: description.substring(0, 500),
          media_source: {
            source_type: 'image_url',
            url: mediaUrl,
          },
        };
      }

      // Create the pin
      const response = await fetch(`${this.apiBaseUrl}/pins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pinData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest pin creation failed: ${response.status} ${errorText}`);
      }

      const pin: PinterestPin = await response.json();

      logger.info('Pinterest pin created successfully', {
        accountId: account._id,
        pinId: pin.id,
        title: title.substring(0, 50),
        boardId,
      });

      return {
        postId: pin.id,
        url: pin.link || `https://pinterest.com/pin/${pin.id}`,
      };
    } catch (error: any) {
      logger.error('Failed to create Pinterest pin', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get Pinterest boards for the account
   */
  async getPinterestBoards(accessToken: string): Promise<PinterestBoard[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/boards`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest boards fetch failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error: any) {
      logger.error('Failed to fetch Pinterest boards', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload video to Pinterest (placeholder implementation)
   */
  private async uploadVideo(accessToken: string, videoUrl: string): Promise<string> {
    // Note: Pinterest video upload is a complex multi-step process
    // This is a simplified placeholder implementation
    // In production, you would need to implement the full video upload flow
    
    logger.info('Pinterest video upload (placeholder)', { videoUrl });
    
    // For now, return a placeholder video ID
    // In real implementation, this would upload the video and return the actual video ID
    return 'placeholder_video_id';
  }

  /**
   * Check if URL is a video
   */
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  /**
   * Extract title from content (first line or first 100 chars)
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    const firstLine = lines[0] || '';
    
    if (firstLine.length > 0) {
      return firstLine;
    }
    
    // If no first line, use first 100 characters
    return content.substring(0, 100) || 'Untitled Pin';
  }

  /**
   * Extract description from content (remaining content after title)
   */
  private extractDescription(content: string): string {
    const lines = content.split('\n');
    
    if (lines.length > 1) {
      return lines.slice(1).join('\n').trim();
    }
    
    // If only one line, use the full content as description
    return content;
  }
}