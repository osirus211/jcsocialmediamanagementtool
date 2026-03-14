/**
 * Twitter Publisher
 * 
 * Publishes posts to Twitter using Twitter API v2
 * Features: Single tweets, threads, polls, media, alt text
 */

import { BasePublisher } from './BasePublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { PublishPostOptions, PublishPostResult } from './IPublisher';
import { logger } from '../../utils/logger';
import FormData from 'form-data';

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_BASE = 'https://upload.twitter.com/1.1';
const MAX_CONTENT_LENGTH = 280;
const MAX_CONTENT_LENGTH_PREMIUM = 25000;
const MAX_MEDIA_COUNT = 4;
const MAX_THREAD_LENGTH = 25;
const MAX_POLL_OPTIONS = 4;
const MIN_POLL_DURATION = 5; // minutes
const MAX_POLL_DURATION = 10080; // 7 days in minutes

interface TwitterThreadOptions {
  tweets: string[];
  mediaIds?: string[][];
  altTexts?: string[][];
}

interface TwitterPollOptions {
  options: string[];
  durationMinutes: number;
}

interface TwitterReplyOptions {
  inReplyToTweetId: string;
}

interface TwitterQuoteOptions {
  quoteTweetId: string;
}

export class TwitterPublisher extends BasePublisher {
  readonly platform = 'twitter';

  /**
   * Publish post to Twitter (single tweet, thread, or poll)
   */
  async publishPost(account: ISocialAccount, options: PublishPostOptions): Promise<PublishPostResult> {
    const { content, mediaIds = [], metadata } = options;

    // Check if this is a thread
    if (metadata?.thread) {
      return this.publishThread(account, metadata.thread as TwitterThreadOptions);
    }

    // Check if this is a poll
    if (metadata?.poll) {
      return this.publishPoll(account, content, metadata.poll as TwitterPollOptions);
    }

    // Check if this is a reply
    if (metadata?.reply) {
      return this.publishReply(account, content, mediaIds, metadata.reply as TwitterReplyOptions);
    }

    // Check if this is a quote tweet
    if (metadata?.quote) {
      return this.publishQuote(account, content, mediaIds, metadata.quote as TwitterQuoteOptions);
    }

    // Regular single tweet
    return this.publishSingleTweet(account, content, mediaIds, metadata?.altTexts as string[]);
  }

  /**
   * Publish single tweet
   */
  private async publishSingleTweet(
    account: ISocialAccount, 
    content: string, 
    mediaIds: string[] = [],
    altTexts: string[] = []
  ): Promise<PublishPostResult> {
    // Validate content length (check if account has premium)
    const maxLength = this.getMaxContentLength(account);
    this.validateContentLength(content, maxLength);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);

    try {
      const payload: any = {
        text: content,
      };

      if (mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };

        // Add alt text if provided
        if (altTexts.length > 0) {
          payload.media.tagged_user_ids = altTexts.map((altText, index) => ({
            media_id: mediaIds[index],
            alt_text: altText,
          }));
        }
      }

