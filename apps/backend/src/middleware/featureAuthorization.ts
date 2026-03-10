/**
 * Feature Authorization Middleware
 * 
 * Enforces feature limitations based on Instagram connection type.
 * 
 * Usage:
 *   router.post('/publish', requireFeature(Feature.PUBLISH), controller.publish);
 * 
 * Security:
 * - Returns 403 Forbidden for restricted features
 * - Provides clear error messages with upgrade guidance
 * - Logs authorization attempts for analytics
 */

import { Request, Response, NextFunction } from 'express';
import { SocialAccount } from '../models/SocialAccount';
import { Post } from '../models/Post';
import { featureAuthorizationService, Feature, FeatureLimitationError } from '../services/FeatureAuthorizationService';
import { AccountPermissionService } from '../services/AccountPermissionService';
import { logger } from '../utils/logger';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

/**
 * Middleware factory: Require specific feature for Instagram accounts
 * 
 * For publishing operations, fetches the post and checks all associated accounts.
 * For analytics operations, checks the account specified in params.
 * 
 * @param feature - The feature to check (e.g., Feature.PUBLISH, Feature.INSIGHTS)
 * @returns Express middleware function
 */
export function requireFeature(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let accountsToCheck: any[] = [];

      // For publishing operations: fetch post and check all socialAccountIds
      if (feature === Feature.PUBLISH && req.params.id) {
        const postId = req.params.id;
        const workspaceId = req.workspace?.workspaceId.toString();

        // Fetch post with socialAccountIds
        const post = await Post.findOne({
          _id: postId,
          workspaceId,
        });

        if (!post) {
          throw new BadRequestError('Post not found');
        }

        // Fetch all social accounts for this post
        accountsToCheck = await SocialAccount.find({
          _id: { $in: post.socialAccountIds },
        });
      }
      // For analytics/insights operations: check account from params
      else if (req.params.accountId) {
        const account = await SocialAccount.findById(req.params.accountId);
        
        if (!account) {
          throw new BadRequestError('Social account not found');
        }

        accountsToCheck = [account];
      }
      // For operations with accountId in body
      else if (req.body.accountId) {
        const account = await SocialAccount.findById(req.body.accountId);
        
        if (!account) {
          throw new BadRequestError('Social account not found');
        }

        accountsToCheck = [account];
      }

      // If no accounts to check, skip (not an account-specific operation)
      if (accountsToCheck.length === 0) {
        return next();
      }

      // Check feature authorization for each Instagram account
      for (const account of accountsToCheck) {
        // Only enforce for Instagram accounts
        if (account.provider === 'instagram') {
          featureAuthorizationService.assertFeatureAllowed(account, feature);
        }
      }

      // All features allowed - proceed
      logger.debug('[FeatureAuth] Feature authorized', {
        accountCount: accountsToCheck.length,
        feature,
      });

      next();
    } catch (error) {
      if (error instanceof FeatureLimitationError) {
        // Return 403 with detailed error message
        logger.warn('[FeatureAuth] Feature denied', {
          feature,
          error: error.message,
        });

        res.status(403).json({
          success: false,
          error: 'FEATURE_NOT_ALLOWED',
          message: error.message,
          feature: error.feature,
          providerType: error.providerType,
        });
        return;
      }

      // Other errors - pass to error handler
      next(error);
    }
  };
}


/**
 * Middleware: Check account permission for specific action
 * 
 * Expects:
 * - req.user.userId (from JWT)
 * - req.workspace.workspaceId (from workspace middleware)
 * - req.params.socialAccountId OR req.body.socialAccountId
 * 
 * @param action - The action to check ('post', 'analytics', 'manage')
 * @returns Express middleware function
 */
export function checkAccountPermission(action: 'post' | 'analytics' | 'manage') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const workspaceId = req.workspace?.workspaceId?.toString();

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!workspaceId) {
        throw new BadRequestError('Workspace context required');
      }

      // Extract socialAccountId from params or body
      const socialAccountId = req.params.socialAccountId || req.body.socialAccountId;

      if (!socialAccountId) {
        throw new BadRequestError('Social account ID required');
      }

      // Check permission
      const hasPermission = await AccountPermissionService.canUserAccessAccount(
        workspaceId,
        userId,
        socialAccountId,
        action
      );

      if (!hasPermission) {
        logger.warn('Account permission denied', {
          userId,
          workspaceId,
          socialAccountId,
          action,
        });

        res.status(403).json({
          success: false,
          error: 'ACCOUNT_ACCESS_DENIED',
          message: `You don't have permission to ${action} on this account`,
          details: {
            userId,
            workspaceId,
            socialAccountId,
            requiredAction: action,
          },
        });
        return;
      }

      logger.debug('Account permission granted', {
        userId,
        workspaceId,
        socialAccountId,
        action,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}