/**
 * Billing Store
 * Manages subscription plans, billing, and usage state
 */

import { create } from 'zustand';
import { apiClient } from '../lib/api-client';
import {
  Plan,
  Subscription,
  Usage,
  UsageWithLimits,
  BillingPeriod,
} from '../types/billing.types';

interface BillingState {
  // State
  plans: Plan[];
  currentSubscription: Subscription | null;
  usage: UsageWithLimits | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPlans: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  createCheckout: (planName: string, billingPeriod: BillingPeriod) => Promise<string>;
  upgradePlan: (planName: string, billingPeriod: BillingPeriod) => Promise<void>;
  downgradePlan: (planName: string, billingPeriod: BillingPeriod) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  plans: [],
  currentSubscription: null,
  usage: null,
  isLoading: false,
  error: null,
};

export const useBillingStore = create<BillingState>((set, get) => ({
  ...initialState,

  /**
   * Fetch all available plans
   */
  fetchPlans: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiClient.get('/billing/plans');

      set({
        plans: response.data.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch plans',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Fetch current subscription
   */
  fetchSubscription: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiClient.get('/billing/subscription');

      set({
        currentSubscription: response.data.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch subscription',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Fetch current usage
   */
  fetchUsage: async () => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiClient.get('/billing/usage');

      set({
        usage: response.data.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch usage',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Create Stripe checkout session
   */
  createCheckout: async (planName: string, billingPeriod: BillingPeriod): Promise<string> => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiClient.post('/billing/checkout', {
        planName,
        billingPeriod,
      });

      set({ isLoading: false });

      return response.data.data.checkoutUrl;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create checkout',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Upgrade subscription
   */
  upgradePlan: async (planName: string, billingPeriod: BillingPeriod) => {
    try {
      set({ isLoading: true, error: null });

      await apiClient.post('/billing/upgrade', {
        planName,
        billingPeriod,
      });

      // Refresh subscription and usage
      await get().fetchSubscription();
      await get().fetchUsage();

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to upgrade plan',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Downgrade subscription
   */
  downgradePlan: async (planName: string, billingPeriod: BillingPeriod) => {
    try {
      set({ isLoading: true, error: null });

      await apiClient.post('/billing/downgrade', {
        planName,
        billingPeriod,
      });

      // Refresh subscription
      await get().fetchSubscription();

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to downgrade plan',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Cancel subscription
   */
  cancelSubscription: async () => {
    try {
      set({ isLoading: true, error: null });

      await apiClient.post('/billing/cancel');

      // Refresh subscription
      await get().fetchSubscription();

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to cancel subscription',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Reactivate subscription
   */
  reactivateSubscription: async () => {
    try {
      set({ isLoading: true, error: null });

      await apiClient.post('/billing/reactivate');

      // Refresh subscription
      await get().fetchSubscription();

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to reactivate subscription',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Reset store
   */
  reset: () => {
    set(initialState);
  },
}));
