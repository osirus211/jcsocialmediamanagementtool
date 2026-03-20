import { IPublisher, PublishPostOptions, PublishPostResult } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import axios from 'axios';
import { logger } from '../../utils/logger';

export interface RedditPostOptions extends PublishPostOptions {
  subreddit: string;
  postType: 'text' | 'link' | 'image' | 'video' | 'crosspost';
  title: string;
  url?: string; // For link posts
  nsfw?: boolean;
  spoiler?: boolean;
  sendReplies?: boolean;
  flairId?: string;
  flairText?: string;
  crosspostFullname?: string; // For crossposts
}

export interface SubredditInfo {
  display_name: string;
  title: string;
  subscribers: number;
  over18: boolean;
  description: string;
  submit_text?: string;
  submission_type: string;
  link_flair_enabled: boolean;
  public_description: string;
  subreddit_type: string;
}

export interface RedditFlair {
  id: string;
  text: string;
  type: string;
  richtext?: any[];
}

export interface RedditPostResponse {
  json: {
    data: {
      url: string;
      id: string;
      name: string;
    };
  };
}

export class RedditPublisher implements IPublisher {
  readonly platform = 'reddit';
  protected readonly requiredScopes = ['identity', 'submit', 'read'];
  private userAgent: string;

  constructor(userAgent: string) {
    this.userAgent = userAgent;
  }

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

  /**
   * Publish post to Reddit
   */
  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    this.validatePlatformScopes(account);
    const redditOptions = options as RedditPostOptions;
    
    if (!redditOptions.subreddit || !redditOptions.title) {
      throw new Error('Subreddit and title are required for Reddit posts');
    }

