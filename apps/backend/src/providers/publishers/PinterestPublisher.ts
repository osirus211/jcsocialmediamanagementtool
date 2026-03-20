/**
 * Pinterest Publisher
 * Handles publishing pins to Pinterest using API v5
 * Supports: Image Pins, Video Pins, Idea Pins (multi-page), Board Management
 */

import { IPublisher, PublishPostOptions, PublishPostResult } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IPost } from '../../models/Post';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count?: number;
  follower_count?: number;
  media?: {
    image_cover_url?: string;
  };
}

export interface PinterestPin {
  id: string;
  link?: string;
  title?: string;
  description?: string;
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

export interface PinterestVideoUploadResponse {
  media_id: string;
  upload_url: string;
  upload_parameters: Record<string, any>;
}

export interface PinterestIdeaPin {
  board_id: string;
  title: string;
  media_source: {
    source_type: 'multiple_image_urls';
    items: Array<{
      title?: string;
      description?: string;
      link?: string;
      media: {
        images: {
          originals: {
            url: string;
          };
        };
      };
    }>;
  };
}

export class PinterestPublisher implements IPublisher {
  readonly platform = 'pinterest';
  protected readonly requiredScopes = ['user_accounts:read', 'pins:write', 'boards:read'];
  private readonly apiBaseUrl = 'https://api.pinterest.com/v5';

  /**
   * Validate platform scopes before publishing
   */
  protected validatePlatformScopes(account: ISocialAccount): void {
    const grantedScopes: string[] = account.scopes || [];
    const missingScopes = this.requiredScopes.filter(scope => !grantedScopes.includes(scope));

    if (missingScopes.length > 0) {
      const error: any = new Error(`Missing required scopes: ${missingScopes.join(', ')}`);
      error.code = 'INSUFFICIENT_SCOPES';
      error.details = {
        missing: missingScopes,
        granted: grantedScopes,
        required: this.requiredScopes,
      };
      throw error;
    }
  }

  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    this.validatePlatformScopes(account);
    // Convert options to IPost format for compatibility with existing method
    const altTexts = (options.metadata?.altTexts as string[]) || [];
    const post = {
      content: options.content,
      mediaUrls: options.mediaIds || [],
      metadata: {
        ...options.metadata,
        altText: altTexts[0], // Use first alt text for single image pins
        altTexts, // Keep all alt texts for potential multi-image support
      },
    } as Partial<IPost>;

    const result = await this.publish(account, post as IPost);
    return {
      platformPostId: result.postId,
      url: result.url,
    };
  }

  async publish(account: ISocialAccount, post: IPost): Promise<PinterestPublishResult> {
    const metadata = post.metadata || {};
    const pinType = metadata.pinType || 'image'; // 'image', 'video', 'idea'
    
    switch (pinType) {
      case 'video':
        return this.publishVideoPin(account, post);
      case 'idea':
        return this.publishIdeaPin(account, post);
      default:
        return this.publishImagePin(account, post);
    }
  }

