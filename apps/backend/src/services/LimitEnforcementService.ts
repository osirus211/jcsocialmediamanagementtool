/**
 * Limit Enforcement Service
 * 
 * Enforces plan limits before operations
 */

import mongoose from 'mongoose';
import { usageService } from './UsageService';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { logger } from '../utils/logger';
import { recordUsageLimitReached, updateUsagePercentage } from '../config/billingMetrics';

export class LimitEnforcementService {
  /**
   * Check if workspace can create a post
   */
  async canCreatePost(workspaceId: mongoose.Types.ObjectId): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
  }> {
    try {
      const { allowed, current, limit } = await usageService.checkLimit(
        workspaceId,
        'postsPerMonth'
      );

      if (!allowed) {
        const plan = await this.getWorkspacePlan(workspaceId);
        recordUsageLimitReached(workspaceId.toString(), 'posts', plan?.name || 'unknown');
        
        return {
          allowed: false,
          reason: `Monthly post limit reached (${limit} posts). Upgrade your plan to schedule more posts.`,
          current,
          limit,
        };
      }

      // Update usage percentage metric
      const percentage = (current / limit) * 100;
      const plan = await this.getWorkspacePlan(workspaceId);
      updateUsagePercentage(workspaceId.toString(), 'posts', plan?.name || 'unknown', percentage);

      return { allowed: true, current, limit };
    } catch (error: any) {
      logger.error('Failed to check post limit:', error);
      throw error;
    }
  }

  /**
   * Check if workspace can connect a channel
   */
  async canConnectChannel(workspaceId: mongoose.Types.ObjectId): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
  }> {
    try {
      const { allowed, current, limit } = await usageService.checkLimit(workspaceId, 'channels');

      if (!allowed) {
        const plan = await this.getWorkspacePlan(workspaceId);
        recordUsageLimitReached(workspaceId.toString(), 'channels', plan?.name || 'unknown');
        
        return {
          allowed: false,
          reason: `Channel limit reached (${limit} channels). Upgrade your plan to connect more channels.`,
          current,
          limit,
        };
      }

      // Update usage percentage metric
      const percentage = (current / limit) * 100;
      const plan = await this.getWorkspacePlan(workspaceId);
      updateUsagePercentage(workspaceId.toString(), 'channels', plan?.name || 'unknown', percentage);

      return { allowed: true, current, limit };
    } catch (error: any) {
      logger.error('Failed to check channel limit:', error);
      throw error;
    }
  }

  /**
   * Check if workspace can invite a team member
   */
  async canInviteMember(workspaceId: mongoose.Types.ObjectId): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
  }> {
    try {
      const { allowed, current, limit } = await usageService.checkLimit(
        workspaceId,
        'teamMembers'
      );

      if (!allowed) {
        const plan = await this.getWorkspacePlan(workspaceId);
        recordUsageLimitReached(workspaceId.toString(), 'team_members', plan?.name || 'unknown');
        
        return {
          allowed: false,
          reason: `Team member limit reached (${limit} members). Upgrade your plan to add more team members.`,
          current,
          limit,
        };
      }

      // Update usage percentage metric
      const percentage = (current / limit) * 100;
      const plan = await this.getWorkspacePlan(workspaceId);
      updateUsagePercentage(
        workspaceId.toString(),
        'team_members',
        plan?.name || 'unknown',
        percentage
      );

      return { allowed: true, current, limit };
    } catch (error: any) {
      logger.error('Failed to check team member limit:', error);
      throw error;
    }
  }

  /**
   * Check if workspace can upload media
   */
  async canUploadMedia(
    workspaceId: mongoose.Types.ObjectId,
    sizeInMB: number
  ): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
  }> {
    try {
      const { allowed, current, limit } = await usageService.checkLimit(
        workspaceId,
        'mediaStorage'
      );

      const newTotal = current + sizeInMB;

      if (newTotal > limit) {
        const plan = await this.getWorkspacePlan(workspaceId);
        recordUsageLimitReached(workspaceId.toString(), 'media_storage', plan?.name || 'unknown');
        
        return {
          allowed: false,
          reason: `Media storage limit reached (${limit} MB). Upgrade your plan for more storage.`,
          current,
          limit,
        };
      }

      // Update usage percentage metric
      const percentage = (newTotal / limit) * 100;
      const plan = await this.getWorkspacePlan(workspaceId);
      updateUsagePercentage(
        workspaceId.toString(),
        'media_storage',
        plan?.name || 'unknown',
        percentage
      );

      return { allowed: true, current, limit };
    } catch (error: any) {
      logger.error('Failed to check media storage limit:', error);
      throw error;
    }
  }

  /**
   * Check if workspace has access to a feature
   */
  async hasFeatureAccess(
    workspaceId: mongoose.Types.ObjectId,
    feature: string
  ): Promise<boolean> {
    try {
      const plan = await this.getWorkspacePlan(workspaceId);
      if (!plan) {
        return false;
      }

      return plan.features.includes(feature);
    } catch (error: any) {
      logger.error('Failed to check feature access:', error);
      return false;
    }
  }

  /**
   * Get workspace plan
   */
  private async getWorkspacePlan(workspaceId: mongoose.Types.ObjectId): Promise<any> {
    const subscription = await Subscription.findOne({ workspaceId }).populate('planId');
    if (!subscription) {
      return Plan.findOne({ name: 'free' });
    }
    return subscription.planId;
  }

  /**
   * Get all limits for workspace
   */
  async getLimits(workspaceId: mongoose.Types.ObjectId): Promise<{
    posts: { current: number; limit: number; percentage: number };
    channels: { current: number; limit: number; percentage: number };
    teamMembers: { current: number; limit: number; percentage: number };
    mediaStorage: { current: number; limit: number; percentage: number };
  }> {
    const { limits } = await usageService.checkLimits(workspaceId);

    return {
      posts: {
        current: limits.postsPerMonth.current,
        limit: limits.postsPerMonth.limit,
        percentage: (limits.postsPerMonth.current / limits.postsPerMonth.limit) * 100,
      },
      channels: {
        current: limits.channels.current,
        limit: limits.channels.limit,
        percentage: (limits.channels.current / limits.channels.limit) * 100,
      },
      teamMembers: {
        current: limits.teamMembers.current,
        limit: limits.teamMembers.limit,
        percentage: (limits.teamMembers.current / limits.teamMembers.limit) * 100,
      },
      mediaStorage: {
        current: limits.mediaStorage.current,
        limit: limits.mediaStorage.limit,
        percentage: (limits.mediaStorage.current / limits.mediaStorage.limit) * 100,
      },
    };
  }
}

export const limitEnforcementService = new LimitEnforcementService();
