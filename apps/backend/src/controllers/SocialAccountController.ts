import { Request, Response, NextFunction } from 'express';
import { socialAccountService } from '../services/SocialAccountService';
import { SocialAccount, SocialPlatform } from '../models/SocialAccount';
import { BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { sendSuccess, sendError } from '../utils/apiResponse';
import mongoose from 'mongoose';

/**
 * Social Account Controller
 * 
 * Handles social media account connection and management
 * 
 * All endpoints are tenant-safe (require workspace context)
 */

export class SocialAccountController {
  /**
   * Connect a social account (OAuth placeholder)
   * POST /api/social/connect/:platform
   */
  async connectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform } = req.params;
      const { accountName, accountId, accessToken, refreshToken, tokenExpiresAt, scopes, metadata } = req.body;
      const workspaceId = req.workspace?.workspaceId.toString();

      // Validate platform
      if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
        throw new BadRequestError('Invalid platform');
      }

      // TODO: In production, this would handle OAuth callback
      // For now, accept tokens directly (for testing/development)

      const account = await socialAccountService.connectAccount({
        workspaceId,
        platform: platform as SocialPlatform,
        accountName,
        accountId,
        accessToken,
        refreshToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
        scopes: scopes || [],
        metadata: metadata || {},
      });

      res.status(201).json({
        success: true,
        message: 'Social account connected successfully',
        account: account.toSafeObject(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all connected accounts for workspace
   * GET /api/social/accounts
   */
  async getAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();

      const accounts = await socialAccountService.getAccountsByWorkspace(workspaceId);

      // Transform accounts to UI-safe format with capabilities
      const transformedAccounts = accounts.map(account => {
        const safeObj = account.toSafeObject();
        return {
          _id: safeObj._id, // MongoDB ID (for compatibility)
          id: safeObj._id, // Alias for _id
          platform: safeObj.provider,
          accountName: safeObj.accountName,
          status: safeObj.status,
          capabilities: safeObj.metadata?.capabilities || {
            publish: false,
            analytics: false,
            messaging: false,
          },
          username: safeObj.metadata?.username || safeObj.accountName,
          displayName: safeObj.accountName,
          platformUserId: safeObj.providerUserId,
          profileImageUrl: safeObj.metadata?.avatarUrl,
          followerCount: safeObj.metadata?.followerCount,
          isActive: safeObj.status === 'active',
          connectedAt: safeObj.createdAt,
          lastSyncAt: safeObj.lastSyncAt,
          tokenExpiresAt: safeObj.tokenExpiresAt,
        };
      });

      res.json({
        success: true,
        accounts: transformedAccounts,
        count: transformedAccounts.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single account details
   * GET /api/social/accounts/:id
   */
  async getAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      const account = await socialAccountService.getAccountById(id, workspaceId);

      res.json({
        success: true,
        account: account.toSafeObject(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect account
   * DELETE /api/social/accounts/:id
   */
  async disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId?.toString();
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      await socialAccountService.disconnectAccount(id, workspaceId, userId, ipAddress);

      res.json({
        success: true,
        message: 'Social account disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh account token
   * POST /api/social/accounts/:id/refresh
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      const account = await socialAccountService.refreshAccountToken(id, workspaceId);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        account: account.toSafeObject(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync account info from platform
   * POST /api/social/accounts/:id/sync
   */
  async syncAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      logger.info('[SocialAccount] Sync request received', {
        accountId: id,
        workspaceId,
      });

      const account = await socialAccountService.syncAccountInfo(id, workspaceId);

      res.json({
        success: true,
        message: 'Account synced successfully',
        account: account.toSafeObject(),
      });
    } catch (error: any) {
      // Check if it's a token expiration error
      if (error.message?.includes('Token expired') || error.message?.includes('Invalid access token')) {
        logger.warn('[SocialAccount] Sync failed - token expired', {
          accountId: req.params.id,
          workspaceId: req.workspace?.workspaceId.toString(),
          error: error.message,
        });
        
        res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Your account connection has expired. Please reconnect your account.',
          requiresReconnect: true,
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Get accounts by platform
   * GET /api/social/accounts/platform/:platform
   */
  async getAccountsByPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { platform } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      // Validate platform
      if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
        throw new BadRequestError('Invalid platform');
      }

      const accounts = await socialAccountService.getAccountsByPlatform(
        workspaceId,
        platform as SocialPlatform
      );

      res.json({
        success: true,
        accounts,
        count: accounts.length,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * GET /api/v1/accounts/health
   * Get connection health for all accounts
   */
  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.query;

      if (!workspaceId) {
        sendError(res, 'VALIDATION_ERROR', 'Workspace ID is required', 400);
        return;
      }

      // Get all accounts for workspace
      const accounts = await SocialAccount.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      }).select('platform accountName status metadata lastSyncAt tokenExpiresAt createdAt');

      // Map to health data
      const healthData = accounts.map((account) => ({
        id: account._id.toString(),
        platform: account.provider,
        accountName: account.accountName,
        username: account.metadata?.username || account.accountName,
        healthScore: account.metadata?.healthScore || 0,
        healthGrade: account.metadata?.healthGrade || 'unknown',
        lastInteraction: account.lastSyncAt || account.createdAt,
        tokenExpiry: account.tokenExpiresAt,
        isConnected: account.status === 'active',
        status: account.status,
      }));

      sendSuccess(res, { accounts: healthData }, 200);

      logger.debug('Account health retrieved', {
        workspaceId,
        accountCount: accounts.length,
      });
    } catch (error: any) {
      logger.error('Failed to get account health', {
        error: error.message,
        query: req.query,
      });

      next(error);
    }
  }
}

export const socialAccountController = new SocialAccountController();
