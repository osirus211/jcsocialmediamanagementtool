import { Billing, BillingPlan, BillingStatus } from '../models/Billing';
import { SocialAccount } from '../models/SocialAccount';
import { Post } from '../models/Post';
import { usageService } from './UsageService';
import { PlanLimitError } from '../errors/PlanLimitError';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Plan Enforcement Service
 * 
 * Enforces SaaS limits based on subscription plan
 */

// Plan limits configuration
export const PLAN_LIMITS = {
  [BillingPlan.FREE]: {
    maxPosts: 10, // per month
    maxAccounts: 2,
    maxAIRequests: 5, // per month
    maxStorageMB: 100, // 100 MB
    features: {
      scheduling: true,
      analytics: false,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: false,
    },
  },
  [BillingPlan.PRO]: {
    maxPosts: 100, // per month
    maxAccounts: 10,
    maxAIRequests: 100, // per month
    maxStorageMB: 1000, // 1 GB
    features: {
      scheduling: true,
      analytics: true,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: false,
    },
  },
  [BillingPlan.TEAM]: {
    maxPosts: 500, // per month
    maxAccounts: 50,
    maxAIRequests: 500, // per month
    maxStorageMB: 5000, // 5 GB
    features: {
      scheduling: true,
      analytics: true,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: true,
    },
  },
  [BillingPlan.ENTERPRISE]: {
    maxPosts: -1, // unlimited
    maxAccounts: -1, // unlimited
    maxAIRequests: -1, // unlimited
    maxStorageMB: -1, // unlimited
    features: {
      scheduling: true,
      analytics: true,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: true,
    },
  },
};

class PlanEnforcementService {
  /**
   * Check if workspace can create a post (HARD LIMIT CHECK)
   * 
   * Implements 7-day grace period for past_due subscriptions
   * Uses Usage model for accurate metering
   * 
   * @throws PlanLimitError if limit exceeded
   */
  async canCreatePost(workspaceId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      return {
        allowed: false,
        reason: 'Billing not found',
      };
    }

    // Check subscription status with grace period
    if (billing.status === BillingStatus.PAST_DUE) {
      // Check if within 7-day grace period
      const paymentFailedAt = billing.metadata.paymentFailedAt as Date | undefined;
      
      if (paymentFailedAt) {
        const now = new Date();
        const daysSinceFailure = (now.getTime() - new Date(paymentFailedAt).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceFailure < 7) {
          // Within grace period - allow posting
          logger.debug('Post allowed within grace period', {
            workspaceId,
            daysSinceFailure: daysSinceFailure.toFixed(1),
          });
        } else {
          // Grace period expired - block posting
          return {
            allowed: false,
            reason: 'Payment failed - please update payment method to continue posting',
          };
        }
      } else {
        // No failure timestamp - block immediately (safety fallback)
        return {
          allowed: false,
          reason: 'Payment failed - please update payment method',
        };
      }
    } else if (!billing.canPost()) {
      // Other inactive statuses
      return {
        allowed: false,
        reason: 'Subscription inactive',
      };
    }

    // Get plan limits
    const limits = PLAN_LIMITS[billing.plan];

    // Get current usage from Usage model
    const usage = await usageService.getCurrentUsage(new mongoose.Types.ObjectId(workspaceId));

    // Check post limit (unlimited = -1)
    if (limits.maxPosts !== -1 && usage.postsScheduled >= limits.maxPosts) {
      throw new PlanLimitError(
        `Monthly post limit reached (${limits.maxPosts}). Upgrade to post more.`,
        'posts',
        usage.postsScheduled,
        limits.maxPosts
      );
    }

