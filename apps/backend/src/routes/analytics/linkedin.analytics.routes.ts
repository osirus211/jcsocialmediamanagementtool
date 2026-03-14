/**
 * LinkedIn Analytics Routes
 * 
 * Provides comprehensive LinkedIn analytics for personal profiles and company pages
 * 
 * Base: /api/v1/analytics/linkedin
 */

import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { SocialAccount, SocialPlatform } from '../../models/SocialAccount';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { logger } from '../../utils/logger';
import axios from 'axios';

const router = Router();

// Apply authentication and workspace middleware
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * GET /api/v1/analytics/linkedin/accounts/:accountId/profile-stats
 * Get LinkedIn profile/page statistics
 */
router.get('/accounts/:accountId/profile-stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accountId } = req.params;
    const workspaceId = req.workspace?.workspaceId;

    // Fetch account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.LINKEDIN,
    }).select('+accessToken');

    if (!account) {
      res.status(404).json({
        success: false,
        error: 'ACCOUNT_NOT_FOUND',
        message: 'LinkedIn account not found',
      });
      return;
    }

    const accessToken = account.getDecryptedAccessToken();
    const accountType = account.metadata?.accountType || 'personal';

    let stats: any = {};

    if (accountType === 'personal') {
      // Get personal profile stats
      stats = await getPersonalProfileStats(accessToken, account.providerUserId);
    } else {
      // Get organization stats
      stats = await getOrganizationStats(accessToken, account.providerUserId);
    }

    res.json({
      success: true,
      data: {
        accountId,
        accountType,
        stats,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('LinkedIn profile stats fetch failed', {
      accountId: req.params.accountId,
      error: error.message,
    });
    next(error);
  }
});

/**
 * GET /api/v1/analytics/linkedin/accounts/:accountId/post-analytics
 * Get LinkedIn post analytics
 */
