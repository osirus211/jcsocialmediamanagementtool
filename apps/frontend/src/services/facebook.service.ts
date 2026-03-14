/**
 * Facebook Service
 * 
 * Handles Facebook OAuth and account management
 */

import { apiClient } from '@/lib/api-client';

export interface FacebookOAuthResponse {
  success: boolean;
  authorizationUrl: string;
  state: string;
  platform: string;
}

export interface FacebookAccount {
  _id: string;
  platform: 'facebook';
  platformUserId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  status: 'active' | 'expired' | 'error';
  lastSyncAt?: string;
  metadata?: {
    pageId?: string;
    pageName?: string;
    category?: string;
    verified?: boolean;
    followerCount?: number;
    fanCount?: number;
    profileImageUrl?: string;
  };
}

export interface FacebookConnectionResult {
  success: boolean;
  accounts: FacebookAccount[];
  message?: string;
  error?: string;
}

class FacebookService {
  /**
   * Initiate Facebook OAuth flow
   */
  async initiateOAuth(): Promise<FacebookOAuthResponse> {
    try {
      const response = await apiClient.get('/api/v1/oauth/facebook/authorize');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to initiate Facebook OAuth');
    }
  }

  /**
   * Get connected Facebook accounts
   */
  async getConnectedAccounts(): Promise<FacebookAccount[]> {
    try {
      const response = await apiClient.get('/api/v1/social-accounts');
      return response.data.accounts.filter((account: any) => account.platform === 'facebook');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch Facebook accounts');
    }
  }

  /**
   * Disconnect Facebook account
   */
  async disconnectAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/api/v1/oauth/facebook/disconnect', {
        accountId,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to disconnect Facebook account');
    }
  }

  /**
   * Refresh Facebook account connection
   */
  async refreshAccount(accountId: string): Promise<FacebookAccount> {
    try {
      const response = await apiClient.post(`/api/v1/social-accounts/${accountId}/refresh`);
      return response.data.account;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to refresh Facebook account');
    }
  }

  /**
   * Get Facebook page insights
   */
  async getPageInsights(
    accountId: string,
    startDate: string,
    endDate: string,
    period: 'day' | 'week' | 'days_28' = 'day'
  ): Promise<any> {
    try {
      const response = await apiClient.get(`/api/v1/analytics/facebook/${accountId}/page`, {
        params: {
          startDate,
          endDate,
          period,
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch Facebook page insights');
    }
  }

  /**
   * Get Facebook post insights
   */
  async getPostInsights(accountId: string, postId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/api/v1/analytics/facebook/${accountId}/post/${postId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch Facebook post insights');
    }
  }

  /**
   * Get Facebook audience insights
   */
  async getAudienceInsights(accountId: string, startDate: string, endDate: string): Promise<any> {
    try {
      const response = await apiClient.get(`/api/v1/analytics/facebook/${accountId}/audience`, {
        params: {
          startDate,
          endDate,
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch Facebook audience insights');
    }
  }

  /**
   * Get user's Facebook groups
   */
  async getUserGroups(accountId: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`/api/v1/facebook/${accountId}/groups`);
      return response.data.groups;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch Facebook groups');
    }
  }

  /**
   * Publish to Facebook group
   */
  async publishToGroup(
    accountId: string,
    groupId: string,
    content: string,
    options?: {
      mediaIds?: string[];
      link?: string;
      scheduledPublishTime?: number;
    }
  ): Promise<{ postId: string; url: string }> {
    try {
      const response = await apiClient.post(`/api/v1/facebook/${accountId}/groups/${groupId}/publish`, {
        content,
        ...options,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to publish to Facebook group');
    }
  }

  /**
   * Check Facebook connection status
   */
  async checkConnectionStatus(accountId: string): Promise<{
    connected: boolean;
    status: string;
    lastChecked: string;
    permissions: string[];
  }> {
    try {
      const response = await apiClient.get(`/api/v1/social-accounts/${accountId}/status`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to check Facebook connection status');
    }
  }
}

export const facebookService = new FacebookService();