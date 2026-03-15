/**
 * Queue Controller
 * 
 * Handles comprehensive queue management operations
 */

import { Request, Response, NextFunction } from 'express';
import { queueService } from '../services/QueueService';
import { UnauthorizedError } from '../utils/errors';

export class QueueController {
  /**
   * Get queue with all scheduled posts
   * GET /queue
   */
  async getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { platform, limit = 100, offset = 0 } = req.query;

      const result = await queueService.getQueue(
        workspaceId,
        platform as string | undefined,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder queue by moving post to new position
   * POST /queue/reorder
   */
  async reorderQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { postId, newPosition } = req.body;

      const updatedQueue = await queueService.reorderQueue(
        workspaceId,
        postId,
        newPosition
      );

      res.status(200).json({
        success: true,
        data: updatedQueue,
        message: `Post moved to position ${newPosition}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move post up one position
   * POST /queue/move-up
   */
  async movePostUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { postId } = req.body;

      const updatedQueue = await queueService.movePostUp(workspaceId, postId);

      res.status(200).json({
        success: true,
        data: updatedQueue,
        message: 'Post moved up',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move post down one position
   * POST /queue/move-down
   */
  async movePostDown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { postId } = req.body;

      const updatedQueue = await queueService.movePostDown(workspaceId, postId);

      res.status(200).json({
        success: true,
        data: updatedQueue,
        message: 'Post moved down',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move post to top of queue
   * POST /queue/move-to-top
   */
  async moveToTop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { postId } = req.body;

      const updatedQueue = await queueService.moveToTop(workspaceId, postId);

      res.status(200).json({
        success: true,
        data: updatedQueue,
        message: 'Post moved to top',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move post to bottom of queue
   * POST /queue/move-to-bottom
   */
  async moveToBottom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { postId } = req.body;

      const updatedQueue = await queueService.moveToBottom(workspaceId, postId);

      res.status(200).json({
        success: true,
        data: updatedQueue,
        message: 'Post moved to bottom',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove post from queue
   * POST /queue/remove
   */
  async removeFromQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { postId } = req.body;

      await queueService.removeFromQueue(workspaceId, postId);

      res.status(200).json({
        success: true,
        message: 'Post removed from queue',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Shuffle queue with smart distribution
   * POST /queue/shuffle
   */
  async shuffleQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { platform, preserveTimeSlots, distributionStrategy } = req.body;

      const updatedQueue = await queueService.shuffleQueue(workspaceId, {
        platform,
        preserveTimeSlots,
        distributionStrategy,
      });

      res.status(200).json({
        success: true,
        data: updatedQueue,
        message: 'Queue shuffled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk operations on queue
   * POST /queue/bulk
   */
  async bulkOperation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const { operation, postIds, options } = req.body;

      const result = await queueService.bulkOperation(
        workspaceId,
        operation,
        postIds,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
        message: `Bulk ${operation} completed: ${result.success} successful, ${result.failed.length} failed`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PAUSE QUEUE ENDPOINTS - Superior to Buffer & Hootsuite
   */

  /**
   * Pause entire workspace queue or specific account
   * POST /queue/pause
   */
  async pauseQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();
      
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Workspace and user context required');
      }

      const { accountId, resumeAt, reason } = req.body;

      const status = await queueService.pauseQueue(workspaceId, userId, {
        accountId,
        resumeAt: resumeAt ? new Date(resumeAt) : undefined,
        reason,
      });

      const message = accountId 
        ? 'Account queue paused successfully'
        : 'Workspace queue paused successfully';

      res.status(200).json({
        success: true,
        data: status,
        message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resume entire workspace queue or specific account
   * POST /queue/resume
   */
  async resumeQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();
      
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Workspace and user context required');
      }

      const { accountId } = req.body;

      const status = await queueService.resumeQueue(workspaceId, userId, accountId);

      const message = accountId 
        ? 'Account queue resumed successfully'
        : 'Workspace queue resumed successfully';

      res.status(200).json({
        success: true,
        data: status,
        message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pause queue until specific date/time
   * POST /queue/pause-until
   */
  async pauseUntil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      const userId = req.user?.userId.toString();
      
      if (!workspaceId || !userId) {
        throw new UnauthorizedError('Workspace and user context required');
      }

      const { resumeAt, accountId, reason } = req.body;

      if (!resumeAt) {
        res.status(400).json({
          success: false,
          message: 'resumeAt is required',
        });
        return;
      }

      const status = await queueService.pauseUntil(
        workspaceId,
        userId,
        new Date(resumeAt),
        { accountId, reason }
      );

      const message = accountId 
        ? `Account queue paused until ${new Date(resumeAt).toLocaleString()}`
        : `Workspace queue paused until ${new Date(resumeAt).toLocaleString()}`;

      res.status(200).json({
        success: true,
        data: status,
        message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current queue pause status
   * GET /queue/status
   */
  async getQueueStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace?.workspaceId.toString();
      if (!workspaceId) {
        throw new UnauthorizedError('Workspace context required');
      }

      const status = await queueService.getQueueStatus(workspaceId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const queueController = new QueueController();