  /**
   * Create an image Pinterest pin
   */
  async publishImagePin(account: ISocialAccount, post: IPost): Promise<PinterestPublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('Pinterest image pin requires an image');
      }

      const imageUrl = post.mediaUrls[0];
      const title = this.extractTitle(post.content);
      const description = this.extractDescription(post.content);
      const metadata = post.metadata || {};

      // Get board ID
      const boardId = await this.getBoardId(account, metadata.boardId);

      const pinData = {
        board_id: boardId,
        title: title.substring(0, 100), // Pinterest title limit
        description: description.substring(0, 500), // Pinterest description limit
        link: metadata.destinationUrl || undefined,
        media_source: {
          source_type: 'image_url',
          url: imageUrl,
        },
        alt_text: metadata.altText || undefined,
        dominant_color: metadata.dominantColor || undefined,
      };

      const pin = await this.createPin(account.accessToken, pinData);
      
      logger.info('Pinterest image pin created successfully', {
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
      logger.error('Failed to create Pinterest image pin', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a video Pinterest pin
   */
  async publishVideoPin(account: ISocialAccount, post: IPost): Promise<PinterestPublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('Pinterest video pin requires a video');
      }

      const videoUrl = post.mediaUrls[0];
      const title = this.extractTitle(post.content);
      const description = this.extractDescription(post.content);
      const metadata = post.metadata || {};

      // Get board ID
      const boardId = await this.getBoardId(account, metadata.boardId);

      // Upload video first
      const videoId = await this.uploadVideo(account.accessToken, videoUrl);

      const pinData = {
        board_id: boardId,
        title: title.substring(0, 100),
        description: description.substring(0, 500),
        link: metadata.destinationUrl || undefined,
        media_source: {
          source_type: 'video_id',
          media_id: videoId,
          cover_image_url: metadata.thumbnailUrl || undefined,
        },
        alt_text: metadata.altText || undefined,
      };

      const pin = await this.createPin(account.accessToken, pinData);
      
      logger.info('Pinterest video pin created successfully', {
        accountId: account._id,
        pinId: pin.id,
        title: title.substring(0, 50),
        boardId,
        videoId,
      });

      return {
        postId: pin.id,
        url: pin.link || `https://pinterest.com/pin/${pin.id}`,
      };
    } catch (error: any) {
      logger.error('Failed to create Pinterest video pin', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create an Idea Pin (multi-page pin)
   */
  async publishIdeaPin(account: ISocialAccount, post: IPost): Promise<PinterestPublishResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new BadRequestError('Pinterest Idea pin requires at least one image');
      }

      const title = this.extractTitle(post.content);
      const metadata = post.metadata || {};
      const pages = metadata.pages || [];

      // Get board ID
      const boardId = await this.getBoardId(account, metadata.boardId);

      // Build Idea Pin data
      const ideaPinData: PinterestIdeaPin = {
        board_id: boardId,
        title: title.substring(0, 100),
        media_source: {
          source_type: 'multiple_image_urls',
          items: post.mediaUrls.map((url, index) => {
            const page = pages[index] || {};
            return {
              title: page.title || undefined,
              description: page.description || undefined,
              link: page.link || metadata.destinationUrl || undefined,
              media: {
                images: {
                  originals: {
                    url,
                  },
                },
              },
            };
          }),
        },
      };

      const pin = await this.createPin(account.accessToken, ideaPinData);
      
      logger.info('Pinterest Idea pin created successfully', {
        accountId: account._id,
        pinId: pin.id,
        title: title.substring(0, 50),
        boardId,
        pageCount: post.mediaUrls.length,
      });

      return {
        postId: pin.id,
        url: pin.link || `https://pinterest.com/pin/${pin.id}`,
      };
    } catch (error: any) {
      logger.error('Failed to create Pinterest Idea pin', {
        accountId: account._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload video to Pinterest
   */
  async uploadVideo(accessToken: string, videoUrl: string): Promise<string> {
    try {
      // Step 1: Request video upload
      const uploadResponse = await fetch(`${this.apiBaseUrl}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_type: 'video',
        }),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Pinterest video upload request failed: ${uploadResponse.status} ${errorText}`);
      }

      const uploadData: any = await uploadResponse.json();

      // Step 2: Upload video file to the provided URL
      // Note: This is a simplified implementation
      // In production, you would need to handle the actual file upload
      // using the upload_url and upload_parameters from the response
      
      logger.info('Pinterest video upload initiated', {
        mediaId: uploadData.media_id,
        uploadUrl: uploadData.upload_url,
      });

      // For now, return the media_id
      // In a real implementation, you would:
      // 1. Download the video from videoUrl
      // 2. Upload it to uploadData.upload_url using uploadData.upload_parameters
      // 3. Poll for upload completion
      // 4. Return the media_id when ready

      return uploadData.media_id;
    } catch (error: any) {
      logger.error('Pinterest video upload failed', {
        error: error.message,
        videoUrl,
      });
      throw error;
    }
  }

  /**
   * Create a board
   */
  async createBoard(accessToken: string, name: string, description?: string, privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET' = 'PUBLIC'): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/boards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.substring(0, 180), // Pinterest board name limit
          description: description?.substring(0, 500) || undefined,
          privacy,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest board creation failed: ${response.status} ${errorText}`);
      }

      const board: any = await response.json();
      
      logger.info('Pinterest board created successfully', {
        boardId: board.id,
        name,
        privacy,
      });

      return board.id;
    } catch (error: any) {
      logger.error('Pinterest board creation failed', {
        error: error.message,
        name,
      });
      throw error;
    }
  }

  /**
   * Get Pinterest boards for the account
   */
  async getUserBoards(accessToken: string): Promise<PinterestBoard[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/boards?page_size=100`, {
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
      return (data as any).items || [];
    } catch (error: any) {
      logger.error('Failed to fetch Pinterest boards', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a pin
   */
  async deletePin(account: ISocialAccount, platformPostId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/pins/${platformPostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinterest pin deletion failed: ${response.status} ${errorText}`);
      }

      logger.info('Pinterest pin deleted successfully', {
        accountId: account._id,
        pinId: platformPostId,
      });
    } catch (error: any) {
      logger.error('Failed to delete Pinterest pin', {
        accountId: account._id,
        pinId: platformPostId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a pin with the Pinterest API
   */
  private async createPin(accessToken: string, pinData: any): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/pins`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinterest pin creation failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get board ID (create if needed)
   */
  private async getBoardId(account: ISocialAccount, boardId?: string): Promise<string> {
    if (boardId) {
      return boardId;
    }

    // Get user's boards to select the first one (or default board)
    const boards = await this.getUserBoards(account.accessToken);
    if (boards.length === 0) {
      throw new BadRequestError('No Pinterest boards found for this account');
    }

    return boards[0].id; // Use first board as default
  }

  /**
   * Check if URL is a video
   */
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v'];
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

  // IPublisher interface methods
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Pinterest handles media during pin creation
    return mediaUrls;
  }

  getLimits() {
    return {
      maxContentLength: 500,
      maxMediaCount: 20, // For Idea Pins
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'],
    };
  }
}