    try {
      switch (redditOptions.postType) {
        case 'text':
          return await this.publishTextPost(account, redditOptions);
        case 'link':
          return await this.publishLinkPost(account, redditOptions);
        case 'image':
          return await this.publishImagePost(account, redditOptions);
        case 'video':
          return await this.publishVideoPost(account, redditOptions);
        case 'crosspost':
          return await this.publishCrosspost(account, redditOptions);
        default:
          throw new Error(`Unsupported Reddit post type: ${redditOptions.postType}`);
      }
    } catch (error) {
      logger.error('Failed to publish Reddit post', {
        accountId: account._id,
        subreddit: redditOptions.subreddit,
        postType: redditOptions.postType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Publish text post to Reddit
   */
  async publishTextPost(account: ISocialAccount, options: RedditPostOptions): Promise<PublishPostResult> {
    const params = new URLSearchParams({
      sr: options.subreddit,
      kind: 'self',
      title: options.title,
      text: options.content || '',
      nsfw: (options.nsfw || false).toString(),
      spoiler: (options.spoiler || false).toString(),
      sendreplies: (options.sendReplies !== false).toString(),
      resubmit: 'true'
    });

    if (options.flairId) {
      params.append('flair_id', options.flairId);
    }
    if (options.flairText) {
      params.append('flair_text', options.flairText);
    }

    const response = await axios.post(
      'https://oauth.reddit.com/api/submit',
      params,
      {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const result: RedditPostResponse = response.data;
    
    if (result.json?.data?.url) {
      return {
        platformPostId: result.json.data.id,
        url: result.json.data.url,
        metadata: {
          fullname: result.json.data.name,
          subreddit: options.subreddit,
          postType: 'text'
        }
      };
    }

    throw new Error('Failed to publish Reddit text post');
  }

  /**
   * Publish link post to Reddit
   */
  async publishLinkPost(account: ISocialAccount, options: RedditPostOptions): Promise<PublishPostResult> {
    if (!options.url) {
      throw new Error('URL is required for Reddit link posts');
    }

    const params = new URLSearchParams({
      sr: options.subreddit,
      kind: 'link',
      title: options.title,
      url: options.url,
      nsfw: (options.nsfw || false).toString(),
      spoiler: (options.spoiler || false).toString(),
      sendreplies: (options.sendReplies !== false).toString(),
      resubmit: 'true'
    });

    if (options.flairId) {
      params.append('flair_id', options.flairId);
    }
    if (options.flairText) {
      params.append('flair_text', options.flairText);
    }

    const response = await axios.post(
      'https://oauth.reddit.com/api/submit',
      params,
      {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const result: RedditPostResponse = response.data;
    
    if (result.json?.data?.url) {
      return {
        platformPostId: result.json.data.id,
        url: result.json.data.url,
        metadata: {
          fullname: result.json.data.name,
          subreddit: options.subreddit,
          postType: 'link',
          linkUrl: options.url
        }
      };
    }

    throw new Error('Failed to publish Reddit link post');
  }

  /**
   * Publish image post to Reddit
   */
  async publishImagePost(account: ISocialAccount, options: RedditPostOptions): Promise<PublishPostResult> {
    if (!options.url) {
      throw new Error('Image URL is required for Reddit image posts');
    }

    const params = new URLSearchParams({
      sr: options.subreddit,
      kind: 'image',
      title: options.title,
      url: options.url,
      nsfw: (options.nsfw || false).toString(),
      spoiler: (options.spoiler || false).toString(),
      sendreplies: (options.sendReplies !== false).toString(),
      resubmit: 'true'
    });

    if (options.flairId) {
      params.append('flair_id', options.flairId);
    }
    if (options.flairText) {
      params.append('flair_text', options.flairText);
    }

    const response = await axios.post(
      'https://oauth.reddit.com/api/submit',
      params,
      {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const result: RedditPostResponse = response.data;
    
    if (result.json?.data?.url) {
      return {
        platformPostId: result.json.data.id,
        url: result.json.data.url,
        metadata: {
          fullname: result.json.data.name,
          subreddit: options.subreddit,
          postType: 'image',
          imageUrl: options.url
        }
      };
    }

    throw new Error('Failed to publish Reddit image post');
  }

  /**
   * Publish video post to Reddit
   */
  async publishVideoPost(account: ISocialAccount, options: RedditPostOptions): Promise<PublishPostResult> {
    if (!options.url) {
      throw new Error('Video URL is required for Reddit video posts');
    }

    const params = new URLSearchParams({
      sr: options.subreddit,
      kind: 'videogif',
      title: options.title,
      url: options.url,
      nsfw: (options.nsfw || false).toString(),
      spoiler: (options.spoiler || false).toString(),
      sendreplies: (options.sendReplies !== false).toString(),
      resubmit: 'true'
    });

    if (options.flairId) {
      params.append('flair_id', options.flairId);
    }
    if (options.flairText) {
      params.append('flair_text', options.flairText);
    }

    const response = await axios.post(
      'https://oauth.reddit.com/api/submit',
      params,
      {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const result: RedditPostResponse = response.data;
    
    if (result.json?.data?.url) {
      return {
        platformPostId: result.json.data.id,
        url: result.json.data.url,
        metadata: {
          fullname: result.json.data.name,
          subreddit: options.subreddit,
          postType: 'video',
          videoUrl: options.url
        }
      };
    }

    throw new Error('Failed to publish Reddit video post');
  }

  /**
   * Publish crosspost to Reddit
   */
  async publishCrosspost(account: ISocialAccount, options: RedditPostOptions): Promise<PublishPostResult> {
    if (!options.crosspostFullname) {
      throw new Error('Original post fullname is required for Reddit crossposts');
    }

    const params = new URLSearchParams({
      sr: options.subreddit,
      kind: 'crosspost',
      title: options.title,
      crosspost_fullname: options.crosspostFullname,
      nsfw: (options.nsfw || false).toString(),
      spoiler: (options.spoiler || false).toString(),
      sendreplies: (options.sendReplies !== false).toString(),
      resubmit: 'true'
    });

    if (options.flairId) {
      params.append('flair_id', options.flairId);
    }
    if (options.flairText) {
      params.append('flair_text', options.flairText);
    }

    const response = await axios.post(
      'https://oauth.reddit.com/api/submit',
      params,
      {
        headers: {
          'Authorization': `Bearer ${account.accessToken}`,
          'User-Agent': this.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const result: RedditPostResponse = response.data;
    
    if (result.json?.data?.url) {
      return {
        platformPostId: result.json.data.id,
        url: result.json.data.url,
        metadata: {
          fullname: result.json.data.name,
          subreddit: options.subreddit,
          postType: 'crosspost',
          originalPost: options.crosspostFullname
        }
      };
    }

    throw new Error('Failed to publish Reddit crosspost');
  }

  /**
   * Get subreddit information
   */
  async getSubredditInfo(accessToken: string, subreddit: string): Promise<SubredditInfo> {
    try {
      const response = await axios.get(
        `https://oauth.reddit.com/r/${subreddit}/about`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': this.userAgent
          }
        }
      );

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get subreddit info', {
        subreddit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to get subreddit info for r/${subreddit}`);
    }
  }

  /**
   * Get subreddit flairs
   */
  async getSubredditFlairs(accessToken: string, subreddit: string): Promise<RedditFlair[]> {
    try {
      const response = await axios.get(
        `https://oauth.reddit.com/r/${subreddit}/api/link_flair_v2`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': this.userAgent
          }
        }
      );

      return response.data || [];
    } catch (error) {
      logger.error('Failed to get subreddit flairs', {
        subreddit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Validate if user can post to subreddit
   */
  async validateSubreddit(accessToken: string, subreddit: string): Promise<boolean> {
    try {
      const info = await this.getSubredditInfo(accessToken, subreddit);
      
      // Check if subreddit allows submissions
      return info.submission_type !== 'restricted';
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete Reddit post
   */
  async deletePost(account: ISocialAccount, platformPostId: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        id: `t3_${platformPostId}` // Reddit fullname format
      });

      await axios.post(
        'https://oauth.reddit.com/api/del',
        params,
        {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'User-Agent': this.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      logger.info('Reddit post deleted successfully', {
        accountId: account._id,
        postId: platformPostId
      });
    } catch (error) {
      logger.error('Failed to delete Reddit post', {
        accountId: account._id,
        postId: platformPostId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Upload media (Reddit handles this differently - usually via external hosting)
   */
  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Reddit doesn't have a direct media upload API like other platforms
    // Media is typically hosted externally (imgur, etc.) and linked
    return mediaUrls;
  }

  /**
   * Build User-Agent string for Reddit API
   */
  buildUserAgent(): string {
    return this.userAgent;
  }

  /**
   * Get platform limits
   */
  getLimits() {
    return {
      maxContentLength: 40000, // Reddit text post limit
      maxTitleLength: 300,     // Reddit title limit
      maxMediaCount: 1,        // Reddit allows 1 media per post
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      rateLimit: {
        requests: 60,
        window: 60000 // 60 requests per minute
      }
    };
  }

  /**
   * Get post analytics (upvotes, comments, etc.)
   */
  async getPostAnalytics(accessToken: string, fullname: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://oauth.reddit.com/by_id/${fullname}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': this.userAgent
          }
        }
      );

      const post = response.data.data.children[0]?.data;
      
      if (post) {
        return {
          score: post.score,
          upvote_ratio: post.upvote_ratio,
          num_comments: post.num_comments,
          ups: post.ups,
          downs: post.downs,
          created_utc: post.created_utc,
          permalink: post.permalink
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get Reddit post analytics', {
        fullname,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}