    return { allowed: true };
  }

  /**
   * Check if workspace can connect a social account (HARD LIMIT CHECK)
   * 
   * @throws PlanLimitError if limit exceeded
   */
  async canConnectAccount(workspaceId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      return {
        allowed: false,
        reason: 'Billing not found',
      };
    }

    // Check subscription status
    if (!billing.isActive()) {
      return {
        allowed: false,
        reason: 'Subscription inactive',
      };
    }

    // Get plan limits
    const limits = PLAN_LIMITS[billing.plan];

    // Count current accounts
    const accountCount = await SocialAccount.countDocuments({ workspaceId });

    // Check account limit (unlimited = -1)
    if (limits.maxAccounts !== -1 && accountCount >= limits.maxAccounts) {
      throw new PlanLimitError(
        `Account limit reached (${limits.maxAccounts}). Upgrade to connect more accounts.`,
        'accounts',
        accountCount,
        limits.maxAccounts
      );
    }

    return { allowed: true };
  }

  /**
   * Check if workspace can use AI features (HARD LIMIT CHECK)
   * 
   * @throws PlanLimitError if limit exceeded
   */
  async canUseAI(workspaceId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      return {
        allowed: false,
        reason: 'Billing not found',
      };
    }

    // Check subscription status
    if (!billing.isActive()) {
      return {
        allowed: false,
        reason: 'Subscription inactive',
      };
    }

    // Get plan limits
    const limits = PLAN_LIMITS[billing.plan];

    // Check if AI is available for plan
    if (!limits.features.aiAssistant) {
      return {
        allowed: false,
        reason: 'AI assistant not available on your plan',
      };
    }

    // Get current usage from Usage model
    const usage = await usageService.getCurrentUsage(new mongoose.Types.ObjectId(workspaceId));

    // Check AI usage limit (unlimited = -1)
    if (limits.maxAIRequests !== -1 && usage.aiRequests >= limits.maxAIRequests) {
      throw new PlanLimitError(
        `Monthly AI request limit reached (${limits.maxAIRequests}). Upgrade for more.`,
        'ai',
        usage.aiRequests,
        limits.maxAIRequests
      );
    }

    return { allowed: true };
  }

  /**
   * Check if workspace can upload media (HARD LIMIT CHECK)
   * 
   * @throws PlanLimitError if limit exceeded
   */
  async canUploadMedia(workspaceId: string, sizeMB: number): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      return {
        allowed: false,
        reason: 'Billing not found',
      };
    }

    // Check subscription status
    if (!billing.isActive()) {
      return {
        allowed: false,
        reason: 'Subscription inactive',
      };
    }

    // Get plan limits
    const limits = PLAN_LIMITS[billing.plan];

    // Get current usage from Usage model
    const usage = await usageService.getCurrentUsage(new mongoose.Types.ObjectId(workspaceId));

    // Check storage limit (unlimited = -1)
    if (limits.maxStorageMB !== -1) {
      const newTotal = usage.mediaStorageUsed + sizeMB;
      
      if (newTotal > limits.maxStorageMB) {
        throw new PlanLimitError(
          `Storage limit reached (${limits.maxStorageMB} MB). Upgrade for more storage.`,
          'storage',
          usage.mediaStorageUsed,
          limits.maxStorageMB
        );
      }
    }

    return { allowed: true };
  }

  /**
   * Increment post usage (delegates to UsageService)
   * 
   * ONLY call after successful post publish
   */
  async incrementPostUsage(workspaceId: string): Promise<void> {
    await usageService.incrementPostsScheduled(new mongoose.Types.ObjectId(workspaceId));
  }

  /**
   * Increment AI usage (delegates to UsageService)
   * 
   * ONLY call after successful AI request
   */
  async incrementAIUsage(workspaceId: string): Promise<void> {
    await usageService.incrementAI(workspaceId);
  }

  /**
   * Increment account usage (delegates to UsageService)
   * 
   * ONLY call after successful account connection
   */
  async incrementAccountUsage(workspaceId: string): Promise<void> {
    await usageService.incrementAccounts(workspaceId);
  }

  /**
   * Increment storage usage (delegates to UsageService)
   * 
   * ONLY call after successful media upload
   */
  async incrementStorageUsage(workspaceId: string, sizeMB: number): Promise<void> {
    await usageService.incrementMediaUploads(new mongoose.Types.ObjectId(workspaceId), sizeMB);
  }

  /**
   * Get plan limits for workspace
   */
  async getPlanLimits(workspaceId: string): Promise<typeof PLAN_LIMITS[BillingPlan]> {
    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      return PLAN_LIMITS[BillingPlan.FREE];
    }

    return PLAN_LIMITS[billing.plan];
  }

  /**
   * Get usage stats for workspace
   */
  async getUsageStats(workspaceId: string): Promise<{
    plan: BillingPlan;
    limits: typeof PLAN_LIMITS[BillingPlan];
    usage: {
      posts: number;
      accounts: number;
      ai: number;
      storage: number;
    };
    periodStart: Date;
    periodEnd: Date;
  }> {
    const billing = await Billing.findOne({ workspaceId });

    if (!billing) {
      return {
        plan: BillingPlan.FREE,
        limits: PLAN_LIMITS[BillingPlan.FREE],
        usage: {
          posts: 0,
          accounts: 0,
          ai: 0,
          storage: 0,
        },
        periodStart: new Date(),
        periodEnd: new Date(),
      };
    }

    const accountCount = await SocialAccount.countDocuments({ workspaceId });
    const usageData = await usageService.getCurrentUsage(new mongoose.Types.ObjectId(workspaceId));

    return {
      plan: billing.plan,
      limits: PLAN_LIMITS[billing.plan],
      usage: {
        posts: usageData.postsScheduled,
        accounts: accountCount,
        ai: usageData.aiRequests,
        storage: usageData.mediaStorageUsed,
      },
      periodStart: usageData.periodStart,
      periodEnd: usageData.periodEnd,
    };
  }

  /**
   * Reset usage for all workspaces (run monthly via cron)
   */
  async resetMonthlyUsage(): Promise<void> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await Billing.updateMany(
      {
        'usageSnapshot.resetAt': { $lt: oneMonthAgo },
      },
      {
        $set: {
          'usageSnapshot.postsUsed': 0,
          'usageSnapshot.aiUsed': 0,
          'usageSnapshot.resetAt': now,
        },
      }
    );

    logger.info('Monthly usage reset completed', {
      workspacesReset: result.modifiedCount,
    });
  }
}

export const planEnforcementService = new PlanEnforcementService();
