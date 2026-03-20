/**
 * Google Business Profile Publisher
 * 
 * Handles publishing posts to Google Business Profile locations
 * Supports: Standard posts, Events, Offers, Products, Alerts
 * 
 * API Documentation:
 * - Posts: https://mybusiness.googleapis.com/v4/{location_name}/localPosts
 * - Reviews: https://mybusiness.googleapis.com/v4/{location_name}/reviews
 * - Analytics: https://businessprofileperformance.googleapis.com/v1/{location_name}:fetchMultiDailyMetricsTimeSeries
 */

import axios, { AxiosResponse } from 'axios';
import { IPublisher, PublishPostOptions, PublishPostResult } from './IPublisher';
import { ISocialAccount } from '../../models/SocialAccount';
import { IBusinessLocation } from '../../models/BusinessLocation';
import { logger } from '../../utils/logger';
import { classifyPublishingError } from '../../types/PublishingErrors';

export interface GoogleBusinessPost {
  text: string;
  mediaUrls?: string[];
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER' | 'PRODUCT' | 'ALERT';
  callToAction?: {
    actionType: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL';
    url: string;
  };
  // Event-specific fields
  event?: {
    title: string;
    startDate: string; // ISO 8601
    endDate: string;   // ISO 8601
  };
  // Offer-specific fields
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  // Product-specific fields
  product?: {
    name: string;
    category?: string;
    price?: {
      currencyCode: string;
      units: string;
      nanos: number;
    };
  };
}

