/**
 * Platform Controller
 * 
 * Provides platform status and rate limit information endpoints.
 * 
 * Endpoints:
 * - GET /api/v1/platforms/status - Get health status for all platforms
 * - GET /api/v1/platforms/rate-limits - Get rate limit status for connected accounts
 */

import { Request, Response } from 'express';
import { PlatformHealthService } from '../services/PlatformHealthService';
import { PlatformRateLimitService } from '../services/PlatformRateLimitService';
import { SocialAccount } from '../models/SocialAccount';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';

export class PlatformController {
  private healthService: PlatformHealthService;
  private rateLimitService: PlatformRateLimitService;

  constructor() {
    this.healthService = new PlatformHealthService();
    this.rateLimitService = new PlatformRateLimitService();
  }

  /**
   * Get platform status for all platforms
   * GET /api/v1/platforms/status
   * 
   * Returns health status, failure rate, and publishing pause status
   * for all 5 supported platforms (Facebook, Instagram, Twitter, LinkedIn, TikTok)
   */
  async getPlatformStatus(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Fetching platform status');

      const statuses = await this.healthService.getAllPlatformStatuses();

      logger.info('Platform status retrieved', {
        platforms: Object.keys(statuses),
        degradedCount: Object.values(statuses).filter(s => s.status === 'degraded').length,
      });

      res.status(200).json({
        success: true,
        data: statuses,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to fetch platform status', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform status',
        message: error.message,
      });
    }
  }

  /**
   * Get rate limit status for connected accounts
   * GET /api/v1/platforms/rate-limits
   * 
   * Returns rate limit information for all accounts connected to the
   * current user's workspace, including whether they're rate limited,
   * reset time, and quota usage.
   * 
   * Requires authentication - uses req.user.workspaceId
   */
  async getRateLimits(req: Request, res: Response): Promise<void> {
    try {
      // Verify user is authenticated
      if (!req.user || !req.user.workspaceId) {
        throw new UnauthorizedError('Authentication required');
      }

      const workspaceId = req.user.workspaceId;

      logger.debug('Fetching rate limits for workspace', { workspaceId });

      // Query all connected accounts for this workspace
      const accounts = await SocialAccount.find({
        workspaceId,
        status: { $in: ['ACTIVE', 'RATE_LIMITED'] },
      }).select('_id provider platformAccountId accountName');

      logger.debug('Found connected accounts', {
        workspaceId,
        accountCount: accounts.length,
      });

      // Check rate limit status for each account
      const rateLimits = await Promise.all(
        accounts.map(async (account) => {
          const isRateLimited = await this.rateLimitService.isRateLimited(
            account.provider,
            account._id.toString()
          );

          let rateLimitInfo = null;
          if (isRateLimited) {
            rateLimitInfo = await this.rateLimitService.getRateLimitInfo(
              account.provider,
              account._id.toString()
            );
          }

          return {
            accountId: account._id.toString(),
            platform: account.provider,
            accountName: account.accountName,
            rateLimited: isRateLimited,
            resetAt: rateLimitInfo?.resetAt || null,
            quotaUsed: rateLimitInfo?.quotaUsed || null,
            quotaLimit: rateLimitInfo?.quotaLimit || null,
          };
        })
      );

      logger.info('Rate limits retrieved', {
        workspaceId,
        accountCount: accounts.length,
        rateLimitedCount: rateLimits.filter(r => r.rateLimited).length,
      });

      res.status(200).json({
        success: true,
        data: rateLimits,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to fetch rate limits', {
        error: error.message,
        stack: error.stack,
        workspaceId: req.user?.workspaceId,
      });

      // Handle authentication errors
      if (error instanceof UnauthorizedError) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to fetch rate limits',
        message: error.message,
      });
    }
  }
}
