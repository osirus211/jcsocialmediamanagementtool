/**
 * Google Analytics Integration Service
 * 
 * Integrates with Google Analytics to track social media referral traffic
 * and campaign performance
 */

import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface GoogleAnalyticsConfig {
  propertyId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiresAt?: Date;
}

export interface ReferralTrafficData {
  source: string;
  medium: string;
  campaign?: string;
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
  conversionValue: number;
  date: string;
}

export interface CampaignPerformance {
  campaignName: string;
  source: string;
  medium: string;
  clicks: number;
  sessions: number;
  users: number;
  conversions: number;
  conversionValue: number;
  costPerClick?: number;
  returnOnAdSpend?: number;
}

export interface SocialLinkClick {
  linkUrl: string;
  source: string;
  medium: string;
  clicks: number;
  sessions: number;
  users: number;
  timestamp: Date;
}

export class GoogleAnalyticsService {
  private static readonly GA_API_BASE = 'https://analyticsreporting.googleapis.com/v4';
  private static readonly OAUTH_BASE = 'https://oauth2.googleapis.com/token';

  /**
   * Encrypt OAuth tokens for secure storage
   */
  private static encryptToken(token: string): string {
    const secretKey = process.env.ENCRYPTION_KEY;
    if (!secretKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    cipher.setAAD(Buffer.from('google-analytics', 'utf8'));
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt OAuth tokens
   */
  private static decryptToken(encryptedToken: string): string {
    const secretKey = process.env.ENCRYPTION_KEY;
    if (!secretKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    
    const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAAD(Buffer.from('google-analytics', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Refresh access token using refresh token
   */
  private static async refreshAccessToken(config: GoogleAnalyticsConfig): Promise<string> {
    try {
      const response = await fetch(this.OAUTH_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: this.decryptToken(config.refreshToken),
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`);
      }

      const data = await response.json() as { access_token: string };
      return data.access_token;
    } catch (error) {
      logger.error('Error refreshing Google Analytics access token:', error);
      throw error;
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private static async getValidAccessToken(config: GoogleAnalyticsConfig): Promise<string> {
    try {
      // Check if current token is still valid
      if (config.accessToken && config.tokenExpiresAt && config.tokenExpiresAt > new Date()) {
        return this.decryptToken(config.accessToken);
      }

      // Refresh token
      const newAccessToken = await this.refreshAccessToken(config);
      
      // Update config with new token (caller should save this)
      config.accessToken = this.encryptToken(newAccessToken);
      config.tokenExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      return newAccessToken;
    } catch (error) {
      logger.error('Error getting valid access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Google Analytics API
   */
  private static async makeGARequest(
    config: GoogleAnalyticsConfig,
    endpoint: string,
    body: any
  ): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(config);

      const response = await fetch(`${this.GA_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`GA API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error making Google Analytics request:', error);
      throw error;
    }
  }

  /**
   * Get social media referral traffic data
   */
  static async getReferralTraffic(
    config: GoogleAnalyticsConfig,
    options: {
      startDate: string; // YYYY-MM-DD
      endDate: string;   // YYYY-MM-DD
      socialPlatforms?: string[]; // ['facebook.com', 'twitter.com', etc.]
    }
  ): Promise<ReferralTrafficData[]> {
    try {
      const { startDate, endDate, socialPlatforms = [] } = options;

      const requestBody = {
        reportRequests: [
          {
            viewId: config.propertyId,
            dateRanges: [{ startDate, endDate }],
            metrics: [
              { expression: 'ga:sessions' },
              { expression: 'ga:users' },
              { expression: 'ga:pageviews' },
              { expression: 'ga:bounceRate' },
              { expression: 'ga:avgSessionDuration' },
              { expression: 'ga:goalCompletionsAll' },
              { expression: 'ga:goalValueAll' },
            ],
            dimensions: [
              { name: 'ga:source' },
              { name: 'ga:medium' },
              { name: 'ga:campaign' },
              { name: 'ga:date' },
            ],
            dimensionFilterClauses: [
              {
                filters: [
                  {
                    dimensionName: 'ga:medium',
                    operator: 'EXACT',
                    expressions: ['social'],
                  },
                ],
              },
            ],
            orderBys: [{ fieldName: 'ga:sessions', sortOrder: 'DESCENDING' }],
          },
        ],
      };

      // Add source filter if specific platforms specified
      if (socialPlatforms.length > 0) {
        requestBody.reportRequests[0].dimensionFilterClauses.push({
          filters: [
            {
              dimensionName: 'ga:source',
              operator: 'IN_LIST',
              expressions: socialPlatforms,
            },
          ],
        });
      }

      const response = await this.makeGARequest(config, '/reports:batchGet', requestBody);
      
      const report = response.reports[0];
      if (!report.data.rows) {
        return [];
      }

      return report.data.rows.map((row: any) => ({
        source: row.dimensions[0],
        medium: row.dimensions[1],
        campaign: row.dimensions[2],
        date: row.dimensions[3],
        sessions: parseInt(row.metrics[0].values[0]),
        users: parseInt(row.metrics[0].values[1]),
        pageviews: parseInt(row.metrics[0].values[2]),
        bounceRate: parseFloat(row.metrics[0].values[3]),
        avgSessionDuration: parseFloat(row.metrics[0].values[4]),
        conversions: parseInt(row.metrics[0].values[5]),
        conversionValue: parseFloat(row.metrics[0].values[6]),
      }));
    } catch (error) {
      logger.error('Error getting referral traffic data:', error);
      throw error;
    }
  }

  /**
   * Get campaign performance data
   */
  static async getCampaignPerformance(
    config: GoogleAnalyticsConfig,
    options: {
      startDate: string;
      endDate: string;
      campaignNames?: string[];
    }
  ): Promise<CampaignPerformance[]> {
    try {
      const { startDate, endDate, campaignNames = [] } = options;

      const requestBody: any = {
        reportRequests: [
          {
            viewId: config.propertyId,
            dateRanges: [{ startDate, endDate }],
            metrics: [
              { expression: 'ga:sessions' },
              { expression: 'ga:users' },
              { expression: 'ga:goalCompletionsAll' },
              { expression: 'ga:goalValueAll' },
            ],
            dimensions: [
              { name: 'ga:campaign' },
              { name: 'ga:source' },
              { name: 'ga:medium' },
            ],
            orderBys: [{ fieldName: 'ga:sessions', sortOrder: 'DESCENDING' }],
          },
        ],
      };

      // Add campaign filter if specific campaigns specified
      if (campaignNames.length > 0) {
        requestBody.reportRequests[0].dimensionFilterClauses = [
          {
            filters: [
              {
                dimensionName: 'ga:campaign',
                operator: 'IN_LIST',
                expressions: campaignNames,
              },
            ],
          },
        ];
      }

      const response = await this.makeGARequest(config, '/reports:batchGet', requestBody);
      
      const report = response.reports[0];
      if (!report.data.rows) {
        return [];
      }

      return report.data.rows.map((row: any) => ({
        campaignName: row.dimensions[0],
        source: row.dimensions[1],
        medium: row.dimensions[2],
        clicks: 0, // GA doesn't provide clicks directly, would need Google Ads integration
        sessions: parseInt(row.metrics[0].values[0]),
        users: parseInt(row.metrics[0].values[1]),
        conversions: parseInt(row.metrics[0].values[2]),
        conversionValue: parseFloat(row.metrics[0].values[3]),
      }));
    } catch (error) {
      logger.error('Error getting campaign performance data:', error);
      throw error;
    }
  }

  /**
   * Track social link clicks (for attribution)
   */
  static async trackSocialLinkClick(
    config: GoogleAnalyticsConfig,
    clickData: {
      linkUrl: string;
      source: string;
      medium: string;
      campaign?: string;
      userId?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      // This would typically use Google Analytics Measurement Protocol
      // to send custom events for link click tracking
      const measurementId = config.propertyId;
      const apiSecret = process.env.GA_MEASUREMENT_API_SECRET;

      if (!apiSecret) {
        logger.warn('GA Measurement API secret not configured, skipping link click tracking');
        return;
      }

      const payload = {
        client_id: clickData.sessionId || 'anonymous',
        user_id: clickData.userId,
        events: [
          {
            name: 'social_link_click',
            parameters: {
              link_url: clickData.linkUrl,
              source: clickData.source,
              medium: clickData.medium,
              campaign: clickData.campaign || 'unknown',
              event_category: 'social_media',
              event_label: `${clickData.source}_${clickData.medium}`,
            },
          },
        ],
      };

      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to track link click: ${response.statusText}`);
      }

      logger.info('Social link click tracked successfully');
    } catch (error) {
      logger.error('Error tracking social link click:', error);
      // Don't throw - tracking failures shouldn't break the main flow
    }
  }

  /**
   * Test connection to Google Analytics
   */
  static async testConnection(config: GoogleAnalyticsConfig): Promise<boolean> {
    try {
      const requestBody = {
        reportRequests: [
          {
            viewId: config.propertyId,
            dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
            metrics: [{ expression: 'ga:sessions' }],
            dimensions: [{ name: 'ga:date' }],
            pageSize: 1,
          },
        ],
      };

      await this.makeGARequest(config, '/reports:batchGet', requestBody);
      return true;
    } catch (error) {
      logger.error('Google Analytics connection test failed:', error);
      return false;
    }
  }
}