export interface GoogleBusinessReview {
  name: string;
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: number;
  comment: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface LocationInsights {
  locationName: string;
  metrics: {
    impressions: number;
    views: number;
    directionRequests: number;
    callClicks: number;
    websiteClicks: number;
    bookings: number;
    foodOrders: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export class GoogleBusinessPublisher implements IPublisher {
  readonly platform = 'google-business';
  protected readonly requiredScopes = ['https://www.googleapis.com/auth/business.manage'];
  private readonly baseUrl = 'https://mybusiness.googleapis.com/v4';
  private readonly performanceUrl = 'https://businessprofileperformance.googleapis.com/v1';

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
    try {
      logger.info('Publishing Google Business Profile post', {
        accountId: account._id,
        hasMedia: !!options.mediaIds?.length,
      });

      // Get business location from account metadata
      const locationName = this.getLocationName(account);
      if (!locationName) {
        throw new Error('No business location found in account metadata');
      }

      // Extract Google Business specific metadata
      const metadata = options.metadata || {};
      const topicType = metadata.topicType || 'STANDARD';

      // Prepare post data
      const postData = this.preparePostData(options, metadata);

      // Make API request
      const response = await this.makeAuthenticatedRequest(
        'POST',
        `${this.baseUrl}/${locationName}/localPosts`,
        account.accessToken!,
        postData
      );

      logger.info('Google Business Profile post published successfully', {
        accountId: account._id,
        postId: response.data.name,
        topicType,
      });

      return {
        platformPostId: response.data.name,
        metadata: response.data,
      };

    } catch (error: any) {
      logger.error('Failed to publish Google Business Profile post', {
        accountId: account._id,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      throw error;
    }
  }

  async uploadMedia(account: ISocialAccount, mediaUrls: string[]): Promise<string[]> {
    // Google Business Profile doesn't require separate media upload
    // Media URLs are included directly in the post
    return mediaUrls;
  }

  async validatePost(options: PublishPostOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate content length
    if (!options.content || options.content.trim().length === 0) {
      errors.push('Post content is required');
    } else if (options.content.length > 1500) {
      errors.push('Post content must be 1500 characters or less');
    }

    // Validate media count
    if (options.mediaIds && options.mediaIds.length > 1) {
      errors.push('Google Business Profile supports only 1 image per post');
    }

    // Validate event-specific fields
    const metadata = options.metadata || {};
    if (metadata.topicType === 'EVENT') {
      if (!metadata.event?.title) {
        errors.push('Event title is required for event posts');
      } else if (metadata.event.title.length > 58) {
        errors.push('Event title must be 58 characters or less');
      }

      if (!metadata.event?.startDate || !metadata.event?.endDate) {
        errors.push('Event start and end dates are required for event posts');
      }
    }

    // Validate offer-specific fields
    if (metadata.topicType === 'OFFER') {
      if (metadata.offer?.couponCode && metadata.offer.couponCode.length > 58) {
        errors.push('Coupon code must be 58 characters or less');
      }

      if (metadata.offer?.termsConditions && metadata.offer.termsConditions.length > 1500) {
        errors.push('Terms and conditions must be 1500 characters or less');
      }
    }

    // Validate product-specific fields
    if (metadata.topicType === 'PRODUCT') {
      if (!metadata.product?.name) {
        errors.push('Product name is required for product posts');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getLimits() {
    return {
      maxContentLength: 1500,
      maxMediaCount: 1,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif'],
    };
  }

  async deletePost(account: ISocialAccount, platformPostId: string): Promise<void> {
    try {
      logger.info('Deleting Google Business Profile post', {
        accountId: account._id,
        postId: platformPostId,
      });

      await this.makeAuthenticatedRequest(
        'DELETE',
        `${this.baseUrl}/${platformPostId}`,
        account.accessToken!
      );

      logger.info('Google Business Profile post deleted successfully', {
        accountId: account._id,
        postId: platformPostId,
      });

    } catch (error: any) {
      logger.error('Failed to delete Google Business Profile post', {
        accountId: account._id,
        postId: platformPostId,
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  async getReviews(account: ISocialAccount, pageSize: number = 50): Promise<GoogleBusinessReview[]> {
    try {
      const locationName = this.getLocationName(account);
      if (!locationName) {
        throw new Error('No business location found in account metadata');
      }

      logger.info('Fetching Google Business Profile reviews', {
        accountId: account._id,
        locationName,
        pageSize,
      });

      const response = await this.makeAuthenticatedRequest(
        'GET',
        `${this.baseUrl}/${locationName}/reviews?pageSize=${pageSize}&orderBy=updateTime desc`,
        account.accessToken!
      );

      const reviews = response.data.reviews || [];
      
      logger.info('Google Business Profile reviews fetched', {
        accountId: account._id,
        reviewCount: reviews.length,
      });

      return reviews;

    } catch (error: any) {
      logger.error('Failed to fetch Google Business Profile reviews', {
        accountId: account._id,
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  async replyToReview(account: ISocialAccount, reviewId: string, reply: string): Promise<void> {
    try {
      logger.info('Replying to Google Business Profile review', {
        accountId: account._id,
        reviewId,
      });

      const locationName = this.getLocationName(account);
      if (!locationName) {
        throw new Error('No business location found in account metadata');
      }

      const reviewName = `${locationName}/reviews/${reviewId}`;

      await this.makeAuthenticatedRequest(
        'PUT',
        `${this.baseUrl}/${reviewName}/reply`,
        account.accessToken!,
        { comment: reply }
      );

      logger.info('Google Business Profile review reply posted', {
        accountId: account._id,
        reviewId,
      });

    } catch (error: any) {
      logger.error('Failed to reply to Google Business Profile review', {
        accountId: account._id,
        reviewId,
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  async deleteReviewReply(account: ISocialAccount, reviewId: string): Promise<void> {
    try {
      logger.info('Deleting Google Business Profile review reply', {
        accountId: account._id,
        reviewId,
      });

      const locationName = this.getLocationName(account);
      if (!locationName) {
        throw new Error('No business location found in account metadata');
      }

      const reviewName = `${locationName}/reviews/${reviewId}`;

      await this.makeAuthenticatedRequest(
        'DELETE',
        `${this.baseUrl}/${reviewName}/reply`,
        account.accessToken!
      );

      logger.info('Google Business Profile review reply deleted', {
        accountId: account._id,
        reviewId,
      });

    } catch (error: any) {
      logger.error('Failed to delete Google Business Profile review reply', {
        accountId: account._id,
        reviewId,
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  async getLocationInsights(
    account: ISocialAccount, 
    startDate: string, 
    endDate: string
  ): Promise<LocationInsights> {
    try {
      const locationName = this.getLocationName(account);
      if (!locationName) {
        throw new Error('No business location found in account metadata');
      }

      logger.info('Fetching Google Business Profile insights', {
        accountId: account._id,
        locationName,
        startDate,
        endDate,
      });

      const metricsRequest = {
        dailyMetrics: [
          'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
          'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
          'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
          'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
          'BUSINESS_DIRECTION_REQUESTS',
          'CALL_CLICKS',
          'WEBSITE_CLICKS',
          'BUSINESS_BOOKINGS',
          'BUSINESS_FOOD_ORDERS',
        ],
        dailyRange: {
          startDate: this.formatDateForAPI(startDate),
          endDate: this.formatDateForAPI(endDate),
        },
      };

      const response = await this.makeAuthenticatedRequest(
        'POST',
        `${this.performanceUrl}/${locationName}:fetchMultiDailyMetricsTimeSeries`,
        account.accessToken!,
        metricsRequest
      );

      // Process and aggregate metrics
      const insights = this.processInsightsData(response.data, locationName, startDate, endDate);

      logger.info('Google Business Profile insights fetched', {
        accountId: account._id,
        totalImpressions: insights.metrics.impressions,
        totalViews: insights.metrics.views,
      });

      return insights;

    } catch (error: any) {
      logger.error('Failed to fetch Google Business Profile insights', {
        accountId: account._id,
        error: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  private getLocationName(account: ISocialAccount): string | null {
    // Extract location name from account metadata
    // This should be stored when the account is connected
    const metadata = account.metadata as any;
    return metadata?.locationName || metadata?.businessLocation?.name || null;
  }

  private preparePostData(options: PublishPostOptions, metadata: any): any {
    const postData: any = {
      summary: options.content,
      topicType: metadata.topicType || 'STANDARD',
    };

    // Add media if provided
    if (options.mediaIds && options.mediaIds.length > 0) {
      postData.media = options.mediaIds.map(url => ({
        mediaFormat: 'PHOTO',
        sourceUrl: url,
      }));
    }

    // Add call to action
    if (metadata.callToAction) {
      postData.callToAction = {
        actionType: metadata.callToAction.actionType,
        url: metadata.callToAction.url,
      };
    }

    // Add type-specific data
    if (metadata.topicType === 'EVENT' && metadata.event) {
      postData.event = {
        title: metadata.event.title,
        schedule: {
          startDate: this.formatDateForAPI(metadata.event.startDate),
          endDate: this.formatDateForAPI(metadata.event.endDate),
        },
      };
    }

    if (metadata.topicType === 'OFFER' && metadata.offer) {
      postData.offer = {
        couponCode: metadata.offer.couponCode,
        redeemOnlineUrl: metadata.offer.redeemOnlineUrl,
        termsConditions: metadata.offer.termsConditions,
      };
    }

    if (metadata.topicType === 'PRODUCT' && metadata.product) {
      postData.product = {
        name: metadata.product.name,
        category: metadata.product.category,
        price: metadata.product.price,
      };
    }

    return postData;
  }

  private async makeAuthenticatedRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    accessToken: string,
    data?: any
  ): Promise<AxiosResponse> {
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data,
    };

    return axios(config);
  }

  private formatDateForAPI(dateString: string): any {
    const date = new Date(dateString);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  private processInsightsData(
    data: any, 
    locationName: string, 
    startDate: string, 
    endDate: string
  ): LocationInsights {
    // Process the metrics time series data
    const metrics = {
      impressions: 0,
      views: 0,
      directionRequests: 0,
      callClicks: 0,
      websiteClicks: 0,
      bookings: 0,
      foodOrders: 0,
    };

    // Aggregate metrics from time series data
    if (data.multiDailyMetricTimeSeries) {
      for (const series of data.multiDailyMetricTimeSeries) {
        const metricType = series.dailyMetric;
        const values = series.dailyMetricTimeSeries?.timeSeries?.metricValues || [];
        
        const totalValue = values.reduce((sum: number, value: any) => {
          return sum + (parseInt(value.metricValue) || 0);
        }, 0);

        switch (metricType) {
          case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
          case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
          case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
          case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
            metrics.impressions += totalValue;
            metrics.views += totalValue; // Views = impressions for GBP
            break;
          case 'BUSINESS_DIRECTION_REQUESTS':
            metrics.directionRequests += totalValue;
            break;
          case 'CALL_CLICKS':
            metrics.callClicks += totalValue;
            break;
          case 'WEBSITE_CLICKS':
            metrics.websiteClicks += totalValue;
            break;
          case 'BUSINESS_BOOKINGS':
            metrics.bookings += totalValue;
            break;
          case 'BUSINESS_FOOD_ORDERS':
            metrics.foodOrders += totalValue;
            break;
        }
      }
    }

    return {
      locationName,
      metrics,
      dateRange: {
        startDate,
        endDate,
      },
    };
  }
}