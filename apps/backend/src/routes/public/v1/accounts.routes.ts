/**
 * Public API - Accounts Routes
 * 
 * External endpoints for viewing connected social accounts via API keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireScope } from '../../../middleware/apiKeyScope';
import { SocialAccount } from '../../../models/SocialAccount';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/public/v1/accounts
 * List connected social accounts for the workspace
 * 
 * Query params:
 * - platform: filter by platform (twitter, facebook, instagram, linkedin, tiktok)
 * 
 * Requires: accounts:read scope
 */
router.get('/',
  requireScope('accounts:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.apiKey!.workspaceId;
      const platform = req.query.platform as string;
      
      // Build query
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };
      
      if (platform) {
        query.platform = platform;
      }
      
      // Fetch accounts
      const accounts = await SocialAccount.find(query)
        .sort({ createdAt: -1 })
        .select('-accessToken -refreshToken -accessTokenSecret -__v'); // Exclude sensitive tokens
      
      res.json({
        accounts: accounts.map(account => ({
          id: account._id,
          platform: (account as any).platform,
          username: (account as any).username,
          profileUrl: (account as any).profileUrl,
          profilePicture: (account as any).profilePicture,
          isActive: (account as any).isActive,
          lastSyncedAt: (account as any).lastSyncAt || (account as any).lastSyncedAt,
          createdAt: account.createdAt,
        })),
        total: accounts.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
