/**
 * QueueSlot Controller
 * 
 * Handles queue slot operations
 */

import { Request, Response, NextFunction } from 'express';
import { queueSlotService } from '../services/QueueSlotService';
import { UnauthorizedError } from '../utils/errors';

export class QueueSlotController {
  /**
   * Get queue slots
   * GET /queue-slots
   */
  async getSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { platform } = req.query;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const slots = await queueSlotService.getSlots(
        workspaceId,
        platform as string | undefined
      );

      res.status(200).json({
        success: true,
        data: slots.map((s) => s.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create queue slot
   * POST /queue-slots
   */
  async createSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { platform, dayOfWeek, time, timezone } = req.body;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const slot = await queueSlotService.createSlot({
        workspaceId,
        platform,
        dayOfWeek,
        time,
        timezone,
      });

      res.status(201).json({
        success: true,
        data: slot.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update queue slot
   * PUT /queue-slots/:id
   */
  async updateSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();
      const { time, timezone, isActive } = req.body;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const slot = await queueSlotService.updateSlot(id, workspaceId, {
        time,
        timezone,
        isActive,
      });

      res.status(200).json({
        success: true,
        data: slot.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete queue slot
   * DELETE /queue-slots/:id
   */
  async deleteSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace?.workspaceId.toString();

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      await queueSlotService.deleteSlot(id, workspaceId);

      res.status(200).json({
        success: true,
        message: 'Queue slot deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add post to queue
   * POST /queue-slots/add-to-queue
   */
  async addToQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const { postId, platform } = req.body;

      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const result = await queueSlotService.addToQueue(workspaceId, postId, platform);

      res.status(200).json({
        success: true,
        data: {
          scheduledAt: result.scheduledAt,
          slotId: result.slotId,
        },
        message: `Post scheduled to ${result.scheduledAt.toLocaleString()}`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const queueSlotController = new QueueSlotController();