router.get('/accounts/:accountId/post-analytics', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;
    const workspaceId = req.workspace?.workspaceId;

    // Fetch account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.LINKEDIN,
    }).select('+accessToken');

    if (!account) {
      res.status(404).json({
        success: false,
        error: 'ACCOUNT_NOT_FOUND',
        message: 'LinkedIn account not found',
      });
      return;
    }

    const accessToken = account.getDecryptedAccessToken();
    const accountType = account.metadata?.accountType || 'personal';

    // Get post analytics
    const analytics = await getPostAnalytics(
      accessToken, 
      account.providerUserId, 
      accountType,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        limit: parseInt(limit as string),
      }
    );

    res.json({
      success: true,
      data: {
        accountId,
        accountType,
        analytics,
        period: {
          startDate,
          endDate,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('LinkedIn post analytics fetch failed', {
      accountId: req.params.accountId,
      error: error.message,
    });
    next(error);
  }
});

/**
 * GET /api/v1/analytics/linkedin/accounts/:accountId/follower-analytics
 * Get LinkedIn follower analytics
 */
router.get('/accounts/:accountId/follower-analytics', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;
    const workspaceId = req.workspace?.workspaceId;

    // Fetch account
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
      provider: SocialPlatform.LINKEDIN,
    }).select('+accessToken');

    if (!account) {
      res.status(404).json({
        success: false,
        error: 'ACCOUNT_NOT_FOUND',
        message: 'LinkedIn account not found',
      });
      return;
    }

    const accessToken = account.getDecryptedAccessToken();
    const accountType = account.metadata?.accountType || 'personal';

    // Get follower analytics
    const analytics = await getFollowerAnalytics(
      accessToken, 
      account.providerUserId, 
      accountType,
      {
        startDate: startDate as string,
        endDate: endDate as string,
      }
    );

    res.json({
      success: true,
      data: {
        accountId,
        accountType,
        analytics,
        period: {
          startDate,
          endDate,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('LinkedIn follower analytics fetch failed', {
      accountId: req.params.accountId,
      error: error.message,
    });
    next(error);
  }
});

/**
 * Helper function: Get personal profile stats
 */
async function getPersonalProfileStats(accessToken: string, profileId: string): Promise<any> {
  try {
    // Get network size (connections)
    const networkResponse = await axios.get(
      `https://api.linkedin.com/v2/networkSizes/urn:li:person:${profileId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    return {
      connections: networkResponse.data.firstDegreeSize || 0,
      networkSize: networkResponse.data.secondDegreeSize || 0,
    };
  } catch (error: any) {
    logger.warn('Failed to fetch LinkedIn personal profile stats', {
      profileId,
      error: error.response?.data || error.message,
    });
    return {
      connections: 0,
      networkSize: 0,
    };
  }
}

/**
 * Helper function: Get organization stats
 */
async function getOrganizationStats(accessToken: string, organizationId: string): Promise<any> {
  try {
    // Get organization follower statistics
    const followerResponse = await axios.get(
      `https://api.linkedin.com/v2/organizationFollowerStatistics`,
      {
        params: {
          q: 'organizationalEntity',
          organizationalEntity: `urn:li:organization:${organizationId}`,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    const followerStats = followerResponse.data.elements?.[0] || {};

    return {
      followers: followerStats.followerCount || 0,
      organicFollowerCount: followerStats.organicFollowerCount || 0,
      paidFollowerCount: followerStats.paidFollowerCount || 0,
    };
  } catch (error: any) {
    logger.warn('Failed to fetch LinkedIn organization stats', {
      organizationId,
      error: error.response?.data || error.message,
    });
    return {
      followers: 0,
      organicFollowerCount: 0,
      paidFollowerCount: 0,
    };
  }
}

/**
 * Helper function: Get post analytics
 */
async function getPostAnalytics(
  accessToken: string, 
  entityId: string, 
  accountType: string,
  options: { startDate?: string; endDate?: string; limit: number }
): Promise<any> {
  try {
    const entityUrn = accountType === 'organization' 
      ? `urn:li:organization:${entityId}`
      : `urn:li:person:${entityId}`;

    // Calculate time intervals
    const endTime = options.endDate ? new Date(options.endDate).getTime() : Date.now();
    const startTime = options.startDate ? new Date(options.startDate).getTime() : endTime - (30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Get share statistics
    const shareStatsResponse = await axios.get(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics`,
      {
        params: {
          q: 'organizationalEntity',
          organizationalEntity: entityUrn,
          'timeIntervals.timeGranularityType': 'DAY',
          'timeIntervals.startTime': startTime,
          'timeIntervals.endTime': endTime,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    const shareStats = shareStatsResponse.data.elements || [];

    // Process and aggregate statistics
    const analytics = {
      totalShares: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLikes: 0,
      totalComments: 0,
      totalEngagement: 0,
      dailyStats: shareStats.map((stat: any) => ({
        date: new Date(stat.timeRange.start).toISOString().split('T')[0],
        shares: stat.totalShareStatistics?.shareCount || 0,
        impressions: stat.totalShareStatistics?.impressionCount || 0,
        clicks: stat.totalShareStatistics?.clickCount || 0,
        likes: stat.totalShareStatistics?.likeCount || 0,
        comments: stat.totalShareStatistics?.commentCount || 0,
        engagement: stat.totalShareStatistics?.engagement || 0,
      })),
    };

    // Calculate totals
    analytics.dailyStats.forEach((day: any) => {
      analytics.totalShares += day.shares;
      analytics.totalImpressions += day.impressions;
      analytics.totalClicks += day.clicks;
      analytics.totalLikes += day.likes;
      analytics.totalComments += day.comments;
      analytics.totalEngagement += day.engagement;
    });

    return analytics;
  } catch (error: any) {
    logger.warn('Failed to fetch LinkedIn post analytics', {
      entityId,
      accountType,
      error: error.response?.data || error.message,
    });
    return {
      totalShares: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLikes: 0,
      totalComments: 0,
      totalEngagement: 0,
      dailyStats: [],
    };
  }
}

/**
 * Helper function: Get follower analytics
 */
async function getFollowerAnalytics(
  accessToken: string, 
  entityId: string, 
  accountType: string,
  options: { startDate?: string; endDate?: string }
): Promise<any> {
  try {
    if (accountType !== 'organization') {
      // Personal profiles don't have detailed follower analytics
      return {
        totalFollowers: 0,
        followerGrowth: [],
        demographics: {},
      };
    }

    const entityUrn = `urn:li:organization:${entityId}`;

    // Calculate time intervals
    const endTime = options.endDate ? new Date(options.endDate).getTime() : Date.now();
    const startTime = options.startDate ? new Date(options.startDate).getTime() : endTime - (30 * 24 * 60 * 60 * 1000);

    // Get follower statistics
    const followerResponse = await axios.get(
      `https://api.linkedin.com/v2/organizationFollowerStatistics`,
      {
        params: {
          q: 'organizationalEntity',
          organizationalEntity: entityUrn,
          'timeIntervals.timeGranularityType': 'DAY',
          'timeIntervals.startTime': startTime,
          'timeIntervals.endTime': endTime,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    const followerStats = followerResponse.data.elements || [];

    const analytics = {
      totalFollowers: 0,
      followerGrowth: followerStats.map((stat: any) => ({
        date: new Date(stat.timeRange.start).toISOString().split('T')[0],
        followers: stat.followerCount || 0,
        organicFollowers: stat.organicFollowerCount || 0,
        paidFollowers: stat.paidFollowerCount || 0,
      })),
      demographics: {
        // LinkedIn API provides limited demographic data
        // This would need additional API calls for detailed demographics
      },
    };

    // Get latest follower count
    if (analytics.followerGrowth.length > 0) {
      analytics.totalFollowers = analytics.followerGrowth[analytics.followerGrowth.length - 1].followers;
    }

    return analytics;
  } catch (error: any) {
    logger.warn('Failed to fetch LinkedIn follower analytics', {
      entityId,
      accountType,
      error: error.response?.data || error.message,
    });
    return {
      totalFollowers: 0,
      followerGrowth: [],
      demographics: {},
    };
  }
}

export default router;