import { apiClient } from '../lib/api-client';

/**
 * Billing Service
 * API calls for billing, subscription, and usage
 */

export interface BillingStatus {
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  usageSnapshot: {
    postsUsed: number;
    accountsUsed: number;
    aiUsed: number;
  };
}

export interface CurrentUsage {
  current: {
    postsUsed: number;
    accountsUsed: number;
    aiUsed: number;
    storageUsedMB: number;
  };
  periodStart: string;
  periodEnd: string;
}

export interface UsageStats {
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  limits: {
    maxPosts: number;
    maxAccounts: number;
    maxAIRequests: number;
    maxStorageMB: number;
  };
  usage: {
    posts: number;
    accounts: number;
    ai: number;
    storage: number;
  };
  periodStart: string;
  periodEnd: string;
}

export const billingService = {
  /**
   * Get billing status
   */
  async getBillingStatus(): Promise<BillingStatus> {
    return apiClient.get('/billing');
  },

  /**
   * Get current usage
   */
  async getCurrentUsage(): Promise<UsageStats> {
    return apiClient.get('/usage/stats');
  },

  /**
   * Create checkout session
   */
  async createCheckout(priceId: string): Promise<{ url: string }> {
    return apiClient.post('/billing/checkout', { priceId });
  },

  /**
   * Create portal session
   */
  async createPortal(): Promise<{ url: string }> {
    return apiClient.post('/billing/portal');
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<{ success: boolean }> {
    return apiClient.post('/billing/cancel');
  },
};
