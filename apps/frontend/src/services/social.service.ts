import { apiClient } from '../lib/api-client';

/**
 * Social Service
 * API calls for social account management
 */

export interface SocialAccount {
  _id: string;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  platformUserId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  isActive: boolean;
  connectedAt: Date;
}

export const socialService = {
  /**
   * Get all connected social accounts
   */
  async getAccounts(): Promise<SocialAccount[]> {
    const response = await apiClient.get<{ success: boolean; accounts: SocialAccount[]; count: number }>('/social/accounts');
    return response.accounts;
  },

  /**
   * Get OAuth URL for platform
   */
  async getOAuthUrl(platform: string): Promise<{ url: string; testMode: boolean }> {
    const response = await apiClient.post<{ success: boolean; authorizationUrl: string; state: string; platform: string }>(`/oauth/${platform}/authorize`);
    return { url: response.authorizationUrl, testMode: false };
  },

  /**
   * Get available OAuth platforms
   */
  async getOAuthPlatforms(): Promise<{ platforms: string[]; testMode: boolean }> {
    return apiClient.get('/oauth/platforms');
  },

  /**
   * Disconnect social account
   */
  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/social/accounts/${accountId}`);
  },
};
