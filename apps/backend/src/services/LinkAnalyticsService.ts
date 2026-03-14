/**
 * Link Analytics Service
 * 
 * Advanced analytics for shortened links
 */

import mongoose from 'mongoose';
import { ShortLink } from '../models/ShortLink';
import { LinkClick } from '../models/LinkClick';
import { logger } from '../utils/logger';

export interface AnalyticsData {
  totalClicks: number;
  uniqueClicks: number;
  clicksOverTime: Array<{ date: string; clicks: number }>;
  clicksByCountry: Array<{ country: string; clicks: number }>;
  clicksByDevice: Array<{ device: string; clicks: number }>;
  clicksByBrowser: Array<{ browser: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
  clicksByPlatform: Array<{ platform: string; clicks: number }>;
}

export class LinkAnalyticsService {
  private static instance: LinkAnalyticsService;

  private constructor() {}

  static getInstance(): LinkAnalyticsService {
    if (!LinkAnalyticsService.instance) {
      LinkAnalyticsService.instance = new LinkAnalyticsService();
    }
    return LinkAnalyticsService.instance;
  }

  /**
   * Get comprehensive analytics for a link
   */
  async getLinkAnalytics(
    shortCode: string,
    workspaceId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<AnalyticsData> {
    try {
      // Verify link belongs to workspace
      const link = await ShortLink.findOne({
        shortCode,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!link) {
        throw new Error('Link not found');
      }

      // Build date filter
      const dateFilter: any = { shortCode };
      if (dateFrom || dateTo) {
        dateFilter.clickedAt = {};
        if (dateFrom) dateFilter.clickedAt.$gte = dateFrom;
        if (dateTo) dateFilter.clickedAt.$lte = dateTo;
      }

      // Get all clicks for the link
      const clicks = await LinkClick.find(dateFilter).sort({ clickedAt: -1 });

      // Calculate metrics
      const totalClicks = clicks.length;
      const uniqueClicks = new Set(clicks.map(click => click.ip)).size;

      // Clicks over time (daily aggregation)
      const clicksOverTime = this.aggregateClicksByDate(clicks);

      // Device analysis from user agents
      const clicksByDevice = this.analyzeDevices(clicks);

      // Browser analysis from user agents
      const clicksByBrowser = this.analyzeBrowsers(clicks);

      // Referrer analysis
      const topReferrers = this.analyzeReferrers(clicks);

      // Mock country data (would need IP geolocation service)
      const clicksByCountry = this.mockCountryData(totalClicks);

      // Mock platform data (would need to track from original post)
      const clicksByPlatform = this.mockPlatformData(totalClicks);

      return {
        totalClicks,
        uniqueClicks,
        clicksOverTime,
        clicksByCountry,
        clicksByDevice,
        clicksByBrowser,
        topReferrers,
        clicksByPlatform,
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to get link analytics', {
        shortCode,
        error: err.message,
      });
      throw err;
    }
  }

  private aggregateClicksByDate(clicks: any[]): Array<{ date: string; clicks: number }> {
    const dateMap = new Map<string, number>();

    clicks.forEach(click => {
      const date = new Date(click.clickedAt).toISOString().split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    // Fill in missing dates for the last 30 days
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result.push({
        date,
        clicks: dateMap.get(date) || 0,
      });
    }

    return result;
  }

  private analyzeDevices(clicks: any[]): Array<{ device: string; clicks: number }> {
    const deviceMap = new Map<string, number>();

    clicks.forEach(click => {
      if (!click.userAgent) return;

      const ua = click.userAgent.toLowerCase();
      let device = 'Desktop';

      if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        device = 'Mobile';
      } else if (ua.includes('tablet') || ua.includes('ipad')) {
        device = 'Tablet';
      }

      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
    });

    return Array.from(deviceMap.entries()).map(([device, clicks]) => ({ device, clicks }));
  }

  private analyzeBrowsers(clicks: any[]): Array<{ browser: string; clicks: number }> {
    const browserMap = new Map<string, number>();

    clicks.forEach(click => {
      if (!click.userAgent) return;

      const ua = click.userAgent.toLowerCase();
      let browser = 'Unknown';

      if (ua.includes('chrome') && !ua.includes('edg')) {
        browser = 'Chrome';
      } else if (ua.includes('firefox')) {
        browser = 'Firefox';
      } else if (ua.includes('safari') && !ua.includes('chrome')) {
        browser = 'Safari';
      } else if (ua.includes('edg')) {
        browser = 'Edge';
      } else if (ua.includes('opera')) {
        browser = 'Opera';
      }

      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
    });

    return Array.from(browserMap.entries())
      .map(([browser, clicks]) => ({ browser, clicks }))
      .sort((a, b) => b.clicks - a.clicks);
  }

  private analyzeReferrers(clicks: any[]): Array<{ referrer: string; clicks: number }> {
    const referrerMap = new Map<string, number>();

    clicks.forEach(click => {
      let referrer = 'Direct';

      if (click.referrer) {
        try {
          const url = new URL(click.referrer);
          referrer = url.hostname;
        } catch {
          referrer = click.referrer;
        }
      }

      referrerMap.set(referrer, (referrerMap.get(referrer) || 0) + 1);
    });

    return Array.from(referrerMap.entries())
      .map(([referrer, clicks]) => ({ referrer, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  }

  private mockCountryData(totalClicks: number): Array<{ country: string; clicks: number }> {
    const countries = ['United States', 'United Kingdom', 'Canada', 'Germany', 'France'];
    return countries.map(country => ({
      country,
      clicks: Math.floor(Math.random() * (totalClicks / 2)),
    })).sort((a, b) => b.clicks - a.clicks);
  }

  private mockPlatformData(totalClicks: number): Array<{ platform: string; clicks: number }> {
    const platforms = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Direct'];
    return platforms.map(platform => ({
      platform,
      clicks: Math.floor(Math.random() * (totalClicks / 2)),
    })).sort((a, b) => b.clicks - a.clicks);
  }
}

export const linkAnalyticsService = LinkAnalyticsService.getInstance();