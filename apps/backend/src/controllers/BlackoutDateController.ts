import { Request, Response } from 'express';
import { blackoutDateService } from '../services/BlackoutDateService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

export class BlackoutDateController {
  /**
   * Create a new blackout date
   */
  async createBlackoutDate(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { workspaceId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const blackoutDate = await blackoutDateService.createBlackoutDate({
        workspaceId,
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: blackoutDate,
      });
    } catch (error: any) {
      logger.error('Failed to create blackout date', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to create blackout date',
        error: error.message,
      });
    }
  }

  /**
   * Get all blackout dates for a workspace
   */
  async getBlackoutDates(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const {
        isActive,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
      } = req.query;

      const options: any = {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
      };

      if (isActive !== undefined) {
        options.isActive = isActive === 'true';
      }

      if (startDate) {
        options.startDate = new Date(startDate as string);
      }

      if (endDate) {
        options.endDate = new Date(endDate as string);
      }

      const blackoutDates = await blackoutDateService.getBlackoutDates(
        workspaceId,
        options
      );

      res.json({
        success: true,
        data: blackoutDates,
      });
    } catch (error: any) {
      logger.error('Failed to get blackout dates', {
        error: error.message,
        workspaceId: req.params.workspaceId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get blackout dates',
        error: error.message,
      });
    }
  }

  /**
   * Get a single blackout date by ID
   */
  async getBlackoutDateById(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, id } = req.params;

      const blackoutDate = await blackoutDateService.getBlackoutDateById(
        id,
        workspaceId
      );

      if (!blackoutDate) {
        res.status(404).json({
          success: false,
          message: 'Blackout date not found',
        });
        return;
      }

      res.json({
        success: true,
        data: blackoutDate,
      });
    } catch (error: any) {
      logger.error('Failed to get blackout date by ID', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        id: req.params.id,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get blackout date',
        error: error.message,
      });
    }
  }

  /**
   * Update a blackout date
   */
  async updateBlackoutDate(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { workspaceId, id } = req.params;

      const blackoutDate = await blackoutDateService.updateBlackoutDate(
        id,
        workspaceId,
        req.body
      );

      if (!blackoutDate) {
        res.status(404).json({
          success: false,
          message: 'Blackout date not found',
        });
        return;
      }

      res.json({
        success: true,
        data: blackoutDate,
      });
    } catch (error: any) {
      logger.error('Failed to update blackout date', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        id: req.params.id,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update blackout date',
        error: error.message,
      });
    }
  }

  /**
   * Delete a blackout date
   */
  async deleteBlackoutDate(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, id } = req.params;

      const deleted = await blackoutDateService.deleteBlackoutDate(
        id,
        workspaceId
      );

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Blackout date not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Blackout date deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete blackout date', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        id: req.params.id,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to delete blackout date',
        error: error.message,
      });
    }
  }

  /**
   * Check if a date is blacked out
   */
  async checkBlackoutDate(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { date } = req.query;

      if (!date) {
        res.status(400).json({
          success: false,
          message: 'Date parameter is required',
        });
        return;
      }

      const checkDate = new Date(date as string);
      const result = await blackoutDateService.isDateBlackedOut(
        workspaceId,
        checkDate
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to check blackout date', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        date: req.query.date,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to check blackout date',
        error: error.message,
      });
    }
  }

  /**
   * Find posts that conflict with blackout dates
   */
  async findConflictingPosts(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      const conflicts = await blackoutDateService.findConflictingPosts(
        workspaceId
      );

      res.json({
        success: true,
        data: conflicts,
      });
    } catch (error: any) {
      logger.error('Failed to find conflicting posts', {
        error: error.message,
        workspaceId: req.params.workspaceId,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to find conflicting posts',
        error: error.message,
      });
    }
  }

  /**
   * Get blackout dates for calendar display
   */
  async getBlackoutDatesInRange(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate parameters are required',
        });
        return;
      }

      const blackoutDates = await blackoutDateService.getBlackoutDatesInRange(
        workspaceId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: blackoutDates,
      });
    } catch (error: any) {
      logger.error('Failed to get blackout dates in range', {
        error: error.message,
        workspaceId: req.params.workspaceId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get blackout dates in range',
        error: error.message,
      });
    }
  }
}

export const blackoutDateController = new BlackoutDateController();