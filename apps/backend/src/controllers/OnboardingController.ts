import { Request, Response } from 'express';
import { OnboardingService } from '../services/OnboardingService';
import { BadRequestError } from '../utils/errors';

export class OnboardingController {
  /**
   * Get current user's onboarding progress
   */
  static async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      const progress = await OnboardingService.getProgress(userId);
      
      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update current user's onboarding step
   */
  static async updateStep(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { step } = req.body;
      
      if (typeof step !== 'number') {
        throw new BadRequestError('Step must be a number');
      }
      
      const progress = await OnboardingService.updateStep(userId, step);
      
      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark onboarding as completed
   */
  static async completeOnboarding(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      const progress = await OnboardingService.completeOnboarding(userId);
      
      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Skip onboarding entirely
   */
  static async skipOnboarding(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      const progress = await OnboardingService.skipOnboarding(userId);
      
      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if current user needs onboarding
   */
  static async needsOnboarding(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      const needsOnboarding = await OnboardingService.needsOnboarding(userId);
      
      res.json({
        success: true,
        data: { needsOnboarding },
      });
    } catch (error) {
      throw error;
    }
  }
}