/**
 * Plan Limit Middleware
 * Enforces subscription plan limits
 */

import { Request, Response, NextFunction } from 'express';
import { planEnforcementService } from '../services/PlanEnforcementService';
import { logger } from '../utils/logger';

export interface PlanLimitRequest extends Request {
  workspaceId?: string;
}

/**
 * Check if workspace can perform action based on plan limits
 */
export const checkPlanLimit = (action: 'createPost' | 'connectSocialAccount' | 'inviteMember' | 'useAI') => {
  return async (req: PlanLimitRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = req.workspaceId || req.headers['x-workspace-id'] as string;

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
        return;
      }

      let result;
      switch (action) {
        case 'createPost':
          result = await planEnforcementService.canCreatePost(workspaceId);
          break;
        case 'connectSocialAccount':
          result = await planEnforcementService.canConnectAccount(workspaceId);
          break;
        case 'useAI':
          result = await planEnforcementService.canUseAI(workspaceId);
          break;
        case 'inviteMember':
          // For now, allow member invites (no specific limit check)
          result = { allowed: true };
          break;
        default:
          result = { allowed: true };
      }

      if (!result.allowed) {
        logger.warn('Plan limit exceeded', {
          workspaceId,
          action,
          reason: result.reason,
          limit: result.limit,
          current: result.current,
        });

        res.status(402).json({
          success: false,
          message: result.reason || 'Plan limit exceeded',
          error: {
            code: 'PLAN_LIMIT_EXCEEDED',
            action,
            limit: result.limit,
            current: result.current,
            upgradeRequired: true,
          },
        });
        return;
      }

      // Action is allowed, proceed
      next();
    } catch (error) {
      logger.error('Error checking plan limit', { action, error });
      res.status(500).json({
        success: false,
        message: 'Error checking plan limits',
      });
      return;
    }
  };
};

/**
 * Middleware to check post creation limit
 */
export const checkPostLimit = checkPlanLimit('createPost');

/**
 * Middleware to check social account connection limit
 */
export const checkSocialAccountLimit = checkPlanLimit('connectSocialAccount');

/**
 * Middleware to check team member invitation limit
 */
export const checkMemberLimit = checkPlanLimit('inviteMember');

/**
 * Middleware to check AI usage limit
 */
export const checkAILimit = checkPlanLimit('useAI');
