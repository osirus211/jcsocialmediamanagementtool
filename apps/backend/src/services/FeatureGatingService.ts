/**
 * Feature Gating Service
 * 
 * Controls access to features based on subscription plan
 */

import mongoose from 'mongoose';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { logger } from '../utils/logger';

// Feature flags
export enum Feature {
  // Analytics features
  BASIC_ANALYTICS = 'Basic analytics',
  ADVANCED_ANALYTICS = 'Advanced analytics',
  EXPORT_ANALYTICS = 'Export analytics',
  
  // Collaboration features
  TEAM_COLLABORATION = 'Team collaboration',
  APPROVAL_WORKFLOW = 'Approval workflow',
  
  // Integration features
  API_ACCESS = 'API access',
  WEBHOOK_INTEGRATION = 'Webhook integration',
  
  // Support features
  PRIORITY_SUPPORT = 'Priority support',
  DEDICATED_SUPPORT = 'Dedicated support',
  
  // Advanced features
  WHITE_LABEL = 'White-label options',
  CUSTOM_BRANDING = 'Custom branding',
  BULK_SCHEDULING = 'Bulk scheduling',
  CONTENT_CALENDAR = 'Content calendar',
}

export class FeatureGatingService {
  /**
   * Check if workspace has access to a feature
   */
  async hasAccess(
    workspaceId: mongoose.Types.ObjectId,
    feature: Feature
  ): Promise<boolean> {
    try {
      const plan = await this.getWorkspacePlan(workspaceId);
      if (!plan) {
        logger.warn(`No plan found for workspace ${workspaceId}`);
        return false;
      }

      return plan.features.includes(feature);
    } catch (error: any) {
      logger.error('Failed to check feature access:', error);
      return false;
    }
  }

  /**
   * Check multiple features at once
   */
  async hasAccessToFeatures(
    workspaceId: mongoose.Types.ObjectId,
    features: Feature[]
  ): Promise<Record<Feature, boolean>> {
    const plan = await this.getWorkspacePlan(workspaceId);
    if (!plan) {
      return features.reduce((acc, feature) => {
        acc[feature] = false;
        return acc;
      }, {} as Record<Feature, boolean>);
    }

    return features.reduce((acc, feature) => {
      acc[feature] = plan.features.includes(feature);
      return acc;
    }, {} as Record<Feature, boolean>);
  }

  /**
   * Get all available features for workspace
   */
  async getAvailableFeatures(workspaceId: mongoose.Types.ObjectId): Promise<string[]> {
    const plan = await this.getWorkspacePlan(workspaceId);
    if (!plan) {
      return [];
    }
    return plan.features;
  }

  /**
   * Check if workspace can use analytics
   */
  async canUseAnalytics(workspaceId: mongoose.Types.ObjectId): Promise<{
    basic: boolean;
    advanced: boolean;
    export: boolean;
  }> {
    const plan = await this.getWorkspacePlan(workspaceId);
    if (!plan) {
      return { basic: false, advanced: false, export: false };
    }

    return {
      basic: plan.features.includes(Feature.BASIC_ANALYTICS),
      advanced: plan.features.includes(Feature.ADVANCED_ANALYTICS),
      export: plan.features.includes(Feature.EXPORT_ANALYTICS),
    };
  }

  /**
   * Check if workspace can use team collaboration
   */
  async canUseTeamCollaboration(workspaceId: mongoose.Types.ObjectId): Promise<boolean> {
    return this.hasAccess(workspaceId, Feature.TEAM_COLLABORATION);
  }

  /**
   * Check if workspace can use approval workflow
   */
  async canUseApprovalWorkflow(workspaceId: mongoose.Types.ObjectId): Promise<boolean> {
    return this.hasAccess(workspaceId, Feature.APPROVAL_WORKFLOW);
  }

  /**
   * Check if workspace can use API access
   */
  async canUseApiAccess(workspaceId: mongoose.Types.ObjectId): Promise<boolean> {
    return this.hasAccess(workspaceId, Feature.API_ACCESS);
  }

  /**
   * Require feature access (throws error if not available)
   */
  async requireFeature(
    workspaceId: mongoose.Types.ObjectId,
    feature: Feature
  ): Promise<void> {
    const hasAccess = await this.hasAccess(workspaceId, feature);
    if (!hasAccess) {
      throw new Error(
        `This feature (${feature}) is not available on your current plan. Please upgrade to access this feature.`
      );
    }
  }

  /**
   * Get feature comparison across plans
   */
  async getFeatureComparison(): Promise<{
    plans: Array<{
      name: string;
      displayName: string;
      features: string[];
    }>;
  }> {
    const plans = await Plan.find({ isActive: true }).sort({ priceMonthly: 1 });

    return {
      plans: plans.map((plan) => ({
        name: plan.name,
        displayName: plan.displayName,
        features: plan.features,
      })),
    };
  }

  /**
   * Get workspace plan
   */
  private async getWorkspacePlan(workspaceId: mongoose.Types.ObjectId): Promise<any> {
    const subscription = await Subscription.findOne({ workspaceId }).populate('planId');
    if (!subscription) {
      // Return free plan if no subscription
      return Plan.findOne({ name: 'free' });
    }
    return subscription.planId;
  }

  /**
   * Get plan upgrade suggestions based on missing features
   */
  async getUpgradeSuggestions(
    workspaceId: mongoose.Types.ObjectId,
    desiredFeatures: Feature[]
  ): Promise<{
    currentPlan: string;
    suggestedPlans: Array<{
      name: string;
      displayName: string;
      priceMonthly: number;
      priceYearly: number;
      features: string[];
      missingFeatures: string[];
    }>;
  }> {
    const currentPlan = await this.getWorkspacePlan(workspaceId);
    const allPlans = await Plan.find({ isActive: true }).sort({ priceMonthly: 1 });

    const suggestedPlans = allPlans
      .filter((plan) => {
        // Only suggest plans that have at least one desired feature
        return desiredFeatures.some((feature) => plan.features.includes(feature));
      })
      .map((plan) => {
        const missingFeatures = desiredFeatures.filter(
          (feature) => !plan.features.includes(feature)
        );

        return {
          name: plan.name,
          displayName: plan.displayName,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          features: plan.features,
          missingFeatures,
        };
      })
      .sort((a, b) => a.missingFeatures.length - b.missingFeatures.length);

    return {
      currentPlan: currentPlan?.displayName || 'Free',
      suggestedPlans,
    };
  }
}

export const featureGatingService = new FeatureGatingService();
