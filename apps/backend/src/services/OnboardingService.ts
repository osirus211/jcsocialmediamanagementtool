import { User, IUser } from '../models/User';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface OnboardingProgress {
  userId: string;
  currentStep: number;
  completed: boolean;
  completedSteps: number[];
}

export interface OnboardingStepData {
  role?: string;
  teamSize?: string;
  primaryGoal?: string;
  connectedAccounts?: string[];
  firstPostCreated?: boolean;
  teamMembersInvited?: string[];
}

/**
 * OnboardingService
 * 
 * Manages user onboarding flow and progress tracking
 */
export class OnboardingService {
  /**
   * Get user's onboarding progress
   */
  static async getProgress(userId: string): Promise<OnboardingProgress> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        userId,
        currentStep: user.onboardingStep,
        completed: user.onboardingCompleted,
        completedSteps: this.getCompletedSteps(user.onboardingStep),
      };
    } catch (error) {
      logger.error('Failed to get onboarding progress', { userId, error });
      throw error;
    }
  }

  /**
   * Update user's onboarding step
   */
  static async updateStep(userId: string, step: number): Promise<OnboardingProgress> {
    try {
      if (step < 0 || step > 5) {
        throw new BadRequestError('Invalid onboarding step. Must be between 0 and 5');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Only allow moving forward or staying at current step
      if (step < user.onboardingStep && !user.onboardingCompleted) {
        throw new BadRequestError('Cannot move backwards in onboarding');
      }

      user.onboardingStep = step;
      
      // Mark as completed if reached step 5
      if (step === 5) {
        user.onboardingCompleted = true;
      }

      await user.save();

      logger.info('Onboarding step updated', { userId, step, completed: user.onboardingCompleted });

      return {
        userId,
        currentStep: user.onboardingStep,
        completed: user.onboardingCompleted,
        completedSteps: this.getCompletedSteps(user.onboardingStep),
      };
    } catch (error) {
      logger.error('Failed to update onboarding step', { userId, step, error });
      throw error;
    }
  }

  /**
   * Mark onboarding as completed
   */
  static async completeOnboarding(userId: string): Promise<OnboardingProgress> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      user.onboardingCompleted = true;
      user.onboardingStep = 5;
      await user.save();

      logger.info('Onboarding completed', { userId });

      return {
        userId,
        currentStep: user.onboardingStep,
        completed: user.onboardingCompleted,
        completedSteps: this.getCompletedSteps(user.onboardingStep),
      };
    } catch (error) {
      logger.error('Failed to complete onboarding', { userId, error });
      throw error;
    }
  }

  /**
   * Skip onboarding entirely
   */
  static async skipOnboarding(userId: string): Promise<OnboardingProgress> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      user.onboardingCompleted = true;
      user.onboardingStep = 5;
      await user.save();

      logger.info('Onboarding skipped', { userId });

      return {
        userId,
        currentStep: user.onboardingStep,
        completed: user.onboardingCompleted,
        completedSteps: this.getCompletedSteps(user.onboardingStep),
      };
    } catch (error) {
      logger.error('Failed to skip onboarding', { userId, error });
      throw error;
    }
  }

  /**
   * Reset onboarding progress (admin only)
   */
  static async resetOnboarding(userId: string): Promise<OnboardingProgress> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      user.onboardingCompleted = false;
      user.onboardingStep = 0;
      await user.save();

      logger.info('Onboarding reset', { userId });

      return {
        userId,
        currentStep: user.onboardingStep,
        completed: user.onboardingCompleted,
        completedSteps: this.getCompletedSteps(user.onboardingStep),
      };
    } catch (error) {
      logger.error('Failed to reset onboarding', { userId, error });
      throw error;
    }
  }

  /**
   * Check if user needs onboarding
   */
  static async needsOnboarding(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      return !user.onboardingCompleted;
    } catch (error) {
      logger.error('Failed to check onboarding status', { userId, error });
      return false;
    }
  }

  /**
   * Get completed steps array based on current step
   */
  private static getCompletedSteps(currentStep: number): number[] {
    const steps = [];
    for (let i = 0; i < currentStep; i++) {
      steps.push(i);
    }
    return steps;
  }
}