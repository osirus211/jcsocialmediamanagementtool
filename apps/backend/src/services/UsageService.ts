/**
 * Usage Service
 * 
 * Tracks and manages workspace resource usage
 */

import mongoose from 'mongoose';
import { Usage, IUsage } from '../models/Usage';
import { Plan, IPlan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { logger } from '../utils/logger';

export class UsageService {
  /**
   * Get or create current month usage
   */
  async getCurrentUsage(workspaceId: mongoose.Types.ObjectId): Promise<IUsage> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let usage = await Usage.findOne({ workspaceId, year, month });

    if (!usage) {
      // Create new usage record for current month
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

      usage = new Usage({
        workspaceId,
        year,
        month,
        periodStart,
        periodEnd,
      });
      await usage.save();
      logger.info(`Created usage record for workspace ${workspaceId}: ${year}-${month}`);
    }

    return usage;
  }

  /**
   * Increment post scheduled counter
   */
  async incrementPostsScheduled(workspaceId: mongoose.Types.ObjectId): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.postsScheduled += 1;
    await usage.save();
  }

  /**
   * Increment post published counter
   */
  async incrementPostsPublished(workspaceId: mongoose.Types.ObjectId): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.postsPublished += 1;
    await usage.save();
  }

  /**
   * Increment media uploads counter
   */
  async incrementMediaUploads(workspaceId: mongoose.Types.ObjectId, sizeInMB: number): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.mediaUploads += 1;
    usage.mediaStorageUsed += sizeInMB;
    await usage.save();
  }

  /**
   * Decrement media storage (when media is deleted)
   */
  async decrementMediaStorage(workspaceId: mongoose.Types.ObjectId, sizeInMB: number): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.mediaStorageUsed = Math.max(0, usage.mediaStorageUsed - sizeInMB);
    await usage.save();
  }

  /**
   * Increment analytics requests counter
   */
  async incrementAnalyticsRequests(workspaceId: mongoose.Types.ObjectId): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.analyticsRequests += 1;
    await usage.save();
  }

  /**
   * Update team members count
   */
  async updateTeamMembers(workspaceId: mongoose.Types.ObjectId, count: number): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.teamMembers = count;
    await usage.save();
  }

  /**
   * Update channels connected count
   */
  async updateChannelsConnected(workspaceId: mongoose.Types.ObjectId, count: number): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.channelsConnected = count;
    await usage.save();
  }

  /**
   * Increment API requests counter
   */
  async incrementApiRequests(workspaceId: mongoose.Types.ObjectId): Promise<void> {
    const usage = await this.getCurrentUsage(workspaceId);
    usage.apiRequests += 1;
    await usage.save();
  }

  /**
   * Check if workspace has exceeded limits
   */
  async checkLimits(workspaceId: mongoose.Types.ObjectId): Promise<{
    withinLimits: boolean;
    limits: {
      postsPerMonth: { current: number; limit: number; exceeded: boolean };
      channels: { current: number; limit: number; exceeded: boolean };
      teamMembers: { current: number; limit: number; exceeded: boolean };
      mediaStorage: { current: number; limit: number; exceeded: boolean };
    };
  }> {
    const usage = await this.getCurrentUsage(workspaceId);
    const plan = await this.getWorkspacePlan(workspaceId);

    if (!plan) {
      throw new Error('No plan found for workspace');
    }

    const limits = {
      postsPerMonth: {
        current: usage.postsScheduled,
        limit: plan.maxPostsPerMonth,
        exceeded: usage.postsScheduled >= plan.maxPostsPerMonth,
      },
      channels: {
        current: usage.channelsConnected,
        limit: plan.maxChannels,
        exceeded: usage.channelsConnected >= plan.maxChannels,
      },
      teamMembers: {
        current: usage.teamMembers,
        limit: plan.maxTeamMembers,
        exceeded: usage.teamMembers >= plan.maxTeamMembers,
      },
      mediaStorage: {
        current: usage.mediaStorageUsed,
        limit: plan.maxMediaStorage,
        exceeded: usage.mediaStorageUsed >= plan.maxMediaStorage,
      },
    };

    const withinLimits = !Object.values(limits).some((limit) => limit.exceeded);

    return { withinLimits, limits };
  }

  /**
   * Check specific limit
   */
  async checkLimit(
    workspaceId: mongoose.Types.ObjectId,
    limitType: 'postsPerMonth' | 'channels' | 'teamMembers' | 'mediaStorage'
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const usage = await this.getCurrentUsage(workspaceId);
    const plan = await this.getWorkspacePlan(workspaceId);

    if (!plan) {
      throw new Error('No plan found for workspace');
    }

    let current: number;
    let limit: number;

    switch (limitType) {
      case 'postsPerMonth':
        current = usage.postsScheduled;
        limit = plan.maxPostsPerMonth;
        break;
      case 'channels':
        current = usage.channelsConnected;
        limit = plan.maxChannels;
        break;
      case 'teamMembers':
        current = usage.teamMembers;
        limit = plan.maxTeamMembers;
        break;
      case 'mediaStorage':
        current = usage.mediaStorageUsed;
        limit = plan.maxMediaStorage;
        break;
    }

    return {
      allowed: current < limit,
      current,
      limit,
    };
  }

  /**
   * Get workspace plan
   */
  private async getWorkspacePlan(workspaceId: mongoose.Types.ObjectId): Promise<IPlan | null> {
    const subscription = await Subscription.findOne({ workspaceId }).populate('planId');
    if (!subscription) {
      // Return free plan if no subscription
      return Plan.findOne({ name: 'free' });
    }
    return subscription.planId as any;
  }

  /**
   * Get usage history
   */
  async getUsageHistory(
    workspaceId: mongoose.Types.ObjectId,
    months: number = 6
  ): Promise<IUsage[]> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    return Usage.find({
      workspaceId,
      periodStart: { $gte: startDate },
    }).sort({ year: -1, month: -1 });
  }

  /**
   * Reset monthly counters (called by cron job)
   */
  async resetMonthlyCounters(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    logger.info(`Resetting monthly counters for ${year}-${month}`);

    // This will create new usage records for the new month
    // Old records are preserved for history
    // No action needed - new records are created on first access
  }

  /**
   * Get usage summary
   */
  async getUsageSummary(workspaceId: mongoose.Types.ObjectId): Promise<{
    current: IUsage;
    plan: IPlan;
    limits: any;
    percentages: {
      posts: number;
      channels: number;
      teamMembers: number;
      mediaStorage: number;
    };
  }> {
    const usage = await this.getCurrentUsage(workspaceId);
    const plan = await this.getWorkspacePlan(workspaceId);

    if (!plan) {
      throw new Error('No plan found for workspace');
    }

    const { limits } = await this.checkLimits(workspaceId);

    const percentages = {
      posts: (usage.postsScheduled / plan.maxPostsPerMonth) * 100,
      channels: (usage.channelsConnected / plan.maxChannels) * 100,
      teamMembers: (usage.teamMembers / plan.maxTeamMembers) * 100,
      mediaStorage: (usage.mediaStorageUsed / plan.maxMediaStorage) * 100,
    };

    return {
      current: usage,
      plan,
      limits,
      percentages,
    };
  }
}

export const usageService = new UsageService();