      const response = await this.httpClient.post(
        `${TWITTER_API_BASE}/tweets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = response.data.data.id;

      logger.info('Tweet published successfully', {
        tweetId,
        accountId: account._id.toString(),
        hasMedia: mediaIds.length > 0,
        hasAltText: altTexts.length > 0,
      });

      return {
        platformPostId: tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
        metadata: response.data.data,
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishSingleTweet');
    }
  }

  /**
   * Publish Twitter thread
   */
  private async publishThread(account: ISocialAccount, threadOptions: TwitterThreadOptions): Promise<PublishPostResult> {
    const { tweets, mediaIds = [], altTexts = [] } = threadOptions;

    if (tweets.length === 0) {
      throw new Error('Thread must contain at least one tweet');
    }

    if (tweets.length > MAX_THREAD_LENGTH) {
      throw new Error(`Thread cannot exceed ${MAX_THREAD_LENGTH} tweets`);
    }

    // Validate each tweet
    const maxLength = this.getMaxContentLength(account);
    tweets.forEach((tweet, index) => {
      this.validateContentLength(tweet, maxLength);
      if (mediaIds[index]) {
        this.validateMediaCount(mediaIds[index], MAX_MEDIA_COUNT);
      }
    });

    const accessToken = this.getAccessToken(account);
    const publishedTweets: any[] = [];

    try {
      let previousTweetId: string | undefined;

      for (let i = 0; i < tweets.length; i++) {
        const tweetContent = tweets[i];
        const tweetMediaIds = mediaIds[i] || [];
        const tweetAltTexts = altTexts[i] || [];

        const payload: any = {
          text: tweetContent,
        };

        // Add reply to previous tweet (for threading)
        if (previousTweetId) {
          payload.reply = {
            in_reply_to_tweet_id: previousTweetId,
          };
        }

        // Add media if present
        if (tweetMediaIds.length > 0) {
          payload.media = {
            media_ids: tweetMediaIds,
          };

          // Add alt text if provided
          if (tweetAltTexts.length > 0) {
            payload.media.tagged_user_ids = tweetAltTexts.map((altText, mediaIndex) => ({
              media_id: tweetMediaIds[mediaIndex],
              alt_text: altText,
            }));
          }
        }

        const response = await this.httpClient.post(
          `${TWITTER_API_BASE}/tweets`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const tweetData = response.data.data;
        publishedTweets.push(tweetData);
        previousTweetId = tweetData.id;

        // Add delay between tweets to avoid rate limiting
        if (i < tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const firstTweetId = publishedTweets[0].id;

      logger.info('Twitter thread published successfully', {
        threadId: firstTweetId,
        accountId: account._id.toString(),
        tweetCount: publishedTweets.length,
      });

      return {
        platformPostId: firstTweetId,
        url: `https://twitter.com/i/web/status/${firstTweetId}`,
        metadata: {
          threadTweets: publishedTweets,
          isThread: true,
        },
      };
    } catch (error: any) {
      logger.error('Thread publishing failed', {
        accountId: account._id.toString(),
        publishedCount: publishedTweets.length,
        totalCount: tweets.length,
        error: error.message,
      });
      this.handleApiError(error, 'publishThread');
    }
  }

  /**
   * Publish Twitter poll
   */
  private async publishPoll(
    account: ISocialAccount, 
    content: string, 
    pollOptions: TwitterPollOptions
  ): Promise<PublishPostResult> {
    const { options, durationMinutes } = pollOptions;

    // Validate poll
    if (options.length < 2 || options.length > MAX_POLL_OPTIONS) {
      throw new Error(`Poll must have 2-${MAX_POLL_OPTIONS} options`);
    }

    if (durationMinutes < MIN_POLL_DURATION || durationMinutes > MAX_POLL_DURATION) {
      throw new Error(`Poll duration must be between ${MIN_POLL_DURATION} minutes and ${MAX_POLL_DURATION} minutes`);
    }

    // Validate content length
    const maxLength = this.getMaxContentLength(account);
    this.validateContentLength(content, maxLength);

    const accessToken = this.getAccessToken(account);

    try {
      const payload = {
        text: content,
        poll: {
          options: options.map(option => ({ label: option })),
          duration_minutes: durationMinutes,
        },
      };

      const response = await this.httpClient.post(
        `${TWITTER_API_BASE}/tweets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = response.data.data.id;

      logger.info('Twitter poll published successfully', {
        tweetId,
        accountId: account._id.toString(),
        optionCount: options.length,
        durationMinutes,
      });

      return {
        platformPostId: tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
        metadata: {
          ...response.data.data,
          isPoll: true,
          pollOptions: options,
          pollDuration: durationMinutes,
        },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishPoll');
    }
  }

  /**
   * Publish reply tweet
   */
  private async publishReply(
    account: ISocialAccount,
    content: string,
    mediaIds: string[] = [],
    replyOptions: TwitterReplyOptions
  ): Promise<PublishPostResult> {
    const { inReplyToTweetId } = replyOptions;

    // Validate content length
    const maxLength = this.getMaxContentLength(account);
    this.validateContentLength(content, maxLength);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);

    try {
      const payload: any = {
        text: content,
        reply: {
          in_reply_to_tweet_id: inReplyToTweetId,
        },
      };

      if (mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };
      }

      const response = await this.httpClient.post(
        `${TWITTER_API_BASE}/tweets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = response.data.data.id;

      logger.info('Reply tweet published successfully', {
        tweetId,
        inReplyTo: inReplyToTweetId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
        metadata: {
          ...response.data.data,
          isReply: true,
          inReplyToTweetId,
        },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishReply');
    }
  }

  /**
   * Publish quote tweet
   */
  private async publishQuote(
    account: ISocialAccount,
    content: string,
    mediaIds: string[] = [],
    quoteOptions: TwitterQuoteOptions
  ): Promise<PublishPostResult> {
    const { quoteTweetId } = quoteOptions;

    // Validate content length
    const maxLength = this.getMaxContentLength(account);
    this.validateContentLength(content, maxLength);
    this.validateMediaCount(mediaIds, MAX_MEDIA_COUNT);

    const accessToken = this.getAccessToken(account);

    try {
      const payload: any = {
        text: content,
        quote_tweet_id: quoteTweetId,
      };

      if (mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };
      }

      const response = await this.httpClient.post(
        `${TWITTER_API_BASE}/tweets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const tweetId = response.data.data.id;

      logger.info('Quote tweet published successfully', {
        tweetId,
        quoteTweetId,
        accountId: account._id.toString(),
      });

      return {
        platformPostId: tweetId,
        url: `https://twitter.com/i/web/status/${tweetId}`,
        metadata: {
          ...response.data.data,
          isQuote: true,
          quoteTweetId,
        },
      };
    } catch (error: any) {
      this.handleApiError(error, 'publishQuote');
    }
  }

  /**
   * Delete tweet
   */
  async deleteTweet(account: ISocialAccount, tweetId: string): Promise<boolean> {
    const accessToken = this.getAccessToken(account);

    try {
      await this.httpClient.delete(
        `${TWITTER_API_BASE}/tweets/${tweetId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      logger.info('Tweet deleted successfully', {
        tweetId,
        accountId: account._id.toString(),
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to delete tweet', {
        tweetId,
        accountId: account._id.toString(),
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get maximum content length based on account type
   */
  private getMaxContentLength(account: ISocialAccount): number {
    // Check if account has premium features (stored in metadata)
    const isPremium = account.metadata?.isPremium || account.metadata?.subscription?.includes('premium');
    return isPremium ? MAX_CONTENT_LENGTH_PREMIUM : MAX_CONTENT_LENGTH;
  }

  /**
   * Upload media to Twitter with alt text support
   */
  async uploadMedia(account: ISocialAccount, mediaUrls: string[], altTexts: string[] = []): Promise<string[]> {
    const accessToken = this.getAccessToken(account);
    const mediaIds: string[] = [];

    for (let i = 0; i < mediaUrls.length; i++) {
      const url = mediaUrls[i];
      const altText = altTexts[i];

      try {
        const mediaBuffer = await this.downloadMedia(url);
        const mediaType = this.getMediaType(url);
        const mimeType = this.getMimeType(url);

        // Initialize upload
        const initResponse = await this.httpClient.post(
          `${TWITTER_UPLOAD_BASE}/media/upload.json`,
          {
            command: 'INIT',
            total_bytes: mediaBuffer.length,
            media_type: mimeType,
            media_category: mediaType === 'video' ? 'tweet_video' : 'tweet_image',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const mediaId = initResponse.data.media_id_string;

        // Upload media in chunks for large files
        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
        let segmentIndex = 0;

        for (let offset = 0; offset < mediaBuffer.length; offset += chunkSize) {
          const chunk = mediaBuffer.slice(offset, offset + chunkSize);
          
          const formData = new FormData();
          formData.append('command', 'APPEND');
          formData.append('media_id', mediaId);
          formData.append('media', chunk);
          formData.append('segment_index', segmentIndex.toString());

          await this.httpClient.post(
            `${TWITTER_UPLOAD_BASE}/media/upload.json`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                ...formData.getHeaders(),
              },
            }
          );

          segmentIndex++;
        }

        // Finalize upload
        await this.httpClient.post(
          `${TWITTER_UPLOAD_BASE}/media/upload.json`,
          {
            command: 'FINALIZE',
            media_id: mediaId,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // Add alt text if provided
        if (altText && altText.trim()) {
          await this.addAltText(accessToken, mediaId, altText);
        }

        mediaIds.push(mediaId);

        logger.info('Media uploaded to Twitter', {
          mediaId,
          url,
          hasAltText: !!altText,
          mediaType,
          size: mediaBuffer.length,
        });
      } catch (error: any) {
        logger.error('Failed to upload media to Twitter', {
          url,
          error: error.message,
        });
        this.handleApiError(error, 'uploadMedia');
      }
    }

    return mediaIds;
  }

  /**
   * Add alt text to uploaded media
   */
  private async addAltText(accessToken: string, mediaId: string, altText: string): Promise<void> {
    try {
      await this.httpClient.post(
        `${TWITTER_UPLOAD_BASE}/media/metadata/create.json`,
        {
          media_id: mediaId,
          alt_text: {
            text: altText.substring(0, 1000), // Twitter alt text limit
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.debug('Alt text added to media', {
        mediaId,
        altText: altText.substring(0, 100) + '...',
      });
    } catch (error: any) {
      logger.warn('Failed to add alt text', {
        mediaId,
        error: error.message,
      });
      // Don't throw - alt text is optional
    }
  }

  /**
   * Get MIME type for media file
   */
  private getMimeType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'avi':
        return 'video/x-msvideo';
      case 'm4v':
        return 'video/x-m4v';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get Twitter profile metrics
   */
  async getProfileMetrics(account: ISocialAccount): Promise<any> {
    const accessToken = this.getAccessToken(account);

    try {
      const response = await this.httpClient.get(
        `${TWITTER_API_BASE}/users/me`,
        {
          params: {
            'user.fields': 'public_metrics,verified,verified_type',
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const user = response.data.data;
      const metrics = user.public_metrics;

      return {
        followersCount: metrics.followers_count,
        followingCount: metrics.following_count,
        tweetCount: metrics.tweet_count,
        listedCount: metrics.listed_count,
        verified: user.verified,
        verifiedType: user.verified_type,
      };
    } catch (error: any) {
      logger.error('Failed to get Twitter profile metrics', {
        accountId: account._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get platform limits and capabilities
   */
  getLimits() {
    return {
      maxContentLength: MAX_CONTENT_LENGTH,
      maxContentLengthPremium: MAX_CONTENT_LENGTH_PREMIUM,
      maxMediaCount: MAX_MEDIA_COUNT,
      maxThreadLength: MAX_THREAD_LENGTH,
      maxPollOptions: MAX_POLL_OPTIONS,
      minPollDuration: MIN_POLL_DURATION,
      maxPollDuration: MAX_POLL_DURATION,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-m4v'],
      features: {
        threads: true,
        polls: true,
        altText: true,
        replies: true,
        quotes: true,
        scheduling: true,
        analytics: true,
      },
    };
  }
}
