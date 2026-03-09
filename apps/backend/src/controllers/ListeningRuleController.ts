/**
 * Listening Rule Controller
 * 
 * Handles listening rule management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { ListeningRule, ListeningRuleType } from '../models/ListeningRule';
import { SocialListeningQueue } from '../queue/SocialListeningQueue';
import { logger } from '../utils/logger';

export class ListeningRuleController {
  /**
   * Create listening rule
   * POST /api/v1/listening-rules
   */
  static async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;
      const userId = req.user?.userId;

      if (!workspaceId || !userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { platform, type, value } = req.body;

      if (!platform || !type || !value) {
        res.status(400).json({
          success: false,
          error: 'platform, type, and value are required',
        });
        return;
      }

      // Validate type
      if (!Object.values(ListeningRuleType).includes(type)) {
        res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.values(ListeningRuleType).join(', ')}`,
        });
        return;
      }

      // Create rule
      const rule = new ListeningRule({
        workspaceId,
        platform,
        type,
        value,
        createdBy: userId,
        active: true,
      });

      await rule.save();

      // Schedule collection jobs for this platform if not already scheduled
      try {
        await SocialListeningQueue.scheduleKeywordCollection(workspaceId.toString(), platform);
        await SocialListeningQueue.scheduleHashtagCollection(workspaceId.toString(), platform);
        await SocialListeningQueue.scheduleCompetitorCollection(workspaceId.toString(), platform);
        await SocialListeningQueue.scheduleTrendCalculation(workspaceId.toString());
      } catch (scheduleError: any) {
        // Jobs may already be scheduled - that's okay
        logger.debug('Schedule jobs warning', {
          error: scheduleError.message,
        });
      }

      res.status(201).json({
        success: true,
        data: rule,
      });
    } catch (error: any) {
      // Handle duplicate rule
      if (error.code === 11000) {
        res.status(409).json({
          success: false,
          error: 'Listening rule already exists for this workspace',
        });
        return;
      }

      logger.error('Create listening rule error:', error);
      next(error);
    }
  }

  /**
   * Get listening rules
   * GET /api/v1/listening-rules
   */
  static async getRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { platform, type, active } = req.query;

      const query: any = { workspaceId };

      if (platform) {
        query.platform = platform;
      }

      if (type) {
        query.type = type;
      }

      if (active !== undefined) {
        query.active = active === 'true';
      }

      const rules = await ListeningRule.find(query)
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: rules,
      });
    } catch (error: any) {
      logger.error('Get listening rules error:', error);
      next(error);
    }
  }

  /**
   * Delete listening rule
   * DELETE /api/v1/listening-rules/:id
   */
  static async deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { id } = req.params;

      const result = await ListeningRule.findOneAndDelete({
        _id: id,
        workspaceId,
      });

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Listening rule not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Listening rule deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete listening rule error:', error);
      next(error);
    }
  }

  /**
   * Update listening rule (activate/deactivate)
   * PATCH /api/v1/listening-rules/:id
   */
  static async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId;

      if (!workspaceId) {
        res.status(401).json({ error: 'Workspace context required' });
        return;
      }

      const { id } = req.params;
      const { active } = req.body;

      if (active === undefined) {
        res.status(400).json({
          success: false,
          error: 'active field is required',
        });
        return;
      }

      const rule = await ListeningRule.findOneAndUpdate(
        { _id: id, workspaceId },
        { active },
        { new: true }
      );

      if (!rule) {
        res.status(404).json({
          success: false,
          error: 'Listening rule not found',
        });
        return;
      }

      res.json({
        success: true,
        data: rule,
      });
    } catch (error: any) {
      logger.error('Update listening rule error:', error);
      next(error);
    }
  }
}
